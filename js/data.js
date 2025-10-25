// data.js

// Use your new published Apps Script endpoint
const SHEETS_URL = "https://script.google.com/macros/s/AKfycbx_kn7OZsKxSp-7MhZNDP1QMC3OUogRB0LfgA_92JHkOygnMdKH6fv6mcqQsflfeME/exec";

export async function fetchShiftData() {
  try {
    const res = await fetch(SHEETS_URL);
    if (!res.ok) throw new Error("Failed to fetch shift data");
    const data = await res.json();
    console.log("Fetched shift data:", data);
    return data; // already keyed by date with arrays of {person, label, ...}
  } catch (err) {
    console.error("Error fetching data:", err);
    return {};
  }
}
