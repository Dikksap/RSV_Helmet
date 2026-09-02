import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCirclePlus } from "@fortawesome/free-solid-svg-icons";

type Props = {
  onCreateProduct: () => void;
  onCreateVariant: () => void;
};

export function VariantHeader({ onCreateProduct, onCreateVariant }: Props) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-brand-gold">
          Product Inventory / Variant
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Variant Produk</h1>
        <p className="mt-1 max-w-2xl text-sm text-brand-grey">
          Daftar seluruh produk beserta varian (style, warna, dan ukuran).
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onCreateProduct}
          className="inline-flex items-center gap-2 rounded-lg border border-brand-border bg-brand-surface px-4 py-2.5 text-sm font-bold text-brand-grey-light transition hover:border-brand-gold hover:text-brand-gold"
        >
          <FontAwesomeIcon icon={faCirclePlus} className="h-4 w-4" />
          Produk
        </button>
        <button
          type="button"
          onClick={onCreateVariant}
          className="inline-flex items-center gap-2 rounded-lg border border-brand-gold/30 bg-brand-gold/10 px-4 py-2.5 text-sm font-bold text-brand-gold transition hover:bg-brand-gold hover:text-brand-black"
        >
          <FontAwesomeIcon icon={faCirclePlus} className="h-4 w-4" />
          Variant
        </button>
      </div>
    </div>
  );
}
