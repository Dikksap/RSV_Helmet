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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-brand-gold">
          Inventory / Barang
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Daftar Barang
        </h1>
        <p className="mt-1 text-sm text-brand-grey">
          Kelola dan pantau seluruh barang yang tercatat secara real-time.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto">
        <span className="inline-flex items-center rounded-full border border-brand-gold/20 bg-brand-gold/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-gold">
          {totalBarang} Total Barang
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExportCSV}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-xs font-bold text-brand-grey-light transition hover:border-brand-gold hover:text-white disabled:cursor-wait disabled:opacity-40"
          >
            {isExporting ? "Mengekspor..." : "Export CSV"}
          </button>
          <button
            type="button"
            onClick={onExportJSON}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-xs font-bold text-brand-grey-light transition hover:border-brand-gold hover:text-white disabled:cursor-wait disabled:opacity-40"
          >
            Export JSON
          </button>
        </div>
        {onCreate && (
          <button
            type="button"
            onClick={onCreate}
            className="rounded-xl bg-brand-gold px-4 py-2 text-xs font-bold text-brand-black transition hover:bg-brand-gold-light active:scale-[0.98]"
          >
            + Tambah Barang
          </button>
        )}
        <a
          href="/admin/barang/statistik"
          className="rounded-xl border border-brand-border bg-brand-surface px-4 py-2 text-xs font-bold text-brand-grey-light transition hover:border-brand-gold hover:text-white"
        >
          Lihat Statistik
        </a>
      </div>
    </div>
  );
}
