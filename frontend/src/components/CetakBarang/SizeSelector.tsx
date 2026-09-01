import type { ProductSize } from "../../api/products";

type SizeSelectorProps = {
  colorId: string;
  sizeId: string;
  sizes: ProductSize[];
  selectedSizeName: string | undefined;
  onSizeSelect: (sizeId: string) => void;
};

export function SizeSelector({
  colorId,
  sizeId,
  sizes,
  selectedSizeName,
  onSizeSelect,
}: SizeSelectorProps) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${colorId ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-500"}`}>4</span>
        <h2 className="text-sm font-bold text-zinc-900">Ukuran</h2>
        {selectedSizeName && (
          <span className="ml-auto rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white">
            {selectedSizeName}
          </span>
        )}
      </div>
      {!colorId ? (
        <p className="rounded-xl bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
          Pilih warna terlebih dulu.
        </p>
      ) : sizes.length === 0 ? (
        <p className="rounded-xl bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
          Tidak ada ukuran.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Pilih ukuran">
          {sizes.map((size) => {
            const active = sizeId === String(size.id);
            return (
              <button
                key={size.id}
                type="button"
                aria-pressed={active}
                onClick={() => onSizeSelect(String(size.id))}
                className={`min-w-14 rounded-xl border px-4 py-2.5 text-sm font-bold transition ${active ? "border-zinc-900 bg-zinc-900 text-white shadow-sm" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-900 hover:bg-zinc-50"}`}
              >
                {size.nama}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
