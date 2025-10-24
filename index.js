const calendar = document.getElementById('calendar');
const title = document.getElementById('title');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const weekdayRow = document.getElementById('weekday-row');

let currentMonth = new Date().getMonth() + 1;
let currentYear = new Date().getFullYear();

// === LocalStorage helpers ===
function saveState() {
  const state = {};
  document.querySelectorAll('.day').forEach(day => {
    const dateKey = day.dataset.date;
    if (!dateKey) return;
    const cards = [];
    day.querySelectorAll('.assignment').forEach(card => {
      cards.push({
        person: card.dataset.person,
        text: card.dataset.person === "Note" ? card.innerText.trim() : card.dataset.person
      });
    });
    if (cards.length) state[dateKey] = cards;
  });
  localStorage.setItem('calendarState', JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem('calendarState');
  return raw ? JSON.parse(raw) : {};
}

// === Holiday calculation helpers ===
function nthWeekday(year, month, weekday, n) {
  let date = new Date(year, month, 1);
  let count = 0;
  while (true) {
    if (date.getDay() === weekday) {
      count++;
      if (count === n) return date;
    }
    date.setDate(date.getDate() + 1);
  }
}
function lastWeekday(year, month, weekday) {
  let date = new Date(year, month + 1, 0);
  while (date.getDay() !== weekday) {
    date.setDate(date.getDate() - 1);
  }
  return date;
}
function getUSHolidays(year) {
  const holidays = {};
  holidays[`${year}-01-01`] = "New Year's Day";
  holidays[`${year}-06-19`] = "Juneteenth";
  holidays[`${year}-07-04`] = "Independence Day";
  holidays[`${year}-11-11`] = "Veterans Day";
  holidays[`${year}-12-25`] = "Christmas";
  holidays[nthWeekday(year, 0, 1, 3).toISOString().slice(0,10)] = "MLK Jr. Day";
  holidays[nthWeekday(year, 1, 1, 3).toISOString().slice(0,10)] = "Presidents' Day";
  holidays[lastWeekday(year, 4, 1).toISOString().slice(0,10)] = "Memorial Day";
  holidays[nthWeekday(year, 8, 1, 1).toISOString().slice(0,10)] = "Labor Day";
  holidays[nthWeekday(year, 9, 1, 2).toISOString().slice(0,10)] = "Columbus Day";
  holidays[nthWeekday(year, 10, 4, 4).toISOString().slice(0,10)] = "Thanksgiving";
  return holidays;
}

// === Weekday headers ===
function buildWeekdayHeaders() {
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  weekdayRow.innerHTML = "";
  days.forEach(d => {
    const cell = document.createElement('div');
    cell.textContent = d;
    weekdayRow.appendChild(cell);
  });
}

// === Card factory ===
function makeCard(person, dateKey, isNote, text="") {
  const div = document.createElement('div');
  div.className = isNote ? "assignment note-card" : `assignment ${person.toLowerCase()}`;
  div.textContent = isNote ? text : person;
  div.draggable = true;
  div.dataset.person = person;
  div.id = `card-${person.toLowerCase()}-${dateKey}-${Date.now()}`;

  div.ondragstart = ev => {
    ev.dataTransfer.setData("person", person);
    ev.dataTransfer.setData("source", "calendar");
    ev.dataTransfer.setData("id", div.id);
  };

  if (isNote) {
    div.contentEditable = true;
    div.onblur = () => saveState(); // save when editing finishes
  }

  // Double‑click removes only this card
  div.ondblclick = e => {
    e.stopPropagation();
    div.remove();
    saveState();
  };

  return div;
}

// === Build calendar ===
function buildCalendar(month, year) {
  calendar.innerHTML = "";
  const firstDay = new Date(year, month - 1, 1);
  const startDay = firstDay.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const monthName = firstDay.toLocaleString('default', { month: 'long' });
  title.textContent = `${monthName} ${year}`;

  const holidays = getUSHolidays(year);
  const saved = loadState();

  // leading blanks
  for (let i=0; i<startDay; i++) {
    calendar.appendChild(document.createElement('div'));
  }

  for (let d=1; d<=daysInMonth; d++) {
    const cell = document.createElement('div');
    cell.className = 'day';
    const dateKey = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cell.dataset.date = dateKey;
    cell.innerHTML = `<div class="day-number">${d}</div>`;

    // Holiday badge
    if (holidays[dateKey]) {
      cell.classList.add('holiday');
      const label = document.createElement('div');
      label.className = "holiday-label";
      label.textContent = holidays[dateKey];
      cell.appendChild(label);
    }

    // Restore saved state
    if (saved[dateKey]) {
      saved[dateKey].forEach(c => {
        const isNote = c.person === "Note";
        const div = makeCard(c.person, dateKey, isNote, c.text);
        cell.appendChild(div);
      });
    }

    // Drag/drop logic
    cell.ondragover = e => e.preventDefault();
    cell.ondrop = e => {
      e.preventDefault();
      const sourceType = e.dataTransfer.getData("source");
      const person = e.dataTransfer.getData("person");
      if (!person) return;

      if (sourceType === "tray") {
        const isNote = person === "Note";
        const div = makeCard(person, dateKey, isNote);
        cell.appendChild(div);
      } else if (sourceType === "calendar") {
        const id = e.dataTransfer.getData("id");
        const dragged = document.getElementById(id);
        if (dragged) cell.appendChild(dragged);
      }
      saveState();
    };

    calendar.appendChild(cell);
  }
}

// Tray palette
document.querySelectorAll('.card-container .assignment').forEach(card => {
  card.ondragstart = e => {
    e.dataTransfer.setData("person", card.dataset.person);
    e.dataTransfer.setData("source", "tray");
  };
});

// Navigation
prevBtn.onclick = () => {
  currentMonth--;
  if (currentMonth < 1) { currentMonth = 12; currentYear--; }
  buildCalendar(currentMonth, currentYear);
};
nextBtn.onclick = () => {
  currentMonth++;
  if (currentMonth > 12) { currentMonth = 1; currentYear++; }
  buildCalendar(currentMonth, currentYear);
};

// Print button
const printBtn = document.getElementById('print');
printBtn.onclick = () => {
  window.print();
};

// Init
buildWeekdayHeaders();
buildCalendar(currentMonth, currentYear);
