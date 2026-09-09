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
    <section aria-labelledby="pilih-ukuran-h" className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
      <div className="mb-3 flex items-center gap-3">
        <span aria-hidden="true" className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${colorId ? "bg-[#1E3A5F] text-white" : "bg-slate-200 text-[#6B7280]"}`}>4</span>
        <h2 id="pilih-ukuran-h" className="text-[15px] font-semibold text-[#1F2937]">Ukuran</h2>
        {selectedSizeName && (
          <span className="ml-auto rounded-full bg-[#1E3A5F] px-3 py-1 text-xs font-semibold text-white">
            {selectedSizeName}
          </span>
        )}
      </div>
      {!colorId ? (
        <p className="rounded-xl bg-[#F5F7FA] px-3 py-6 text-center text-sm text-[#6B7280]">
          Pilih warna terlebih dulu.
        </p>
      ) : sizes.length === 0 ? (
        <p className="rounded-xl bg-[#F5F7FA] px-3 py-6 text-center text-sm text-[#6B7280]">
          Tidak ada ukuran.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Pilih ukuran">
          {sizes.map((size) => {
            const active = sizeId === String(size.id);
            return (
              <button
                key={size.id}
                type="button"
                aria-pressed={active}
                onClick={() => onSizeSelect(String(size.id))}
                className={`flex min-w-0 items-center justify-center rounded-xl border px-4 py-3 text-center text-sm font-semibold transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A8E8] ${active ? "border-[#1E3A5F] bg-[#1E3A5F] text-white shadow-sm" : "border-[#D1D5DB] bg-white text-[#1F2937] hover:border-[#00A8E8] hover:bg-[#00A8E8]/5"}`}
              >
                <span className="truncate">{size.nama}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
