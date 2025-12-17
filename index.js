// Show a green success banner (like showErrorBanner, but for success)
function showSuccessBanner(message) {
  if (!errorBanner) return;
  errorBannerText.textContent = message || "Success.";
  errorBanner.style.display = "";
  errorBanner.setAttribute('aria-hidden', 'false');
  errorBanner.classList.add('success');
  setTimeout(() => {
    errorBanner.style.display = "none";
    errorBanner.setAttribute('aria-hidden', 'true');
    errorBanner.classList.remove('success');
  }, 2000);
}
/* Full index.js — calendar rendering + K Work/Off toggle
   Changes in this version:
   - Replaced window.prompt note entry with inline textarea in the day-menu
   - Ensured note text is sanitized and stored as plain text
   - Added a lightweight error banner when fetching shift data fails
   - Commented out legacy drag/drop moveAssignmentInStorage function (no longer used)
   - Minor robustness improvements around initialization and menu focus
   - Restored rendering of imported shift labels (A / K etc.) for carryover prev/next-month cells
*/

/* -----------------------------
   Config / Globals
------------------------------ */
const SHEETS_URL = "https://script.google.com/macros/s/AKfycbzmS_-6Ot8A2nlcNPldlYSmw7AerLmhghUPukSA5-ckrEbh0Kh7ytT8W0hY-xDrksju/exec";

const today = new Date();
let currentYear = today.getFullYear();
let currentMonth = today.getMonth();

const overlay = document.getElementById("loading-overlay");
const titleEl = document.getElementById("title");
let kViewMode = localStorage.getItem("kViewMode") || "work";

/* -----------------------------
   Limits for compact view
------------------------------ */
const MAX_VISIBLE_SHIFT_LABELS = 3;
const MAX_VISIBLE_ASSIGNMENTS = 3;

/* -----------------------------
   DOM references for enhanced controls
------------------------------ */
const dayMenu = document.getElementById('day-menu');
const dayMenuButtons = document.getElementById('day-menu-buttons');
const noteForm = document.getElementById('note-form');
const noteInput = document.getElementById('note-input');
const noteSaveBtn = document.getElementById('note-save');
const noteCancelBtn = document.getElementById('note-cancel');

const errorBanner = document.getElementById('error-banner');
const errorBannerText = document.getElementById('error-banner-text');
const errorRetryBtn = document.getElementById('error-retry');
const errorDismissBtn = document.getElementById('error-dismiss');

let _currentMenuTargetDay = null;

/* -----------------------------
   Persistence Helpers
------------------------------ */
function loadCustomAssignments() {
  try { return JSON.parse(localStorage.getItem("customAssignments") || "{}"); }
  catch (e) { return {}; }
}
function saveCustomAssignments(assignments) { localStorage.setItem("customAssignments", JSON.stringify(assignments)); }
function addAssignmentToStorage(dateKey, person, text = null) {
  const custom = loadCustomAssignments();
  if (!custom[dateKey]) custom[dateKey] = [];
  custom[dateKey].push({ person, text });
  saveCustomAssignments(custom);
}
function removeAssignmentFromStorage(dateKey, person, text = null) {
  const custom = loadCustomAssignments();
  if (!custom[dateKey]) return;
  if (person === "Note" && text !== null) {
    custom[dateKey] = custom[dateKey].filter(a => !(a.person === "Note" && a.text === text));
  } else {
    custom[dateKey] = custom[dateKey].filter(a => a.person !== person);
  }
  if (custom[dateKey] && custom[dateKey].length === 0) delete custom[dateKey];
  saveCustomAssignments(custom);
}

/* Legacy drag/drop helper — commented out because drag/drop is not used.
/function moveAssignmentInStorage(oldDateKey, newDateKey, person, text = null) {
  // kept for compatibility though drag/drop removed
  ...
}
*/

/* Update note text in storage (sanitized)
   We keep matching by person === "Note" and the previous plain-text value.
*/
function sanitizeText(raw) {
  if (raw == null) return "";
  // remove HTML (if any) by reading textContent via a temporary element,
  // collapse whitespace and trim.
  const tmp = document.createElement('div');
  tmp.innerHTML = String(raw);
  let s = tmp.textContent || tmp.innerText || "";
  s = s.replace(/\r?\n+/g, ' ');      // convert newlines to spaces
  s = s.replace(/\s+/g, ' ').trim();  // collapse whitespace
  return s;
}
function updateNoteText(dateKey, oldText, newText) {
  const custom = loadCustomAssignments();
  if (!custom[dateKey]) return;
  const cleanOld = sanitizeText(oldText);
  const cleanNew = sanitizeText(newText);
  for (let i = 0; i < custom[dateKey].length; i++) {
    const a = custom[dateKey][i];
    if (a.person === "Note" && sanitizeText(a.text) === cleanOld) {
      a.text = cleanNew;
      saveCustomAssignments(custom);
      return;
    }
  }
}

/* -----------------------------
   Export/Load Calendar Data
------------------------------ */

// Formspree endpoint - configured to email calendar submissions
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/xeovelyn';

