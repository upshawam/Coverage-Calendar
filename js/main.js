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
