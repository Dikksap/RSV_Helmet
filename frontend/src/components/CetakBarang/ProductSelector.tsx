import type { Product } from "../../api/products";

type ProductSelectorProps = {
  products: Product[];
  productId: string;
  onProductSelect: (productId: string) => void;
};

export function ProductSelector({
  products,
  productId,
  onProductSelect,
}: ProductSelectorProps) {
  const selectedProduct = products.find(
    (product) => product.id === Number(productId),
  );

  return (
    <section aria-labelledby="pilih-produk-h" className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
      <div className="mb-4 flex items-center gap-3">
        <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-full bg-[#1E3A5F] text-xs font-bold text-white">
          1
        </span>
        <h2 id="pilih-produk-h" className="text-[15px] font-semibold text-[#1F2937]">Pilih Produk</h2>
        {selectedProduct && (
          <span className="ml-auto max-w-[50%] truncate rounded-full bg-[#1E3A5F] px-3 py-1 text-xs font-semibold text-white">
            {selectedProduct.nama}
          </span>
        )}
      </div>

      <div
        className="grid max-h-[260px] gap-2 overflow-y-auto pr-1"
        role="listbox"
        aria-label="Daftar produk"
      >
        {products.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-[#F5F7FA] px-4 py-8 text-center text-sm italic text-[#6B7280]">
            Produk tidak ditemukan.
          </p>
        ) : (
          products.map((product) => {
            const active = productId === String(product.id);
            return (
              <button
                key={product.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onProductSelect(String(product.id))}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A8E8] ${
                  active
                    ? "border-[#1E3A5F] bg-[#1E3A5F] text-white shadow-sm"
                    : "border-[#D1D5DB] bg-white text-[#1F2937] hover:border-[#00A8E8] hover:bg-[#00A8E8]/5"
                }`}
              >
                <span className="text-sm font-semibold">{product.nama}</span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${active ? "bg-white/15 text-white" : "bg-[#F5F7FA] text-[#6B7280]"}`}
                >
                  {product.variants.length} varian
                </span>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