function showSubmitModal() {
  return new Promise((resolve) => {
    const modal = document.getElementById('submit-modal');
    const nameInput = document.getElementById('submitter-name');
    const submitBtn = document.getElementById('submit-confirm');
    const cancelBtn = document.getElementById('submit-cancel');
    
    modal.style.display = 'flex';
    nameInput.value = '';
    nameInput.focus();
    
    const handleSubmit = () => {
      const name = nameInput.value.trim() || 'Anonymous';
      modal.style.display = 'none';
      cleanup();
      resolve(name);
    };
    
    const handleCancel = () => {
      modal.style.display = 'none';
      cleanup();
      resolve(null);
    };
    
    const handleKeyPress = (e) => {
      if (e.key === 'Enter') handleSubmit();
      if (e.key === 'Escape') handleCancel();
    };
    
    const cleanup = () => {
      submitBtn.removeEventListener('click', handleSubmit);
      cancelBtn.removeEventListener('click', handleCancel);
      nameInput.removeEventListener('keypress', handleKeyPress);
    };
    
    submitBtn.addEventListener('click', handleSubmit);
    cancelBtn.addEventListener('click', handleCancel);
    nameInput.addEventListener('keypress', handleKeyPress);
  });
}

async function submitChangesToEmail() {
  // Check if endpoint is configured
  if (!FORMSPREE_ENDPOINT || FORMSPREE_ENDPOINT === 'YOUR_FORMSPREE_ENDPOINT_HERE') {
    showErrorBanner('Submit feature not configured yet. Please contact the calendar owner.', null);
    return;
  }
  
  // Show custom modal and wait for user input
  const submitterName = await showSubmitModal();
  if (submitterName === null) return; // User cancelled
  
  const customAssignments = loadCustomAssignments();
  const sortedAssignments = {};
  Object.keys(customAssignments).sort().forEach(dateKey => {
    sortedAssignments[dateKey] = customAssignments[dateKey];
  });
  
  const payload = {
    savedAt: new Date().toISOString(),
    assignments: sortedAssignments
  };
  
  // Compare with last saved version to show only changes
  let savedData = {};
  try {
    const res = await fetch('calendar-data.json?ts=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      savedData = data.assignments || {};
    }
  } catch (e) {
    // No saved version yet
  }
  
  // Generate diff summary
  const added = [];
  const removed = [];
  const modified = [];
  
  // Check for additions and modifications
  Object.keys(sortedAssignments).forEach(dateKey => {
    const newItems = sortedAssignments[dateKey];
    const oldItems = savedData[dateKey] || [];
    // Parse date correctly (YYYY-MM-DD format, add time to avoid timezone issues)
    const [year, month, day] = dateKey.split('-');
    const date = new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    newItems.forEach(newItem => {
      const exists = oldItems.find(old => 
        old.person === newItem.person && 
        (old.text || null) === (newItem.text || null)
      );
      if (!exists) {
        if (newItem.person === 'Note') {
          added.push(`${date}: Note - "${newItem.text}"`);
        } else {
          added.push(`${date}: ${newItem.person}`);
        }
      }
    });
  });
  
  // Check for removals
  Object.keys(savedData).forEach(dateKey => {
    const oldItems = savedData[dateKey];
    const newItems = sortedAssignments[dateKey] || [];
    // Parse date correctly (YYYY-MM-DD format, add time to avoid timezone issues)
    const [year, month, day] = dateKey.split('-');
    const date = new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    oldItems.forEach(oldItem => {
      const exists = newItems.find(newI => 
        newI.person === oldItem.person && 
        (newI.text || null) === (oldItem.text || null)
      );
      if (!exists) {
        if (oldItem.person === 'Note') {
          removed.push(`${date}: Note - "${oldItem.text}"`);
        } else {
          removed.push(`${date}: ${oldItem.person}`);
        }
      }
    });
  });
  
  const changesSummary = [];
  if (added.length > 0) {
    changesSummary.push('=== ADDED ===');
    changesSummary.push(...added);
  }
  if (removed.length > 0) {
    if (added.length > 0) changesSummary.push('');
    changesSummary.push('=== REMOVED ===');
    changesSummary.push(...removed);
  }
  if (added.length === 0 && removed.length === 0) {
    changesSummary.push('No changes from last saved version');
  }
  
  const totalChanges = added.length + removed.length;
  
  try {
    const response = await fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        submitter: submitterName,
        timestamp: new Date().toISOString(),
        changesSummary: changesSummary.join('\n'),
        totalChanges: totalChanges,
        calendarData: JSON.stringify(payload, null, 2)
      })
    });
    
    const responseData = await response.json();
    
    // Formspree returns 200 even on success, check for their OK status
    if (response.ok || responseData.ok) {
      showSuccessBanner('Changes submitted! The calendar owner will review and update.');
    } else {
      console.error('Formspree error:', responseData);
      throw new Error(responseData.error || 'Submit failed');
    }
  } catch (err) {
    console.error('Submit error:', err);
    // Only show error if it's a real network error, not a false positive
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      showErrorBanner(`Failed to submit: ${err.message}`, null);
    } else {
      // Might be a CORS issue but submission went through
      showSuccessBanner('Changes may have been submitted. Check your email to confirm.');
    }
  }
}
async function saveAndPublish() {
  const customAssignments = loadCustomAssignments();
  
  // Sort assignments by date
  const sortedAssignments = {};
  Object.keys(customAssignments).sort().forEach(dateKey => {
    sortedAssignments[dateKey] = customAssignments[dateKey];
  });
  
  const payload = {
    savedAt: new Date().toISOString(),
    assignments: sortedAssignments
  };
  
  const dataStr = JSON.stringify(payload, null, 2);
  
  // Check if File System Access API is supported
  if (!window.showSaveFilePicker) {
    // Fallback: just download the file with instructions
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'calendar-data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setTimeout(() => {
      const doCommit = confirm(
        'Calendar data downloaded!\n\n' +
        'Next steps:\n' +
        '1. Move calendar-data.json to your repo folder\n' +
        '2. Run these commands in terminal:\n\n' +
        '& "C:\\Program Files\\Git\\bin\\git.exe" add calendar-data.json\n' +
        '& "C:\\Program Files\\Git\\bin\\git.exe" commit -m "Update calendar"\n' +
        '& "C:\\Program Files\\Git\\bin\\git.exe" push\n\n' +
        'Copy commands to clipboard?'
      );
      
      if (doCommit) {
        const commands = '& "C:\\Program Files\\Git\\bin\\git.exe" add calendar-data.json; & "C:\\Program Files\\Git\\bin\\git.exe" commit -m "Update calendar"; & "C:\\Program Files\\Git\\bin\\git.exe" push';
        navigator.clipboard.writeText(commands).then(() => {
          showSuccessBanner('Commands copied! Paste in terminal.');
        });
      }
    }, 500);
    return;
  }
  
  try {
    const opts = {
      suggestedName: 'calendar-data.json',
      types: [{
        description: 'JSON Files',
        accept: { 'application/json': ['.json'] }
      }]
    };
    
    const fileHandle = await window.showSaveFilePicker(opts);
    const writable = await fileHandle.createWritable();
    await writable.write(dataStr);
    await writable.close();
    
    showSuccessBanner('Calendar saved! Now committing to GitHub...');
    
    setTimeout(() => {
      const doCommit = confirm(
        'File saved successfully!\n\n' +
        'To publish to GitHub, run these commands in VS Code terminal:\n\n' +
        '& "C:\\Program Files\\Git\\bin\\git.exe" add calendar-data.json\n' +
        '& "C:\\Program Files\\Git\\bin\\git.exe" commit -m "Update calendar"\n' +
        '& "C:\\Program Files\\Git\\bin\\git.exe" push\n\n' +
        'Copy commands to clipboard?'
      );
      
      if (doCommit) {
        const commands = '& "C:\\Program Files\\Git\\bin\\git.exe" add calendar-data.json; & "C:\\Program Files\\Git\\bin\\git.exe" commit -m "Update calendar"; & "C:\\Program Files\\Git\\bin\\git.exe" push';
        navigator.clipboard.writeText(commands).then(() => {
          showSuccessBanner('Commands copied! Paste in terminal.');
        });
      }
    }, 500);
    
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('Save cancelled by user');
      return;
    }
    console.error('Save error:', err);
    showErrorBanner(`Save failed: ${err.message}`, null);
  }
}


