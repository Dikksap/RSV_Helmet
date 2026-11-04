import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDownload, faPlus, faRotate, faUpload } from "@fortawesome/free-solid-svg-icons";

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
  const exportTitle = exportDisabled ? exportDisabledReason : "Export data sesuai filter aktif";
  const exportButton = "inline-flex h-8 items-center justify-center rounded-lg px-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-[#1E3A5F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/50 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <header className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Barang Produksi</p>
        <div className="mt-1 flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Daftar Barang</h1>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold tabular-nums text-slate-600"
            title="Total seluruh barang"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            {totalBarang.toLocaleString("id-ID")} barang
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">Kelola stok per unit, pantau status, dan catat mutasi gudang.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 xl:shrink-0 xl:flex-nowrap">
        <div
          className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white pl-3 pr-1"
          title={exportTitle}
        >
          <FontAwesomeIcon
            icon={isExporting ? faRotate : faDownload}
            spin={isExporting}
            className="mr-1.5 h-3 w-3 text-slate-400"
            aria-hidden="true"
          />
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Export</span>
          <button type="button" onClick={onExportCSV} disabled={isExporting || exportDisabled} title={exportTitle} className={exportButton}>
            CSV
          </button>
          <span className="h-4 w-px bg-slate-200" aria-hidden="true" />
          <button type="button" onClick={onExportJSON} disabled={isExporting || exportDisabled} title={exportTitle} className={exportButton}>
            JSON
          </button>
        </div>
        {onImport && (
          <button type="button" onClick={onImport} className={GHOST}>
            <FontAwesomeIcon icon={faUpload} className="h-3.5 w-3.5" aria-hidden="true" />
            Import
          </button>
        )}
        {onCreate && (
          <button
            type="button"
            onClick={onCreate}
            className={`${BTN} w-full justify-center bg-[#1E3A5F] text-white shadow-sm hover:bg-[#162C48] sm:w-auto`}
          >
            <FontAwesomeIcon icon={faPlus} className="h-3.5 w-3.5" aria-hidden="true" />
            Tambah barang
          </button>
        )}
      </div>
    </header>
  );
}
