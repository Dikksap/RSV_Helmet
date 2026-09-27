import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCirclePlus, faFileArrowUp } from "@fortawesome/free-solid-svg-icons";

type Props = {
  onCreateProduct: () => void;
  onCreateVariant: () => void;
  onImport: () => void;
};

export function VariantHeader({ onCreateProduct, onCreateVariant, onImport }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm sm:px-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-bold leading-none tracking-tight text-[#1E3A5F] sm:text-xl">Variant Produk</h1>
          <span className="hidden text-xs leading-none text-[#6B7280] sm:inline">Product Inventory / Variant</span>
        </div>
        <p className="mt-0.5 hidden text-xs leading-none text-[#6B7280] sm:block">
          Daftar produk & varian (style, warna, ukuran)
        </p>
        <p className="mt-0.5 text-[11px] leading-none text-[#6B7280] sm:hidden">Product Inventory</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onImport}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-[#1E3A5F] hover:bg-slate-50"
        >
          <FontAwesomeIcon icon={faFileArrowUp} className="h-3 w-3" />
          Import
        </button>
        <button
          type="button"
          onClick={onCreateProduct}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-[#1E3A5F] hover:bg-slate-50"
        >
          <FontAwesomeIcon icon={faCirclePlus} className="h-3 w-3" />
          Produk
        </button>
        <button
          type="button"
          onClick={onCreateVariant}
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#00A8E8] px-3 text-xs font-semibold text-white hover:bg-[#0088C0]"
        >
          <FontAwesomeIcon icon={faCirclePlus} className="h-3 w-3" />
          Variant
        </button>
      </div>
    </div>
  );
}
