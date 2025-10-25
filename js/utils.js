// utils.js

export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export function getWeekday(year, month, day) {
  return new Date(year, month, day).getDay();
}

export function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
