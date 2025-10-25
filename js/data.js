// data.js

const SHEETS_URL = "https://script.google.com/macros/s/AKfycbxV45YA-n3bQ_CNJYYBxZAhgcdhSt4W7YMKbpgor9gKxNkk9ElEz2NED1N-tZcBogo/exec";

export async function fetchShiftData() {
  try {
    const res = await fetch(SHEETS_URL);
    if (!res.ok) throw new Error("Failed to fetch shift data");
    const data = await res.json();
    console.log("Fetched shift data:", data);
    return data; // already keyed by date
  } catch (err) {
    console.error("Error fetching data:", err);
    return {};
  }
}
