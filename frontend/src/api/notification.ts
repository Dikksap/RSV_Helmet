const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export interface StoredNotif {
  id: number;
  type: string;
  message: string;
  data: unknown;
  ts: number;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`Notifikasi request gagal: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchNotifications(): Promise<StoredNotif[]> {
  const res = await request<{ items: StoredNotif[] }>("/notifications");
  return Array.isArray(res.items) ? res.items : [];
}

export async function clearNotifications(): Promise<void> {
  await request("/notifications", { method: "DELETE" });
}
