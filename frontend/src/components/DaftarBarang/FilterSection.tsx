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
  const inputCls = "h-10 w-full rounded-xl border border-brand-border bg-brand-surface px-3 text-sm text-white outline-none transition placeholder:text-brand-grey focus:border-brand-gold focus:ring-1 focus:ring-brand-gold";
  const labelCls = "flex flex-col gap-1.5 text-xs font-semibold text-brand-grey";

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
    <section aria-label="Filter barang" className="rounded-2xl border border-brand-border bg-brand-surface-card p-5">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Filter Data</h3>
          <p className="text-xs text-brand-grey">
            Persempit pencarian berdasarkan kriteria tertentu.
          </p>
        </div>
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
          <span className="text-xs font-medium text-brand-grey">
            Hal. {currentPage} / {totalPages}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="sm:col-span-2 lg:col-span-1">
          <label className={labelCls}>
            <span>Pencarian</span>
            <input
              type="search"
              className={inputCls}
              placeholder="Cari kode barang..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </label>
        </div>

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

        <label className={labelCls}>
          <span>Varian</span>
          <select
            className={inputCls}
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
          <span>Filter Cepat</span>
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
          <span>Tanggal Awal</span>
          <input
            type="date"
            className={inputCls}
            value={tanggalAwal}
            onChange={(e) => onTanggalAwalChange(e.target.value)}
          />
        </label>

        <label className={labelCls}>
          <span>Tanggal Akhir</span>
          <input
            type="date"
            className={inputCls}
            value={tanggalAkhir}
            onChange={(e) => onTanggalAkhirChange(e.target.value)}
          />
        </label>
      </div>
    </section>
  );
}
