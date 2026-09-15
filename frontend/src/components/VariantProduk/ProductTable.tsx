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
      <p className="rounded-xl border border-dashed border-[#D1D5DB] bg-white p-6 text-center text-sm italic text-[#6B7280] shadow-sm">
        Produk belum tersedia. Klik tombol Produk untuk menambah.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-[#1E3A5F] text-xs font-bold uppercase tracking-wider text-white">
            <tr>
              <th className="px-3 py-2.5">Produk</th>
              <th className="px-3 py-2.5">Prefix</th>
              <th className="px-3 py-2.5">Jumlah Variant</th>
              <th className="px-3 py-2.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products
              .slice()
              .sort((a, b) => a.nama.localeCompare(b.nama))
              .map((product) => (
                <tr key={product.id} className="text-[13px] hover:bg-[#F5F7FA]">
                  <td className="px-3 py-2 font-medium text-[#1F2937]">{product.nama}</td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs font-semibold text-[#1E3A5F]">{product.prefix}</span>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-[#1F2937]">{product.variants.length}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-0.5">
                      <button type="button" title="Edit produk" onClick={() => onEdit(product)} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#00A8E8]/10 hover:text-[#00A8E8]">
                        <FontAwesomeIcon icon={faPen} className="h-3 w-3" />
                      </button>
                      <button type="button" title="Hapus produk" onClick={() => onDelete(product)} className="rounded-md p-1.5 text-[#6B7280] hover:bg-red-50 hover:text-[#EF4444]">
                        <FontAwesomeIcon icon={faTrash} className="h-3 w-3" />
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
