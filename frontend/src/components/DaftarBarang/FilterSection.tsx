import { useState } from "react";
import type { StatusBarang } from "../../api/barang";

const DATE_PRESETS = [
  { label: "Hari Ini", getRange: () => { const d = new Date(); return { start: d, end: d }; } },
  { label: "Kemarin", getRange: () => { const d = new Date(); d.setDate(d.getDate() - 1); return { start: d, end: d }; } },
  { label: "Minggu Ini", getRange: () => { const d = new Date(); const day = d.getDay(); const start = new Date(d.setDate(d.getDate() - day + 1)); const end = new Date(start); end.setDate(start.getDate() + 6); return { start, end }; } },
  { label: "7 Hari Terakhir", getRange: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 6); return { start, end }; } },
  { label: "30 Hari Terakhir", getRange: () => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 29); return { start, end }; } },
  { label: "Bulan Ini", getRange: () => { const d = new Date(); return { start: new Date(d.getFullYear(), d.getMonth(), 1), end: new Date(d.getFullYear(), d.getMonth() + 1, 0) }; } },
  { label: "Bulan Lalu", getRange: () => { const d = new Date(); return { start: new Date(d.getFullYear(), d.getMonth() - 1, 1), end: new Date(d.getFullYear(), d.getMonth(), 0) }; } },
] as const;

const STATUS_OPTIONS: { value: StatusBarang; label: string }[] = [
  { value: "REGISTER", label: "Register" },
  { value: "FINISHGOOD", label: "Finish Good" },
  { value: "RETUR", label: "Retur" },
  { value: "OUT", label: "Out" },
  { value: "BAD", label: "Bad" },
];

type FilterSectionProps = {
  search: string;
  statusFilter: string;
  variantFilter: string;
  tanggalAwal: string;
  tanggalAkhir: string;
  datePreset: string;
  variantOptions: { id: number; nama: string }[];
  currentPage: number;
  totalPages: number;
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: StatusBarang) => void;
  onVariantChange: (value: string) => void;
  onDatePresetChange: (value: string) => void;
  onTanggalAwalChange: (value: string) => void;
  onTanggalAkhirChange: (value: string) => void;
  onResetFilters: () => void;
};

function formatDateInput(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function FilterSection({
  search,
  statusFilter,
  variantFilter,
  tanggalAwal,
  tanggalAkhir,
  datePreset,
  variantOptions,
  currentPage,
  totalPages,
  hasActiveFilters,
  onSearchChange,
  onStatusChange,
  onVariantChange,
  onDatePresetChange,
  onTanggalAwalChange,
  onTanggalAkhirChange,
  onResetFilters,
}: FilterSectionProps) {
  const [open, setOpen] = useState(false);
  const inputCls = "h-9 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-[14px] text-[#1F2937] outline-none transition placeholder:text-[#6B7280]/60 focus:border-[#00A8E8] focus:ring-2 focus:ring-[#00A8E8]/20";
  const labelCls = "flex flex-col gap-1 text-xs font-medium text-[#1F2937]";
  const activeCount = [search, statusFilter, variantFilter, tanggalAwal, tanggalAkhir].filter(Boolean).length;

  const handleDatePresetChange = (value: string) => {
    onDatePresetChange(value);
    if (!value) {
      onTanggalAwalChange("");
      onTanggalAkhirChange("");
      return;
    }
    const preset = DATE_PRESETS.find((p) => p.label === value);
    if (preset) {
      const { start, end } = preset.getRange();
      onTanggalAwalChange(formatDateInput(start));
      onTanggalAkhirChange(formatDateInput(end));
    }
  };

  return (
    <section aria-label="Filter barang" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
      {/* compact single row: search + filter toggle + meta */}
      <div className="flex items-center gap-2 p-3">
        <div className="relative flex-1">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <input
            type="search"
            className={`${inputCls} pl-9 pr-9`}
            placeholder="Cari kode barang..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Cari kode barang"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Hapus pencarian"
              className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#6B7280] hover:bg-slate-100 hover:text-[#1F2937]"
            >
              ✕
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/40 ${open || activeCount > 0 ? "border-[#00A8E8] bg-[#00A8E8]/10 text-[#00A8E8]" : "border-[#D1D5DB] bg-white text-[#1E3A5F] hover:border-[#00A8E8] hover:text-[#00A8E8]"}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
          Filter
          {activeCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#00A8E8] px-1.5 text-[10px] font-bold text-white">{activeCount}</span>
          )}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9" /></svg>
        </button>

        <span className="hidden shrink-0 text-xs font-medium tabular-nums text-[#6B7280] sm:inline">
          {currentPage}/{totalPages}
        </span>

        {hasActiveFilters && (
          <button type="button" onClick={onResetFilters} className="hidden shrink-0 text-xs font-medium text-[#EF4444] hover:underline sm:inline">
            Reset
          </button>
        )}
      </div>

      {/* collapsible advanced filters — single row on desktop, grid on smaller */}
      {open && (
        <div className="grid gap-2 border-t border-slate-100 bg-slate-50/50 p-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className={labelCls}>
            <span>Status</span>
            <select className={inputCls} value={statusFilter} onChange={(e) => onStatusChange(e.target.value as StatusBarang)}>
              <option value="">Semua Status</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <label className={`${labelCls} lg:col-span-1`}>
            <span>Varian</span>
            <select className={`${inputCls} truncate`} value={variantFilter} onChange={(e) => onVariantChange(e.target.value)}>
              <option value="">Semua Varian</option>
              {variantOptions.map((opt) => (
                <option key={opt.id} value={String(opt.id)}>{opt.nama}</option>
              ))}
            </select>
          </label>

          <label className={labelCls}>
            <span>Periode</span>
            <select className={inputCls} value={datePreset} onChange={(e) => handleDatePresetChange(e.target.value)}>
              <option value="">Pilih periode...</option>
              {DATE_PRESETS.map((preset) => (
                <option key={preset.label} value={preset.label}>{preset.label}</option>
              ))}
            </select>
          </label>

          <label className={labelCls}>
            <span>Tgl Awal</span>
            <input type="date" className={inputCls} value={tanggalAwal} onChange={(e) => onTanggalAwalChange(e.target.value)} />
          </label>

          <label className={labelCls}>
            <span>Tgl Akhir</span>
            <input type="date" className={inputCls} value={tanggalAkhir} onChange={(e) => onTanggalAkhirChange(e.target.value)} />
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={onResetFilters}
              disabled={!hasActiveFilters}
              className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-white px-3 text-sm font-medium text-[#6B7280] ring-1 ring-inset ring-[#D1D5DB] hover:bg-slate-100 hover:text-[#1F2937] disabled:opacity-40"
            >
              Reset Filter
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
