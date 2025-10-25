// calendar.js
import { daysInMonth, getWeekday, formatDateKey } from './utils.js';

export function buildCalendar(year, month, shiftData) {
  const calendarEl = document.getElementById("calendar");
  const weekdayRow = document.getElementById("weekday-row");
  const titleEl = document.getElementById("title");

  // Clear old content
  calendarEl.innerHTML = "";
  weekdayRow.innerHTML = "";

  // Title
  const monthName = new Date(year, month).toLocaleString("default", { month: "long" });
  titleEl.textContent = `${monthName} ${year}`;

  // Weekday headers
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  weekdays.forEach(d => {
    const div = document.createElement("div");
    div.textContent = d;
    weekdayRow.appendChild(div);
  });

  // Days
  const numDays = daysInMonth(year, month);
  const firstDay = getWeekday(year, month, 1);

  // Empty slots before first day
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    calendarEl.appendChild(empty);
  }

  // Actual days
  for (let day = 1; day <= numDays; day++) {
    const cell = document.createElement("div");
    cell.className = "day";

    const num = document.createElement("div");
    num.className = "day-number";
    num.textContent = day;
    cell.appendChild(num);

    const dateKey = formatDateKey(new Date(year, month, day));
    const shifts = shiftData[dateKey];

    if (shifts && shifts.length > 0) {
      const shiftContainer = document.createElement("div");
      shiftContainer.className = "shift-container";

      shifts.forEach(shift => {
        const label = document.createElement("div");
        label.className = "shift-label";
        label.textContent = shift.label; // A-Days / A-Nights / K-Work
        shiftContainer.appendChild(label);
      });

      cell.appendChild(shiftContainer);
    }

    calendarEl.appendChild(cell);
  }
}