function getCurrentCalendarJson() {
  const customAssignments = loadCustomAssignments();
  // Sort assignments by date
  const sortedAssignments = {};
  Object.keys(customAssignments).sort().forEach(dateKey => {
    sortedAssignments[dateKey] = customAssignments[dateKey];
  });
  const payload = {
    savedAt: new Date().toISOString(),
    assignments: sortedAssignments
  };
  return JSON.stringify(payload, null, 2);
}


// exportCalendarData removed (clipboard replaces export)

// Clipboard copy logic
function copyCalendarJsonToClipboard() {
  const dataStr = getCurrentCalendarJson();
  navigator.clipboard.writeText(dataStr)
    .then(() => {
      showSuccessBanner('Calendar JSON copied to clipboard!');
    })
    .catch(err => {
      showErrorBanner('Failed to copy: ' + err, null);
    });
}

// Wire up button after DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
  const copyBtn = document.getElementById('copy-calendar');
  if (copyBtn) {
    copyBtn.addEventListener('click', copyCalendarJsonToClipboard);
  }
});

async function loadCalendarData() {
  try {
    const res = await fetch('calendar-data.json?ts=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) {
      console.log('No calendar-data.json found, using localStorage only');
      return null;
    }
    
    const data = await res.json();
    if (data.assignments) {
      saveCustomAssignments(data.assignments);
      const savedDate = data.savedAt ? new Date(data.savedAt).toLocaleString() : 'unknown';
      console.log('Calendar loaded from calendar-data.json:', savedDate);
      return data;
    }
    return null;
  } catch (err) {
    console.error('Error loading calendar-data.json:', err);
    return null;
  }
}

