/* -----------------------------
   Constants / Globals
------------------------------ */

const today = new Date();
let currentYear = today.getFullYear();
let currentMonth = today.getMonth();

const overlay = document.getElementById("loading-overlay");
const titleEl = document.getElementById("title");
let selectedPerson = null;

// Guard to prevent duplicate event listener initialization
let _interactionsInitialized = false;

/* -----------------------------
   Persistence Helpers
------------------------------ */
function loadCustomAssignments() {
  return JSON.parse(localStorage.getItem("customAssignments") || "{}");
}
function saveCustomAssignments(assignments) {
  localStorage.setItem("customAssignments", JSON.stringify(assignments));
}
function addAssignmentToStorage(dateKey, person, text = null) {
  const custom = loadCustomAssignments();
  if (!custom[dateKey]) custom[dateKey] = [];
  custom[dateKey].push({ person, text });
  saveCustomAssignments(custom);
}
function updateNoteText(dateKey, oldText, newText) {
  const custom = loadCustomAssignments();
  if (custom[dateKey]) {
    const note = custom[dateKey].find(a => a.person === "Note" && a.text === oldText);
    if (note) {
      note.text = newText;
      saveCustomAssignments(custom);
    }
  }
}

/* -----------------------------
   Data Fetching
------------------------------ */
const SHEETS_URL = "https://script.google.com/macros/s/AKfycbwUYXXAHy_QK8EgY3SHYPnjERllTJu37XnROzS-H4d0_VqE9_1aMQ6SbzlRt6PsDkTf/exec";

async function fetchShiftData() {
  try {
    const res = await fetch(SHEETS_URL + "?ts=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log("Fetched shift data:", data);
    return data;
  } catch (err) {
    console.error("Error fetching data:", err);
    return {};
  }
}

/* -----------------------------
   Utils
------------------------------ */
function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function getWeekday(year, month, day) {
  return new Date(year, month, day).getDay();
}
function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* -----------------------------
   Data Loading / Build Calendar
------------------------------ */
async function loadShiftsAndBuild(year, month) {
  const data = await fetchShiftData();
  buildCalendar(year, month, data);
}

/* -----------------------------
   Holiday Helpers
------------------------------ */
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
   Calendar Rendering
------------------------------ */
function buildCalendar(year, month, shiftData) {
  const calendarEl = document.getElementById("calendar");
  const weekdayRow = document.getElementById("weekday-row");

  // Clear old content
  calendarEl.innerHTML = "";
  weekdayRow.innerHTML = "";

  // Title
  const monthName = new Date(year, month).toLocaleString("default", { month: "long" });
  titleEl.textContent = `${monthName} ${year}`;

  // Weekday headers
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

  // Fill previous month days
  for (let i = 0; i < firstDay; i++) {
    const dayNum = daysInPrevMonth - firstDay + 1 + i;
    const cell = document.createElement("div");
    cell.className = "day other-month";

    const num = document.createElement("div");
    num.className = "day-number";
    num.textContent = dayNum;
    cell.appendChild(num);

    // store the actual date represented by this cell and map it
    const prevDate = new Date(year, month - 1, dayNum);
    const prevDateKey = formatDateKey(prevDate);
    cell.dataset.date = prevDateKey;
    cellMap.set(prevDateKey, cell);

    calendarEl.appendChild(cell);
  }

  // Fill current month days
  for (let day = 1; day <= numDays; day++) {
    const cell = document.createElement("div");
    cell.className = "day";

    const date = new Date(year, month, day);
    if (date.getDay() === 0 || date.getDay() === 6) cell.classList.add("weekend");

    const num = document.createElement("div");
    num.className = "day-number";
    num.textContent = day;
    cell.appendChild(num);

    const dateKey = formatDateKey(date);
    // store the actual date for this cell (used when assigning/removing)
    cell.dataset.date = dateKey;
    cellMap.set(dateKey, cell);

    // Shifts
    const shifts = shiftData[dateKey];
    if (shifts) {
      const shiftContainer = document.createElement("div");
      shiftContainer.className = "shift-container";
      shifts.forEach(shift => {
        const label = document.createElement("div");
        label.className = "shift-label";
        label.textContent = shift.label;
        shiftContainer.appendChild(label);
      });
      cell.appendChild(shiftContainer);
    }

    // Holidays
    if (holidays[dateKey]) {
      const holidayEl = document.createElement("div");
      holidayEl.className = "holiday-label";
      holidayEl.textContent = holidays[dateKey];
      cell.appendChild(holidayEl);
    }

    calendarEl.appendChild(cell);
  }

  // Fill next month days to complete the grid
  const totalCells = firstDay + numDays;
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    const cell = document.createElement("div");
    cell.className = "day other-month";

    const num = document.createElement("div");
    num.className = "day-number";
    num.textContent = d;
    cell.appendChild(num);

    // store the actual date represented by this cell and map it
    const nextDate = new Date(year, month + 1, d);
    const nextDateKey = formatDateKey(nextDate);
    cell.dataset.date = nextDateKey;
    cellMap.set(nextDateKey, cell);

    calendarEl.appendChild(cell);
  }

  // Reapply saved custom assignments
  const custom = loadCustomAssignments();
  Object.entries(custom).forEach(([dateKey, items]) => {
    const cell = cellMap.get(dateKey);
    if (cell) {
      items.forEach(item => {
        const assignment = createAssignmentElement(dateKey, item.person, item.text);
        // ensure dataset dateKey set on the element
        assignment.dataset.dateKey = dateKey;
        cell.appendChild(assignment);
      });
    }
  });

  // Initialize interactions only once
  if (!_interactionsInitialized) {
    initializeInteractions();
    _interactionsInitialized = true;
  }
}

