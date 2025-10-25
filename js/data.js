// data.js

// Fetch shift data from JSON (local file or API)
export async function fetchShiftData() {
  try {
    const res = await fetch(SHEETS_URL);
    if (!res.ok) throw new Error("Failed to fetch shift data");
    return await res.json();
  } catch (err) {
    console.error("Error fetching data:", err);
    return {};
  }
}
