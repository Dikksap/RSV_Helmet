import type { Product } from "../../api/products";
import type { GenerateInfo } from "../../api/barang";

type VariantSummaryProps = {
  selectedProduct: Product | undefined;
  selectedStyleName: string | undefined;
  selectedColorName: string | undefined;
  selectedSizeName: string | undefined;
  previewCode: string | null;
  generateInfo: GenerateInfo | null;
  isGenerating: boolean;
  onGenerate: () => void;
  disabled: boolean;
};

export function VariantSummary({
  selectedProduct,
  selectedStyleName,
  selectedColorName,
  selectedSizeName,
  previewCode,
  generateInfo,
  isGenerating,
  onGenerate,
  disabled,
}: VariantSummaryProps) {
  const variantDescription = [selectedProduct?.nama, selectedStyleName, selectedColorName, selectedSizeName]
    .filter(Boolean)
    .join("  ›  ");

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl bg-[#1E3A5F] p-6 text-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-300">
          Ringkasan Varian
        </p>
        <p className="mt-1 truncate text-sm font-semibold">
          {variantDescription || "Lengkapi pilihan di atas untuk membuat barang."}
        </p>
        {generateInfo && (
          <p className="mt-1 font-mono text-xs text-slate-300">
            Preview: {previewCode} • Batch {generateInfo.batch.kodeBatch}
          </p>
        )}
      </div>
      <button
        type="button"
        disabled={disabled || isGenerating || !generateInfo}
        onClick={onGenerate}
        className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#00A8E8] px-6 py-3 text-[15px] font-medium text-white shadow-sm transition-colors duration-200 hover:bg-[#0088C0] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {isGenerating ? "Membuat..." : "Generate & Print"}
      </button>
    </div>
  );
}
