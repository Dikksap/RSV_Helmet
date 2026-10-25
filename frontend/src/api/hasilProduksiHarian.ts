import { authHeaders, redirectToLogin } from "./auth";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";

export type TipeHasilProduksiItem = "MASUK" | "KELUAR" | "HASIL";

export interface HasilProduksiItemRef {
  id: number;
  kode: string;
  nama: string;
  unit: string;
  jenis: string | null;
}

export interface StokMutasiRingkas {
  id: number;
  tipe: "MASUK" | "KELUAR";
  jumlah: number | string;
  tanggal: string;
}

export interface WipKonsumsiRingkas {
  id: number;
  jumlah: number | string;
  pemakaianMaterialItem: {
    id: number;
    pemakaian: {
      tanggal: string;
      divisi: { id: number; nama: string };
    };
  };
}

export interface WipMasukRingkas {
  id: number;
  jumlahDiterima: number | string;
  jumlahDipakai: number | string;
  jumlahSisa: number | string;
  satuan: string | null;
  pemakaian: {
    id: number;
    nomor: string;
    tanggal: string;
    sumber: string;
    divisi: { id: number; nama: string };
  };
}

export interface HasilProduksiItemRecord {
  id: number;
  hasilProduksiHarianId: number;
  itemId: number;
  tipe: TipeHasilProduksiItem;
  jumlah: number | string;
  keterangan: string | null;
  createdAt: string;
  item: HasilProduksiItemRef;
  stokMutasi?: StokMutasiRingkas | null;
  pemakaian?: WipKonsumsiRingkas[];
  wipMasuk?: WipMasukRingkas | null;
}

export interface HasilProduksiRecord {
  id: number;
  nomor: string;
  tanggalProduksi: string;
  divisiId: number;
  keterangan: string | null;
  createdAt: string;
  updatedAt: string;
  divisi: { id: number; nama: string };
  items: HasilProduksiItemRecord[];
}

