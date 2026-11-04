/**
 * Visual tokens untuk status barang.
 *
 * Dipakai bersama oleh badge status, ringkasan inventori, dan tabel supaya
 * warna/bentuk status selalu konsisten di seluruh halaman.
 */

export type StatusVisual = {
  /** Warna solid untuk chart/bar (inline style). */
  hex: string;
  /** Kelas untuk badge (background, teks, border). */
  soft: string;
  text: string;
  border: string;
  /** Kelas titik indikator. */
  dot: string;
  /** Kelas isi bar distribusi. */
  bar: string;
};

const VISUALS: Record<string, StatusVisual> = {
  REGISTER: {
    hex: "#F59E0B",
    soft: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
    bar: "bg-amber-400",
  },
  FINISHGOOD: {
    hex: "#10B981",
    soft: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
  },
  RETUR: {
    hex: "#00A8E8",
    soft: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
    dot: "bg-[#00A8E8]",
    bar: "bg-[#00A8E8]",
  },
  OUT: {
    hex: "#1E3A5F",
    soft: "bg-[#1E3A5F]/5",
    text: "text-[#1E3A5F]",
    border: "border-[#1E3A5F]/15",
    dot: "bg-[#1E3A5F]",
    bar: "bg-[#1E3A5F]",
  },
  BAD: {
    hex: "#EF4444",
    soft: "bg-red-50",
    text: "text-red-600",
    border: "border-red-200",
    dot: "bg-red-500",
    bar: "bg-red-500",
  },
};

const FALLBACKS: StatusVisual[] = [
  {
    hex: "#64748B",
    soft: "bg-slate-100",
    text: "text-slate-600",
    border: "border-slate-200",
    dot: "bg-slate-400",
    bar: "bg-slate-400",
  },
  {
    hex: "#6366F1",
    soft: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
    dot: "bg-indigo-500",
    bar: "bg-indigo-400",
  },
  {
    hex: "#8B5CF6",
    soft: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-200",
    dot: "bg-violet-500",
    bar: "bg-violet-400",
  },
];

/** Urutan tampil status yang dikenal (fallback bila master data kosong). */
export const DEFAULT_STATUS_ORDER = ["REGISTER", "FINISHGOOD", "RETUR", "OUT", "BAD"];

export function statusVisual(status: string): StatusVisual {
  const key = status.trim().toUpperCase();
  const known = VISUALS[key];
  if (known) return known;

  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % 997;
  }
  return FALLBACKS[hash % FALLBACKS.length];
}
