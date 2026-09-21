import crypto from "node:crypto";

// Klien minimal Mekari Jurnal (HMAC-SHA256).
// Secret tidak pernah ke browser; semua lewat backend.

const BASE_URL = process.env.MEKARI_BASE_URL || "https://api.mekari.com";

export function mekariConfigured(): boolean {
  return Boolean(process.env.MEKARI_CLIENT_ID && process.env.MEKARI_CLIENT_SECRET);
}

export async function mekariGet(path: string): Promise<{ status: number; data: unknown }> {
  const clientId = process.env.MEKARI_CLIENT_ID || "";
  const secret = process.env.MEKARI_CLIENT_SECRET || "";
  if (!clientId || !secret) {
    throw Object.assign(new Error("Integrasi Jurnal belum dikonfigurasi (MEKARI_CLIENT_ID / MEKARI_CLIENT_SECRET kosong)"), {
      code: "MEKARI_NO_CRED",
    });
  }
  const date = new Date().toUTCString();
  const signing = `date: ${date}\nGET ${path} HTTP/1.1`;
  const signature = crypto.createHmac("sha256", secret).update(signing).digest("base64");
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Date: date,
      Authorization: `hmac username="${clientId}", algorithm="hmac-sha256", headers="date request-line", signature="${signature}"}`,
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw Object.assign(new Error(`Mekari API menjawab ${response.status}`), {
      code: "MEKARI_UPSTREAM",
      status: response.status,
      data,
    });
  }
  return { status: response.status, data };
}
