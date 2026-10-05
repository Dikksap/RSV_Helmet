import type { StatusBarang } from "./barang";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export interface BarangGroup {
  id: number;
  nama: string;
  isArsip: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { barang: number };
  barang?: BarangInGroup[];
}

export interface BarangInGroup {
  id: number;
  kodeBarang: string;
  status: StatusBarang;
  pernahRetur?: boolean;
  createdAt: string;
  variant: {
    kodeVariant: string;
    product: { nama: string; prefix?: string };
    style: { nama: string };
    color: { nama: string };
    size: { nama: string };
  };
}

async function parseApiError(response: Response, fallback: string): Promise<Error> {
  const payload = (await response.json().catch(() => null)) as { message?: string } | null;
  return new Error(payload?.message || fallback);
}

export async function getBarangGroups(): Promise<BarangGroup[]> {
  const response = await fetch(`${apiUrl}/barang-group`);
  if (!response.ok) throw await parseApiError(response, "Gagal mengambil daftar dus");
  return response.json() as Promise<BarangGroup[]>;
}

export async function getBarangInGroup(groupId: number): Promise<BarangInGroup[]> {
  const response = await fetch(`${apiUrl}/barang-group/${groupId}/barangs`);
  if (!response.ok) throw await parseApiError(response, "Gagal memuat isi dus");
  return (await response.json() as { barang: BarangInGroup[] }).barang;
}

export async function createBarangGroup(nama: string): Promise<BarangGroup> {
  const response = await fetch(`${apiUrl}/barang-group`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nama }),
  });
  if (!response.ok) throw await parseApiError(response, "Gagal membuat dus");
  return response.json() as Promise<BarangGroup>;
}

export async function updateBarangGroup(id: number, data: { nama?: string; isArsip?: boolean }): Promise<BarangGroup> {
  const response = await fetch(`${apiUrl}/barang-group/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw await parseApiError(response, "Gagal memperbarui dus");
  return response.json() as Promise<BarangGroup>;
}

export async function deleteBarangGroup(id: number): Promise<void> {
  const response = await fetch(`${apiUrl}/barang-group/${id}`, { method: "DELETE" });
  if (!response.ok) throw await parseApiError(response, "Gagal menghapus dus");
}

export async function assignBarangToGroup(
  groupId: number,
  barangIds: number[],
): Promise<{ updated: number; skipped: number }> {
  const response = await fetch(`${apiUrl}/barang-group/${groupId}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barangIds }),
  });
  if (!response.ok) throw await parseApiError(response, "Gagal memasukkan barang ke dus");
  return response.json() as Promise<{ updated: number; skipped: number }>;
}

export async function unassignBarangFromGroup(
  groupId: number,
  barangIds: number[],
): Promise<{ updated: number; skipped: number }> {
  const response = await fetch(`${apiUrl}/barang-group/${groupId}/unassign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barangIds }),
  });
  if (!response.ok) throw await parseApiError(response, "Gagal melepas barang dari dus");
  return response.json() as Promise<{ updated: number; skipped: number }>;
}
