const API_URL = process.env.API_URL;
if (!API_URL) {
    throw new Error("API_URL belum diset");
}
const API_BASE_URL = API_URL.replace(/\/$/, "").endsWith("/api")
    ? API_URL.replace(/\/$/, "")
    : `${API_URL.replace(/\/$/, "")}/api`;
export async function getBarang() {
    const response = await fetch(`${API_BASE_URL}/barang`);
    if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
}
export async function getFinishgoodHariIni() {
    const status = "FINISHGOOD";
    const limit = "100";
    const response = await fetch(`${API_BASE_URL}/barang/hari-ini?status=${status}&limit=${limit}`);
    if (response.ok) {
        return response.json();
    }
    if (response.status !== 400) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    const dateParts = new Intl.DateTimeFormat("en", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());
    const date = Object.fromEntries(dateParts.map(({ type, value }) => [type, value]));
    const fallbackResponse = await fetch(`${API_BASE_URL}/barang?tanggal=${date.year}-${date.month}-${date.day}` +
        `&status=${status}&limit=${limit}`);
    if (!fallbackResponse.ok) {
        throw new Error(`API error: ${fallbackResponse.status} ${fallbackResponse.statusText}`);
    }
    return fallbackResponse.json();
}
