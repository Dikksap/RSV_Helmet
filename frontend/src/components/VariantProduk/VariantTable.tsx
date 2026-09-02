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
      <p className="rounded-2xl border border-brand-border bg-brand-surface-card p-8 text-center text-sm italic text-brand-grey">
        {hasActiveFilters ? "Tidak ada varian yang cocok dengan filter." : "Variant belum tersedia. Klik tombol Variant untuk menambah."}
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[840px] border-collapse text-left">
          <thead className="bg-brand-surface/40 text-brand-grey">
            <tr>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">Kode Variant</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">Produk</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">Style</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">Warna</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">Ukuran</th>
              <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">Tanggal</th>
              <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {rows.map(({ variant, productName }) => (
              <tr key={variant.id} className="text-sm transition-colors hover:bg-brand-surface/60">
                <td className="px-5 py-4">
                  <strong className="font-mono text-sm font-bold text-brand-gold">{variant.kodeVariant ?? "-"}</strong>
                </td>
                <td className="px-5 py-4 font-semibold text-white">{productName}</td>
                <td className="px-5 py-4 text-brand-grey-light">{variant.style.nama}</td>
                <td className="px-5 py-4 text-brand-grey-light">{variant.color.nama}</td>
                <td className="px-5 py-4 text-brand-grey-light">{variant.size.nama}</td>
                <td className="px-5 py-4 text-brand-grey">
                  {variant.tanggal ? new Date(variant.tanggal).toLocaleDateString("id-ID") : "-"}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-1">
                    <button type="button" title="Edit variant" onClick={() => onEdit(variant)} className="rounded-lg p-2 text-brand-grey transition hover:bg-brand-gold/10 hover:text-brand-gold">
                      <FontAwesomeIcon icon={faPen} className="h-4 w-4" />
                    </button>
                    <button type="button" title="Hapus variant" onClick={() => onDelete(variant)} className="rounded-lg p-2 text-brand-grey transition hover:bg-rose-500/10 hover:text-rose-400">
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
