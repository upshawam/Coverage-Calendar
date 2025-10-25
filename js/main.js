// main.js
import { buildCalendar as originalBuildCalendar } from './calendar.js';
import { fetchShiftData } from './data.js';
import { formatDateKey } from './utils.js';

const today = new Date();
let currentYear = today.getFullYear();
let currentMonth = today.getMonth();

const overlay = document.getElementById("loading-overlay");
const titleEl = document.getElementById("title");

/* -----------------------------
   Persistence helpers
------------------------------ */
function loadCustomAssignments() {
  return JSON.parse(localStorage.getItem("customAssignments") || "{}");
}

function saveCustomAssignments(assignments) {
  localStorage.setItem("customAssignments", JSON.stringify(assignments));
}

function addAssignment(dateKey, person, text = null) {
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
   Calendar wrapper
------------------------------ */
function buildCalendar(year, month, shiftData) {
  originalBuildCalendar(year, month, shiftData);

  // Update title
  const monthName = new Date(year, month).toLocaleString("default", { month: "long" });
  titleEl.textContent = `${monthName} ${year}`;

  // Reapply saved custom assignments
  const custom = loadCustomAssignments();
  Object.entries(custom).forEach(([dateKey, items]) => {
    const date = new Date(dateKey);
    if (date.getMonth() !== month || date.getFullYear() !== year) return;

    const dayCells = document.querySelectorAll(".calendar .day");
    const dayCell = Array.from(dayCells).find(cell => {
      const numEl = cell.querySelector(".day-number");
      return numEl && parseInt(numEl.textContent, 10) === date.getDate();
    });

    if (dayCell) {
      items.forEach(item => {
        const assignment = createAssignmentElement(dateKey, item.person, item.text);
        dayCell.appendChild(assignment);
      });
    }
  });

  enableDayDropZones();
}

/* -----------------------------
   Assignment element factory
------------------------------ */
function createAssignmentElement(dateKey, person, text = null) {
  const assignment = document.createElement("div");
  assignment.classList.add("assignment");

  if (person === "Nonnie") {
    assignment.classList.add("nonnie");
    assignment.textContent = "Nonnie";
  } else if (person === "Sophia") {
    assignment.classList.add("sophia");
    assignment.textContent = "Sophia";
  } else if (person === "Note") {
    assignment.classList.add("note-card");
    assignment.setAttribute("contenteditable", "true");
    assignment.textContent = text || ""; // leave empty, placeholder shows via CSS

    // Save edits
    let oldText = assignment.textContent;
    assignment.addEventListener("input", () => {
      updateNoteText(dateKey, oldText, assignment.textContent);
      oldText = assignment.textContent;
    });
  }

  return assignment;
}

/* -----------------------------
   Drag-and-drop functionality
------------------------------ */
document.querySelectorAll(".card-container .assignment").forEach(card => {
  card.setAttribute("draggable", "true");

  card.addEventListener("dragstart", e => {
    e.dataTransfer.setData("text/plain", card.dataset.person);
    card.classList.add("active");
  });

  card.addEventListener("dragend", () => {
    card.classList.remove("active");
  });
});

function enableDayDropZones() {
  document.querySelectorAll(".calendar .day").forEach(day => {
    day.addEventListener("dragover", e => e.preventDefault());

    day.addEventListener("drop", e => {
      e.preventDefault();
      const person = e.dataTransfer.getData("text/plain");
      if (!person) return;

      const dateKey = formatDateKeyFromCell(day);
      const assignment = createAssignmentElement(dateKey, person, person === "Note" ? "" : null);
      day.appendChild(assignment);

      addAssignment(dateKey, person, assignment.textContent);
    });
  });
}

function formatDateKeyFromCell(dayCell) {
  const dayNum = dayCell.querySelector(".day-number").textContent;
  const y = currentYear;
  const m = String(currentMonth + 1).padStart(2, "0");
  const d = String(dayNum).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* -----------------------------
   Initial render
------------------------------ */
const cached = localStorage.getItem("shiftData");
if (cached) {
  buildCalendar(currentYear, currentMonth, JSON.parse(cached));
} else {
  buildCalendar(currentYear, currentMonth, {});
}

overlay.style.display = "block";

fetchShiftData()
  .then(data => {
    if (data && Object.keys(data).length > 0) {
      localStorage.setItem("shiftData", JSON.stringify(data));
      buildCalendar(currentYear, currentMonth, data);
    }
  })
  .finally(() => {
    overlay.style.display = "none";
  });

/* -----------------------------
   Navigation + Print buttons
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
