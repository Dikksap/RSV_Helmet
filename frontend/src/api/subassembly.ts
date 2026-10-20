import { authHeaders, redirectToLogin } from "./auth";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export interface SubassemblyVariant {
  id: number;
  kodeVariant?: string;
  product?: { id: number; nama: string; prefix: string };
}

export interface SubassemblyItem {
  id: number;
  kode: string;
  nama: string;
  unit: string | null;
  jenis: string | null;
  isActive: boolean;
}

export interface Subassembly {
  id: number;
  kode: string;
  nama: string;
  itemId: number | null;
  productVariantId: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  item?: SubassemblyItem | null;
  productVariant?: SubassemblyVariant | null;
}

export interface SubassemblyParams {
  q?: string;
  aktif?: boolean;
  productVariantId?: number;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${apiUrl}${path}`, { headers: { "Content-Type": "application/json", ...authHeaders(), ...(options?.headers ?? {}) }, ...options });
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try { const body = await res.json(); if (typeof body?.message === "string") message = body.message; } catch { /* ignore */ }
    if (res.status === 401) { redirectToLogin(); throw new Error("Sesi telah berakhir. Silakan login ulang."); }
    throw new Error(message);
  }
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export async function getSubassemblies(params: SubassemblyParams = {}): Promise<Subassembly[]> {
  const q = new URLSearchParams();
  if (params.q?.trim()) q.set("q", params.q.trim());
  if (params.aktif !== undefined) q.set("aktif", String(params.aktif));
  if (params.productVariantId) q.set("productVariantId", String(params.productVariantId));
  const qs = q.toString();
  return request<Subassembly[]>(`/subassemblies${qs ? `?${qs}` : ""}`);
}

export const getSubassembly = (id: number) => request<Subassembly>(`/subassemblies/${id}`);
export const createSubassembly = (body: { kode: string; nama: string; itemId?: number | null; productVariantId?: number | null; isActive?: boolean }) =>
  request<Subassembly>("/subassemblies", { method: "POST", body: JSON.stringify(body) });
export const updateSubassembly = (id: number, body: { kode?: string; nama?: string; itemId?: number | null; productVariantId?: number | null; isActive?: boolean }) =>
  request<Subassembly>(`/subassemblies/${id}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteSubassembly = (id: number) => request<{ message: string }>(`/subassemblies/${id}`, { method: "DELETE" });
export const syncSubassemblies = () => request<{ message: string; count: number }>("/subassemblies/sync", { method: "POST" });