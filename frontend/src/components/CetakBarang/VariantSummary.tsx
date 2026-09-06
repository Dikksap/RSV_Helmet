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
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-900 bg-zinc-900 p-5 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
          Ringkasan Varian
        </p>
        <p className="mt-1 truncate text-sm font-semibold">
          {variantDescription || "Lengkapi pilihan di atas untuk membuat barang."}
        </p>
        {generateInfo && (
          <p className="mt-1 font-mono text-xs text-zinc-400">
            Preview: {previewCode} • Batch {generateInfo.batch.kodeBatch}
          </p>
        )}
      </div>
      <button
        type="button"
        disabled={disabled || isGenerating || !generateInfo}
        onClick={onGenerate}
        className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-bold text-zinc-900 shadow-sm transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isGenerating ? "Membuat..." : "Generate & Print"}
      </button>
    </div>
  );
}
