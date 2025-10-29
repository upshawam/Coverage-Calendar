/* Full index.js — calendar rendering + K Work/Off toggle
   Uses compact JSON from SHEETS_URL: shiftData[yyyy-MM-dd] = [{ person, category }, ...]
   Toggle logic: Kristin entries are filtered by selected mode:
     - work mode: show only Kristin working categories (K-Work, K-Weekend, K-NORA, K-Neuro, etc.)
     - off mode : show only off categories (K-Off, K-PTO/Vacation). PTO is treated as off.
   The toggle is a switch (checkbox) in the header and persists in localStorage.
*/

/* -----------------------------
   Config / Globals
------------------------------ */
const SHEETS_URL = "https://script.google.com/macros/s/AKfycbwUYXXAHy_QK8EgY3SHYPnjERllTJu37XnROzS-H4d0_VqE9_1aMQ6SbzlRt6PsDkTf/exec";

const today = new Date();
let currentYear = today.getFullYear();
let currentMonth = today.getMonth();

const overlay = document.getElementById("loading-overlay");
const titleEl = document.getElementById("title");
let selectedPerson = null; // for tap-to-assign

let kViewMode = localStorage.getItem("kViewMode") || "work";

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
function moveAssignmentInStorage(oldDateKey, newDateKey, person, text = null) {
  const custom = loadCustomAssignments();
  if (!custom[oldDateKey]) return;
  let removed = null;
  if (person === "Note" && text !== null) {
    for (let i = 0; i < custom[oldDateKey].length; i++) {
      const a = custom[oldDateKey][i];
      if (a.person === "Note" && a.text === text) { removed = a; custom[oldDateKey].splice(i, 1); break; }
    }
  } else {
    for (let i = 0; i < custom[oldDateKey].length; i++) {
      const a = custom[oldDateKey][i];
      if (a.person === person) { removed = a; custom[oldDateKey].splice(i, 1); break; }
    }
  }
  if (custom[oldDateKey] && custom[oldDateKey].length === 0) delete custom[oldDateKey];
  if (removed) {
    if (!custom[newDateKey]) custom[newDateKey] = [];
    custom[newDateKey].push(removed);
    saveCustomAssignments(custom);
  } else {
    if (!custom[newDateKey]) custom[newDateKey] = [];
    custom[newDateKey].push({ person, text });
    saveCustomAssignments(custom);
  }
}
function updateNoteText(dateKey, oldText, newText) {
  const custom = loadCustomAssignments();
  if (custom[dateKey]) {
    const note = custom[dateKey].find(a => a.person === "Note" && a.text === oldText);
    if (note) { note.text = newText; saveCustomAssignments(custom); }
  }
}

