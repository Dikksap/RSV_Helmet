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
    <section className="w-full rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-zinc-900 text-xs font-bold text-white">
          1
        </span>
        <h2 className="text-sm font-bold text-zinc-900">Pilih Produk</h2>
        {selectedProduct && (
          <span className="ml-auto max-w-[50%] truncate rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white">
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
          <p className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm italic text-zinc-500">
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
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  active
                    ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                    : "border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50"
                }`}
              >
                <span className="text-sm font-semibold">{product.nama}</span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${active ? "bg-white/15 text-white" : "bg-zinc-100 text-zinc-600"}`}
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
