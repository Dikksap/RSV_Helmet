type HeaderSectionProps = {
  totalBarang: number;
  isExporting: boolean;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onCreate?: () => void;
};

export function HeaderSection({
  totalBarang,
  isExporting,
  onExportCSV,
  onExportJSON,
  onCreate,
}: HeaderSectionProps) {
  return (
    <div className="space-y-4">
      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-gold">
            Inventory / Barang
          </p>
          <h1 className="truncate text-xl font-bold tracking-tight text-white sm:text-3xl">
            Daftar Barang
          </h1>
          <p className="mt-1 hidden text-sm text-brand-grey sm:block">
            Kelola dan pantau seluruh barang yang tercatat secara real-time.
          </p>
          <p className="mt-1 text-xs text-brand-grey sm:hidden">
            Kelola & pantau barang real-time.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-brand-gold/25 bg-brand-gold/10 px-3 py-1.5 text-[11px] font-bold tabular-nums text-brand-gold sm:text-xs">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-gold" />
          {totalBarang.toLocaleString("id-ID")}
          <span className="hidden font-medium sm:inline">Total</span>
          <span className="sm:hidden">item</span>
        </span>
      </div>

      {/* Actions: primary full-width on mobile, secondary grid */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {onCreate && (
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-brand-gold px-4 py-2.5 text-sm font-bold text-brand-black shadow-lg shadow-brand-gold/20 transition hover:bg-brand-gold-light active:scale-[0.98] sm:w-auto"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            Tambah Barang
          </button>
        )}
        <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-2">
          <button
            type="button"
            onClick={onExportCSV}
            disabled={isExporting}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-brand-border bg-brand-surface-card px-3 py-2.5 text-xs font-bold text-brand-grey-light transition hover:border-brand-gold/60 hover:text-white active:scale-[0.98] disabled:cursor-wait disabled:opacity-40"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            {isExporting ? "..." : "CSV"}
          </button>
          <button
            type="button"
            onClick={onExportJSON}
            disabled={isExporting}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-brand-border bg-brand-surface-card px-3 py-2.5 text-xs font-bold text-brand-grey-light transition hover:border-brand-gold/60 hover:text-white active:scale-[0.98] disabled:cursor-wait disabled:opacity-40"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            JSON
          </button>
          <a
            href="/admin/barang/statistik"
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-brand-border bg-brand-surface-card px-3 py-2.5 text-xs font-bold text-brand-grey-light transition hover:border-brand-gold/60 hover:text-white active:scale-[0.98]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
            Statistik
          </a>
        </div>
      </div>
    </div>
  );
}