/* -----------------------------
   Fetch shift JSON
------------------------------ */
async function fetchShiftData() {
  try {
    const res = await fetch(SHEETS_URL + "?ts=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
    const data = await res.json();
    localStorage.setItem("shiftData", JSON.stringify(data || {}));
    return data || {};
  } catch (err) {
    console.error("Error fetching shift data:", err);
    try { return JSON.parse(localStorage.getItem("shiftData") || "{}"); } catch (e) { return {}; }
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
------------------------------ */
function createAssignmentElement(dateKey, person, text = null) {
  const assignment = document.createElement("div");
  assignment.classList.add("assignment", person.toLowerCase());
  assignment.dataset.person = person;
  assignment.dataset.dateKey = dateKey;
  assignment.id = 'assignment-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
  assignment.draggable = true;
  assignment.style.position = assignment.style.position || "relative";
  assignment.style.zIndex = 2;

  assignment.addEventListener('dragstart', e => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'existing', id: assignment.id }));
  });

  if (person === "Note") {
    assignment.classList.add("note-card");
    assignment.contentEditable = "true";
    assignment.textContent = text || "";
    let oldText = assignment.textContent;
    assignment.addEventListener("input", () => {
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
   Calendar rendering (uses compact JSON)
------------------------------ */
function buildCalendar(year, month, shiftData) {
  const calendarEl = document.getElementById("calendar");
  const weekdayRow = document.getElementById("weekday-row");

  calendarEl.innerHTML = "";
  weekdayRow.innerHTML = "";

  const monthName = new Date(year, month).toLocaleString("default", { month: "long" });
  titleEl.textContent = `${monthName} ${year}`;

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
    const num = document.createElement("div");
    num.className = "day-number";
    num.textContent = dayNum;
    cell.appendChild(num);

    const prevDate = new Date(year, month - 1, dayNum);
    const prevDateKey = formatDateKey(prevDate);
    cell.dataset.date = prevDateKey;
    cellMap.set(prevDateKey, cell);
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

    const dateKey = formatDateKey(date);
    cell.dataset.date = dateKey;
    cellMap.set(dateKey, cell);

    const shifts = shiftData[dateKey] || [];
    const kristinEntries = shifts.filter(s => s.person && s.person.toLowerCase() === "kristin");
    const otherEntries = shifts.filter(s => !(s.person && s.person.toLowerCase() === "kristin"));

    let shiftContainer = null;
    if (otherEntries.length > 0 || kristinEntries.length > 0) {
      shiftContainer = document.createElement("div");
      shiftContainer.className = "shift-container";

      // render others
      otherEntries.forEach(s => {
        const label = document.createElement("div");
        label.className = "shift-label";
        label.textContent = s.category || "";
        shiftContainer.appendChild(label);
      });

      // Kristin: filter by kViewMode
      if (kristinEntries.length > 0) {
        if (kViewMode === "work") {
          // only show working categories
          kristinEntries.forEach(e => {
            if (isKristinWorkingCategory(e.category)) {
              const label = document.createElement("div");
              label.className = "shift-label k-shift";
              label.textContent = e.category || "";
              shiftContainer.appendChild(label);
            }
          });
        } else { // off mode
          // only show off/PT0 categories
          kristinEntries.forEach(e => {
            if (isKristinOffCategory(e.category) || isKristinPTOCategory(e.category)) {
              const label = document.createElement("div");
              label.className = "shift-label k-off";
              label.textContent = e.category || "K-Off";
              shiftContainer.appendChild(label);
            }
          });
        }
      } else {
        // nothing for Kristin on this date (we do not infer)
      }

      cell.appendChild(shiftContainer);
    }

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
    const num = document.createElement("div");
    num.className = "day-number";
    num.textContent = d;
    cell.appendChild(num);

    const nextDate = new Date(year, month + 1, d);
    const nextDateKey = formatDateKey(nextDate);
    cell.dataset.date = nextDateKey;
    cellMap.set(nextDateKey, cell);
    calendarEl.appendChild(cell);
  }

  // custom assignments
  const custom = loadCustomAssignments();
  Object.entries(custom).forEach(([dateKey, items]) => {
    const cell = cellMap.get(dateKey);
    if (cell) {
      items.forEach(item => {
        const assignment = createAssignmentElement(dateKey, item.person, item.text);
        assignment.dataset.dateKey = dateKey;
        cell.appendChild(assignment);
      });
    }
  });

  enableInteractions("ontouchstart" in window);
}

/* -----------------------------
   Interactions (delegated, single init)
------------------------------ */
let _interactionsInitialized = false;
function enableInteractions(isTouchDevice) {
  if (_interactionsInitialized) return;
  _interactionsInitialized = true;

  const tray = document.getElementById('tray');
  const calendarEl = document.getElementById('calendar');

  document.addEventListener('dragstart', e => {
    const el = e.target;
    if (!el.classList || !el.classList.contains('assignment')) return;
    const inTray = !!el.closest('#tray');
    if (inTray) {
      e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'tray', person: el.dataset.person }));
    } else {
      e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'existing', id: el.id }));
    }
  });

  calendarEl.addEventListener('dragover', e => { if (e.target.closest('.day')) e.preventDefault(); });

  calendarEl.addEventListener('drop', e => {
    e.preventDefault();
    const day = e.target.closest('.day');
    if (!day) return;

    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    let payload;
    try { payload = JSON.parse(raw); } catch (err) { payload = { type: 'tray', person: raw }; }

    if (payload.type === 'tray') {
      addAssignment(day, payload.person);
      return;
    }
    if (payload.type === 'existing') {
      const el = document.getElementById(payload.id);
      if (!el) return;
      const oldDay = el.closest('.day');
      if (!oldDay || oldDay === day) return;

      const oldDateKey = oldDay.dataset.date || formatDateKey(new Date(currentYear, currentMonth, parseInt(oldDay.querySelector(".day-number").textContent, 10)));
      const newDateKey = day.dataset.date || formatDateKey(new Date(currentYear, currentMonth, parseInt(day.querySelector(".day-number").textContent, 10)));

      day.appendChild(el);
      el.dataset.dateKey = newDateKey;

      const person = el.classList.contains("note-card") ? "Note" : el.textContent;
      const text = el.classList.contains("note-card") ? el.textContent : null;

      moveAssignmentInStorage(oldDateKey, newDateKey, person, text);
    }
  });

  tray.addEventListener('click', e => {
    const card = e.target.closest('.assignment');
    if (!card) return;
    selectedPerson = card.dataset.person;
    tray.querySelectorAll('.assignment').forEach(c => c.classList.toggle('active', c === card));
  });

  calendarEl.addEventListener('click', e => {
    const day = e.target.closest('.day');
    if (!day) return;
    if (!selectedPerson) return;
    addAssignment(day, selectedPerson);
  });

  calendarEl.addEventListener('dblclick', e => {
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

  let lastTap = 0;
  let longPressTimer = null;

  calendarEl.addEventListener('touchstart', e => {
    const assignmentEl = e.target.closest('.assignment');
    if (!assignmentEl) return;
    const day = assignmentEl.closest('.day');
    if (!day) return;

    if (assignmentEl.classList.contains('note-card')) {
      longPressTimer = setTimeout(() => {
        const dateKey = day.dataset.date || formatDateKey(new Date(currentYear, currentMonth, parseInt(day.querySelector(".day-number").textContent, 10)));
        const text = assignmentEl.textContent;
        assignmentEl.remove();
        removeAssignmentFromStorage(dateKey, "Note", text);
      }, 600);
    }

    const now = Date.now();
    if (now - lastTap < 300) {
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
      lastTap = 0;
      const dateKey = day.dataset.date || formatDateKey(new Date(currentYear, currentMonth, parseInt(day.querySelector(".day-number").textContent, 10)));
      const person = assignmentEl.classList.contains("note-card") ? "Note" : assignmentEl.textContent;
      const text = assignmentEl.classList.contains("note-card") ? assignmentEl.textContent : null;
      assignmentEl.remove();
      removeAssignmentFromStorage(dateKey, person, text);
      e.preventDefault();
    } else {
      lastTap = now;
    }
  }, { passive: true });

  calendarEl.addEventListener('touchend', () => { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } });
}

