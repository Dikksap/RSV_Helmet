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
    <section className="w-full rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
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
        <div className="flex gap-2" role="group" aria-label="Pilih style">
          {styles.map((style) => {
            const active = styleId === String(style.id);
            return (
              <button
                key={style.id}
                type="button"
                aria-pressed={active}
                onClick={() => onStyleSelect(String(style.id))}
                className={`flex min-w-0 flex-1 items-center justify-center rounded-xl border px-4 py-3 text-center text-sm font-medium transition ${active ? "border-zinc-900 bg-zinc-900 text-white shadow-sm" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-900 hover:bg-zinc-50"}`}
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
