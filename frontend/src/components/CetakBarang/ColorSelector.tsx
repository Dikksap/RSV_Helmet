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
    <section className="w-full rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${styleId ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-500"}`}>3</span>
        <h2 className="text-sm font-bold text-zinc-900">Warna</h2>
        {selectedColorName && (
          <span className="ml-auto truncate rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
            {selectedColorName}
          </span>
        )}
      </div>
      {!styleId ? (
        <p className="rounded-xl bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
          Pilih style terlebih dulu.
        </p>
      ) : colors.length === 0 ? (
        <p className="rounded-xl bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
          Tidak ada warna.
        </p>
      ) : (
        <div className="flex gap-2" role="group" aria-label="Pilih warna">
          {colors.map((color) => {
            const active = colorId === String(color.id);
            return (
              <button
                key={color.id}
                type="button"
                aria-pressed={active}
                onClick={() => onColorSelect(String(color.id))}
                className={`flex min-w-0 flex-1 items-center justify-center rounded-xl border px-4 py-3 text-center text-sm font-medium transition ${active ? "border-zinc-900 bg-zinc-900 text-white shadow-sm" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-900 hover:bg-zinc-50"}`}
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
