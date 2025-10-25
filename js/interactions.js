// interactions.js

let selectedPerson = null;

export function enableInteractions(isTouchDevice) {
  if (isTouchDevice) {
    enableTapToAssign();
  } else {
    enableDragAndDrop();
    enableDoubleClickRemove(); // restore desktop double‑click removal
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

// --- Double‑click remove (desktop only) ---
function enableDoubleClickRemove() {
  const days = document.querySelectorAll('.day');
  days.forEach(day => {
    day.addEventListener('dblclick', e => {
      const target = e.target;
      if (target.classList.contains('assignment')) {
        target.remove();
      }
    });
  });
}

// --- Shared helper ---
function addAssignment(day, person) {
  // Toggle: if already present, remove it
  const existing = day.querySelector(`.assignment.${person.toLowerCase()}`);
  if (existing) {
    existing.remove();
    return;
  }

  // Special handling for Note
  if (person === "Note") {
    const note = document.createElement("div");
    note.className = "assignment note-card";
    note.contentEditable = "true";
    note.textContent = "";
    day.appendChild(note);
    return;
  }

  // Default: Nonnie, Sophia, etc.
  const pill = document.createElement("div");
  pill.className = `assignment ${person.toLowerCase()}`;
  pill.textContent = person;
  day.appendChild(pill);
}