/* -----------------------------
   Assignment Element Factory
------------------------------ */
function createAssignmentElement(dateKey, person, text = null) {
  const assignment = document.createElement("div");
  assignment.classList.add("assignment", person.toLowerCase());

  // metadata for drag/drop & persistence
  assignment.dataset.person = person;
  assignment.dataset.dateKey = dateKey;
  assignment.id = 'assignment-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
  assignment.draggable = true;

  // Note: dragstart is handled by delegated event listener in initializeDesktopInteractions

  if (person === "Note") {
    assignment.classList.add("note-card");
    assignment.contentEditable = "true";
    assignment.textContent = text || "";
    let oldText = assignment.textContent;
    assignment.addEventListener("input", () => {
      // use dataset.dateKey so edits after moving persist correctly
      updateNoteText(assignment.dataset.dateKey, oldText, assignment.textContent);
      oldText = assignment.textContent;
    });
  } else {
    assignment.textContent = person;
  }
  return assignment;
}

/* -----------------------------
   Interactions - Delegated Event Handlers
------------------------------ */
function initializeInteractions() {
  const isTouchDevice = "ontouchstart" in window;

  if (isTouchDevice) {
    initializeTouchInteractions();
  } else {
    initializeDesktopInteractions();
  }
}

function initializeDesktopInteractions() {
  // Delegated dragstart for tray cards
  document.getElementById('tray').addEventListener('dragstart', e => {
    if (e.target.classList.contains('assignment')) {
      e.dataTransfer.setData('text/plain', JSON.stringify({ 
        type: 'tray', 
        person: e.target.dataset.person 
      }));
    }
  });

  // Delegated dragstart for existing assignments in calendar
  document.getElementById('calendar').addEventListener('dragstart', e => {
    if (e.target.classList.contains('assignment') && e.target.id) {
      e.dataTransfer.setData('text/plain', JSON.stringify({ 
        type: 'existing', 
        id: e.target.id 
      }));
    }
  });

  // Delegated dragover and drop for calendar days
  const calendar = document.getElementById('calendar');
  calendar.addEventListener('dragover', e => {
    if (e.target.closest('.day')) {
      e.preventDefault();
    }
  });

  calendar.addEventListener('drop', e => {
    const day = e.target.closest('.day');
    if (!day) return;

    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (err) {
      // fallback to old plain-person payload
      payload = { type: 'tray', person: raw };
    }

    if (payload.type === 'tray') {
      addAssignment(day, payload.person);
      return;
    }

    if (payload.type === 'existing') {
      const el = document.getElementById(payload.id);
      if (!el) return;

      const oldDay = el.closest('.day');
      if (!oldDay) return;
      if (oldDay === day) return;

      // prefer stored data-date on cells so other-month cells keep correct date
      const oldDateKey = oldDay.dataset.date || formatDateKey(
        new Date(currentYear, currentMonth, parseInt(oldDay.querySelector(".day-number").textContent, 10))
      );
      const newDateKey = day.dataset.date || formatDateKey(
        new Date(currentYear, currentMonth, parseInt(day.querySelector(".day-number").textContent, 10))
      );

      // move DOM node and update its stored dateKey
      day.appendChild(el);
      el.dataset.dateKey = newDateKey;

      // determine person/text for persistence
      const person = el.classList.contains("note-card") ? "Note" : el.textContent;
      const text = el.classList.contains("note-card") ? el.textContent : null;

      moveAssignmentInStorage(oldDateKey, newDateKey, person, text);
    }
  });

  // Delegated double-click removal for desktop
  calendar.addEventListener('dblclick', e => {
    if (e.target.classList.contains('assignment')) {
      const day = e.target.closest('.day');
      if (!day) return;

      const dateKey = day.dataset.date || formatDateKey(
        new Date(currentYear, currentMonth, parseInt(day.querySelector(".day-number").textContent, 10))
      );
      const person = e.target.classList.contains("note-card") ? "Note" : e.target.textContent;
      const text = e.target.classList.contains("note-card") ? e.target.textContent : null;

      e.target.remove();
      removeAssignmentFromStorage(dateKey, person, text);
    }
  });
}

