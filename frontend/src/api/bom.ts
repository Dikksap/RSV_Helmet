import { authHeaders, redirectToLogin } from "./auth";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export interface SubassemblyRef {
  id: number;
  kode: string;
  nama: string;
}

export interface ItemRef {
  id: number;
  kode: string;
  nama: string;
  unit: string | null;
}

export interface BomItem {
  id?: number;
  bomId?: number;
  urutan?: number | null;
  itemId?: number | null;
  subassemblyId?: number | null;
  quantity: number | string;
  unit?: string | null;
  scrapPercent?: number | null;
  item?: ItemRef | null;
  subassembly?: SubassemblyRef | null;
}

export interface BomProductVariant {
  id: number;
  kodeVariant: string;
  product: { id: number; nama: string; prefix: string };
}

export interface Bom {
  id: number;
  kode?: string | null;
  nama: string;
  version: string;
  isActive: boolean;
  berlakuMulai?: string | null;
  berlakuSelesai?: string | null;
  productVariantId?: number | null;
  subassemblyId?: number | null;
  productVariant?: BomProductVariant | null;
  subassembly?: SubassemblyRef | null;
  createdAt: string;
  updatedAt: string;
  items: BomItem[];
}

export interface BomParams {
  q?: string;
  aktif?: boolean;
  outputType?: "product" | "subassembly";
  productVariantId?: number;
  subassemblyId?: number;
}

export interface BomItemInput {
  urutan?: number | null;
  itemId?: number | null;
  subassemblyId?: number | null;
  quantity: number;
  unit?: string | null;
  scrapPercent?: number | null;
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

export async function getBoms(params: BomParams = {}): Promise<Bom[]> {
  const q = new URLSearchParams();
  if (params.q?.trim()) q.set("q", params.q.trim());
  if (params.aktif !== undefined) q.set("aktif", params.aktif ? "true" : "false");
  if (params.outputType) q.set("outputType", params.outputType);
  if (params.productVariantId) q.set("productVariantId", String(params.productVariantId));
  if (params.subassemblyId) q.set("subassemblyId", String(params.subassemblyId));
  const qs = q.toString();
  return request<Bom[]>(`/bom${qs ? `?${qs}` : ""}`);
}

export const getBom = (id: number) => request<Bom>(`/bom/${id}`);
export const createBom = (body: {
  kode?: string | null;
  nama: string;
  version: string;
  isActive?: boolean;
  berlakuMulai?: string | null;
  berlakuSelesai?: string | null;
  productVariantId?: number | null;
  subassemblyId?: number | null;
  items: BomItemInput[];
}) => request<Bom>("/bom", { method: "POST", body: JSON.stringify(body) });
export const updateBom = (id: number, body: {
  kode?: string | null;
  nama?: string;
  version?: string;
  isActive?: boolean;
  berlakuMulai?: string | null;
  berlakuSelesai?: string | null;
  productVariantId?: number | null;
  subassemblyId?: number | null;
  items?: BomItemInput[];
}) => request<Bom>(`/bom/${id}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteBom = (id: number) => request<{ message: string }>(`/bom/${id}`, { method: "DELETE" });
