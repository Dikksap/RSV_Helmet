import type {
  ProductionOrderItem,
  ScheduleRow,
  StatusProductionOrder,
} from "../../api/productionOrders";

export type Tab = "orders" | "master" | "jadwal" | "ringkasan" | "kapasitas" | "manpower";

export const TABS: { key: Tab; label: string }[] = [
  { key: "orders", label: "Daftar Orders" },
  { key: "master", label: "Master Produksi" },
  { key: "jadwal", label: "Jadwal" },
  { key: "ringkasan", label: "Ringkasan" },
  { key: "kapasitas", label: "Kapasitas Produksi" },
  { key: "manpower", label: "Man Power" },
];

export const STATUS_STYLE: Record<StatusProductionOrder, string> = {
  DRAFT: "border-slate-200 bg-slate-100 text-slate-600",
  AKTIF: "border-sky-200 bg-sky-50 text-sky-700",
  SELESAI: "border-emerald-200 bg-emerald-50 text-emerald-700",
  BATAL: "border-red-200 bg-red-50 text-[#EF4444]",
};

export const fmt = (n: number): string => n.toLocaleString("id-ID");

export const fmtPct = (n: number): string =>
  `${n.toFixed(2).replace(".", ",")}%`;

export const fmtDate = (s: string | null): string => {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? "—"
    : d
        .toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "2-digit",
        })
        .replace(/ /g, "-");
};

export const fmtLong = (s: string | null): string => {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("id-ID", { day: "numeric", month: "long" });
};

export const fmtCap = (w: number, s: number, catatan: string | null): string => {
  const ws = w.toLocaleString("id-ID");
  const ss = s.toLocaleString("id-ID");
  if (catatan) return `${ws}/hari (${catatan})`;
  if (s !== w) return `${ws}/hari (weekday), ${ss}/hari (Sabtu)`;
  return `${ws}/hari`;
};

export interface StageSummary {
  key: string;
  label: string;
  mulai: string;
  selesai: string;
  hariKerja: number;
  kapW: number;
  kapS: number;
}

type ScheduleNumField = "persiapan" | "decalSolid" | "decalMotif" | "topCoat" | "qc";

const STAGE_FIELDS: { key: string; label: string; field: ScheduleNumField }[] = [
  { key: "persiapan", label: "PERSIAPAN", field: "persiapan" },
  { key: "decalSolid", label: "DECAL SOLID", field: "decalSolid" },
  { key: "decalMotif", label: "DECAL MOTIF", field: "decalMotif" },
  { key: "topCoat", label: "TOP COAT + PERAKITAN", field: "topCoat" },
  { key: "qc", label: "QC", field: "qc" },
];

function mode(vals: number[]): number {
  if (vals.length === 0) return 0;
  const freq = new Map<number, number>();
  for (const v of vals) freq.set(v, (freq.get(v) ?? 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}

// Agregasi baris jadwal → ringkasan per tahap + alokasi per item.
// Sumber tunggal kebenaran = output GET schedule.
export function summarizeSchedule(rows: ScheduleRow[]): {
  stages: StageSummary[];
  allocation: { item: string; total: number }[];
} {
  const stages = STAGE_FIELDS.map((s) => {
    const hit = rows.filter((r) => r[s.field] > 0);
    const dates = [...new Set(hit.map((r) => r.tanggal))].sort();
    return {
      key: s.key,
      label: s.label,
      mulai: dates[0] ?? "",
      selesai: dates[dates.length - 1] ?? "",
      hariKerja: dates.length,
      kapW: mode(hit.filter((r) => r.hari !== "Sabtu").map((r) => r[s.field])),
      kapS: mode(hit.filter((r) => r.hari === "Sabtu").map((r) => r[s.field])),
    };
  });
  const alloc = new Map<string, number>();
  for (const r of rows) {
    if (r.jumlah <= 0) continue;
    alloc.set(r.item, (alloc.get(r.item) ?? 0) + r.jumlah);
  }
  return {
    stages,
    allocation: [...alloc.entries()].map(([item, total]) => ({ item, total })),
  };
}

export interface ItemGroup {
  item: string;
  rows: ProductionOrderItem[];
  total: number;
  priority: number;
}

export interface RingkasanInput {
  qty: number;
  priority: number;
  label: string;
}

// Hitung ulang ringkasan di lokal (matematika sama dengan backend getOrderSummary).
export function recomputeRingkasan(items: RingkasanInput[], totalQty: number) {
  const map = new Map<string, { item: string; total: number; priority: number }>();
  for (const it of items) {
    const cur = map.get(it.label) ?? { item: it.label, total: 0, priority: it.priority };
    cur.total += it.qty;
    map.set(it.label, cur);
  }
  return [...map.values()].map((r) => ({
    ...r,
    persentase: totalQty > 0 ? Number(((r.total / totalQty) * 100).toFixed(2)) : 0,
  }));
}

export function groupItems(items: ProductionOrderItem[]): ItemGroup[] {
  const groups: ItemGroup[] = [];
  const byItem = new Map<string, ItemGroup>();
  for (const it of items) {
    const item = `${it.variant.style.nama} ${it.variant.color.nama}`;
    let g = byItem.get(item);
    if (!g) {
      g = { item, rows: [], total: 0, priority: it.priority };
      byItem.set(item, g);
      groups.push(g);
    }
    g.rows.push(it);
    g.total += it.qty;
  }
  return groups;
}
