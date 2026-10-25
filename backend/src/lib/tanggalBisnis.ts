export const ZONA_WAKTU_BISNIS = "Asia/Jakarta";
const OFFSET_BISNIS = "+07:00";

const formatterTanggal = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_WAKTU_BISNIS,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function partsTanggal(date: Date): Record<string, string> {
  return Object.fromEntries(
    formatterTanggal.formatToParts(date).map((part) => [part.type, part.value]),
  );
}

export function tanggalBisnis(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) throw new Error("Tanggal tidak valid");
  const parts = partsTanggal(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function awalHariBisnis(value: Date | string): Date {
  return new Date(`${tanggalBisnis(value)}T00:00:00${OFFSET_BISNIS}`);
}

export function tambahHariBisnis(value: Date | string, days: number): Date {
  return new Date(awalHariBisnis(value).getTime() + days * 24 * 60 * 60 * 1000);
}

export function parseTanggalBisnis(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== "string" || !value.trim()) return null;

  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T00:00:00${OFFSET_BISNIS}`);
    if (Number.isNaN(date.getTime()) || tanggalBisnis(date) !== raw) return null;
    return date;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}
