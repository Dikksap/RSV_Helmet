import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen, faTrash } from "@fortawesome/free-solid-svg-icons";
import type { Product } from "../../api/products";

type Props = {
  products: Product[];
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
};

export function ProductTable({ products, onEdit, onDelete }: Props) {
  if (products.length === 0) {
    return (
      <p className="rounded-2xl border border-brand-border bg-brand-surface-card p-8 text-center text-sm italic text-brand-grey">
        Produk belum tersedia. Klik tombol Produk untuk menambah.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead className="bg-brand-surface/40 text-brand-grey">
            <tr>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">Produk</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">Prefix</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">Jumlah Variant</th>
              <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {products
              .slice()
              .sort((a, b) => a.nama.localeCompare(b.nama))
              .map((product) => (
                <tr key={product.id} className="text-sm transition-colors hover:bg-brand-surface/60">
                  <td className="px-5 py-4 font-semibold text-white">{product.nama}</td>
                  <td className="px-5 py-4">
                    <span className="font-mono text-brand-gold">{product.prefix}</span>
                  </td>
                  <td className="px-5 py-4 tabular-nums text-brand-grey-light">{product.variants.length}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" title="Edit produk" onClick={() => onEdit(product)} className="rounded-lg p-2 text-brand-grey transition hover:bg-brand-gold/10 hover:text-brand-gold">
                        <FontAwesomeIcon icon={faPen} className="h-4 w-4" />
                      </button>
                      <button type="button" title="Hapus produk" onClick={() => onDelete(product)} className="rounded-lg p-2 text-brand-grey transition hover:bg-rose-500/10 hover:text-rose-400">
                        <FontAwesomeIcon icon={faTrash} className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
