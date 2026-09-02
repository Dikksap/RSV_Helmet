const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export interface MasterStyle {
  id: number;
  nama: string;
  createdAt: string;
  updatedAt: string;
}

export interface MasterColor {
  id: number;
  nama: string;
  createdAt: string;
  updatedAt: string;
}

export interface MasterSize {
  id: number;
  nama: string;
  urutan: number;
  createdAt: string;
  updatedAt: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${apiUrl}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.message === "string") message = body.message;
    } catch { /* ignore */ }
    throw new Error(message);
  }
  // 204 or empty body
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// ---- Styles: GET /api/styles, POST /api/styles {nama}, PUT /api/styles/:id {nama}, DELETE ----
export const getStyles = () => request<MasterStyle[]>("/styles");
export const getStyle = (id: number) => request<MasterStyle>(`/styles/${id}`);
export const createStyle = (body: { nama: string }) =>
  request<MasterStyle>("/styles", { method: "POST", body: JSON.stringify(body) });
export const updateStyle = (id: number, body: { nama: string }) =>
  request<MasterStyle>(`/styles/${id}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteStyle = (id: number) =>
  request<{ message: string }>(`/styles/${id}`, { method: "DELETE" });

// ---- Colors: GET /api/colors, POST /api/colors {nama}, PUT /api/colors/:id, DELETE ----
export const getColors = () => request<MasterColor[]>("/colors");
export const getColor = (id: number) => request<MasterColor>(`/colors/${id}`);
export const createColor = (body: { nama: string }) =>
  request<MasterColor>("/colors", { method: "POST", body: JSON.stringify(body) });
export const updateColor = (id: number, body: { nama: string }) =>
  request<MasterColor>(`/colors/${id}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteColor = (id: number) =>
  request<{ message: string }>(`/colors/${id}`, { method: "DELETE" });

// ---- Sizes: GET /api/sizes, POST /api/sizes {nama,urutan?}, PUT /api/sizes/:id {nama?,urutan?}, DELETE ----
export const getSizes = () => request<MasterSize[]>("/sizes");
export const getSize = (id: number) => request<MasterSize>(`/sizes/${id}`);
export const createSize = (body: { nama: string; urutan?: number }) =>
  request<MasterSize>("/sizes", { method: "POST", body: JSON.stringify(body) });
export const updateSize = (id: number, body: { nama?: string; urutan?: number }) =>
  request<MasterSize>(`/sizes/${id}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteSize = (id: number) =>
  request<{ message: string }>(`/sizes/${id}`, { method: "DELETE" });
