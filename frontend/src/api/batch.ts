import { clearAuth } from "./auth";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";

export type BatchStatus = "AKTIF" | "SELESAI";

export interface Batch {
  id: number;
  nomorBatch: number;
  totalProduksi: number;
  kapasitas: number;
  status: BatchStatus;
  createdAt: string;
  updatedAt: string;
  _count?: { barang: number };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("rsv_auth_token");
  const res = await fetch(`${apiUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
    ...options,
  });
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.message === "string") message = body.message;
    } catch { /* ignore */ }
    if (res.status === 401) {
      clearAuth();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login?session=expired";
      }
      throw new Error("Sesi telah berakhir. Silakan login ulang.");
    }
    throw new Error(message);
  }
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export const batchLabel = (nomorBatch: number) => `BC${String(nomorBatch).padStart(3, "0")}`;

export const getBatches = () => request<Batch[]>("/batches");
export const getBatchById = (id: number) => request<Batch>(`/batches/${id}`);
export const createBatch = (body: { kapasitas?: number }) =>
  request<Batch>("/batches", { method: "POST", body: JSON.stringify(body) });
export const updateBatch = (id: number, body: { kapasitas?: number; status?: BatchStatus }) =>
  request<Batch>(`/batches/${id}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteBatch = (id: number) =>
  request<{ message: string }>(`/batches/${id}`, { method: "DELETE" });