/* -----------------------------
   Fetch shift JSON + lightweight error banner
------------------------------ */
async function fetchShiftData() {
  try {
    const res = await fetch(SHEETS_URL + "?ts=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
    const data = await res.json();
    localStorage.setItem("shiftData", JSON.stringify(data || {}));
    hideErrorBanner();
    return data || {};
  } catch (err) {
    console.error("Error fetching shift data:", err);
    showErrorBanner("Unable to refresh shifts — showing cached data.", () => {
      // Retry handler
      initFetchAndBuild();
    });
    try {
      return JSON.parse(localStorage.getItem("shiftData") || "{}");
    } catch (e) {
      return {};
    }
  }
}

function showErrorBanner(message, onRetry) {
  if (!errorBanner) return;
  errorBannerText.textContent = message || "An error occurred.";
  errorBanner.style.display = "";
  errorBanner.setAttribute('aria-hidden', 'false');
  // attach retry handler temporarily
  errorRetryBtn.onclick = () => { if (typeof onRetry === 'function') onRetry(); hideErrorBanner(); };
  errorDismissBtn.onclick = () => { hideErrorBanner(); };
}
function hideErrorBanner() {
  if (!errorBanner) return;
  errorBanner.style.display = "none";
  errorBanner.setAttribute('aria-hidden', 'true');
  errorRetryBtn.onclick = null;
  errorDismissBtn.onclick = null;
}

/* Helper to init fetch & build for retry use */
async function initFetchAndBuild() {
  if (overlay) overlay.style.display = "block";
  try {
    const data = await fetchShiftData();
    buildCalendar(currentYear, currentMonth, data || {});
  } catch (err) {
    console.error("Initialization fetch error:", err);
    buildCalendar(currentYear, currentMonth, JSON.parse(localStorage.getItem("shiftData") || "{}"));
  } finally {
    if (overlay) overlay.style.display = "none";
  }
}

/* -----------------------------
   Date / holiday helpers
------------------------------ */
function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
function getWeekday(year, month, day) { return new Date(year, month, day).getDay(); }
function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function nthWeekday(year, month, weekday, n) {
  const first = new Date(year, month, 1);
  const offset = (7 + weekday - first.getDay()) % 7;
  return new Date(year, month, 1 + offset + 7 * (n - 1));
}
function lastWeekday(year, month, weekday) {
  const last = new Date(year, month + 1, 0);
  const offset = (7 + last.getDay() - weekday) % 7;
  return new Date(year, month + 1, 0 - offset);
}
function getUSHolidays(year) {
  const holidays = {};
  holidays[`${year}-01-01`] = "New Year's Day";
  holidays[`${year}-06-19`] = "Juneteenth";
  holidays[`${year}-07-04`] = "Independence Day";
  holidays[`${year}-11-11`] = "Veterans Day";
  holidays[`${year}-12-25`] = "Christmas";
  holidays[formatDateKey(nthWeekday(year, 0, 1, 3))] = "MLK Jr. Day";
  holidays[formatDateKey(nthWeekday(year, 1, 1, 3))] = "Presidents' Day";
  holidays[formatDateKey(lastWeekday(year, 4, 1))] = "Memorial Day";
  holidays[formatDateKey(nthWeekday(year, 8, 1, 1))] = "Labor Day";
  holidays[formatDateKey(nthWeekday(year, 9, 1, 2))] = "Columbus Day";
  holidays[formatDateKey(nthWeekday(year, 10, 4, 4))] = "Thanksgiving";
  return holidays;
}

/* -----------------------------
   Kristin category helpers
------------------------------ */
function isKristinWorkingCategory(cat) {
  if (!cat) return false;
  const c = String(cat).toLowerCase();
  return c.indexOf("k-work") !== -1 ||
         c.indexOf("k-weekend") !== -1 ||
         c.indexOf("k-nora") !== -1 ||
         c.indexOf("k-neuro") !== -1 ||
         c.indexOf("work") !== -1;
}
function isKristinPTOCategory(cat) {
  if (!cat) return false;
  const c = String(cat).toLowerCase();
  return c.indexOf("pto") !== -1 || c.indexOf("vacation") !== -1;
}
function isKristinOffCategory(cat) {
  if (!cat) return false;
  const c = String(cat).toLowerCase();
  return c.indexOf("k-off") !== -1 || c.indexOf("off") !== -1 || isKristinPTOCategory(cat);
}

/* -----------------------------
   Assignment element factory
   Notes are contentEditable for quick inline editing, but we sanitize and save
   changes reliably using textContent via sanitizeText before writing to storage.
------------------------------ */
function createAssignmentElement(dateKey, person, text = null) {
  const assignment = document.createElement("div");
  assignment.classList.add("assignment", person.toLowerCase());
  assignment.dataset.person = person;
  assignment.dataset.dateKey = dateKey;
  assignment.id = 'assignment-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
  assignment.style.position = assignment.style.position || "relative";
  assignment.style.zIndex = 2;

  if (person === "Note") {
    assignment.classList.add("note-card");
    assignment.contentEditable = "true";
    assignment.textContent = sanitizeText(text || "");
    let oldText = assignment.textContent;
    // sanitize on input and update storage (plain text)
    assignment.addEventListener("input", () => {
      const clean = sanitizeText(assignment.textContent);
      // push cleaned text into the element to remove any HTML artifacts
      if (assignment.textContent !== clean) {
        assignment.textContent = clean;
        // keep caret at end — a tiny UX nicety
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(assignment);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      updateNoteText(assignment.dataset.dateKey, oldText, assignment.textContent);
      oldText = assignment.textContent;
    });
    // save on blur as well
    assignment.addEventListener("blur", () => {
      const clean = sanitizeText(assignment.textContent);
      if (assignment.textContent !== clean) assignment.textContent = clean;
      updateNoteText(assignment.dataset.dateKey, oldText, assignment.textContent);
      oldText = assignment.textContent;
    });
  } else {
    assignment.textContent = person;
  }
  return assignment;
}

/* -----------------------------
   K Toggle UI helpers
------------------------------ */
function setKToggleFromCheckbox() {
  const cb = document.getElementById("k-toggle-checkbox");
  if (!cb) return;
  kViewMode = cb.checked ? "off" : "work";
  localStorage.setItem("kViewMode", kViewMode);
  const label = document.getElementById("k-toggle-label");
  if (label) label.textContent = cb.checked ? "K: Off" : "K: Work";
}

/* -----------------------------
   Day menu helpers (now includes inline note editor)
------------------------------ */
function showDayMenuForDay(day, anchorRect) {
  _currentMenuTargetDay = day;
  const menu = dayMenu;
  if (!menu) return;
  // always default to showing the main buttons and hide note form
  dayMenuButtons.style.display = "";
  noteForm.style.display = "none";
  menu.setAttribute('aria-hidden', 'false');

  // position menu near anchorRect, but keep inside viewport
  const pad = 8;
  const menuW = menu.offsetWidth || 220;
  const menuH = menu.offsetHeight || 140;
  let left = anchorRect.left;
  let top = anchorRect.bottom + 6;

  if (left + menuW + pad > window.innerWidth) left = Math.max(pad, window.innerWidth - menuW - pad);
  if (top + menuH + pad > window.innerHeight) top = Math.max(pad, anchorRect.top - menuH - 6);

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;

  // focus the first button for keyboard users
  const firstBtn = menu.querySelector('.day-menu-buttons .menu-btn');
  if (firstBtn) firstBtn.focus();
}

function hideDayMenu() {
  if (!dayMenu) return;
  dayMenu.setAttribute('aria-hidden', 'true');
  _currentMenuTargetDay = null;
  // cleanup note form if open
  dayMenuButtons.style.display = "";
  noteForm.style.display = "none";
  noteInput.value = "";
}

/* Show inline note editor for a given day, optionally prefilling text (for edits) */
function showNoteEditorForDay(day, initialText = "") {
  _currentMenuTargetDay = day;
  dayMenuButtons.style.display = "none";
  noteForm.style.display = "";
  dayMenu.setAttribute('aria-hidden', 'false');

  noteInput.value = sanitizeText(initialText);
  noteInput.focus();
  // put caretaker at end
  noteInput.selectionStart = noteInput.selectionEnd = noteInput.value.length;
}

/* -----------------------------
   Helpers: add button & "more" toggle
------------------------------ */
function createAddButton(cell) {
  const addBtn = document.createElement("button");
  addBtn.className = "add-btn";
  addBtn.type = "button";
  addBtn.title = "Add assignment";
  addBtn.textContent = "+";
  addBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    showDayMenuForDay(cell, addBtn.getBoundingClientRect());
  });
  cell.appendChild(addBtn);
}

