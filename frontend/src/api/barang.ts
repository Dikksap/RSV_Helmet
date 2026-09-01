const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

export type StatusBarang = "REGISTER" | "FINISHGOOD" | "RETUR" | "OUT" | "BAD";

export interface BarangVariant {
  id: number;
  kodeVariant: string;
  productId: number;
  styleId: number;
  colorId: number;
  sizeId: number;
  product: { nama: string; prefix: string };
  style: { nama: string };
  color: { nama: string };
  size: { nama: string };
}

export interface Barang {
  id: number;
  kodeBarang: string;
  variantId: number;
  batchId: number;
  status: StatusBarang;
  tanggal: string;
  createdAt: string;
  updatedAt: string;
  variant: BarangVariant;
  batch: {
    id: number;
    nomorBatch: number;
    totalProduksi: number;
    kapasitas: number;
    status: string;
  };
}

interface BarangPageResponse {
  data: Barang[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface BarangResponse {
  data: Barang[];
  meta: BarangPageResponse["meta"];
}

export function dedupeBarangById<T extends { id: number }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

export interface BarangListParams {
  page?: number;
  limit?: number;
  variantId?: number;
  batchId?: number;
  status?: StatusBarang;
  tanggalAwal?: string;
  tanggalAkhir?: string;
}

export async function getBarangPage(
  params: BarangListParams = {},
): Promise<BarangResponse> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 20),
  });
  if (params.variantId) query.set("variantId", String(params.variantId));
  if (params.batchId) query.set("batchId", String(params.batchId));
  if (params.status) query.set("status", params.status);
  if (params.tanggalAwal) query.set("tanggalAwal", params.tanggalAwal);
  if (params.tanggalAkhir) query.set("tanggalAkhir", params.tanggalAkhir);

  const response = await fetch(`${apiUrl}/barang?${query}`);
  if (!response.ok) {
    throw new Error(`Gagal mengambil data barang: ${response.status}`);
  }
  return response.json() as Promise<BarangResponse>;
}

export async function searchBarang(
  q: string,
  limit = 50,
): Promise<{ data: Barang[]; meta: { q: string; count: number } }> {
  const query = new URLSearchParams({ q: q.trim(), limit: String(limit) });
  const response = await fetch(`${apiUrl}/barang/search?${query}`);
  if (!response.ok) {
    throw new Error(`Gagal mencari barang: ${response.status}`);
  }
  return response.json() as Promise<{
    data: Barang[];
    meta: { q: string; count: number };
  }>;
}

export interface ExportBarangParams {
  format?: "json" | "csv";
  page?: number;
  limit?: number;
  variantId?: number;
  batchId?: number;
  status?: StatusBarang;
  tanggalAwal?: string;
  tanggalAkhir?: string;
}

export async function exportBarang(
  params: ExportBarangParams = {},
): Promise<Blob> {
  const query = new URLSearchParams({
    format: params.format ?? "csv",
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 10000),
  });
  if (params.variantId) query.set("variantId", String(params.variantId));
  if (params.batchId) query.set("batchId", String(params.batchId));
  if (params.status) query.set("status", params.status);
  if (params.tanggalAwal) query.set("tanggalAwal", params.tanggalAwal);
  if (params.tanggalAkhir) query.set("tanggalAkhir", params.tanggalAkhir);

  const response = await fetch(`${apiUrl}/barang/export?${query}`);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(payload?.message || `Gagal export barang: ${response.status}`);
  }
  return response.blob();
}

export interface BarangStats {
  total: number;
  perStatus: Record<StatusBarang, number>;
  perVariant: Array<{ variantId: number; nama: string; total: number }>;
  perBatch: Array<{
    batchId: number;
    nomorBatch: string | number;
    total: number;
  }>;
}

export interface BatchRentangTanggal {
  batchId: number;
  nomorBatch: string;
  totalProduksi: number;
  tanggalMulai: string;
  tanggalSelesai: string;
}

export interface BatchRentangTanggalResponse {
  selesai: BatchRentangTanggal[];
  aktif: BatchRentangTanggal[];
}

export async function getBatchRentangTanggal(
  params: { tanggalAwal?: string; tanggalAkhir?: string } = {},
): Promise<BatchRentangTanggalResponse> {
  const query = new URLSearchParams();
  if (params.tanggalAwal) query.set("tanggalAwal", params.tanggalAwal);
  if (params.tanggalAkhir) query.set("tanggalAkhir", params.tanggalAkhir);
  const queryString = query.toString();
  const response = await fetch(
    `${apiUrl}/barang/batch-rentang-tanggal${
      queryString ? `?${queryString}` : ""
    }`,
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(
      payload?.message ||
        `Gagal mengambil data rentang tanggal batch: ${response.status}`,
    );
  }
  return response.json() as Promise<BatchRentangTanggalResponse>;
}

export interface FinishgoodPerBulan {
  bulan: string;
  tahun: number;
  bulanAngka: number;
  variantId: number;
  productId: number;
  jumlah: number;
}