function initializeTouchInteractions() {
  // Delegated tap-to-select for tray cards
  document.getElementById('tray').addEventListener('click', e => {
    if (e.target.classList.contains('assignment')) {
      selectedPerson = e.target.dataset.person;
      document.querySelectorAll('#tray .assignment').forEach(c => c.classList.remove('active'));
      e.target.classList.add('active');
    }
  });

  // Delegated tap-to-assign for calendar days
  const calendar = document.getElementById('calendar');
  calendar.addEventListener('click', e => {
    const day = e.target.closest('.day');
    if (!day) return;
    if (!selectedPerson) return;
    // Don't assign if clicking on an assignment itself
    if (e.target.classList.contains('assignment')) return;
    
    addAssignment(day, selectedPerson);
  });

  // Touch double-tap removal for any assignment
  let lastTapTime = 0;
  let lastTapTarget = null;
  let doubleTapDetected = false;

  calendar.addEventListener('touchend', e => {
    const target = e.target;
    if (!target.classList.contains('assignment')) return;

    const now = Date.now();
    const timeSinceLastTap = now - lastTapTime;

    if (timeSinceLastTap < 300 && target === lastTapTarget) {
      // Double-tap detected - remove assignment
      e.preventDefault();
      doubleTapDetected = true;
      
      const day = target.closest('.day');
      if (!day) return;

      const dateKey = day.dataset.date || formatDateKey(
        new Date(currentYear, currentMonth, parseInt(day.querySelector(".day-number").textContent, 10))
      );
      const person = target.classList.contains("note-card") ? "Note" : target.textContent;
      const text = target.classList.contains("note-card") ? target.textContent : null;

      target.remove();
      removeAssignmentFromStorage(dateKey, person, text);

      lastTapTime = 0;
      lastTapTarget = null;
      
      // Clear double-tap flag after a short delay
      setTimeout(() => { doubleTapDetected = false; }, 100);
    } else {
      lastTapTime = now;
      lastTapTarget = target;
      doubleTapDetected = false;
    }
  });

  // Long-press removal for note-cards (optional feature preserved)
  let longPressTimer = null;
  let longPressTarget = null;

  calendar.addEventListener('touchstart', e => {
    const target = e.target;
    if (!target.classList.contains('note-card')) return;
    
    // Don't start long-press if double-tap was just detected
    if (doubleTapDetected) return;

    longPressTarget = target;
    longPressTimer = setTimeout(() => {
      const day = target.closest('.day');
      if (!day) return;

      const dateKey = day.dataset.date || formatDateKey(
        new Date(currentYear, currentMonth, parseInt(day.querySelector(".day-number").textContent, 10))
      );
      const text = target.textContent;

      target.remove();
      removeAssignmentFromStorage(dateKey, "Note", text);
      longPressTimer = null;
      longPressTarget = null;
    }, 600);
  });

  calendar.addEventListener('touchend', e => {
    if (longPressTimer && e.target === longPressTarget) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
      longPressTarget = null;
    }
  });

  calendar.addEventListener('touchmove', e => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
      longPressTarget = null;
    }
  });
}