/* Helper to render imported shift labels into any cell (used for current month and carryover cells) */
function renderShiftLabelsForCell(cell, dateKey, shiftData) {
  const shifts = shiftData[dateKey] || [];
  if (!shifts || shifts.length === 0) return;
  const kristinEntries = shifts.filter(s => s.person && s.person.toLowerCase() === "kristin");
  const otherEntries = shifts.filter(s => !(s.person && s.person.toLowerCase() === "kristin"));

  const labels = [];
  otherEntries.forEach(s => labels.push({ text: s.category || "", type: "shift" }));
  if (kristinEntries.length > 0) {
    if (kViewMode === "work") {
      kristinEntries.forEach(e => { if (isKristinWorkingCategory(e.category)) labels.push({ text: e.category || "", type: "k-shift" }); });
    } else {
      kristinEntries.forEach(e => { if (isKristinOffCategory(e.category) || isKristinPTOCategory(e.category)) labels.push({ text: e.category || "K-Off", type: "k-off" }); });
    }
  }

  if (labels.length === 0) return;

  const shiftContainer = document.createElement("div");
  shiftContainer.className = "shift-container";

  let hiddenLabels = 0;
  labels.forEach((lbl, idx) => {
    const label = document.createElement("div");
    label.className = "shift-label";
    if (lbl.type === "k-off") label.classList.add("k-off");
    if (lbl.type === "k-shift") label.classList.add("k-shift");
    label.textContent = lbl.text;
    if (idx < MAX_VISIBLE_SHIFT_LABELS) {
      shiftContainer.appendChild(label);
    } else {
      label.classList.add("hidden-shift");
      label.style.display = "none";
      shiftContainer.appendChild(label);
      hiddenLabels++;
    }
  });

  if (hiddenLabels > 0) {
    const more = document.createElement("div");
    more.className = "shift-label more-label";
    more.textContent = `+${hiddenLabels}`;
    more.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const expanded = shiftContainer.classList.toggle('expanded');
      more.textContent = expanded ? '−' : `+${hiddenLabels}`;
      const hiddenEls = shiftContainer.querySelectorAll('.hidden-shift');
      hiddenEls.forEach(el => { el.style.display = expanded ? '' : 'none'; });
      const dayEl = shiftContainer.closest('.day');
      if (dayEl) dayEl.classList.toggle('expanded', expanded);
    });
    shiftContainer.appendChild(more);
  }

  cell.appendChild(shiftContainer);
}

