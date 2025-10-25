// main.js
import { buildCalendar } from './calendar.js';
import { fetchShiftData } from './data.js';

const today = new Date();
const year = today.getFullYear();
const month = today.getMonth();

const overlay = document.getElementById("loading-overlay");

// Render instantly from cache
const cached = localStorage.getItem("shiftData");
if (cached) {
  buildCalendar(year, month, JSON.parse(cached));
} else {
  buildCalendar(year, month, {}); // shows grid structure even without data
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
      e.preventDefault(); // allow drop
    });

    day.addEventListener("drop", e => {
      e.preventDefault();
      const person = e.dataTransfer.getData("text/plain");
      if (person) {
        const assignment = document.createElement("div");
        assignment.className = "assignment";
        assignment.textContent = person;
        day.appendChild(assignment);
      }
    });
  });
}

// Run once on load
enableDayDropZones();

// Re-run after calendar rebuilds
// (Monkey-patch buildCalendar to re-enable drop zones)
const originalBuildCalendar = buildCalendar;
window.buildCalendar = function(year, month, data) {
  originalBuildCalendar(year, month, data);
  enableDayDropZones();
};
