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
      shifts.forEach(shift => {
        const note = document.createElement("div");
        note.className = "ref-note";

        // Add color coding by label/person if you want
        if (shift.person === "Aaron" && shift.label === "A-Days") {
          note.classList.add("nonnie"); // reuse your green style
        } else if (shift.person === "Aaron" && shift.label === "A-Nights") {
          note.classList.add("nonnie"); // same base, or make a darker shade
        } else if (shift.person === "Kristin") {
          note.classList.add("sophia"); // reuse your blue style
        }

        note.textContent = shift.label; // only show A-Days / A-Nights / K-Work
        cell.appendChild(note);
      });
    } else {
      // No shifts → coverage needed
      cell.classList.add("coverage-needed");
    }

    calendarEl.appendChild(cell);
  }
}
