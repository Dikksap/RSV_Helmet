import { inputCls, labelCls } from "./constants";

type Option = { id: number; nama: string };

type Props = {
  search: string;
  productFilter: string;
  styleFilter: string;
  colorFilter: string;
  sizeFilter: string;
  productOptions: Option[];
  styleOptions: Option[];
  colorOptions: Option[];
  sizeOptions: Option[];
  rowsLength: number;
  totalVarian: number;
  hasActiveFilters: boolean;
  onSearchChange: (v: string) => void;
  onProductChange: (v: string) => void;
  onStyleChange: (v: string) => void;
  onColorChange: (v: string) => void;
  onSizeChange: (v: string) => void;
  onReset: () => void;
};

export function VariantFilters({
  search,
  productFilter,
  styleFilter,
  colorFilter,
  sizeFilter,
  productOptions,
  styleOptions,
  colorOptions,
  sizeOptions,
  rowsLength,
  totalVarian,
  hasActiveFilters,
  onSearchChange,
  onProductChange,
  onStyleChange,
  onColorChange,
  onSizeChange,
  onReset,
}: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4">
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
        <input
          type="search"
          className={inputCls}
          placeholder="Cari kode variant..."
          aria-label="Cari variant"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <label className={labelCls}>
          <span>Produk</span>
          <select
            className={inputCls}
            aria-label="Filter produk"
            value={productFilter}
            onChange={(e) => {
              onProductChange(e.target.value);
              onStyleChange("");
              onColorChange("");
              onSizeChange("");
            }}
          >
            <option value="">Semua</option>
            {productOptions.map((o) => (
              <option key={o.id} value={String(o.id)}>{o.nama}</option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          <span>Style</span>
          <select
            className={inputCls}
            aria-label="Filter style"
            value={styleFilter}
            onChange={(e) => {
              onStyleChange(e.target.value);
              onColorChange("");
              onSizeChange("");
            }}
          >
            <option value="">Semua</option>
            {styleOptions.map((o) => (
              <option key={o.id} value={String(o.id)}>{o.nama}</option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          <span>Warna</span>
          <select
            className={inputCls}
            aria-label="Filter warna"
            value={colorFilter}
            onChange={(e) => {
              onColorChange(e.target.value);
              onSizeChange("");
            }}
          >
            <option value="">Semua</option>
            {colorOptions.map((o) => (
              <option key={o.id} value={String(o.id)}>{o.nama}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-2 lg:grid-cols-4">
        <label className={labelCls}>
          <span>Ukuran</span>
          <select
            className={inputCls}
            aria-label="Filter ukuran"
            value={sizeFilter}
            onChange={(e) => onSizeChange(e.target.value)}
          >
            <option value="">Semua</option>
            {sizeOptions.map((o) => (
              <option key={o.id} value={String(o.id)}>{o.nama}</option>
            ))}
          </select>
        </label>
        <label className={labelCls}>
          <span className="hidden lg:block text-transparent" aria-hidden="true">Aksi</span>
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-[#F5F7FA] px-3 text-xs font-medium text-[#6B7280] hover:bg-slate-200 hover:text-[#1F2937] disabled:opacity-40"
            onClick={onReset}
            disabled={!hasActiveFilters}
          >
            Reset filter
          </button>
        </label>
        <span className="flex items-end pb-1 text-xs font-medium text-[#6B7280] lg:col-span-2" aria-live="polite">
          {rowsLength} dari {totalVarian} varian
        </span>
      </div>
    </div>
  );
}
