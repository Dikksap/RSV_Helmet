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
      <p className="rounded-xl border border-dashed border-[#D1D5DB] bg-white p-8 text-center text-[15px] italic text-[#6B7280] shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        Produk belum tersedia. Klik tombol Produk untuk menambah.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead className="bg-[#F5F7FA] text-[#1E3A5F]">
            <tr className="border-b border-slate-200">
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">Produk</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">Prefix</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">Jumlah Variant</th>
              <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products
              .slice()
              .sort((a, b) => a.nama.localeCompare(b.nama))
              .map((product) => (
                <tr key={product.id} className="text-[15px] transition-colors duration-200 ease hover:bg-[#F5F7FA]">
                  <td className="px-5 py-4 font-semibold text-[#1F2937]">{product.nama}</td>
                  <td className="px-5 py-4">
                    <span className="font-mono font-semibold text-[#1E3A5F]">{product.prefix}</span>
                  </td>
                  <td className="px-5 py-4 tabular-nums text-[#1F2937]">{product.variants.length}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" title="Edit produk" onClick={() => onEdit(product)} className="rounded-lg p-2 text-[#6B7280] transition duration-200 ease hover:bg-[#00A8E8]/10 hover:text-[#00A8E8]">
                        <FontAwesomeIcon icon={faPen} className="h-4 w-4" />
                      </button>
                      <button type="button" title="Hapus produk" onClick={() => onDelete(product)} className="rounded-lg p-2 text-[#6B7280] transition duration-200 ease hover:bg-red-50 hover:text-[#EF4444]">
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
