import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBoxesStacked, faTags } from "@fortawesome/free-solid-svg-icons";
import type { Tab } from "./types";

type Props = {
  tab: Tab;
  onChange: (tab: Tab) => void;
  totalVarian: number;
  totalProduk: number;
};

export function VariantTabs({ tab, onChange, totalVarian, totalProduk }: Props) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-lg border border-brand-border bg-brand-surface-card p-1">
        <button
          type="button"
          onClick={() => onChange("variant")}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition ${tab === "variant" ? "bg-brand-gold text-brand-black" : "text-brand-grey hover:text-white"}`}
        >
          <FontAwesomeIcon icon={faTags} className="h-4 w-4" />
          Variant
        </button>
        <button
          type="button"
          onClick={() => onChange("produk")}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition ${tab === "produk" ? "bg-brand-gold text-brand-black" : "text-brand-grey hover:text-white"}`}
        >
          <FontAwesomeIcon icon={faBoxesStacked} className="h-4 w-4" />
          Produk
        </button>
      </div>
      {tab === "variant" && (
        <span className="w-fit rounded-full border border-brand-gold/20 bg-brand-gold/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-gold">
          {totalVarian} total varian
        </span>
      )}
      {tab === "produk" && (
        <span className="w-fit rounded-full border border-brand-gold/20 bg-brand-gold/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-gold">
          {totalProduk} total produk
        </span>
      )}
    </div>
  );
}
