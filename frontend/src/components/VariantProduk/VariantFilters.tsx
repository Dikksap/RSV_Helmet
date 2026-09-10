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
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
          <span className="text-transparent" aria-hidden="true">Aksi</span>
          <button
            type="button"
            className="h-12 rounded-lg bg-[#F5F7FA] px-4 text-sm font-medium text-[#6B7280] transition duration-200 ease hover:bg-slate-200 hover:text-[#1F2937] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/40 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={onReset}
            disabled={!hasActiveFilters}
          >
            Reset filter
          </button>
        </label>
        <span className="flex items-end pb-2 text-sm font-medium text-[#6B7280]" aria-live="polite">
          Menampilkan {rowsLength} dari {totalVarian} varian
        </span>
      </div>
    </div>
  );
}
