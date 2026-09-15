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
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border border-slate-200 bg-[#F5F7FA] p-0.5">
        <button
          type="button"
          onClick={() => onChange("variant")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${tab === "variant" ? "bg-[#1E3A5F] text-white" : "text-[#6B7280] hover:text-[#1E3A5F]"}`}
        >
          <FontAwesomeIcon icon={faTags} className="h-3 w-3" />
          Variant
        </button>
        <button
          type="button"
          onClick={() => onChange("produk")}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${tab === "produk" ? "bg-[#1E3A5F] text-white" : "text-[#6B7280] hover:text-[#1E3A5F]"}`}
        >
          <FontAwesomeIcon icon={faBoxesStacked} className="h-3 w-3" />
          Produk
        </button>
      </div>
      <span className="rounded-full border border-[#1E3A5F]/10 bg-[#F5F7FA] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#1E3A5F]">
        {tab === "variant" ? `${totalVarian} varian` : `${totalProduk} produk`}
      </span>
    </div>
  );
}
