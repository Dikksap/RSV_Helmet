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
          <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#00A8E8]">
            Inventory / Barang
          </p>
          <h1 className="truncate text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">
            Daftar Barang
          </h1>
          <p className="mt-1 hidden text-base leading-relaxed text-[#6B7280] sm:block">
            Kelola dan pantau seluruh barang yang tercatat secara real-time.
          </p>
          <p className="mt-1 text-[15px] text-[#6B7280] sm:hidden">
            Kelola & pantau barang real-time.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#1E3A5F]/15 bg-[#F5F7FA] px-3 py-1.5 text-[11px] font-semibold tabular-nums text-[#1E3A5F] sm:text-xs">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#10B981]" />
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
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-[#00A8E8] px-6 py-3 text-base font-medium text-white shadow-[0_4px_20px_rgba(0,168,232,0.25)] transition duration-200 ease hover:bg-[#0088C0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/40 active:scale-[0.98] sm:w-auto"
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
            className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-lg border-2 border-[#1E3A5F] bg-transparent px-3 py-3 text-sm font-medium text-[#1E3A5F] transition duration-200 ease hover:bg-[#1E3A5F]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/40 active:scale-[0.98] disabled:cursor-wait disabled:opacity-40"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            {isExporting ? "..." : "CSV"}
          </button>
          <button
            type="button"
            onClick={onExportJSON}
            disabled={isExporting}
            className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-lg border-2 border-[#1E3A5F] bg-transparent px-3 py-3 text-sm font-medium text-[#1E3A5F] transition duration-200 ease hover:bg-[#1E3A5F]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/40 active:scale-[0.98] disabled:cursor-wait disabled:opacity-40"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            JSON
          </button>
          <a
            href="/admin/barang/statistik"
            className="inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-lg border-2 border-[#1E3A5F] bg-transparent px-3 py-3 text-sm font-medium text-[#1E3A5F] transition duration-200 ease hover:bg-[#1E3A5F]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/40 active:scale-[0.98]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
            Statistik
          </a>
        </div>
      </div>
    </div>
  );
}
