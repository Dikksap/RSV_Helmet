export type ScanReportItem = {
  kode: string;
  variant: string;
  status: string;
  waktu: string;
  dus?: string;
};

const KEY = "rsv_scan_report";

/** Tanggal lokal YYYY-MM-DD — dipakai sebagai kunci laporan harian. */
export function todayKey(): string {
  return new Date().toLocaleDateString("sv-SE");
}

export function reportDateLabel(): string {
  return new Date().toLocaleDateString("id-ID", { dateStyle: "long" });
}

const itemKey = (it: ScanReportItem) => `${it.kode.trim().toLowerCase()}|${it.status.toUpperCase()}`;

/** Gabung tanpa duplikat kode+status; entri lama tetap di depan. */
export function mergeReportItems(existing: ScanReportItem[], incoming: ScanReportItem[]): ScanReportItem[] {
  const seen = new Set(existing.map(itemKey));
  const fresh = incoming.filter((it) => {
    const k = itemKey(it);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return [...existing, ...fresh];
}

export function loadScanReport(): ScanReportItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { tanggal?: string; items?: ScanReportItem[] };
    return parsed.tanggal === todayKey() && Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

// shortcut: tanggal mengikuti saat simpan; sesi yang dibiarkan terbuka lewat tengah malam ikut mencampur hari sebelumnya.
export function saveScanReport(items: ScanReportItem[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ tanggal: todayKey(), items }));
  } catch {
    // localStorage penuh/diblokir: laporan tetap tampil dari state selama sesi.
  }
}

export function clearScanReport(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // localStorage diblokir: cukup kosongkan state di pemanggil.
  }
}

export type ScanReportGroup = { variant: string; status: string; jumlah: number };

/** Ringkasan laporan: satu baris per varian + status. */
export function groupReportItems(items: ScanReportItem[]): ScanReportGroup[] {
  const m = new Map<string, ScanReportGroup>();
  for (const it of items) {
    const k = `${it.variant}|${it.status}`;
    const g = m.get(k);
    if (g) g.jumlah += 1;
    else m.set(k, { variant: it.variant, status: it.status, jumlah: 1 });
  }
  return [...m.values()].sort(
    (a, b) => a.variant.localeCompare(b.variant) || a.status.localeCompare(b.status),
  );
}

export function buildScanReportText(
  items: ScanReportItem[],
  tanggal: string,
  statusLabel: (kode: string) => string,
): string {
  return [
    "LAPORAN SCAN HARIAN",
    `Tanggal: ${tanggal}`,
    `Total: ${items.length} item`,
    "",
    "Varian · status · jumlah:",
    ...groupReportItems(items).map((g) => `- ${g.variant} · ${statusLabel(g.status)}: ${g.jumlah}`),
    "",
    "Detail:",
    ...items.map((it, i) => {
      const row = `${i + 1}. ${it.kode} — ${statusLabel(it.status)} — ${it.variant} — ${it.waktu}`;
      return it.dus ? `${row} — ${it.dus}` : row;
    }),
  ].join("\n");
}
