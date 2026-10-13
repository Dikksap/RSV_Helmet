import { authHeaders, redirectToLogin } from "./auth";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export interface StokMutasiRecord {
  id: number;
  itemId: number;
  tipe: "MASUK" | "KELUAR";
  jumlah: number;
  sumberPermintaanItemId: number | null;
  keterangan: string | null;
  userId: number | null;
  tanggal: string;
}

export interface StokItemResponse {
  item: { id: number; kode: string; nama: string; unit: string };
  saldo: number;
  riwayat: {
    data: StokMutasiRecord[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(options.headers ?? {}) },
  });
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.message === "string") message = body.message;
    } catch { /* ignore */ }
    if (res.status === 401) {
      redirectToLogin();
      throw new Error("Sesi telah berakhir. Silakan login ulang.");
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export const getStokItem = (id: number, page = 1, limit = 20) =>
  request<StokItemResponse>(`/items/${id}/stok?page=${page}&limit=${limit}`);

export const getSaldoBulk = (ids: number[]) =>
  request<{ saldo: Record<number, number> }>("/items/stok-saldo", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });

export const tambahStokItem = (id: number, body: { jumlah: number; keterangan?: string }) =>
  request<{ mutasi: StokMutasiRecord; saldo: number }>(`/items/${id}/stok`, {
    method: "POST",
    body: JSON.stringify(body),
  });
