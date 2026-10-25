import { authHeaders, redirectToLogin } from "./auth";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";

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

export interface StokRiwayatFilter {
  dari?: string;
  sampai?: string;
}

export const getStokItem = (id: number, page = 1, limit = 20, filter: StokRiwayatFilter = {}) => {
  const query = new URLSearchParams({
    page: String(Math.max(1, page)),
    limit: String(Math.min(100, Math.max(1, limit))),
  });
  if (filter.dari) query.set("dari", filter.dari);
  if (filter.sampai) query.set("sampai", filter.sampai);
  return request<StokItemResponse>(`/items/${id}/stok?${query}`);
};

export async function listSemuaRiwayatStokItem(id: number, filter: StokRiwayatFilter = {}): Promise<StokMutasiRecord[]> {
  const pertama = await getStokItem(id, 1, 100, filter);
  const semua: StokMutasiRecord[] = [...pertama.riwayat.data];
  for (let page = 2; page <= pertama.riwayat.meta.totalPages; page += 1) {
    const res = await getStokItem(id, page, 100, filter);
    semua.push(...res.riwayat.data);
  }
  return semua;
}

export interface RingkasanStokItem {
  masuk: number;
  keluar: number;
  net: number;
}

export async function getRingkasanBulkStok(ids: number[], filter: StokRiwayatFilter = {}): Promise<Record<number, RingkasanStokItem>> {
  const uniq = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  const hasil: Record<number, RingkasanStokItem> = {};
  for (let i = 0; i < uniq.length; i += 200) {
    const res = await request<{ ringkasan: Record<number, RingkasanStokItem> }>("/items/stok-ringkasan", {
      method: "POST",
      body: JSON.stringify({
        ids: uniq.slice(i, i + 200),
        ...(filter.dari ? { dari: filter.dari } : {}),
        ...(filter.sampai ? { sampai: filter.sampai } : {}),
      }),
    });
    Object.assign(hasil, res.ringkasan);
  }
  return hasil;
}

export async function getSaldoBulk(ids: number[]): Promise<{ saldo: Record<number, number> }> {
  const uniq = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  const saldo: Record<number, number> = {};
  for (let i = 0; i < uniq.length; i += 200) {
    const res = await request<{ saldo: Record<number, number> }>("/items/stok-saldo", {
      method: "POST",
      body: JSON.stringify({ ids: uniq.slice(i, i + 200) }),
    });
    Object.assign(saldo, res.saldo);
  }
  return { saldo };
}

export const tambahStokItem = (id: number, body: { jumlah: number; keterangan?: string; tanggal?: string }) =>
  request<{ mutasi: StokMutasiRecord; saldo: number }>(`/items/${id}/stok`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const catatKeluarItem = (id: number, body: { jumlah: number; keterangan?: string; tanggal?: string }) =>
  request<{ mutasi: StokMutasiRecord; saldo: number }>(`/items/${id}/stok/keluar`, {
    method: "POST",
    body: JSON.stringify(body),
  });
