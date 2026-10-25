import { authHeaders, redirectToLogin } from "./auth";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";

export interface OpnameBarisRecord {
  id: number;
  sesiId: number;
  itemId: number;
  stokSistem: number;
  stokFisik: number;
  selisih: number;
  item?: { id: number; kode: string; nama: string; unit: string } | null;
}

export interface OpnameSesiRingkas {
  id: number;
  tanggal: string;
  keterangan: string | null;
  userId: number | null;
  createdAt: string;
  jumlahBaris: number;
  totalPlus: number;
  totalMinus: number;
}

export interface OpnameSesiDetail {
  id: number;
  tanggal: string;
  keterangan: string | null;
  userId: number | null;
  createdAt: string;
  baris: OpnameBarisRecord[];
  user?: { id: number; name: string } | null;
}

export interface OpnameSesiListResponse {
  data: OpnameSesiRingkas[];
  meta: { page: number; limit: number; total: number; totalPages: number };
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

export const listSesiOpname = (page = 1, limit = 20) =>
  request<OpnameSesiListResponse>(`/stok-opname?page=${page}&limit=${limit}`);

export const getSesiOpname = (id: number) => request<OpnameSesiDetail>(`/stok-opname/${id}`);

export const buatSesiOpname = (body: { items: { itemId: number; stokFisik: number }[]; keterangan?: string }) =>
  request<OpnameSesiDetail>("/stok-opname", { method: "POST", body: JSON.stringify(body) });
