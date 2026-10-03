import { clearAuth } from "./auth";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";

export interface Karyawan {
  id: number;
  nama: string;
  jabatan: string;
  createdAt: string;
  updatedAt: string;
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

export const getKaryawan = () => request<Karyawan[]>("/karyawan");
export const getKaryawanById = (id: number) => request<Karyawan>(`/karyawan/${id}`);
export const createKaryawan = (body: { nama: string; jabatan: string }) =>
  request<Karyawan>("/karyawan", { method: "POST", body: JSON.stringify(body) });
export const updateKaryawan = (id: number, body: { nama: string; jabatan: string }) =>
  request<Karyawan>(`/karyawan/${id}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteKaryawan = (id: number) =>
  request<{ message: string }>(`/karyawan/${id}`, { method: "DELETE" });
