import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCirclePlus, faFileArrowUp } from "@fortawesome/free-solid-svg-icons";

type Props = {
  onCreateProduct: () => void;
  onCreateVariant: () => void;
  onImport: () => void;
};

export function VariantHeader({ onCreateProduct, onCreateVariant, onImport }: Props) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#00A8E8]">
          Product Inventory / Variant
        </p>
        <h1 className="text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">Variant Produk</h1>
        <p className="mt-1 max-w-2xl text-base text-[#6B7280]">
          Daftar seluruh produk beserta varian (style, warna, dan ukuran).
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onImport}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-lg border-2 border-[#1E3A5F] bg-transparent px-6 py-3 text-base font-medium text-[#1E3A5F] transition duration-200 ease hover:bg-[#1E3A5F]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/40"
        >
          <FontAwesomeIcon icon={faFileArrowUp} className="h-4 w-4" />
          Import
        </button>
        <button
          type="button"
          onClick={onCreateProduct}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-lg border-2 border-[#1E3A5F] bg-transparent px-6 py-3 text-base font-medium text-[#1E3A5F] transition duration-200 ease hover:bg-[#1E3A5F]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/40"
        >
          <FontAwesomeIcon icon={faCirclePlus} className="h-4 w-4" />
          Produk
        </button>
        <button
          type="button"
          onClick={onCreateVariant}
          className="inline-flex min-h-[48px] items-center gap-2 rounded-lg bg-[#00A8E8] px-6 py-3 text-base font-medium text-white transition duration-200 ease hover:bg-[#0088C0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/40"
        >
          <FontAwesomeIcon icon={faCirclePlus} className="h-4 w-4" />
          Variant
        </button>
      </div>
    </div>
  );
}
