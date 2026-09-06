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
  const inputCls = "min-h-[44px] w-full rounded-xl border border-brand-border bg-brand-surface px-3 text-sm text-white outline-none transition placeholder:text-brand-grey/70 focus:border-brand-gold focus:ring-1 focus:ring-brand-gold";
  const labelCls = "flex flex-col gap-1.5 text-xs font-semibold text-brand-grey";

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
    <section aria-label="Filter barang" className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface-card">
      {/* Search — always visible */}
      <div className="p-3 sm:p-4">
        <div className="relative">
          <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-grey" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <input
            type="search"
            className={`${inputCls} pl-10 pr-10`}
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
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-brand-grey transition hover:bg-white/5 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* Mobile toggle row */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-xl border border-brand-border bg-brand-surface px-3 text-xs font-bold text-brand-grey-light transition hover:border-brand-gold/50 hover:text-white md:hidden"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
            Filter
            {activeCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-gold px-1.5 text-[10px] font-bold text-brand-black">
                {activeCount}
              </span>
            )}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9" /></svg>
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              className="inline-flex min-h-[40px] items-center rounded-xl px-3 text-xs font-bold text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-300 active:scale-[0.98]"
              onClick={onResetFilters}
            >
              Reset
            </button>
          )}
          <span className="hidden shrink-0 text-xs font-medium tabular-nums text-brand-grey sm:block md:hidden">
            {currentPage}/{totalPages}
          </span>
        </div>
      </div>

      {/* Desktop header */}
      <div className="hidden items-center justify-between border-t border-brand-border/60 px-4 pb-1 pt-3 md:flex">
        <p className="text-xs font-bold uppercase tracking-wider text-brand-grey">Filter lanjutan</p>
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <button
              type="button"
              className="text-xs font-semibold text-rose-400 hover:text-rose-300 hover:underline"
              onClick={onResetFilters}
            >
              Reset Filter
            </button>
          )}
          <span className="text-xs font-medium tabular-nums text-brand-grey">
            Hal. {currentPage} / {totalPages}
          </span>
        </div>
      </div>

      {/* Filter grid — collapsible on mobile, always open on desktop */}
      <div className={`${open ? "grid" : "hidden"} gap-3 border-t border-brand-border/60 p-3 sm:p-4 md:grid md:grid-cols-3 md:border-t-0 md:pt-2 xl:grid-cols-6`}>
        <label className={labelCls}>
          <span>Status</span>
          <select
            className={inputCls}
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value as StatusBarang)}
          >
            <option value="">Semua Status</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className={`${labelCls} md:col-span-2 xl:col-span-1`}>
          <span>Varian</span>
          <select
            className={`${inputCls} truncate`}
            value={variantFilter}
            onChange={(e) => onVariantChange(e.target.value)}
          >
            <option value="">Semua Varian</option>
            {variantOptions.map((opt) => (
              <option key={opt.id} value={String(opt.id)}>
                {opt.nama}
              </option>
            ))}
          </select>
        </label>

        <label className={labelCls}>
          <span>Periode</span>
          <select
            className={inputCls}
            value={datePreset}
            onChange={(e) => handleDatePresetChange(e.target.value)}
          >
            <option value="">Pilih periode...</option>
            {DATE_PRESETS.map((preset) => (
              <option key={preset.label} value={preset.label}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>

        <label className={labelCls}>
          <span>Tgl Awal</span>
          <input
            type="date"
            className={`${inputCls} [color-scheme:dark]`}
            value={tanggalAwal}
            onChange={(e) => onTanggalAwalChange(e.target.value)}
          />
        </label>

        <label className={labelCls}>
          <span>Tgl Akhir</span>
          <input
            type="date"
            className={`${inputCls} [color-scheme:dark]`}
            value={tanggalAkhir}
            onChange={(e) => onTanggalAkhirChange(e.target.value)}
          />
        </label>

        <div className="flex items-end md:col-span-3 xl:col-span-1">
          <button
            type="button"
            onClick={onResetFilters}
            disabled={!hasActiveFilters}
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-brand-border bg-brand-surface px-3 text-xs font-bold text-brand-grey-light transition hover:border-rose-500/40 hover:text-rose-300 disabled:opacity-40"
          >
            Reset
          </button>
        </div>
      </div>
    </section>
  );
}