export interface HasilProduksiListResponse {
  data: HasilProduksiRecord[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface HasilProduksiListParams {
  page?: number;
  limit?: number;
  divisiId?: number;
  dari?: string;
  sampai?: string;
  q?: string;
}

export interface HasilProduksiRekapParams {
  divisiId?: number;
  itemId?: number;
  dari?: string;
  sampai?: string;
}

export interface CreateHasilProduksiItem {
  itemId: number;
  tipe: TipeHasilProduksiItem;
  jumlah: number;
  keterangan?: string | null;
}

export interface CreateHasilProduksiPayload {
  divisiId: number;
  tanggalProduksi?: string;
  nomor?: string | null;
  keterangan?: string | null;
  items: CreateHasilProduksiItem[];
}

export interface RekapTipe {
  masuk: number;
  keluar: number;
  hasil: number;
}

export interface RekapItem extends RekapTipe {
  itemId: number;
  itemKode: string;
  itemNama: string;
  satuan: string;
}

export interface RekapTanggal extends RekapItem {
  tanggal: string;
  divisiId: number;
  divisiNama: string;
}

export interface RekapDivisi extends RekapItem {
  divisiId: number;
  divisiNama: string;
}

export interface RekapData {
  perTanggal: RekapTanggal[];
  perDivisi: RekapDivisi[];
  perItem: RekapItem[];
  total: RekapTipe;
}

export interface RekapResponse {
  data: RekapData;
}

export interface WipRow {
  itemId: number;
  kode: string;
  nama: string;
  unit: string;
  jenis: string | null;
  divisiId: number | null;
  divisiNama: string | null;
  saldoAwal: number;
  masuk: number;
  keluar: number;
  saldoAkhir: number;
}

export interface WipResponse {
  data: WipRow[];
}

export interface WipLedgerHarianRow {
  tanggal: string;
  itemId: number;
  kode: string;
  nama: string;
  unit: string;
  jenis: string | null;
  divisiId: number;
  divisiNama: string;
  stokAwal: number;
  masuk: number;
  keluarProduksi: number;
  keluarTransfer: number;
  keluarLain: number;
  sisa: number;
}

export interface WipLedgerHarianTotal {
  itemId: number;
  kode: string;
  nama: string;
  unit: string;
  stokAwal: number;
  masuk: number;
  keluarProduksi: number;
  keluarTransfer: number;
  keluarLain: number;
  sisa: number;
}

export interface WipLedgerHarianResponse {
  data: WipLedgerHarianRow[];
  total: WipLedgerHarianTotal | null;
}

export interface SaranTransfer {
  itemId: number;
  kode: string;
  nama: string;
  unit: string;
  kekurangan: number;
  divisiAsalId: number | null;
  divisiAsalNama: string | null;
}

export interface WipKurangData {
  divisiId: number;
  divisiNama: string;
  itemId: number;
  itemKode: string;
  itemNama: string;
  unit: string;
  jumlahMasuk: number;
  wipTersedia: number;
  kekurangan: number;
}

export interface PermintaanBarangOtomatis {
  id: number;
  nomor: string;
  status: string;
  items: {
    id: number;
    itemId: number | null;
    nama: string;
    jumlah: number | string;
    satuan: string | null;
  }[];
}

export class HasilProduksiApiError extends Error {
  readonly status: number;
  readonly kode?: string;
  readonly dataKekurangan?: WipKurangData;
  readonly permintaanBarang?: PermintaanBarangOtomatis | null;
  readonly errorPermintaan?: string;
  readonly saranTransfer?: SaranTransfer | null;

  constructor(
    message: string,
    status: number,
    body?: {
      kode?: string;
      dataKekurangan?: WipKurangData;
      permintaanBarang?: PermintaanBarangOtomatis | null;
      errorPermintaan?: string;
      saranTransfer?: SaranTransfer | null;
    },
  ) {
    super(message);
    this.name = "HasilProduksiApiError";
    this.status = status;
    this.kode = body?.kode;
    this.dataKekurangan = body?.dataKekurangan;
    this.permintaanBarang = body?.permintaanBarang;
    this.errorPermintaan = body?.errorPermintaan;
    this.saranTransfer = body?.saranTransfer;
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
      dataKekurangan?: WipKurangData;
      permintaanBarang?: PermintaanBarangOtomatis | null;
      errorPermintaan?: string;
      saranTransfer?: SaranTransfer | null;
    } | null;
    throw new HasilProduksiApiError(
      data?.message || `Request failed: ${response.status}`,
      response.status,
      data ?? undefined,
    );
  }

  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function listHasilProduksiHarian(
  params: HasilProduksiListParams = {},
): Promise<HasilProduksiListResponse> {
  const query = toQuery({
    page: Math.max(1, params.page ?? 1),
    limit: Math.min(100, Math.max(1, params.limit ?? 20)),
    divisiId: params.divisiId,
    dari: params.dari,
    sampai: params.sampai,
    q: params.q?.trim() || undefined,
  });
  return authRequest<HasilProduksiListResponse>(`/hasil-produksi-harian${query}`);
}

export async function getHasilProduksiHarian(id: number): Promise<HasilProduksiRecord> {
  return authRequest<HasilProduksiRecord>(`/hasil-produksi-harian/${id}`);
}

export async function createHasilProduksiHarian(
  payload: CreateHasilProduksiPayload,
): Promise<HasilProduksiRecord> {
  return authRequest<HasilProduksiRecord>("/hasil-produksi-harian", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getRekapHasilProduksiHarian(
  params: HasilProduksiRekapParams = {},
): Promise<RekapResponse> {
  const query = toQuery({
    divisiId: params.divisiId,
    itemId: params.itemId,
    dari: params.dari,
    sampai: params.sampai,
  });
  return authRequest<RekapResponse>(`/hasil-produksi-harian/rekap${query}`);
}

export async function getWipHasilProduksiHarian(
  params: HasilProduksiRekapParams = {},
): Promise<WipResponse> {
  const query = toQuery({
    divisiId: params.divisiId,
    itemId: params.itemId,
    dari: params.dari,
    sampai: params.sampai,
  });
  return authRequest<WipResponse>(`/hasil-produksi-harian/wip${query}`);
}

export async function getWipLedgerHarian(
  params: HasilProduksiRekapParams = {},
): Promise<WipLedgerHarianResponse> {
  const query = toQuery({
    divisiId: params.divisiId,
    itemId: params.itemId,
    dari: params.dari,
    sampai: params.sampai,
  });
  return authRequest<WipLedgerHarianResponse>(`/hasil-produksi-harian/wip/harian${query}`);
}
