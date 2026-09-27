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
      <p className="rounded-xl border border-dashed border-[#D1D5DB] bg-white p-6 text-center text-sm italic text-[#6B7280] shadow-sm">
        {hasActiveFilters ? "Tidak ada varian yang cocok dengan filter." : "Variant belum tersedia. Klik tombol Variant untuk menambah."}
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead className="sticky top-0 z-10 bg-[#1E3A5F] text-xs font-bold uppercase tracking-wider text-white">
            <tr>
              <th className="px-3 py-2.5">Kode Variant</th>
              <th className="px-3 py-2.5">Produk</th>
              <th className="px-3 py-2.5">Style</th>
              <th className="px-3 py-2.5">Warna</th>
              <th className="px-3 py-2.5">Ukuran</th>
              <th className="px-3 py-2.5">Tanggal</th>
              <th className="px-3 py-2.5 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ variant, productName }) => (
              <tr key={variant.id} className="text-[13px] hover:bg-[#F5F7FA]">
                <td className="px-3 py-2">
                  <strong className="font-mono text-xs font-bold text-[#1E3A5F]">{variant.kodeVariant ?? "-"}</strong>
                </td>
                <td className="px-3 py-2 font-medium text-[#1F2937]">{productName}</td>
                <td className="px-3 py-2 text-[#1F2937]">{variant.style.nama}</td>
                <td className="px-3 py-2 text-[#1F2937]">{variant.color.nama}</td>
                <td className="px-3 py-2 text-[#1F2937]">{variant.size.nama}</td>
                <td className="px-3 py-2 text-xs text-[#6B7280]">
                  {variant.tanggal ? new Date(variant.tanggal).toLocaleDateString("id-ID") : "-"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-0.5">
                    <button type="button" title="Edit variant" onClick={() => onEdit(variant)} className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#00A8E8]/10 hover:text-[#00A8E8]">
                      <FontAwesomeIcon icon={faPen} className="h-3 w-3" />
                    </button>
                    <button type="button" title="Hapus variant" onClick={() => onDelete(variant)} className="rounded-md p-1.5 text-[#6B7280] hover:bg-red-50 hover:text-[#EF4444]">
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