// Shared helper for adding assignments
function addAssignment(day, person) {
  // Prefer the cell's data-date attribute (correct for other-month filler cells)
  const dateKey = day.dataset.date || formatDateKey(
    new Date(currentYear, currentMonth, parseInt(day.querySelector(".day-number").textContent, 10))
  );

  // Toggle: if already present, remove it
  const existing = day.querySelector(`.assignment.${person.toLowerCase()}`);
  if (existing) {
    existing.remove();
    removeAssignmentFromStorage(dateKey, person, existing.textContent);
    return;
  }

  const assignment = createAssignmentElement(dateKey, person);
  // ensure dataset dateKey is correct
  assignment.dataset.dateKey = dateKey;
  day.appendChild(assignment);
  addAssignmentToStorage(dateKey, person, assignment.textContent);
}

/* -----------------------------
   Persistence Removal Helper
------------------------------ */
function removeAssignmentFromStorage(dateKey, person, text = null) {
  const custom = loadCustomAssignments();
  if (!custom[dateKey]) return;

  if (person === "Note" && text !== null) {
    custom[dateKey] = custom[dateKey].filter(a => !(a.person === "Note" && a.text === text));
  } else {
    custom[dateKey] = custom[dateKey].filter(a => a.person !== person);
  }

  if (custom[dateKey].length === 0) {
    delete custom[dateKey];
  }
  saveCustomAssignments(custom);
}

/* -----------------------------
   Move persisted assignment helper
------------------------------ */
function moveAssignmentInStorage(oldDateKey, newDateKey, person, text = null) {
  const custom = loadCustomAssignments();
  if (!custom[oldDateKey]) return;

  let removed = null;

  if (person === "Note" && text !== null) {
    for (let i = 0; i < custom[oldDateKey].length; i++) {
      const a = custom[oldDateKey][i];
      if (a.person === "Note" && a.text === text) {
        removed = a;
        custom[oldDateKey].splice(i, 1);
        break;
      }
    }
  } else {
    for (let i = 0; i < custom[oldDateKey].length; i++) {
      const a = custom[oldDateKey][i];
      if (a.person === person) {
        removed = a;
        custom[oldDateKey].splice(i, 1);
        break;
      }
    }
  }

  if (custom[oldDateKey] && custom[oldDateKey].length === 0) {
    delete custom[oldDateKey];
  }

  if (removed) {
    if (!custom[newDateKey]) custom[newDateKey] = [];
    custom[newDateKey].push(removed);
    saveCustomAssignments(custom);
  } else {
    // fallback: create an entry on new date if persisted item not found
    if (!custom[newDateKey]) custom[newDateKey] = [];
    custom[newDateKey].push({ person, text });
    saveCustomAssignments(custom);
  }
}

/* -----------------------------
   Navigation + Print
------------------------------ */
document.getElementById("prev").addEventListener("click", () => {
  currentMonth--;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  buildCalendar(currentYear, currentMonth, JSON.parse(localStorage.getItem("shiftData") || "{}"));
});

document.getElementById("next").addEventListener("click", () => {
  currentMonth++;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  buildCalendar(currentYear, currentMonth, JSON.parse(localStorage.getItem("shiftData") || "{}"));
});

document.getElementById("print").addEventListener("click", () => {
  window.print();
});

/* ========================================================================== */
/*                               Initialization                               */
/* ========================================================================== */
document.addEventListener("DOMContentLoaded", async () => {
  overlay.style.display = "block";

  try {
    // Fetch fresh shift data
    const data = await fetchShiftData();

    if (data && Object.keys(data).length > 0) {
      // Save to localStorage for navigation buttons
      localStorage.setItem("shiftData", JSON.stringify(data));

      // Build the calendar immediately with real data
      buildCalendar(currentYear, currentMonth, data);
    } else {
      // Fallback if no data returned
      buildCalendar(currentYear, currentMonth, {});
    }
  } catch (err) {
    console.error("Error during initialization:", err);
    buildCalendar(currentYear, currentMonth, {});
  } finally {
    overlay.style.display = "none";
  }
});
