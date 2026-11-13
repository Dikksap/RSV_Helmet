import { authHeaders, redirectToLogin } from "./auth";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";

/**
 * Endpoint baca ProduksiHarian (PH) yang masih dipakai halaman stok.
 *
 * Posting produksi TIDAK lagi memakai modul ini: jalur kanonik adalah
 * `api/hasilProduksiHarian.ts` (POST /api/hasil-produksi-harian).
 */
export interface StokGudang {
  location: {
    id: number;
    code: string;
    name: string;
    gudang?: { id: number; kode: string; name: string } | null;
  };
  items: {
    itemId: number;
    kode: string;
    nama: string;
    unit: string;
    jenis: string | null;
    isActive: boolean;
    quantity: number;
  }[];
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.message === "string") message = body.message;
    } catch {
      /* ignore */
    }
    if (res.status === 401) {
      redirectToLogin();
      throw new Error("Sesi telah berakhir. Silakan login ulang.");
    }
    throw new Error(message);
  }
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export const getStokGudang = () => request<StokGudang[]>("/produksi-harian/stok-gudang");