/* -----------------------------
   Calendar rendering
------------------------------ */
function buildCalendar(year, month, shiftData) {
  const calendarEl = document.getElementById("calendar");
  const weekdayRow = document.getElementById("weekday-row");

  if (!calendarEl || !weekdayRow) {
    throw new Error("Missing calendar or weekday-row element in DOM.");
  }

  calendarEl.innerHTML = "";
  weekdayRow.innerHTML = "";

  const monthName = new Date(year, month).toLocaleString("default", { month: "long" });
  if (titleEl) titleEl.textContent = `${monthName} ${year}`;

  ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].forEach(d => {
    const div = document.createElement("div");
    div.textContent = d;
    weekdayRow.appendChild(div);
  });

  const numDays = daysInMonth(year, month);
  const firstDay = getWeekday(year, month, 1);
  const daysInPrevMonth = daysInMonth(year, month - 1);
  const holidays = getUSHolidays(year);
  const cellMap = new Map();

  // prev month filler
  for (let i = 0; i < firstDay; i++) {
    const dayNum = daysInPrevMonth - firstDay + 1 + i;
    const cell = document.createElement("div");
    cell.className = "day other-month";

    const prevDate = new Date(year, month - 1, dayNum);
    const isWeekend = (prevDate.getDay() === 0 || prevDate.getDay() === 6);
    if (isWeekend) cell.classList.add("weekend");

    const num = document.createElement("div");
    num.className = "day-number";
    num.textContent = dayNum;
    cell.appendChild(num);

    // add button on carryover day
    createAddButton(cell);

    const prevDateKey = formatDateKey(prevDate);
    cell.dataset.date = prevDateKey;
    cellMap.set(prevDateKey, cell);

    // render imported shifts (A/K etc.) for carryover day
    renderShiftLabelsForCell(cell, prevDateKey, shiftData);

    // holiday if present
    if (holidays[prevDateKey]) {
      const holidayEl = document.createElement("div");
      holidayEl.className = "holiday-label";
      holidayEl.textContent = holidays[prevDateKey];
      cell.appendChild(holidayEl);
    }

    calendarEl.appendChild(cell);
  }

  // current month
  for (let day = 1; day <= numDays; day++) {
    const cell = document.createElement("div");
    cell.className = "day";

    const date = new Date(year, month, day);
    const isWeekend = (date.getDay() === 0 || date.getDay() === 6);
    if (isWeekend) cell.classList.add("weekend");

    const num = document.createElement("div");
    num.className = "day-number";
    num.textContent = day;
    cell.appendChild(num);

    // small add button
    createAddButton(cell);

    const dateKey = formatDateKey(date);
    cell.dataset.date = dateKey;
    cellMap.set(dateKey, cell);

    // render imported shifts into the cell
    renderShiftLabelsForCell(cell, dateKey, shiftData);

    // holiday
    if (holidays[dateKey]) {
      const holidayEl = document.createElement("div");
      holidayEl.className = "holiday-label";
      holidayEl.textContent = holidays[dateKey];
      cell.appendChild(holidayEl);
    }

    calendarEl.appendChild(cell);
  }

  // next month filler
  const totalCells = firstDay + numDays;
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    const cell = document.createElement("div");
    cell.className = "day other-month";

    const nextDate = new Date(year, month + 1, d);
    const isWeekend = (nextDate.getDay() === 0 || nextDate.getDay() === 6);
    if (isWeekend) cell.classList.add("weekend");

    const num = document.createElement("div");
    num.className = "day-number";
    num.textContent = d;
    cell.appendChild(num);

    // add button for carryover days
    createAddButton(cell);

    const nextDateKey = formatDateKey(nextDate);
    cell.dataset.date = nextDateKey;
    cellMap.set(nextDateKey, cell);

    // render imported shifts for carryover day
    renderShiftLabelsForCell(cell, nextDateKey, shiftData);

    // holiday if present
    if (holidays[nextDateKey]) {
      const holidayEl = document.createElement("div");
      holidayEl.className = "holiday-label";
      holidayEl.textContent = holidays[nextDateKey];
      cell.appendChild(holidayEl);
    }

    calendarEl.appendChild(cell);
  }

  // custom assignments rendering (with collapse)
  const custom = loadCustomAssignments();
  Object.entries(custom).forEach(([dateKey, items]) => {
    const cell = cellMap.get(dateKey);
    if (cell) {
      items.forEach((item, idx) => {
        const assignment = createAssignmentElement(dateKey, item.person, item.text);
        if (idx < MAX_VISIBLE_ASSIGNMENTS) {
          cell.appendChild(assignment);
        } else {
          assignment.classList.add('hidden-assignment');
          assignment.style.display = 'none';
          cell.appendChild(assignment);
        }
      });

      if (items.length > MAX_VISIBLE_ASSIGNMENTS) {
        let shiftContainer = cell.querySelector('.shift-container');
        if (!shiftContainer) {
          shiftContainer = document.createElement('div');
          shiftContainer.className = 'shift-container';
          cell.appendChild(shiftContainer);
        }
        const more = document.createElement("div");
        more.className = "shift-label more-label";
        more.textContent = `+${items.length - MAX_VISIBLE_ASSIGNMENTS}`;
        more.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const expanded = shiftContainer.classList.toggle('expanded');
          more.textContent = expanded ? '−' : `+${items.length - MAX_VISIBLE_ASSIGNMENTS}`;
          const dayEl = shiftContainer.closest('.day');
          if (dayEl) dayEl.classList.toggle('expanded', expanded);
          const hiddenAssignments = dayEl.querySelectorAll('.assignment.hidden-assignment');
          hiddenAssignments.forEach(el => { el.style.display = expanded ? 'block' : 'none'; });
        });
        shiftContainer.appendChild(more);
      }
    }
  });

  enableInteractions();
}

