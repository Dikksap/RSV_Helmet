import { authHeaders, redirectToLogin } from "./auth";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export interface ItemDivisi {
  id: number;
  nama: string;
}

export interface Item {
  id: number;
  kode: string;
  nama: string;
  divisiId: number | null;
  unit: string;
  isActive: boolean;
  divisi?: ItemDivisi | null;
}

export interface ItemListParams {
  q?: string;
  divisiId?: number;
  aktif?: boolean;
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

export async function getItems(params: ItemListParams = {}): Promise<Item[]> {
  const query = new URLSearchParams();
  if (params.q?.trim()) query.set("q", params.q.trim());
  if (params.divisiId) query.set("divisiId", String(params.divisiId));
  if (params.aktif !== undefined) query.set("aktif", params.aktif ? "true" : "false");
  const qs = query.toString();
  return request<Item[]>(`/items${qs ? `?${qs}` : ""}`);
}

export const getItem = (id: number) => request<Item>(`/items/${id}`);

export const createItem = (body: { kode: string; nama: string; divisiId?: number | null; unit?: string; isActive?: boolean }) =>
  request<Item>("/items", { method: "POST", body: JSON.stringify(body) });

export const updateItem = (id: number, body: { kode?: string; nama?: string; divisiId?: number | null; unit?: string; isActive?: boolean }) =>
  request<Item>(`/items/${id}`, { method: "PUT", body: JSON.stringify(body) });

export const deleteItem = (id: number) =>
  request<{ message: string }>(`/items/${id}`, { method: "DELETE" });
