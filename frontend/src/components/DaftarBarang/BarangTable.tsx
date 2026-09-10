import type { Barang } from "../../api/barang";
import { StatusBadge } from "./StatusBadge";

type BarangTableProps = {
  barang: Barang[];
  currentPage: number;
  totalBarang: number;
  now: number;
  onRowClick: (item: Barang) => void;
  onEdit?: (item: Barang) => void;
  onDelete?: (item: Barang) => void;
  formatDate: (date: string) => string;
  formatRelativeTime: (date: string, nowMs: number) => string;
};

export function BarangTable({
  barang,
  currentPage,
  totalBarang,
  now,
  onRowClick,
  onEdit,
  onDelete,
  formatDate,
  formatRelativeTime,
}: BarangTableProps) {
  return (
    <div>
      {/* ── Mobile: cards ─────────────────────────────── */}
      <ul className="grid gap-3 md:hidden" aria-label="Daftar barang">
        {barang.map((item, index) => (
          <li key={item.id}>
            <article
              onClick={() => onRowClick(item)}
              className="cursor-pointer rounded-xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition duration-200 ease hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.10)] active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium tabular-nums text-[#6B7280]">
                    #{(currentPage - 1) * 20 + index + 1} • {formatRelativeTime(item.createdAt, now)}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[15px] font-bold text-[#1E3A5F]">
                    {item.kodeBarang}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </div>

              <p className="mt-2 truncate text-base font-semibold text-[#1F2937]">
                {item.variant.product.nama}
              </p>
              <p className="mt-0.5 truncate text-sm text-[#6B7280]">
                {item.variant.style.nama} • {item.variant.color.nama} • {item.variant.size.nama}
              </p>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="font-mono text-xs font-semibold text-[#1F2937]">
                  {item.batch ? `BC${String(item.batch.nomorBatch).padStart(3, "0")}` : "No Batch"}
                  <span className="ml-2 font-sans font-normal text-[#6B7280]">• {formatDate(item.createdAt)}</span>
                </span>
                {(onEdit || onDelete) && (
                  <span className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {onEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        aria-label={`Edit ${item.kodeBarang}`}
                        className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-lg border border-[#D1D5DB] bg-white px-2.5 text-xs font-medium text-[#1E3A5F] transition duration-200 ease hover:border-[#00A8E8] hover:text-[#00A8E8] active:scale-95"
                      >
                        Edit
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(item)}
                        aria-label={`Hapus ${item.kodeBarang}`}
                        className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-lg border border-red-200 bg-red-50 px-2.5 text-xs font-medium text-[#EF4444] transition duration-200 ease hover:bg-red-100 active:scale-95"
                      >
                        Hapus
                      </button>
                    )}
                  </span>
                )}
              </div>
            </article>
          </li>
        ))}
      </ul>

      {/* ── Desktop: table ────────────────────────────── */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] md:block">
        <div className="max-h-[58vh] overflow-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-[#F5F7FA] text-xs font-semibold uppercase tracking-wider text-[#1E3A5F]">
              <tr className="border-b border-slate-200">
                <th className="w-14 px-4 py-3">No</th>
                <th className="px-4 py-3">Kode Barang</th>
                <th className="px-4 py-3">Produk</th>
                <th className="px-4 py-3">Varian</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Dibuat</th>
                <th className="px-4 py-3">Waktu</th>
                {(onEdit || onDelete) && <th className="px-4 py-3 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[15px]">
              {barang.map((item, index) => (
                <tr
                  key={item.id}
                  onClick={() => onRowClick(item)}
                  className="group cursor-pointer transition-colors duration-200 ease hover:bg-[#F5F7FA]"
                >
                  <td className="px-4 py-2.5 text-xs tabular-nums text-[#6B7280]">
                    {(currentPage - 1) * 20 + index + 1}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-sm font-bold text-[#1E3A5F] transition group-hover:text-[#00A8E8] group-hover:underline">
                      {item.kodeBarang}
                    </span>
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-2.5 text-[15px] font-semibold text-[#1F2937]">
                    {item.variant.product.nama}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-2.5 text-sm text-[#6B7280]">
                    {item.variant.style.nama} {item.variant.color.nama} {item.variant.size.nama}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-[#1F2937]">
                    {item.batch
                      ? `BC${String(item.batch.nomorBatch).padStart(3, "0")}`
                      : "-"}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-sm text-[#6B7280]">
                    {formatDate(item.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-sm text-[#6B7280]">
                    <span title={formatDate(item.createdAt)}>
                      {formatRelativeTime(item.createdAt, now)}
                    </span>
                  </td>
                  {(onEdit || onDelete) && (
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        {onEdit && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(item);
                            }}
                            className="rounded-lg border border-[#D1D5DB] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1E3A5F] transition duration-200 ease hover:border-[#00A8E8] hover:text-[#00A8E8]"
                          >
                            Edit
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(item);
                            }}
                            className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-[#EF4444] transition duration-200 ease hover:bg-red-100"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 bg-[#F5F7FA] px-4 py-2.5 text-xs tabular-nums text-[#6B7280]">
          <span>
            Menampilkan {barang.length} dari {totalBarang.toLocaleString("id-ID")} barang
          </span>
          <span>
            {totalBarang > 0 ? `${((currentPage - 1) * 20 + 1).toLocaleString("id-ID")}–${Math.min(currentPage * 20, totalBarang).toLocaleString("id-ID")}` : "0"}
          </span>
        </div>
      </div>

      {/* Mobile count line */}
      <p className="mt-2 text-center text-xs tabular-nums text-[#6B7280] md:hidden">
        {barang.length} dari {totalBarang.toLocaleString("id-ID")} • Hal. {currentPage}
      </p>
    </div>
  );
}
