import { authHeaders, redirectToLogin } from "./auth";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export interface MutasiGudangRef {
  id: number;
  kode: string;
  name: string;
}

export interface MutasiRecord {
  id: number;
  barangId: number;
  gudangAsalId: number | null;
  gudangTujuanId: number | null;
  jumlah: number;
  tanggal: string;
  keterangan: string | null;
  userId: number | null;
  barang: { id: number; kodeBarang: string; status: string };
  gudangAsal: MutasiGudangRef | null;
  gudangTujuan: MutasiGudangRef | null;
  user: { id: number; name: string; email: string } | null;
}

export interface MutasiListParams {
  page?: number;
  limit?: number;
  barangId?: number;
  kodeBarang?: string;
  gudangId?: number;
  dari?: string;
  sampai?: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${apiUrl}${path}`, {
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(options.headers ?? {}) },
    ...options,
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
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function getMutasiList(
  params: MutasiListParams = {},
): Promise<{ data: MutasiRecord[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
  const query = new URLSearchParams({ page: String(Math.max(1, params.page ?? 1)) });
  query.set("limit", String(Math.min(100, Math.max(1, params.limit ?? 20))));
  if (params.barangId) query.set("barangId", String(params.barangId));
  if (params.kodeBarang?.trim()) query.set("kodeBarang", params.kodeBarang.trim());
  if (params.gudangId) query.set("gudangId", String(params.gudangId));
  if (params.dari) query.set("dari", params.dari);
  if (params.sampai) query.set("sampai", params.sampai);
  return request(`/mutasi-gudang?${query}`);
}

export const getMutasiByBarang = (barangId: number) =>
  request<MutasiRecord[]>(`/mutasi-gudang/barang/${barangId}`);

export const getMutasiByGudang = (gudangId: number) =>
  request<MutasiRecord[]>(`/mutasi-gudang/gudang/${gudangId}`);

export const catatMutasi = (body: {
  barangId?: number;
  kodeBarang?: string;
  gudangAsalId?: number | null;
  gudangTujuanId?: number | null;
  keterangan?: string;
}) => request<MutasiRecord>("/mutasi-gudang", { method: "POST", body: JSON.stringify(body) });

export const catatMutasiBulk = (body: {
  barangIds: number[];
  gudangTujuanId: number | null;
  keterangan?: string;
}) =>
  request<{ success: MutasiRecord[]; summary: { total: number; success: number; failed: number } }>(
    "/mutasi-gudang/bulk",
    { method: "POST", body: JSON.stringify(body) },
  );
