import { clearAuth } from "./auth";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";

export interface Divisi {
  id: number;
  nama: string;
  createdAt: string;
  updatedAt: string;
  _count?: { karyawan: number };
  karyawan?: { id: number; nama: string; jabatan: string }[];
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

export const getDivisi = () => request<Divisi[]>("/divisi");
export const getDivisiById = (id: number) => request<Divisi>(`/divisi/${id}`);
export const createDivisi = (body: { nama: string }) =>
  request<Divisi>("/divisi", { method: "POST", body: JSON.stringify(body) });
export const updateDivisi = (id: number, body: { nama: string }) =>
  request<Divisi>(`/divisi/${id}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteDivisi = (id: number) =>
  request<{ message: string }>(`/divisi/${id}`, { method: "DELETE" });
