type HeaderSectionProps = {
  totalBarang: number;
  isExporting: boolean;
  exportDisabled?: boolean;
  exportDisabledReason?: string;
  onExportCSV: () => void;
  onExportJSON: () => void;
  onCreate?: () => void;
  onImport?: () => void;
};

const BTN =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/50";
const GHOST = `${BTN} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;

export function HeaderSection({
  totalBarang,
  isExporting,
  exportDisabled,
  exportDisabledReason,
  onExportCSV,
  onExportJSON,
  onCreate,
  onImport,
}: HeaderSectionProps) {
  const exportTitle = exportDisabled ? exportDisabledReason : undefined;
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Barang Produksi</p>
        <h1 className="mt-1 flex items-center gap-2.5 text-2xl font-bold tracking-tight text-slate-900">
          Daftar Barang
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#00A8E8]/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-[#0088C0]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#10B981]" aria-hidden="true" />
            {totalBarang.toLocaleString("id-ID")}
          </span>
        </h1>
        <p className="mt-1 text-sm text-slate-500">Data diperbarui otomatis saat ada scan.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onExportCSV} disabled={isExporting || exportDisabled} title={exportTitle} className={GHOST}>
          CSV
        </button>
        <button type="button" onClick={onExportJSON} disabled={isExporting || exportDisabled} title={exportTitle} className={GHOST}>
          JSON
        </button>
        {onImport && (
          <button type="button" onClick={onImport} className={GHOST}>
            Import
          </button>
        )}
        {onCreate && (
          <button type="button" onClick={onCreate} className={`${BTN} bg-[#1E3A5F] text-white hover:bg-[#162C48]`}>
            + Tambah barang
          </button>
        )}
      </div>
    </header>
  );
}
