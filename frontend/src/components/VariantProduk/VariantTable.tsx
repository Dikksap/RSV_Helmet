import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen, faTrash } from "@fortawesome/free-solid-svg-icons";
import type { VariantRow } from "./types";

type Props = {
  rows: VariantRow[];
  hasActiveFilters: boolean;
  onEdit: (v: VariantRow["variant"]) => void;
  onDelete: (v: VariantRow["variant"]) => void;
};

export function VariantTable({ rows, hasActiveFilters, onEdit, onDelete }: Props) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-[#D1D5DB] bg-white p-8 text-center text-[15px] italic text-[#6B7280] shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        {hasActiveFilters ? "Tidak ada varian yang cocok dengan filter." : "Variant belum tersedia. Klik tombol Variant untuk menambah."}
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[840px] border-collapse text-left">
          <thead className="bg-[#F5F7FA] text-[#1E3A5F]">
            <tr className="border-b border-slate-200">
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">Kode Variant</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">Produk</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">Style</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">Warna</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">Ukuran</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">Tanggal</th>
              <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ variant, productName }) => (
              <tr key={variant.id} className="text-[15px] transition-colors duration-200 ease hover:bg-[#F5F7FA]">
                <td className="px-5 py-4">
                  <strong className="font-mono text-sm font-bold text-[#1E3A5F]">{variant.kodeVariant ?? "-"}</strong>
                </td>
                <td className="px-5 py-4 font-semibold text-[#1F2937]">{productName}</td>
                <td className="px-5 py-4 text-[#1F2937]">{variant.style.nama}</td>
                <td className="px-5 py-4 text-[#1F2937]">{variant.color.nama}</td>
                <td className="px-5 py-4 text-[#1F2937]">{variant.size.nama}</td>
                <td className="px-5 py-4 text-sm text-[#6B7280]">
                  {variant.tanggal ? new Date(variant.tanggal).toLocaleDateString("id-ID") : "-"}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-1">
                    <button type="button" title="Edit variant" onClick={() => onEdit(variant)} className="rounded-lg p-2 text-[#6B7280] transition duration-200 ease hover:bg-[#00A8E8]/10 hover:text-[#00A8E8]">
                      <FontAwesomeIcon icon={faPen} className="h-4 w-4" />
                    </button>
                    <button type="button" title="Hapus variant" onClick={() => onDelete(variant)} className="rounded-lg p-2 text-[#6B7280] transition duration-200 ease hover:bg-red-50 hover:text-[#EF4444]">
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
