const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export type ApprovalPermintaan = "BELUM_DISETUJUI" | "DISETUJUI";

export interface PermintaanItemInput {
  nama: string;
  spesifikasi?: string | null;
  jumlah: number;
  satuan?: string | null;
}

export interface CreatePermintaanPayload {
  tanggal: string;
  departemen: string;
  namaPeminta: string;
  kebutuhanUntuk?: string;
  prioritas?: string;
  tanggalDibutuhkan?: string | null;
  alasan: string;
  items: PermintaanItemInput[];
}

export interface PermintaanItemRecord {
  id: number;
  permintaanId: number;
  nama: string;
  spesifikasi: string | null;
  jumlah: number;
  satuan: string | null;
}

export interface PermintaanBarangRecord {
  id: number;
  noPermintaan: string;
  tanggal: string;
  departemen: string;
  namaPeminta: string;
  kebutuhanUntuk: string;
  prioritas: string;
  tanggalDibutuhkan: string | null;
  alasan: string;
  approval: ApprovalPermintaan;
  createdAt: string;
  updatedAt: string;
  items: PermintaanItemRecord[];
}

export async function createPermintaan(
  payload: CreatePermintaanPayload,
): Promise<PermintaanBarangRecord> {
  const response = await fetch(`${apiUrl}/permintaan-barang`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(data?.message || `Gagal menyimpan permintaan: ${response.status}`);
  }
  return response.json() as Promise<PermintaanBarangRecord>;
}

export interface PermintaanListParams {
  page?: number;
  limit?: number;
  approval?: ApprovalPermintaan;
}

export interface PermintaanListResponse {
  data: PermintaanBarangRecord[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

async function parseListError(response: Response, fallback: string): Promise<never> {
  const data = (await response.json().catch(() => null)) as { message?: string } | null;
  throw new Error(data?.message || `${fallback}: ${response.status}`);
}

export async function listPermintaan(
  params: PermintaanListParams = {},
): Promise<PermintaanListResponse> {
  const query = new URLSearchParams({
    page: String(Math.max(1, params.page ?? 1)),
    limit: String(Math.min(100, Math.max(1, params.limit ?? 100))),
  });
  if (params.approval) query.set("approval", params.approval);
  const response = await fetch(`${apiUrl}/permintaan-barang?${query}`);
  if (!response.ok) await parseListError(response, "Gagal memuat daftar permintaan");
  return response.json() as Promise<PermintaanListResponse>;
}

export async function setApprovalPermintaan(
  id: number,
  approval: ApprovalPermintaan,
): Promise<PermintaanBarangRecord> {
  const response = await fetch(`${apiUrl}/permintaan-barang/${id}/approval`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approval }),
  });
  if (!response.ok) await parseListError(response, "Gagal memperbarui status approval");
  return response.json() as Promise<PermintaanBarangRecord>;
}

export async function deletePermintaan(id: number): Promise<{ message: string }> {
  const response = await fetch(`${apiUrl}/permintaan-barang/${id}`, { method: "DELETE" });
  if (!response.ok) await parseListError(response, "Gagal menghapus permintaan");
  return response.json() as Promise<{ message: string }>;
}
