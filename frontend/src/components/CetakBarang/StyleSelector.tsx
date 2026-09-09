import type { ProductVariant } from "../../api/products";

type StyleSelectorProps = {
  productId: string;
  styleId: string;
  productVariants: ProductVariant[];
  onStyleSelect: (styleId: string) => void;
};

export function StyleSelector({
  productId,
  styleId,
  productVariants,
  onStyleSelect,
}: StyleSelectorProps) {
  const styles = [
    ...new Map(
      productVariants.map((variant) => [variant.styleId, variant.style]),
    ).values(),
  ];
  const selectedStyleName = styles.find(
    (style) => String(style.id) === styleId,
  )?.nama;

  return (
    <section aria-labelledby="pilih-style-h" className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
      <div className="mb-3 flex items-center gap-3">
        <span aria-hidden="true" className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${productId ? "bg-[#1E3A5F] text-white" : "bg-slate-200 text-[#6B7280]"}`}>2</span>
        <h2 id="pilih-style-h" className="text-[15px] font-semibold text-[#1F2937]">Style</h2>
        {selectedStyleName && (
          <span className="ml-auto truncate rounded-full bg-[#1E3A5F] px-2.5 py-1 text-xs font-semibold text-white">
            {selectedStyleName}
          </span>
        )}
      </div>
      {!productId ? (
        <p className="rounded-xl bg-[#F5F7FA] px-3 py-6 text-center text-sm text-[#6B7280]">
          Pilih produk terlebih dulu.
        </p>
      ) : styles.length === 0 ? (
        <p className="rounded-xl bg-[#F5F7FA] px-3 py-6 text-center text-sm text-[#6B7280]">
          Tidak ada style.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Pilih style">
          {styles.map((style) => {
            const active = styleId === String(style.id);
            return (
              <button
                key={style.id}
                type="button"
                aria-pressed={active}
                onClick={() => onStyleSelect(String(style.id))}
                className={`flex min-w-0 items-center justify-center rounded-xl border px-4 py-3 text-center text-sm font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A8E8] ${active ? "border-[#1E3A5F] bg-[#1E3A5F] text-white shadow-sm" : "border-[#D1D5DB] bg-white text-[#1F2937] hover:border-[#00A8E8] hover:bg-[#00A8E8]/5"}`}
              >
                <span className="truncate">{style.nama}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