export interface FinishgoodPerBulanParams {
  variantId?: number;
  productId?: number;
  tanggalAwal?: string;
  tanggalAkhir?: string;
}

export interface FinishgoodPerBulanResponse {
  data: FinishgoodPerBulan[];
  meta: { variantId?: number; productId?: number };
}

export async function getFinishgoodPerBulan(
  params: FinishgoodPerBulanParams = {},
): Promise<FinishgoodPerBulanResponse> {
  const query = new URLSearchParams();
  if (params.variantId) query.set("variantId", String(params.variantId));
  if (params.productId) query.set("productId", String(params.productId));
  if (params.tanggalAwal) query.set("tanggalAwal", params.tanggalAwal);
  if (params.tanggalAkhir) query.set("tanggalAkhir", params.tanggalAkhir);
  const queryString = query.toString();
  const response = await fetch(
    `${apiUrl}/barang/finishgood-per-bulan${
      queryString ? `?${queryString}` : ""
    }`,
  );
  if (!response.ok) {
    throw new Error(
      `Gagal mengambil data finishgood per bulan: ${response.status}`,
    );
  }
  return response.json() as Promise<FinishgoodPerBulanResponse>;
}

export async function getBarangStats(
  params: {
    variantId?: number;
    batchId?: number;
  } = {},
): Promise<BarangStats> {
  const query = new URLSearchParams();
  if (params.variantId) query.set("variantId", String(params.variantId));
  if (params.batchId) query.set("batchId", String(params.batchId));
  const queryString = query.toString();
  const response = await fetch(
    `${apiUrl}/barang/stats${queryString ? `?${queryString}` : ""}`,
  );
  if (!response.ok) {
    throw new Error(`Gagal mengambil statistik barang: ${response.status}`);
  }
  return response.json() as Promise<BarangStats>;
}

export async function getBarang(): Promise<BarangResponse> {
  const response = await fetch(`${apiUrl}/barang?page=1&limit=100`);

  if (!response.ok) {
    throw new Error(`Failed to fetch barang: ${response.status}`);
  }

  const firstPage = (await response.json()) as BarangPageResponse;
  const pages = await Promise.all(
    Array.from({ length: firstPage.meta.totalPages - 1 }, (_, index) =>
      fetch(`${apiUrl}/barang?page=${index + 2}&limit=100`).then(
        (pageResponse) => {
          if (!pageResponse.ok)
            throw new Error(`Failed to fetch barang page ${index + 2}`);
          return pageResponse.json() as Promise<BarangPageResponse>;
        },
      ),
    ),
  );

  return {
    data: dedupeBarangById([firstPage, ...pages].flatMap((page) => page.data)),
    meta: firstPage.meta,
  };
}

export interface GenerateInfo {
  variantId: number;
  kodeVariant: string;
  tanggal: string;
  batch: {
    kodeBatch: string;
    totalProduksi: number;
    kapasitas: number;
    remaining: number;
  };
  nextNumber: number;
}

export interface GenerateResponse {
  message: string;
  totalDibuat: number;
  batches: Array<{
    kodeBatch: string;
    batchId: number;
    jumlah: number;
    barang: Array<{ kodeBarang: string; id: number }>;
  }>;
}

async function parseApiError(
  response: Response,
  fallback: string,
): Promise<Error> {
  const payload = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;
  if (response.status === 404) return new Error("Variant tidak ditemukan");
  if (response.status >= 500) return new Error("Gagal generate barang");
  return new Error(payload?.message || fallback);
}

export async function getGenerateInfo(
  variantId: number,
): Promise<GenerateInfo> {
  const response = await fetch(
    `${apiUrl}/barang/generate-info?variantId=${variantId}`,
  );
  if (!response.ok)
    throw await parseApiError(response, "Gagal mengambil informasi generate");
  return response.json() as Promise<GenerateInfo>;
}

export async function generateBarang(
  variantId: number,
): Promise<GenerateResponse> {
  const response = await fetch(`${apiUrl}/barang/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ variantId, jumlah: 1 }),
  });
  if (!response.ok)
    throw await parseApiError(response, "Gagal generate barang");
  return response.json() as Promise<GenerateResponse>;
}

export async function getScanBarang(kodeBarang: string): Promise<Barang> {
  const response = await fetch(
    `${apiUrl}/barang/scan/${encodeURIComponent(kodeBarang)}`,
  );
  if (!response.ok)
    throw await parseApiError(response, "Barang tidak ditemukan");
  return response.json() as Promise<Barang>;
}

export interface BulkScanItemResult {
  id?: number;
  kodeBarang: string;
  reason?: string;
}

export interface BulkScanResponse {
  success: BulkScanItemResult[];
  failed: BulkScanItemResult[];
}

export async function bulkScanBarang(
  kodeBarang: string[],
  status: StatusBarang,
  keterangan?: string,
): Promise<BulkScanResponse> {
  const response = await fetch(`${apiUrl}/barang/scan/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kodeBarang, status, keterangan }),
  });
  if (!response.ok)
    throw await parseApiError(response, "Gagal simpan hasil scan");
  return response.json() as Promise<BulkScanResponse>;
}