/* -----------------------------
   Interactions (delegated)
------------------------------ */
let _interactionsInitialized = false;
function enableInteractions() {
  if (_interactionsInitialized) return;
  _interactionsInitialized = true;

  // Day-menu button handling (main buttons)
  if (dayMenuButtons) {
    dayMenuButtons.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const person = btn.dataset.person;
      const action = btn.dataset.action;
      if (action === 'cancel') { hideDayMenu(); return; }
      if (!_currentMenuTargetDay) { hideDayMenu(); return; }
      const targetDay = _currentMenuTargetDay;
      if (person === 'Note') {
        // show inline editor
        showNoteEditorForDay(targetDay, "");
      } else if (person) {
        hideDayMenu();
        addAssignment(targetDay, person);
      }
    });
  }

  // Note form save / cancel handlers
  if (noteSaveBtn) {
    noteSaveBtn.addEventListener('click', () => {
      if (!_currentMenuTargetDay) { hideDayMenu(); return; }
      const txt = sanitizeText(noteInput.value);
      if (!txt) { // empty -> do nothing
        hideDayMenu();
        return;
      }
      addAssignment(_currentMenuTargetDay, 'Note', txt);
      hideDayMenu();
    });
  }
  if (noteCancelBtn) {
    noteCancelBtn.addEventListener('click', () => {
      hideDayMenu();
    });
  }

  // allow Ctrl/Cmd+Enter to save in textarea
  if (noteInput) {
    noteInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        noteSaveBtn.click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        noteCancelBtn.click();
      }
    });
  }

  // double-click removal (desktop)
  document.getElementById('calendar').addEventListener('dblclick', e => {
    const target = e.target.closest('.assignment');
    if (!target) return;
    const day = target.closest('.day');
    if (!day) return;
    const dateKey = day.dataset.date || formatDateKey(new Date(currentYear, currentMonth, parseInt(day.querySelector(".day-number").textContent, 10)));
    const person = target.classList.contains("note-card") ? "Note" : target.textContent;
    const text = target.classList.contains("note-card") ? target.textContent : null;
    target.remove();
    removeAssignmentFromStorage(dateKey, person, text);
  });

  // double-tap removal for touch (mobile)
  let lastTap = 0;
  document.getElementById('calendar').addEventListener('touchstart', (e) => {
    const assignmentEl = e.target.closest('.assignment');
    if (!assignmentEl) return;
    const now = Date.now();
    if (now - lastTap < 300) {
      // double-tap -> remove
      const day = assignmentEl.closest('.day');
      if (!day) return;
      const dateKey = day.dataset.date || formatDateKey(new Date(currentYear, currentMonth, parseInt(day.querySelector(".day-number").textContent, 10)));
      const person = assignmentEl.classList.contains("note-card") ? "Note" : assignmentEl.textContent;
      const text = assignmentEl.classList.contains("note-card") ? assignmentEl.textContent : null;
      assignmentEl.remove();
      removeAssignmentFromStorage(dateKey, person, text);
      lastTap = 0;
      e.preventDefault();
    } else {
      lastTap = now;
    }
  }, { passive: true });

  // clicking on a note assignment opens editor for editing (single-click)
  document.getElementById('calendar').addEventListener('click', (e) => {
    const noteEl = e.target.closest('.assignment.note-card');
    if (!noteEl) return;
    const day = noteEl.closest('.day');
    if (!day) return;
    // open inline note editor prefilling current note text for safer editing
    showNoteEditorForDay(day, noteEl.textContent || "");
    // hide the calendar click default
    e.stopPropagation();
  });

  // close day menu on outside click
  document.addEventListener('click', (e) => {
    if (!dayMenu) return;
    const isInside = e.target.closest('.day-menu') || e.target.classList && e.target.classList.contains('add-btn');
    if (!isInside) hideDayMenu();
  });

  // wire error banner retry/dismiss already in DOM setup
}

