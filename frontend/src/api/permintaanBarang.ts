import { authHeaders } from "./auth";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";

export type ApprovalPermintaan = "BELUM_DISETUJUI" | "DISETUJUI";
export type SumberPermintaan = "MANUAL" | "HASIL_PRODUKSI";

export interface PermintaanItemInput {
  itemId?: number | null;
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

export type StatusKeputusanItem = "MENUNGGU" | "DISETUJUI" | "DITOLAK";

export interface KeputusanItemInput {
  id: number;
  jumlahDisetujui: number;
}

export interface PermintaanItemRecord {
  id: number;
  permintaanId: number;
  itemId: number | null;
  nama: string;
  statusKeputusan: StatusKeputusanItem;
  jumlahDisetujui: number | null;
  spesifikasi: string | null;
  jumlah: number;
  satuan: string | null;
  item?: {
    id: number;
    kode: string;
    nama: string;
    unit: string;
    divisiId: number | null;
  } | null;
}

export interface PermintaanDivisi {
  id: number;
  nama: string;
}

export interface PermintaanBarangRecord {
  id: number;
  noPermintaan: string;
  tanggal: string;
  departemen: string;
  divisiPemintaId: number | null;
  divisiApproverId: number | null;
  divisiPeminta?: PermintaanDivisi | null;
  divisiApprover?: PermintaanDivisi | null;
  namaPeminta: string;
  kebutuhanUntuk: string;
  prioritas: string;
  tanggalDibutuhkan: string | null;
  alasan: string;
  approval: ApprovalPermintaan;
  sumber: SumberPermintaan;
  autoKey: string | null;
  createdAt: string;
  updatedAt: string;
  items: PermintaanItemRecord[];
}

export class PermintaanBarangApiError extends Error {
  readonly status: number;
  readonly kode?: string;

  constructor(message: string, status: number, kode?: string) {
    super(message);
    this.name = "PermintaanBarangApiError";
    this.status = status;
    this.kode = kode;
  }
}

export function pesanKesalahanPermintaan(error: unknown): string {
  if (error instanceof PermintaanBarangApiError) {
    const label =
      error.status === 403
        ? "Akses ditolak"
        : error.status === 409
          ? "Konflik data"
          : error.status === 422
            ? "Data item belum valid"
            : "Gagal memproses";
    const kode = error.kode ? ` [${error.kode}]` : "";
    return `${label} (${error.status})${kode}: ${error.message}`;
  }

  return error instanceof Error
    ? error.message
    : "Terjadi kesalahan saat memproses permintaan.";
}

export async function createPermintaan(
  payload: CreatePermintaanPayload,
): Promise<PermintaanBarangRecord> {
  const response = await fetch(`${apiUrl}/permintaan-barang`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!response.ok) await parseError(response, "Gagal menyimpan permintaan");
  return response.json() as Promise<PermintaanBarangRecord>;
}

export interface PermintaanListParams {
  page?: number;
  limit?: number;
  approval?: ApprovalPermintaan;
  dari?: string;
  sampai?: string;
  divisiPemintaId?: number;
  divisiApproverId?: number;
  sumber?: SumberPermintaan;
}

export interface PermintaanListResponse {
  data: PermintaanBarangRecord[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

async function parseError(response: Response, fallback: string): Promise<never> {
  const data = (await response.json().catch(() => null)) as {
    message?: string;
    kode?: string;
  } | null;
  throw new PermintaanBarangApiError(
    data?.message || `${fallback}: ${response.status}`,
    response.status,
    data?.kode,
  );
}

export async function listPermintaan(
  params: PermintaanListParams = {},
): Promise<PermintaanListResponse> {
  const query = new URLSearchParams({
    page: String(Math.max(1, params.page ?? 1)),
    limit: String(Math.min(100, Math.max(1, params.limit ?? 100))),
  });
  if (params.approval) query.set("approval", params.approval);
  if (params.dari) query.set("dari", params.dari);
  if (params.sampai) query.set("sampai", params.sampai);
  if (params.divisiPemintaId) {
    query.set("divisiPemintaId", String(params.divisiPemintaId));
  }
  if (params.divisiApproverId) {
    query.set("divisiApproverId", String(params.divisiApproverId));
  }
  if (params.sumber) query.set("sumber", params.sumber);
  const response = await fetch(`${apiUrl}/permintaan-barang?${query}`, { headers: authHeaders() });
  if (!response.ok) await parseError(response, "Gagal memuat daftar permintaan");
  return response.json() as Promise<PermintaanListResponse>;
}

export async function petakanItemPermintaan(
  permintaanId: number,
  barangItemId: number,
  itemId: number,
): Promise<PermintaanItemRecord> {
  const response = await fetch(`${apiUrl}/permintaan-barang/${permintaanId}/items/${barangItemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ itemId }),
  });
  if (!response.ok) await parseError(response, "Gagal memetakan item ke master");
  return response.json() as Promise<PermintaanItemRecord>;
}

export async function setApprovalPermintaan(
  id: number,
  approval: ApprovalPermintaan,
  items?: KeputusanItemInput[],
): Promise<PermintaanBarangRecord> {
  const response = await fetch(`${apiUrl}/permintaan-barang/${id}/approval`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(items ? { approval, items } : { approval }),
  });
  if (!response.ok) await parseError(response, "Gagal memperbarui status approval");
  return response.json() as Promise<PermintaanBarangRecord>;
}

export async function deletePermintaan(id: number): Promise<{ message: string }> {
  const response = await fetch(`${apiUrl}/permintaan-barang/${id}`, { method: "DELETE", headers: authHeaders() });
  if (!response.ok) await parseError(response, "Gagal menghapus permintaan");
  return response.json() as Promise<{ message: string }>;
}
