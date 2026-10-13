import { clearAuth } from "./auth";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";

export interface RolePermission {
  id: number;
  kode: string;
  nama: string;
  kelompok: string;
}

export interface RoleStatusView {
  statusKode: string;
  canView: boolean;
}

export interface Role {
  id: number;
  kode: string;
  nama: string;
  permissions: RolePermission[];
  barangStatus: RoleStatusView[];
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

export const getRoles = () => request<Role[]>("/roles");
export const getPermissions = () => request<RolePermission[]>("/roles/permissions");
export const setRolePermissions = (id: number, permissions: string[]) =>
  request<{ id: number; permissions: string[] }>(`/roles/${id}/permissions`, {
    method: "PUT",
    body: JSON.stringify({ permissions }),
  });
export const setRoleBarangStatus = (id: number, statusView: Record<string, boolean>) =>
  request<{ id: number; statusView: RoleStatusView[] }>(`/roles/${id}/barang-status`, {
    method: "PUT",
    body: JSON.stringify({ statusView }),
  });
