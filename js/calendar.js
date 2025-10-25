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
    const info = shiftData[dateKey];

    if (info) {
      // Show Aaron/Kristin working flags
      if (info.aaronWorking === "Yes") {
        const a = document.createElement("div");
        a.className = "ref-note nonnie";
        a.textContent = "Aaron Working";
        cell.appendChild(a);
      }
      if (info.kristinWorking === "Yes") {
        const k = document.createElement("div");
        k.className = "ref-note sophia";
        k.textContent = "Kristin Working";
        cell.appendChild(k);
      }
      if (info.aaronNightBefore === "Yes") {
        const n = document.createElement("div");
        n.className = "ref-note";
        n.textContent = "Aaron Night Before";
        cell.appendChild(n);
      }

      // Coverage highlight
      if (info.coverage === "Yes") {
        cell.classList.add("coverage-needed");
      }
    } else {
      // No entry at all for this date
      cell.classList.add("coverage-needed");
    }

    calendarEl.appendChild(cell);
  }
}
