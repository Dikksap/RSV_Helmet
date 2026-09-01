import type { ProductVariant } from "../../api/products";

type StyleColorSelectorProps = {
  productId: string;
  styleId: string;
  colorId: string;
  productVariants: ProductVariant[];
  onStyleSelect: (styleId: string) => void;
  onColorSelect: (colorId: string) => void;
};

export function StyleColorSelector({
  productId,
  styleId,
  colorId,
  productVariants,
  onStyleSelect,
  onColorSelect,
}: StyleColorSelectorProps) {
  const styles = [
    ...new Map(
      productVariants.map((variant) => [variant.styleId, variant.style]),
    ).values(),
  ];
  const styleVariants = productVariants.filter(
    (variant) => variant.styleId === Number(styleId),
  );
  const colors = [
    ...new Map(
      styleVariants.map((variant) => [variant.colorId, variant.color]),
    ).values(),
  ];
  const selectedStyleName = styles.find(
    (style) => String(style.id) === styleId,
  )?.nama;
  const selectedColorName = colors.find(
    (color) => String(color.id) === colorId,
  )?.nama;

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-3">
          <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${productId ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-500"}`}>2</span>
          <h2 className="text-sm font-bold text-zinc-900">Style</h2>
          {selectedStyleName && (
            <span className="ml-auto truncate rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
              {selectedStyleName}
            </span>
          )}
        </div>
        {!productId ? (
          <p className="rounded-xl bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
            Pilih produk terlebih dulu.
          </p>
        ) : styles.length === 0 ? (
          <p className="rounded-xl bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
            Tidak ada style.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Pilih style">
            {styles.map((style) => {
              const active = styleId === String(style.id);
              return (
                <button
                  key={style.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onStyleSelect(String(style.id))}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${active ? "border-zinc-900 bg-zinc-900 text-white shadow-sm" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-900 hover:bg-zinc-50"}`}
                >
                  {style.nama}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
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
          <div className="flex flex-wrap gap-2" role="group" aria-label="Pilih warna">
            {colors.map((color) => {
              const active = colorId === String(color.id);
              return (
                <button
                  key={color.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onColorSelect(String(color.id))}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${active ? "border-zinc-900 bg-zinc-900 text-white shadow-sm" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-900 hover:bg-zinc-50"}`}
                >
                  {color.nama}
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
