// main.js
import { buildCalendar as originalBuildCalendar } from './calendar.js';
import { fetchShiftData } from './data.js';

const today = new Date();
const year = today.getFullYear();
const month = today.getMonth();

const overlay = document.getElementById("loading-overlay");

// --- Persistence helpers ---
function loadCustomAssignments() {
  return JSON.parse(localStorage.getItem("customAssignments") || "{}");
}

function saveCustomAssignments(assignments) {
  localStorage.setItem("customAssignments", JSON.stringify(assignments));
}

// --- Calendar wrapper to reapply drops ---
function buildCalendar(year, month, shiftData) {
  originalBuildCalendar(year, month, shiftData);

  // Reapply saved custom assignments
  const custom = loadCustomAssignments();
  Object.entries(custom).forEach(([dateKey, people]) => {
    const dayCell = document.querySelector(
      `.calendar .day:nth-child(${new Date(dateKey).getDate() + new Date(year, month, 1).getDay()})`
    );
    if (dayCell) {
      people.forEach(person => {
        const assignment = document.createElement("div");
        assignment.className = "assignment";
        assignment.textContent = person;
        dayCell.appendChild(assignment);
      });
    }
  });

  enableDayDropZones();
}

// --- Initial render from cache ---
const cached = localStorage.getItem("shiftData");
if (cached) {
  buildCalendar(year, month, JSON.parse(cached));
} else {
  buildCalendar(year, month, {});
}

// Show overlay during fetch
overlay.style.display = "block";

fetchShiftData()
  .then(data => {
    if (data && Object.keys(data).length > 0) {
      localStorage.setItem("shiftData", JSON.stringify(data));
      buildCalendar(year, month, data);
    }
  })
  .finally(() => {
    overlay.style.display = "none";
  });

/* -----------------------------
   Drag-and-drop functionality
------------------------------ */

// Make tray cards draggable
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

// Allow drops on calendar days
function enableDayDropZones() {
  document.querySelectorAll(".calendar .day").forEach(day => {
    day.addEventListener("dragover", e => {
      e.preventDefault();
    });

    day.addEventListener("drop", e => {
      e.preventDefault();
      const person = e.dataTransfer.getData("text/plain");
      if (person) {
        const assignment = document.createElement("div");
        assignment.className = "assignment";
        assignment.textContent = person;
        day.appendChild(assignment);

        // Save to localStorage
        const dateKey = formatDateKeyFromCell(day);
        const custom = loadCustomAssignments();
        if (!custom[dateKey]) custom[dateKey] = [];
        custom[dateKey].push(person);
        saveCustomAssignments(custom);
      }
    });
  });
}

// Helper: infer dateKey from a day cell
function formatDateKeyFromCell(dayCell) {
  const dayNum = dayCell.querySelector(".day-number").textContent;
  const y = year;
  const m = String(month + 1).padStart(2, "0");
  const d = String(dayNum).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
