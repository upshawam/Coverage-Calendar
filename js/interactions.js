// interactions.js

let selectedPerson = null;

export function enableInteractions(isTouchDevice) {
  if (isTouchDevice) {
    enableTapToAssign();
  } else {
    enableDragAndDrop();
  }
}

// --- Desktop: Drag & Drop ---
function enableDragAndDrop() {
  const trayCards = document.querySelectorAll('#tray .assignment');
  const days = document.querySelectorAll('.day');

  trayCards.forEach(card => {
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', card.dataset.person);
    });
  });

  days.forEach(day => {
    day.addEventListener('dragover', e => e.preventDefault());
    day.addEventListener('drop', e => {
      e.preventDefault();
      const person = e.dataTransfer.getData('text/plain');
      if (person) {
        addAssignment(day, person);
      }
    });
  });
}

// --- Mobile: Tap-to-Assign ---
function enableTapToAssign() {
  const trayCards = document.querySelectorAll('#tray .assignment');
  const days = document.querySelectorAll('.day');

  trayCards.forEach(card => {
    card.addEventListener('click', () => {
      selectedPerson = card.dataset.person;
      trayCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    });
  });

  days.forEach(day => {
    day.addEventListener('click', () => {
      if (!selectedPerson) return;
      addAssignment(day, selectedPerson);
    });
  });
}

// --- Shared helper ---
function addAssignment(day, person) {
  const note = document.createElement('div');
  note.className = `assignment ${person.toLowerCase()}`;
  note.textContent = person;
  day.appendChild(note);
}
