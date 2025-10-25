// js/data.js

const SHEETS_URL = "https://script.google.com/macros/s/AKfycbx_kn7OZsKxSp-7MhZNDP1QMC3OUogRB0LfgA_92JHkOygnMdKH6fv6mcqQsflfeME/exec";

export async function fetchShiftData() {
  try {
    const res = await fetch(SHEETS_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log("Fetched shift data:", data);
    return data;
  } catch (err) {
    console.error("Error fetching data:", err);
    return {};
  }
}
