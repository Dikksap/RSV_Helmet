import { authHeaders, redirectToLogin } from "./auth";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";

export type StatusPemakaianMaterial = "DRAFT" | "DICATAT" | "DIVERIFIKASI";

export interface PemakaianItemInput {
  permintaanBarangItemId: number;
  jumlahSisa: number;
  satuan?: string | null;
  keteranganSisa?: string | null;
}

export interface CreatePemakaianPayload {
  permintaanId: number;
  divisiId: number;
  tanggal?: string | null;
  keterangan?: string | null;
  items: PemakaianItemInput[];
}

export interface PemakaianItemRecord {
  id: number;
  pemakaianId: number;
  permintaanBarangItemId: number;
  itemId: number | null;
  jumlahDiterima: number;
  jumlahDipakai: number;
  jumlahSisa: number;
  satuan: string | null;
  keteranganSisa: string | null;
  createdAt: string;
  updatedAt: string;
  permintaanItem?: {
    id: number;
    nama: string;
    jumlah: number;
    satuan: string | null;
    itemId: number | null;
    item?: { id: number; kode: string; nama: string; unit: string } | null;
  } | null;
  item?: { id: number; kode: string; nama: string; unit: string } | null;
}

export interface PemakaianMaterialRecord {
  id: number;
  nomor: string;
  permintaanId: number;
  divisiId: number;
  tanggal: string;
  userId: number | null;
  keterangan: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: number; name: string; email: string; role: string } | null;
  divisi?: { id: number; nama: string } | null;
  permintaan?: {
    id: number;
    noPermintaan: string;
    tanggal: string;
    departemen: string;
    namaPeminta: string;
    approval: string;
    items: Array<{
      id: number;
      nama: string;
      jumlah: number;
      satuan: string | null;
      itemId: number | null;
      item?: { id: number; kode: string; nama: string; unit: string } | null;
    }>;
  } | null;
  items: PemakaianItemRecord[];
}

export interface PemakaianListResponse {
  data: PemakaianMaterialRecord[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface PemakaianListParams {
  page?: number;
  limit?: number;
  permintaanId?: number;
  divisiId?: number;
  status?: StatusPemakaianMaterial;
  dari?: string;
  sampai?: string;
}

export interface StokDivisiMaterial {
  itemId: number | null;
  key: string;
  nama: string;
  jenis: string | null;
  satuan: string | null;
  diterima: number;
  masuk: number;
  dipakai: number;
  sisa: number;
}

export interface StokDivisiRecord {
  divisiId: number;
  divisiNama: string;
  materials: StokDivisiMaterial[];
}

export const PEMAKAIAN_DIPAKAI_PRODUKSI = "PEMAKAIAN_DIPAKAI_PRODUKSI";

export class PemakaianMaterialApiError extends Error {
  readonly status: number;
  readonly kode?: string;

  constructor(message: string, status: number, kode?: string) {
    super(message);
    this.name = "PemakaianMaterialApiError";
    this.status = status;
    this.kode = kode;
  }
}

export function pesanKesalahanPemakaian(error: unknown, fallback: string): string {
  if (!(error instanceof PemakaianMaterialApiError)) {
    return error instanceof Error ? error.message : fallback;
  }
  if (error.kode === PEMAKAIAN_DIPAKAI_PRODUKSI) {
    return `${error.message} (409)`;
  }
  if (error.status === 409) {
    return `Konflik data (409): ${error.message}`;
  }
  return error.message;
}

function toSearchParams(params: PemakaianListParams) {
  const query = new URLSearchParams({
    page: String(Math.max(1, params.page ?? 1)),
    limit: String(Math.min(100, Math.max(1, params.limit ?? 50))),
  });
  if (params.permintaanId) query.set("permintaanId", String(params.permintaanId));
  if (params.divisiId) query.set("divisiId", String(params.divisiId));
  if (params.status) query.set("status", params.status);
  if (params.dari) query.set("dari", params.dari);
  if (params.sampai) query.set("sampai", params.sampai);
  return query;
}

async function authRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    if (response.status === 401) redirectToLogin();
    const data = (await response.json().catch(() => null)) as {
      message?: string;
      kode?: string;
    } | null;
    throw new PemakaianMaterialApiError(
      data?.message || `Request failed: ${response.status}`,
      response.status,
      data?.kode,
    );
  }

  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function listPemakaianMaterial(
  params: PemakaianListParams = {},
): Promise<PemakaianListResponse> {
  return authRequest<PemakaianListResponse>(`/pemakaian-material?${toSearchParams(params)}`);
}

export async function getPemakaianMaterial(id: number): Promise<PemakaianMaterialRecord> {
  return authRequest<PemakaianMaterialRecord>(`/pemakaian-material/${id}`);
}

// Rentang tanggal opsional: Diterima = saldo WIP awal periode, Masuk/Keluar = mutasi
// periode, Sisa = saldo WIP akhir periode.
export async function getStokDivisi(
  params: { dari?: string; sampai?: string } = {},
): Promise<StokDivisiRecord[]> {
  const query = new URLSearchParams();
  if (params.dari) query.set("dari", params.dari);
  if (params.sampai) query.set("sampai", params.sampai);
  const qs = query.toString();
  const result = await authRequest<{ data: StokDivisiRecord[] }>(
    `/pemakaian-material/stok-divisi${qs ? `?${qs}` : ""}`,
  );
  return result.data;
}

export async function createPemakaianMaterial(
  payload: CreatePemakaianPayload,
): Promise<PemakaianMaterialRecord> {
  return authRequest<PemakaianMaterialRecord>("/pemakaian-material", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updatePemakaianMaterial(
  id: number,
  payload: CreatePemakaianPayload,
): Promise<PemakaianMaterialRecord> {
  return authRequest<PemakaianMaterialRecord>(`/pemakaian-material/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function setPemakaianMaterialStatus(
  id: number,
  status: StatusPemakaianMaterial,
): Promise<PemakaianMaterialRecord> {
  return authRequest<PemakaianMaterialRecord>(`/pemakaian-material/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function deletePemakaianMaterial(id: number): Promise<{ message: string }> {
  return authRequest<{ message: string }>(`/pemakaian-material/${id}`, { method: "DELETE" });
}
