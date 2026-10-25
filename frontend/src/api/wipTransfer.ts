import { authHeaders, redirectToLogin } from "./auth";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";

export type ArahWipTransfer = "KIRIM" | "MINTA";
export type StatusWipTransfer = "MENUNGGU" | "DISETUJUI" | "DITOLAK";

export interface WipTransferUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface WipTransferItemRef {
  id: number;
  kode: string;
  nama: string;
  unit: string;
  jenis: string | null;
  divisiId: number | null;
  isActive: boolean;
}

export interface WipTransferItem {
  id: number;
  transferId: number;
  itemId: number;
  jumlah: number;
  satuan: string | null;
  jumlahDisetujui: number | null;
  pemakaianMaterialItemId: number | null;
  createdAt: string;
  updatedAt: string;
  item: WipTransferItemRef;
  wipTersedia?: number;
}

export interface WipTransferRecord {
  id: number;
  nomor: string;
  tanggal: string;
  divisiAsalId: number;
  divisiTujuanId: number;
  arah: ArahWipTransfer;
  status: StatusWipTransfer;
  userId: number | null;
  approvedById: number | null;
  approvedAt: string | null;
  keterangan: string | null;
  createdAt: string;
  updatedAt: string;
  divisiAsal: { id: number; nama: string };
  divisiTujuan: { id: number; nama: string };
  user: WipTransferUser | null;
  approvedBy: WipTransferUser | null;
  pemakaianMaterial: { id: number; nomor: string; tanggal: string } | null;
  items: WipTransferItem[];
}

export interface WipTransferListResponse {
  data: WipTransferRecord[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface WipTransferOpsiItem {
  itemId: number;
  kode: string;
  nama: string;
  unit: string;
  divisiAsalId: number;
  divisiAsalNama: string;
  wipTersedia: number;
}

export interface WipTransferKekuranganItem {
  transferItemId?: number;
  itemId: number;
  kode: string;
  nama: string;
  unit: string;
  diminta: number;
  tersedia: number;
  kekurangan: number;
}

export interface WipTransferKekurangan {
  divisiAsalId: number;
  items: WipTransferKekuranganItem[];
}

export class WipTransferApiError extends Error {
  readonly status: number;
  readonly kode?: string;
  readonly dataKekurangan?: WipTransferKekurangan;

  constructor(
    message: string,
    status: number,
    body?: { kode?: string; dataKekurangan?: WipTransferKekurangan },
  ) {
    super(message);
    this.name = "WipTransferApiError";
    this.status = status;
    this.kode = body?.kode;
    this.dataKekurangan = body?.dataKekurangan;
  }
}

function toQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      kode?: string;
      dataKekurangan?: WipTransferKekurangan;
    } | null;
    throw new WipTransferApiError(
      body?.message || `Request failed: ${response.status}`,
      response.status,
      body ?? undefined,
    );
  }

  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function getWipTransferOpsi(params: {
  arah: ArahWipTransfer;
  divisiAsalId?: number;
  itemId?: number;
}): Promise<WipTransferOpsiItem[]> {
  const query = toQuery({
    arah: params.arah,
    divisiAsalId: params.divisiAsalId,
    itemId: params.itemId,
  });
  const result = await request<{ data: WipTransferOpsiItem[] }>(`/wip-transfer/opsi${query}`);
  return result.data;
}

export async function listWipTransfer(params: {
  page?: number;
  limit?: number;
  arah?: ArahWipTransfer;
  status?: StatusWipTransfer;
  divisiAsalId?: number;
  divisiTujuanId?: number;
  dari?: string;
  sampai?: string;
} = {}): Promise<WipTransferListResponse> {
  const query = toQuery({
    page: params.page ?? 1,
    limit: params.limit ?? 20,
    arah: params.arah,
    status: params.status,
    divisiAsalId: params.divisiAsalId,
    divisiTujuanId: params.divisiTujuanId,
    dari: params.dari,
    sampai: params.sampai,
  });
  return request<WipTransferListResponse>(`/wip-transfer${query}`);
}

export async function getWipTransfer(id: number): Promise<WipTransferRecord> {
  return request<WipTransferRecord>(`/wip-transfer/${id}`);
}

export async function createWipTransfer(payload: {
  arah: ArahWipTransfer;
  tanggal?: string;
  divisiAsalId?: number;
  divisiTujuanId?: number;
  keterangan?: string | null;
  items: Array<{ itemId: number; jumlah: number }>;
}): Promise<WipTransferRecord> {
  return request<WipTransferRecord>("/wip-transfer", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function approveWipTransfer(
  id: number,
  payload: {
    status: "DISETUJUI" | "DITOLAK";
    items?: Array<{ id: number; jumlahDisetujui: number }>;
  },
): Promise<WipTransferRecord> {
  return request<WipTransferRecord>(`/wip-transfer/${id}/approval`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteWipTransfer(id: number): Promise<{ id: number }> {
  return request<{ id: number }>(`/wip-transfer/${id}`, { method: "DELETE" });
}
