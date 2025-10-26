/* -----------------------------
   Constants / Globals
------------------------------ */

const today = new Date();
let currentYear = today.getFullYear();
let currentMonth = today.getMonth();

const overlay = document.getElementById("loading-overlay");
const titleEl = document.getElementById("title");
let selectedPerson = null;

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
const SHEETS_URL = "https://script.google.com/macros/s/AKfycbzqz3OCakG5SaWsGjUlLTQyGb3uGVYKyQ938SLrXb-i4w_1--pSyKc-h0jgMGHQ1L_Q/exec";

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

    calendarEl.appendChild(cell);
  }

 // Fill current month days
for (let day = 1; day <= numDays; day++) {
  const cell = document.createElement("div");
  cell.className = "day";

  const date = new Date(year, month, day);
  if (date.getDay() === 0 || date.getDay() === 6) {
    cell.classList.add("weekend");
  }

  const num = document.createElement("div");
  num.className = "day-number";
  num.textContent = day;
  cell.appendChild(num);

  const dateKey = formatDateKey(date);
  cellMap.set(dateKey, cell);

  // 🔎 Safe debug log: won't crash if shiftData is undefined
  if (shiftData) {
    console.log("Rendering dateKey:", dateKey, "Shifts:", shiftData[dateKey]);
  } else {
    console.log("Rendering dateKey:", dateKey, "Shifts: shiftData is undefined");
  }

  // Shifts
  const shifts = shiftData && Array.isArray(shiftData[dateKey]) ? shiftData[dateKey] : [];
  if (shifts.length > 0) {
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

  calendarEl.appendChild(cell);
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

    calendarEl.appendChild(cell);
  }

  // Reapply saved custom assignments
  const custom = loadCustomAssignments();
  Object.entries(custom).forEach(([dateKey, items]) => {
    const cell = cellMap.get(dateKey);
    if (cell) {
      items.forEach(item => {
        const assignment = createAssignmentElement(dateKey, item.person, item.text);
        cell.appendChild(assignment);
      });
    }
  });

  enableInteractions("ontouchstart" in window);
}


/* -----------------------------
   Assignment Element Factory
------------------------------ */
function createAssignmentElement(dateKey, person, text = null) {
  const assignment = document.createElement("div");
  assignment.classList.add("assignment", person.toLowerCase());

  if (person === "Note") {
    assignment.classList.add("note-card");
    assignment.contentEditable = "true";
    assignment.textContent = text || "";
    let oldText = assignment.textContent;
    assignment.addEventListener("input", () => {
      updateNoteText(dateKey, oldText, assignment.textContent);
      oldText = assignment.textContent;
    });
  } else {
    assignment.textContent = person;
  }
  return assignment;
}

/* -----------------------------
   Interactions
------------------------------ */
function enableInteractions(isTouchDevice) {
  if (isTouchDevice) {
    enableTapToAssign();
  } else {
    enableDragAndDrop();
    enableDoubleClickRemove();
  }
  enableNoteRemoval();
}

function enableDragAndDrop() {
  const trayCards = document.querySelectorAll('#tray .assignment');
  const days = document.querySelectorAll('.day');

  trayCards.forEach(card => {
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', card.dataset.person);
    });
  });

  days.forEach(day => {
    day.addEventListener('dragover', e => e.preventDefault());
    day.addEventListener('drop', e => {
      e.preventDefault();
      const person = e.dataTransfer.getData('text/plain');
      if (person) addAssignment(day, person);
    });
  });
}

function enableTapToAssign() {
  const trayCards = document.querySelectorAll('#tray .assignment');
  const days = document.querySelectorAll('.day');

  trayCards.forEach(card => {
    card.addEventListener('click', () => {
      selectedPerson = card.dataset.person;
      trayCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });
  });

  days.forEach(day => {
    day.addEventListener('click', () => {
      if (!selectedPerson) return;
      addAssignment(day, selectedPerson);
    });
  });
}

function enableDoubleClickRemove() {
  const days = document.querySelectorAll('.day');
  days.forEach(day => {
    day.addEventListener('dblclick', e => {
      const target = e.target;
      if (target.classList.contains('assignment')) {
        const dateKey = formatDateKey(
          new Date(currentYear, currentMonth, parseInt(day.querySelector(".day-number").textContent, 10))
        );
        const person = target.classList.contains("note-card") ? "Note" : target.textContent;
        const text = target.classList.contains("note-card") ? target.textContent : null;

        target.remove();
        removeAssignmentFromStorage(dateKey, person, text);
      }
    });
  });
}

function enableNoteRemoval() {
  const days = document.querySelectorAll('.day');
  days.forEach(day => {
    day.addEventListener('touchstart', e => {
      const target = e.target;
      if (target.classList.contains('note-card')) {
        const dateKey = formatDateKey(
          new Date(currentYear, currentMonth, parseInt(day.querySelector(".day-number").textContent, 10))
        );
        const text = target.textContent;

        let timer = setTimeout(() => {
          target.remove();
          removeAssignmentFromStorage(dateKey, "Note", text);
        }, 600);

        target.addEventListener('touchend', () => clearTimeout(timer), { once: true });
      }
    });
  });
}

// Shared helper for adding assignments
function addAssignment(day, person) {
  const dateKey = formatDateKey(
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
