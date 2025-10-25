// data.js

// Use your new published Apps Script endpoint
const SHEETS_URL = "https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLjg0a4Xc4slCdXxC-saaIWvHISg8VBbv_Og8YUKOb8_G6BtAx3Qy0N3VWU3hps9B7Z2LCy0dLvp8qnnWbK6VYU0bmowfR6z1sU0wYOHYiHwPq96enFBffkgsjbL2vI1GCGzIMslLti0DgLEq2oaaEKEgbgKjUUQYneimkp7OPozD23w4wympfB4m3PN0Z-bnJc3PkWJizIcuSCaOO8KxUSrQ9dXoidSh3IgUSbnFD_Cj6f5LFMM3duPCELGZjz_rrhUZTBW-mc9s8nvXMU7yHg37938cA&lib=MtyhWyQuWk5oj4-xBXtXtJNQvBsD6Bo-Z";

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
