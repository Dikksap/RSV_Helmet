import { authHeaders, redirectToLogin } from "./auth";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";

export type TipeHasilProduksi = "MASUK" | "KELUAR" | "HASIL";

export interface HasilProduksiItemInput {
  itemId?: number;
  productVariantId?: number | null;
  tipe: TipeHasilProduksi;
  jumlah: number;
  keterangan?: string;
}

export interface HasilProduksiPayload {
  nomor?: string;
  tanggalProduksi?: string;
  divisiId: number;
  routingStageId?: number;
  bomId?: number;
  idempotencyKey: string;
  keterangan?: string;
  items: HasilProduksiItemInput[];
}

export interface WipMasukInfo {
  id: number;
  jumlahDiterima: number | string;
  jumlahDipakai: number | string;
  jumlahSisa: number | string;
  satuan: string | null;
  pemakaian?: {
    id: number;
    nomor: string;
    tanggal: string;
    sumber: string;
    divisi: { id: number; nama: string };
  } | null;
}

export interface HasilProduksiItem {
  id: number;
  itemId: number;
  productVariantId: number | null;
  tipe: TipeHasilProduksi;
  jumlah: number | string;
  keterangan: string | null;
  item: { id: number; kode: string; nama: string; unit: string; jenis: string | null };
  productVariant: {
    id: number;
    kodeVariant: string;
    product: { id: number; nama: string };
    style: { id: number; nama: string };
    color: { id: number; nama: string };
    size: { id: number; nama: string };
  } | null;
  barangDihasilkan: Array<{
    id: number;
    kodeBarang: string;
    status: string;
    finishGoodAt: string | null;
  }>;
  wipMasuk: WipMasukInfo | null;
}

export interface HasilProduksiRecord {
  id: number;
  nomor: string;
  tanggalProduksi: string;
  divisiId: number;
  divisi: { id: number; nama: string } | null;
  routingStageId: number | null;
  routingStage: { id: number; stage: string; sequence: number } | null;
  bomId: number | null;
  bom: { id: number; version: string } | null;
  orderId: number | null;
  productionWorkOrderId: number | null;
  keterangan: string | null;
  createdAt: string;
  items: HasilProduksiItem[];
}

export interface HasilProduksiList {
  data: HasilProduksiRecord[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface WipKurangInfo {
  divisiId?: number;
  divisiNama?: string;
  itemId: number;
  itemKode: string;
  itemNama: string;
  unit: string;
  jumlahMasuk: number;
  wipTersedia: number;
  kekurangan: number;
}

export class HasilProduksiApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly dataKekurangan?: WipKurangInfo;
  readonly saranTransfer?: {
    itemId: number;
    kode: string;
    nama: string;
    unit: string;
    kekurangan: number;
    divisiAsalId: number | null;
    divisiAsalNama: string | null;
  } | null;
  readonly permintaanBarang?: { id: number; noPermintaan: string } | null;
  readonly permintaanError?: string | null;

  constructor(message: string, status: number, payload: Record<string, unknown> = {}) {
    super(message);
    this.name = "HasilProduksiApiError";
    this.status = status;
    this.code = typeof payload.code === "string" ? payload.code : undefined;
    this.dataKekurangan =
      payload.dataKekurangan && typeof payload.dataKekurangan === "object"
        ? (payload.dataKekurangan as WipKurangInfo)
        : undefined;
    this.saranTransfer =
      payload.saranTransfer && typeof payload.saranTransfer === "object"
        ? (payload.saranTransfer as NonNullable<HasilProduksiApiError["saranTransfer"]>)
        : null;
    const permintaan = payload.permintaanBarang;
    this.permintaanBarang =
      permintaan && typeof permintaan === "object" && "noPermintaan" in permintaan
        ? (permintaan as { id: number; noPermintaan: string })
        : null;
    this.permintaanError =
      typeof payload.permintaanError === "string" ? payload.permintaanError : null;
  }
}

/** Pesan siap tampil untuk kode error HP yang dikenal backend. */
export function pesanHasilProduksi(error: unknown, fallback = "Gagal menyimpan hasil produksi."): string {
  if (!(error instanceof HasilProduksiApiError)) {
    return error instanceof Error && error.message.trim() ? error.message : fallback;
  }
  switch (error.code) {
    case "WIP_KURANG": {
      const data = error.dataKekurangan;
      if (!data) return error.message;
      return `WIP ${data.itemNama} (${data.itemKode}) kurang ${data.kekurangan.toLocaleString("id-ID")} ${data.unit}. Tersedia ${data.wipTersedia.toLocaleString("id-ID")}, dibutuhkan ${data.jumlahMasuk.toLocaleString("id-ID")}.`;
    }
    case "ROUTING_INVALID":
      return `${error.message} Periksa konfigurasi Routing Produksi untuk divisi ini.`;
    case "BOM_NOT_FOUND":
      return `${error.message} Lengkapi BOM varian terlebih dahulu.`;
    case "BOM_NOT_EFFECTIVE":
      return `${error.message} Periksa masa berlaku BOM (berlaku mulai/selesai).`;
    case "BOM_AMBIGU":
      return `${error.message} Nonaktifkan salah satu BOM yang berlaku.`;
    case "IDEMPOTENCY_CONFLICT":
      return `${error.message} Muat ulang form sebelum menyimpan ulang.`;
    case "INSUFFICIENT_STOCK":
      return `${error.message} Periksa saldo lokasi divisi atau lakukan penerimaan material.`;
    default:
      return error.message || fallback;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    let payload: Record<string, unknown> = {};
    try {
      const body = await res.json();
      if (body && typeof body === "object") payload = body as Record<string, unknown>;
    } catch {
      /* respons bukan JSON */
    }
    if (res.status === 401) {
      redirectToLogin();
      throw new Error("Sesi telah berakhir. Silakan login ulang.");
    }
    const message =
      typeof payload.message === "string"
        ? String(payload.message)
        : `Permintaan gagal (HTTP ${res.status}).`;
    throw new HasilProduksiApiError(message, res.status, payload);
  }
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export const createHasilProduksi = (payload: HasilProduksiPayload) =>
  request<HasilProduksiRecord>("/hasil-produksi-harian", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const listHasilProduksi = (
  params: { page?: number; limit?: number; divisiId?: number | null; dari?: string; sampai?: string } = {},
) => {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.divisiId) query.set("divisiId", String(params.divisiId));
  if (params.dari) query.set("dari", params.dari);
  if (params.sampai) query.set("sampai", params.sampai);
  const suffix = query.toString();
  return request<HasilProduksiList>(`/hasil-produksi-harian${suffix ? `?${suffix}` : ""}`);
};

export const getHasilProduksiById = (id: number) =>
  request<HasilProduksiRecord>(`/hasil-produksi-harian/${id}`);