/* -----------------------------
   Add / remove assignment helpers
------------------------------ */
function addAssignment(day, person) {
  const dateKey = day.dataset.date || formatDateKey(new Date(currentYear, currentMonth, parseInt(day.querySelector(".day-number").textContent, 10)));
  const existing = day.querySelector(`.assignment.${person.toLowerCase()}`);
  if (existing) {
    existing.remove();
    removeAssignmentFromStorage(dateKey, person, existing.textContent);
    return;
  }
  const assignment = createAssignmentElement(dateKey, person);
  assignment.dataset.dateKey = dateKey;
  day.appendChild(assignment);
  addAssignmentToStorage(dateKey, person, assignment.textContent);
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
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  const printBtn = document.getElementById("print");
  const kCheckbox = document.getElementById("k-toggle-checkbox");
  const kLabel = document.getElementById("k-toggle-label");

  if (prevBtn) prevBtn.addEventListener("click", goToPrev);
  if (nextBtn) nextBtn.addEventListener("click", goToNext);
  if (printBtn) printBtn.addEventListener("click", () => window.print());

  // initialize K toggle checkbox from localStorage
  if (kCheckbox) {
    kCheckbox.checked = (localStorage.getItem("kViewMode") === "off");
    setKToggleFromCheckbox();
    kCheckbox.addEventListener("change", () => {
      setKToggleFromCheckbox();
      // rebuild using cached shift data
      const data = JSON.parse(localStorage.getItem("shiftData") || "{}");
      buildCalendar(currentYear, currentMonth, data);
    });
  }

  if (kLabel) {
    // ensure label reflects state
    kLabel.textContent = (kCheckbox && kCheckbox.checked) ? "K: Off" : "K: Work";
  }

  if (overlay) overlay.style.display = "block";
  try {
    const data = await fetchShiftData();
    buildCalendar(currentYear, currentMonth, data || {});
  } catch (err) {
    console.error("Initialization error:", err);
    buildCalendar(currentYear, currentMonth, JSON.parse(localStorage.getItem("shiftData") || "{}"));
  } finally {
    if (overlay) overlay.style.display = "none";
  }
});
