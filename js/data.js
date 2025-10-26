// js/data.js

const SHEETS_URL = "https://script.google.com/macros/s/AKfycbzqz3OCakG5SaWsGjUlLTQyGb3uGVYKyQ938SLrXb-i4w_1--pSyKc-h0jgMGHQ1L_Q/exec";

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
