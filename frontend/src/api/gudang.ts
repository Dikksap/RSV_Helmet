import { authHeaders, redirectToLogin } from "./auth";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export interface Gudang {
  id: number;
  kode: string;
  name: string;
  isActive: boolean;
  _count?: { barang: number };
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

export const getGudangList = () => request<Gudang[]>("/gudang");
export const getGudang = (id: number) => request<Gudang>(`/gudang/${id}`);

export const createGudang = (body: { kode: string; name: string; isActive?: boolean }) =>
  request<Gudang>("/gudang", { method: "POST", body: JSON.stringify(body) });

export const updateGudang = (id: number, body: { kode?: string; name?: string; isActive?: boolean }) =>
  request<Gudang>(`/gudang/${id}`, { method: "PUT", body: JSON.stringify(body) });

export const deleteGudang = (id: number) =>
  request<{ message: string }>(`/gudang/${id}`, { method: "DELETE" });
