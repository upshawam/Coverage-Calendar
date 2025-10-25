// main.js
import { buildCalendar } from './calendar.js';
import { fetchShiftData } from './data.js';

const today = new Date();
const year = today.getFullYear();
const month = today.getMonth();

const overlay = document.getElementById("loading-overlay");

// 1. Render instantly from cache if available
const cached = localStorage.getItem("shiftData");
if (cached) {
  buildCalendar(year, month, JSON.parse(cached));
} else {
  buildCalendar(year, month, {}); // empty calendar if no cache yet
}

// 2. Show overlay while fetching
overlay.style.display = "block";

// 3. Fetch fresh data in background
fetchShiftData().then(data => {
  if (data && Object.keys(data).length > 0) {
    localStorage.setItem("shiftData", JSON.stringify(data));
    buildCalendar(year, month, data);
  }
}).finally(() => {
  overlay.style.display = "none"; // hide once fetch completes
});