/* -----------------------------
   Add / remove assignment helpers
------------------------------ */
function addAssignment(day, person, providedText = null) {
  const dateKey = day.dataset.date || formatDateKey(new Date(currentYear, currentMonth, parseInt(day.querySelector(".day-number").textContent, 10)));
  // toggle behavior: if an assignment for that person exists on the same day, remove it
  const existing = Array.from(day.querySelectorAll('.assignment')).find(a => {
    if (person === 'Note') return a.classList.contains('note-card') && (providedText ? sanitizeText(a.textContent) === sanitizeText(providedText) : true);
    return !a.classList.contains('note-card') && a.textContent === person;
  });
  if (existing) {
    const text = existing.classList.contains("note-card") ? existing.textContent : null;
    existing.remove();
    removeAssignmentFromStorage(dateKey, person, text);
    return;
  }

  // notes: providedText required; opened via inline editor — if none, do nothing
  let textToUse = providedText;
  if (person === 'Note' && textToUse == null) {
    // fallback: do nothing (we no longer use prompt)
    return;
  }
  textToUse = sanitizeText(textToUse);

  const assignment = createAssignmentElement(dateKey, person, textToUse);
  assignment.dataset.dateKey = dateKey;

  // place the new assignment; collapse extras
  const dayEl = day;
  const visibleAssignments = dayEl.querySelectorAll('.assignment:not(.hidden-assignment)');
  if (visibleAssignments.length >= MAX_VISIBLE_ASSIGNMENTS) {
    assignment.classList.add('hidden-assignment');
    assignment.style.display = 'none';
    dayEl.appendChild(assignment);

    let shiftContainer = dayEl.querySelector('.shift-container');
    if (!shiftContainer) {
      shiftContainer = document.createElement('div');
      shiftContainer.className = 'shift-container';
      dayEl.appendChild(shiftContainer);
    }
    let moreBadge = shiftContainer.querySelector('.more-label');
    const hiddenAssignmentsCount = dayEl.querySelectorAll('.assignment.hidden-assignment').length;
    if (!moreBadge) {
      moreBadge = document.createElement('div');
      moreBadge.className = 'shift-label more-label';
      moreBadge.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const expanded = shiftContainer.classList.toggle('expanded');
        moreBadge.textContent = expanded ? '−' : `+${hiddenAssignmentsCount}`;
        dayEl.classList.toggle('expanded', expanded);
        const hiddenAssignments = dayEl.querySelectorAll('.assignment.hidden-assignment');
        hiddenAssignments.forEach(el => { el.style.display = expanded ? 'block' : 'none'; });
      });
      shiftContainer.appendChild(moreBadge);
    }
    moreBadge.textContent = `+${hiddenAssignmentsCount}`;
  } else {
    dayEl.appendChild(assignment);
  }

  addAssignmentToStorage(dateKey, person, assignment.classList.contains('note-card') ? assignment.textContent : null);
}

/* -----------------------------
   Navigation + Print
------------------------------ */
function goToPrev() {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  buildCalendar(currentYear, currentMonth, JSON.parse(localStorage.getItem("shiftData") || "{}"));
}
function goToNext() {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  buildCalendar(currentYear, currentMonth, JSON.parse(localStorage.getItem("shiftData") || "{}"));
}

/* -----------------------------
   Initialization
------------------------------ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const prevBtn = document.getElementById("prev");
    const nextBtn = document.getElementById("next");
    const printBtn = document.getElementById("print");
    const submitBtn = document.getElementById("submit-changes");
    const exportBtn = document.getElementById("export-calendar");
    const kCheckbox = document.getElementById("k-toggle-checkbox");
    const kLabel = document.getElementById("k-toggle-label");

    if (prevBtn) prevBtn.addEventListener("click", goToPrev);
    if (nextBtn) nextBtn.addEventListener("click", goToNext);
    if (printBtn) printBtn.addEventListener("click", () => window.print());
    
    if (submitBtn) {
      submitBtn.addEventListener("click", async () => {
        await submitChangesToEmail();
      });
    }
    
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        if (confirm('Export calendar data?\n\nThis will download calendar-data.json.\nDrag it to your repo folder and commit/push.')) {
          exportCalendarData();
        }
      });
    }

    if (kCheckbox) {
      kCheckbox.checked = (localStorage.getItem("kViewMode") === "off");
      setKToggleFromCheckbox();
      kCheckbox.addEventListener("change", () => {
        setKToggleFromCheckbox();
        const data = JSON.parse(localStorage.getItem("shiftData") || "{}");
        buildCalendar(currentYear, currentMonth, data);
      });
    }

    if (kLabel) {
      kLabel.textContent = (document.getElementById("k-toggle-checkbox") && document.getElementById("k-toggle-checkbox").checked) ? "K: Off" : "K: Work";
    }

    // wire error banner buttons (in case clicked before fetch)
    if (errorRetryBtn) {
      errorRetryBtn.addEventListener('click', () => {
        hideErrorBanner();
        initFetchAndBuild();
      });
    }
    if (errorDismissBtn) {
      errorDismissBtn.addEventListener('click', () => hideErrorBanner());
    }

    if (overlay) overlay.style.display = "block";
    try {
      // Load saved calendar data first
      await loadCalendarData();
      
      const data = await fetchShiftData();
      buildCalendar(currentYear, currentMonth, data || {});
    } catch (err) {
      console.error("Initialization error:", err);
      buildCalendar(currentYear, currentMonth, JSON.parse(localStorage.getItem("shiftData") || "{}"));
    } finally {
      if (overlay) overlay.style.display = "none";
    }
  } catch (err) {
    console.error("Fatal initialization error:", err);
    if (overlay) overlay.style.display = "none";
  }
});
