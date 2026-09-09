import type { ProductVariant } from "../../api/products";

type ColorSelectorProps = {
  styleId: string;
  colorId: string;
  productVariants: ProductVariant[];
  onColorSelect: (colorId: string) => void;
};

export function ColorSelector({
  styleId,
  colorId,
  productVariants,
  onColorSelect,
}: ColorSelectorProps) {
  const colors = [
    ...new Map(
      productVariants
        .filter((variant) => variant.styleId === Number(styleId))
        .map((variant) => [variant.colorId, variant.color]),
    ).values(),
  ];
  const selectedColorName = colors.find(
    (color) => String(color.id) === colorId,
  )?.nama;

  return (
    <section aria-labelledby="pilih-warna-h" className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
      <div className="mb-3 flex items-center gap-3">
        <span aria-hidden="true" className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${styleId ? "bg-[#1E3A5F] text-white" : "bg-slate-200 text-[#6B7280]"}`}>3</span>
        <h2 id="pilih-warna-h" className="text-[15px] font-semibold text-[#1F2937]">Warna</h2>
        {selectedColorName && (
          <span className="ml-auto truncate rounded-full bg-[#1E3A5F] px-2.5 py-1 text-xs font-semibold text-white">
            {selectedColorName}
          </span>
        )}
      </div>
      {!styleId ? (
        <p className="rounded-xl bg-[#F5F7FA] px-3 py-6 text-center text-sm text-[#6B7280]">
          Pilih style terlebih dulu.
        </p>
      ) : colors.length === 0 ? (
        <p className="rounded-xl bg-[#F5F7FA] px-3 py-6 text-center text-sm text-[#6B7280]">
          Tidak ada warna.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Pilih warna">
          {colors.map((color) => {
            const active = colorId === String(color.id);
            return (
              <button
                key={color.id}
                type="button"
                aria-pressed={active}
                onClick={() => onColorSelect(String(color.id))}
                className={`flex min-w-0 items-center justify-center rounded-xl border px-4 py-3 text-center text-sm font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A8E8] ${active ? "border-[#1E3A5F] bg-[#1E3A5F] text-white shadow-sm" : "border-[#D1D5DB] bg-white text-[#1F2937] hover:border-[#00A8E8] hover:bg-[#00A8E8]/5"}`}
              >
                <span className="truncate">{color.nama}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
