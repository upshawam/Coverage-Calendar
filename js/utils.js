// utils.js

// Format a Date object as YYYY-MM-DD
export function formatDateKey(date) {
  return date.toISOString().split('T')[0];
}

// Get number of days in a month
export function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// Get weekday (0 = Sunday)
export function getWeekday(year, month, day) {
  return new Date(year, month, day).getDay();
}
