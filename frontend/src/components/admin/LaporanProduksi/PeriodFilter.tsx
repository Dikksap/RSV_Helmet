import type { Divisi } from "../../../api/divisi";
import type { Item } from "../../../api/item";
import type { Product, VariantProdukRow } from "../../../api/products";
import { defaultPeriod, type LaporanFiltersState } from "./types";

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20";
const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500";

type Props = {
  state: LaporanFiltersState;
  onChange: (patch: Partial<LaporanFiltersState>) => void;
  divisions: Divisi[];
  items: Item[];
  products: Product[];
  variants: VariantProdukRow[];
  showStatus?: boolean;
  disabled?: boolean;
};

export default function PeriodFilter({
  state,
  onChange,
  divisions,
  items,
  products,
  variants,
  showStatus = true,
  disabled = false,
}: Props) {
  const resetPeriod = () => onChange(defaultPeriod());
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <label>
          <span className={labelCls}>Dari</span>
          <input
            type="date"
            value={state.from}
            max={state.to}
            onChange={(event) => onChange({ from: event.target.value })}
            className={inputCls}
            disabled={disabled}
          />
        </label>
        <label>
          <span className={labelCls}>Sampai</span>
          <input
            type="date"
            value={state.to}
            min={state.from}
            onChange={(event) => onChange({ to: event.target.value })}
            className={inputCls}
            disabled={disabled}
          />
        </label>
        <label>
          <span className={labelCls}>Produk</span>
          <select
            value={state.productId}
            onChange={(event) => onChange({ productId: event.target.value, variantId: "" })}
            className={inputCls}
            disabled={disabled}
          >
            <option value="">Semua produk</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.nama}</option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelCls}>Varian</span>
          <select
            value={state.variantId}
            onChange={(event) => onChange({ variantId: event.target.value })}
            className={inputCls}
            disabled={disabled}
          >
            <option value="">Semua varian</option>
            {variants
              .filter((variant) => !state.productId || String(variant.productId) === state.productId)
              .map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.kodeVariant} · {variant.namaColor} {variant.namaSize}
                </option>
              ))}
          </select>
        </label>
        <label>
          <span className={labelCls}>Divisi</span>
          <select
            value={state.divisiId}
            onChange={(event) => onChange({ divisiId: event.target.value })}
            className={inputCls}
            disabled={disabled}
          >
            <option value="">Semua divisi</option>
            {divisions.map((division) => (
              <option key={division.id} value={division.id}>{division.nama}</option>
            ))}
          </select>
        </label>
        <label>
          <span className={labelCls}>Item</span>
          <select
            value={state.itemId}
            onChange={(event) => onChange({ itemId: event.target.value })}
            className={inputCls}
            disabled={disabled}
          >
            <option value="">Semua item</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>{item.kode} · {item.nama}</option>
            ))}
          </select>
        </label>
        {showStatus ? (
          <label>
            <span className={labelCls}>Status unit</span>
            <select
              value={state.status}
              onChange={(event) => onChange({ status: event.target.value })}
              className={inputCls}
              disabled={disabled}
            >
              <option value="">Semua status</option>
              <option value="FINISHGOOD">FINISHGOOD</option>
              <option value="REGISTER">REGISTER</option>
              <option value="RETUR">RETUR</option>
              <option value="OUT">OUT</option>
              <option value="BAD">BAD</option>
            </select>
          </label>
        ) : (
          <div className="flex items-end">
            <button
              type="button"
              onClick={resetPeriod}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Bulan ini
            </button>
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={resetPeriod}
          className="text-[11px] font-semibold text-[#0088C0] hover:underline"
        >
          Atur ke bulan berjalan
        </button>
      </div>
    </section>
  );
}
