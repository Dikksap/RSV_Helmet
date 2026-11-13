import type { ReportFilters } from "../../../api/reports";

export type LaporanFiltersState = {
  from: string;
  to: string;
  productId: string;
  variantId: string;
  divisiId: string;
  itemId: string;
  status: string;
};

function isoDate(date: Date): string {
  return date.toLocaleDateString("en-CA");
}

/** Periode default: awal bulan berjalan sampai hari ini. */
export function defaultPeriod(): { from: string; to: string } {
  const now = new Date();
  const awal = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: isoDate(awal), to: isoDate(now) };
}

export function defaultFilters(): LaporanFiltersState {
  const period = defaultPeriod();
  return {
    from: period.from,
    to: period.to,
    productId: "",
    variantId: "",
    divisiId: "",
    itemId: "",
    status: "",
  };
}

function toId(value: string): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function toReportFilters(state: LaporanFiltersState): ReportFilters {
  return {
    from: state.from,
    to: state.to,
    productId: toId(state.productId),
    variantId: toId(state.variantId),
    divisiId: toId(state.divisiId),
    itemId: toId(state.itemId),
    status: state.status.trim() ? state.status.trim().toUpperCase() : null,
  };
}

export function formatQty(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("id-ID", { maximumFractionDigits: 6 });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("id-ID");
}
