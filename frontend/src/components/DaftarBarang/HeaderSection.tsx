type HeaderSectionProps = {
  totalBarang: number;
  isExporting: boolean;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onCreate?: () => void;
  onImport?: () => void;
};

export function HeaderSection({
  totalBarang,
  isExporting,
  onExportCSV,
  onExportJSON,
  onCreate,
  onImport,
}: HeaderSectionProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm sm:px-4 sm:py-3">
      {/* left: title compact */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-bold leading-none tracking-tight text-[#1E3A5F] sm:text-xl">
            Daftar Barang
          </h1>
          <span className="inline-flex items-center gap-1 rounded-full border border-[#1E3A5F]/10 bg-[#F5F7FA] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#1E3A5F]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#10B981]" />
            {totalBarang.toLocaleString("id-ID")} Total
          </span>
        </div>
        <p className="mt-0.5 hidden text-xs leading-none text-[#6B7280] sm:block">
          Inventory / Barang • Kelola barang real-time
        </p>
        <p className="mt-0.5 text-[11px] leading-none text-[#6B7280] sm:hidden">
          Inventory / Barang
        </p>
      </div>

      {/* right: actions compact single row */}
      <div className="flex shrink-0 items-center gap-1.5">
        {onImport && (
          <button
            type="button"
            onClick={onImport}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#00A8E8] bg-white px-3 text-xs font-semibold text-[#0088C0] hover:bg-sky-50 active:scale-[0.98]"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
            Import
          </button>
        )}
        {onCreate && (
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#00A8E8] px-3 text-xs font-semibold text-white hover:bg-[#0088C0] active:scale-[0.98]"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            <span className="hidden sm:inline">Tambah</span> Barang
          </button>
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onExportCSV}
            disabled={isExporting}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-[#1E3A5F] hover:bg-slate-50 disabled:opacity-40"
            title="Export CSV"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            CSV
          </button>
          <button
            type="button"
            onClick={onExportJSON}
            disabled={isExporting}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-[#1E3A5F] hover:bg-slate-50 disabled:opacity-40"
            title="Export JSON"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            JSON
          </button>
          <a
            href="/admin/barang/statistik"
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-[#1E3A5F] hover:bg-slate-50"
            title="Statistik"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
            <span className="hidden sm:inline">Statistik</span>
            <span className="sm:hidden">Stat</span>
          </a>
        </div>
      </div>
    </div>
  );
}
