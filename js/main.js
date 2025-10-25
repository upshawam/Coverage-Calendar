// main.js
import { fetchShiftData } from './data.js';
import { buildCalendar } from './calendar.js';
import { enableInteractions } from './interactions.js';

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let shiftData = {};

async function init() {
  shiftData = await fetchShiftData();
  render();

  // Controls
  document.getElementById("prev").addEventListener("click", () => {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    render();
  });

  document.getElementById("next").addEventListener("click", () => {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    render();
  });

  document.getElementById("print").addEventListener("click", () => window.print());
}

function render() {
  buildCalendar(currentYear, currentMonth, shiftData);

  // Re‑enable interactions after rebuilding DOM
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  enableInteractions(isTouchDevice);
}

init();
