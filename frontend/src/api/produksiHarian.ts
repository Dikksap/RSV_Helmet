import { authHeaders, redirectToLogin } from "./auth";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";

export interface ProduksiItem {
  id: number;
  kode: string;
  nama: string;
  unit: string;
  jenis: string | null;
  stok: number | string;
  defaultInventoryLocationId: number | null;
}

export interface Lokasi {
  id: number;
  code: string;
  name: string;
  type: "WAREHOUSE" | "DIVISION";
  gudang?: { id: number; kode: string; name: string } | null;
  divisi?: { id: number; nama: string } | null;
}

export interface OutputOption {
  subassemblyId: number;
  subassemblyKode: string;
  subassemblyNama: string;
  item: ProduksiItem;
  bom: { id: number; nama: string; version: string } | null;
}

export interface OpsiProduksi {
  outputs: OutputOption[];
  divisions: { id: number; nama: string }[];
  warehouses: Lokasi[];
}

export interface StokGudang {
  location: {
    id: number;
    code: string;
    name: string;
    gudang?: { id: number; kode: string; name: string } | null;
  };
  items: {
    itemId: number;
    kode: string;
    nama: string;
    unit: string;
    jenis: string | null;
    isActive: boolean;
    quantity: number;
  }[];
}

export interface StokLokasi {
  locationId: number;
  code: string;
  name: string;
  type: "WAREHOUSE" | "DIVISION";
  gudang?: { id: number; kode: string; name: string } | null;
  divisi?: { id: number; nama: string } | null;
  quantity: number;
}

export interface BomLine {
  itemId: number;
  kode: string;
  nama: string;
  unit: string | null;
  jenis: string | null;
  jumlah: number;
  stok: StokLokasi[];
}

export interface BomPreview {
  output: ProduksiItem;
  jumlah: number;
  divisionLocationId: number | null;
  lines: BomLine[];
}

export interface ProduksiRecord {
  id: number;
  nomor: string;
  tanggalProduksi: string;
  divisiId: number;
  divisi?: { id: number; nama: string } | null;
  tujuanLocation?: Lokasi | null;
  user?: { id: number; name: string } | null;
  keterangan: string | null;
  createdAt: string;
  items: {
    id: number;
    itemId: number;
    tipe: "BAHAN" | "HASIL";
    jumlah: number | string;
    item: ProduksiItem;
    sumberLocation?: Lokasi | null;
  }[];
}

export interface ProduksiList {
  data: ProduksiRecord[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateProduksiPayload {
  tanggalProduksi: string;
  divisiId: number;
  outputItemId: number;
  jumlah: number;
  tujuanLocationId: number;
  keterangan?: string;
  bahan: { itemId: number; sumberLocationId: number }[];
}

export interface PenerimaanPayload {
  tanggal: string;
  itemId: number;
  locationId: number;
  jumlah: number;
  keterangan?: string;
  idempotencyKey?: string;
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
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.message === "string") message = body.message;
    } catch {
      /* ignore */
    }
    if (res.status === 401) {
      redirectToLogin();
      throw new Error("Sesi telah berakhir. Silakan login ulang.");
    }
    throw new Error(message);
  }
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export const getOpsiProduksi = () => request<OpsiProduksi>("/produksi-harian/opsi");

export const getLokasiProduksi = () => request<Lokasi[]>("/produksi-harian/lokasi");

export const getStokGudang = () => request<StokGudang[]>("/produksi-harian/stok-gudang");

export const getBomPreview = (outputItemId: number, jumlah: number, divisiId?: number | null) => {
  const params = new URLSearchParams({ outputItemId: String(outputItemId), jumlah: String(jumlah) });
  if (divisiId) params.set("divisiId", String(divisiId));
  return request<BomPreview>(`/produksi-harian/bom-preview?${params}`);
};

export const listProduksiHarian = (params: { page?: number; limit?: number; divisiId?: number | null; dari?: string; sampai?: string } = {}) => {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.divisiId) query.set("divisiId", String(params.divisiId));
  if (params.dari) query.set("dari", params.dari);
  if (params.sampai) query.set("sampai", params.sampai);
  const suffix = query.toString();
  return request<ProduksiList>(`/produksi-harian${suffix ? `?${suffix}` : ""}`);
};

export const createProduksiHarian = (payload: CreateProduksiPayload) =>
  request<ProduksiRecord>("/produksi-harian", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const createPenerimaanBahan = (payload: PenerimaanPayload) =>
  request<{ movement: unknown; item: ProduksiItem; lokasiStok: number }>("/produksi-harian/penerimaan", {
    method: "POST",
    body: JSON.stringify(payload),
  });
