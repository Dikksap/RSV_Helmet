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
      <div className="flex rounded-lg border border-slate-200 bg-[#F5F7FA] p-1">
        <button
          type="button"
          onClick={() => onChange("variant")}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition duration-200 ease ${tab === "variant" ? "bg-[#1E3A5F] text-white" : "text-[#6B7280] hover:text-[#1E3A5F]"}`}
        >
          <FontAwesomeIcon icon={faTags} className="h-4 w-4" />
          Variant
        </button>
        <button
          type="button"
          onClick={() => onChange("produk")}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition duration-200 ease ${tab === "produk" ? "bg-[#1E3A5F] text-white" : "text-[#6B7280] hover:text-[#1E3A5F]"}`}
        >
          <FontAwesomeIcon icon={faBoxesStacked} className="h-4 w-4" />
          Produk
        </button>
      </div>
      {tab === "variant" && (
        <span className="w-fit rounded-full border border-[#1E3A5F]/15 bg-[#F5F7FA] px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-[#1E3A5F]">
          {totalVarian} total varian
        </span>
      )}
      {tab === "produk" && (
        <span className="w-fit rounded-full border border-[#1E3A5F]/15 bg-[#F5F7FA] px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-[#1E3A5F]">
          {totalProduk} total produk
        </span>
      )}
    </div>
  );
}
