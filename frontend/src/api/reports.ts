import { authHeaders, redirectToLogin } from "./auth";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000/api";

export type ReportBasis = "FINISHGOOD" | "PRODUKSI";

export interface ReportFilters {
  from: string;
  to: string;
  productId?: number | null;
  variantId?: number | null;
  orderId?: number | null;
  divisiId?: number | null;
  itemId?: number | null;
  status?: string | null;
  limit?: number | null;
}

export interface ReportWarning {
  code: string;
  message: string;
  count?: number;
}

export interface ReportPeriod {
  from: string;
  to: string;
}

export interface FinishedGoodsSummary {
  period: ReportPeriod;
  basis: "FINISHGOOD";
  totals: {
    productionOutput: number;
    barangGenerated: number;
    fgFirstCount: number;
    registerNotFinishGood: number;
    reject: number;
    repair: number;
    retur: number;
    out: number;
    bad: number;
    statusChanges: number;
    gapProductionVsFinishGood: number;
    legacyUnlinked: number;
  };
  perVariant: Array<{
    variantId: number;
    kodeVariant: string;
    product: string;
    style: string;
    color: string;
    size: string;
    outputQty: number;
    fgFirstCount: number;
    gap: number;
  }>;
  warnings: ReportWarning[];
}

export type ConsumptionComparison = "MATCH" | "TEORITIS_ONLY" | "AKTUAL_ONLY";

export interface MaterialConsumptionReport {
  period: ReportPeriod;
  basis: ReportBasis;
  summary: {
    productionOutput: number;
    finishGoodUnits: number;
    /** Unit FINISHGOOD yang punya tautan dokumen produksi/QC (punya genealogi material). */
    linkedFinishGoodUnits: number;
    /** Unit FINISHGOOD yang tidak punya tautan sehingga tidak dapat diatribusikan. */
    unlinkedFinishGoodUnits: number;
    lotCount: number;
    theoreticalIncomplete: boolean;
    genealogyIncomplete: boolean;
  };
  rows: Array<{
    itemId: number;
    kode: string;
    nama: string;
    jenis: string | null;
    unit: string | null;
    theoreticalQty: number;
    actualQty: number;
    variance: number;
    variancePercentage: number | null;
    comparisonStatus: ConsumptionComparison;
  }>;
  warnings: ReportWarning[];
}

export interface TraceabilityReport {
  period: ReportPeriod;
  total: number;
  rows: Array<{
    kodeBarang: string;
    status: string;
    finishGoodAt: string | null;
    variant: {
      id: number;
      kodeVariant: string;
      product: string;
      style: string;
      color: string;
      size: string;
    };
    production: {
      lineId: number;
      hasilProduksiHarianId: number;
      nomor: string;
      tanggalProduksi: string;
      divisi: { id: number; nama: string };
      stage: { id: number; stage: string; sequence: number } | null;
      bomVersion: string | null;
      outputQuantity: number;
    } | null;
    lotId: number | null;
    genealogySource: "PRODUCTION_OUTPUT" | "QUALITY_INSPECTION" | null;
    materialsPerUnit: Array<{
      itemId: number;
      kode: string;
      nama: string;
      jenis: string | null;
      unit: string | null;
      quantity: number;
    }>;
    statusHistory: Array<{ status: string; tanggal: string; keterangan: string | null }>;
    flags: string[];
  }>;
  warnings: ReportWarning[];
}

export interface ReconciliationReport {
  period: ReportPeriod;
  perVariant: Array<{
    variantId: number;
    kodeVariant: string;
    product: string;
    color: string;
    size: string;
    producedQty: number;
    barangGenerated: number;
    finishGoodQty: number;
    registerNotFinishGood: number;
    retur: number;
    out: number;
    bad: number;
    gapProducedVsGenerated: number;
    bucketTotal: number;
  }>;
  wip: Array<{ itemId: number | null; kode: string; nama: string; unit: string; quantity: number }>;
  legacy: { unlinkedBarang: number; produksiHarianTransaksi: number };
  warnings: ReportWarning[];
  bucketRule: string;
}

export class ReportApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ReportApiError";
    this.status = status;
    this.code = code;
  }
}

export function pesanLaporan(error: unknown, fallback = "Gagal memuat laporan."): string {
  if (error instanceof ReportApiError) {
    if (error.status === 403) return "Akun ini tidak punya izin melihat laporan produksi.";
    if (error.status === 400) return error.message;
    return error.message || fallback;
  }
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export function buildReportQuery(filters: ReportFilters): URLSearchParams {
  const query = new URLSearchParams({ from: filters.from, to: filters.to });
  if (filters.productId) query.set("productId", String(filters.productId));
  if (filters.variantId) query.set("variantId", String(filters.variantId));
  if (filters.orderId) query.set("orderId", String(filters.orderId));
  if (filters.divisiId) query.set("divisiId", String(filters.divisiId));
  if (filters.itemId) query.set("itemId", String(filters.itemId));
  if (filters.status?.trim()) query.set("status", filters.status.trim().toUpperCase());
  if (filters.limit) query.set("limit", String(filters.limit));
  return query;
}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${apiUrl}${path}`, {
    headers: { "Content-Type": "application/json", ...authHeaders() },
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
    throw new ReportApiError(
      typeof payload.message === "string" ? payload.message : `Permintaan gagal (HTTP ${res.status}).`,
      res.status,
      typeof payload.code === "string" ? payload.code : undefined,
    );
  }
  return (await res.json()) as T;
}

export const getFinishedGoodsSummary = (filters: ReportFilters) =>
  request<FinishedGoodsSummary>(`/reports/finished-goods/summary?${buildReportQuery(filters)}`);

export const getMaterialConsumption = (
  filters: ReportFilters & { basis?: ReportBasis },
  basis: ReportBasis = filters.basis ?? "FINISHGOOD",
) => {
  const query = buildReportQuery(filters);
  query.set("basis", basis);
  return request<MaterialConsumptionReport>(`/reports/material-consumption?${query}`);
};

export const getTraceability = (
  filters: ReportFilters & { kodeBarang?: string; barangId?: number },
) => {
  const query = buildReportQuery(filters);
  if (filters.kodeBarang?.trim()) query.set("kodeBarang", filters.kodeBarang.trim());
  if (filters.barangId) query.set("barangId", String(filters.barangId));
  return request<TraceabilityReport>(`/reports/traceability?${query}`);
};

export const getReconciliation = (filters: ReportFilters) =>
  request<ReconciliationReport>(`/reports/reconciliation?${buildReportQuery(filters)}`);
