export const DATE_PRESETS = [
  { label: "Hari Ini", getRange: () => { const d = new Date(); return { start: d, end: d }; } },
  { label: "Kemarin", getRange: () => { const d = new Date(); d.setDate(d.getDate() - 1); return { start: d, end: d }; } },
  { label: "Minggu Ini", getRange: () => { const d = new Date(); const day = d.getDay(); const start = new Date(d.setDate(d.getDate() - day + 1)); const end = new Date(start); end.setDate(start.getDate() + 6); return { start, end }; } },
  { label: "7 Hari Terakhir", getRange: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 6); return { start, end }; } },
  { label: "30 Hari Terakhir", getRange: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 29); return { start, end }; } },
  { label: "Bulan Ini", getRange: () => { const d = new Date(); return { start: new Date(d.getFullYear(), d.getMonth(), 1), end: new Date(d.getFullYear(), d.getMonth() + 1, 0) }; } },
  { label: "Bulan Lalu", getRange: () => { const d = new Date(); return { start: new Date(d.getFullYear(), d.getMonth() - 1, 1), end: new Date(d.getFullYear(), d.getMonth(), 0) }; } },
] as const;

export function formatDateInput(date: Date): string {
  return date.toLocaleDateString("sv-SE");
}

export function getPresetRange(label: string): { start: string; end: string } | null {
  const preset = DATE_PRESETS.find((item) => item.label === label);
  if (!preset) return null;
  const { start, end } = preset.getRange();
  return { start: formatDateInput(start), end: formatDateInput(end) };
}
