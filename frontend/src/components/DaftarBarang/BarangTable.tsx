import type { Barang } from "../../api/barang";
import { StatusBadge } from "./StatusBadge";

type BarangTableProps = {
  barang: Barang[];
  currentPage: number;
  totalBarang: number;
  now: number;
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: (checked: boolean) => void;
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
  selectedIds,
  onToggle,
  onToggleAll,
  onRowClick,
  onEdit,
  onDelete,
  formatDate,
  formatRelativeTime,
}: BarangTableProps) {
  const allSelected = barang.length > 0 && barang.every((b) => selectedIds.has(b.id));
  const someSelected = barang.some((b) => selectedIds.has(b.id));

  return (
    <div>
      {/* ── Mobile: select all bar ─────────────────── */}
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm md:hidden">
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => {
            if (el) el.indeterminate = !allSelected && someSelected;
          }}
          onChange={(e) => onToggleAll(e.target.checked)}
          aria-label="Pilih semua di halaman ini"
          className="h-4 w-4 accent-[#00A8E8]"
        />
        <span className="text-sm font-medium text-[#1F2937]">Pilih semua</span>
        <span className="ml-auto text-xs tabular-nums text-[#6B7280]">{selectedIds.size > 0 ? `${selectedIds.size} dipilih` : `${barang.length} item`}</span>
      </div>
      {/* ── Mobile: cards ─────────────────────────────── */}
      <ul className="grid gap-3 md:hidden" aria-label="Daftar barang">
        {barang.map((item, index) => {
          const checked = selectedIds.has(item.id);
          return (
            <li key={item.id}>
              <article
                onClick={() => onRowClick(item)}
                className={`cursor-pointer rounded-xl border bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.10)] active:scale-[0.99] ${checked ? "border-[#00A8E8] ring-1 ring-[#00A8E8]/30" : "border-slate-200"}`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(item.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Pilih ${item.kodeBarang}`}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#00A8E8]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium tabular-nums text-[#6B7280]">
                          #{(currentPage - 1) * 20 + index + 1} • {formatRelativeTime(item.createdAt, now)}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[15px] font-bold text-[#1E3A5F]">
                          {item.kodeBarang}
                        </p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="mt-2 truncate text-sm font-semibold text-[#1F2937]">{item.variant.product.nama}</p>
                    <p className="mt-0.5 truncate text-xs text-[#6B7280]">
                      {item.variant.style.nama} • {item.variant.color.nama} • {item.variant.size.nama}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
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
                          className="flex min-h-[36px] min-w-[44px] items-center justify-center rounded-lg border border-[#D1D5DB] bg-white px-2.5 text-xs font-medium text-[#1E3A5F] hover:border-[#00A8E8] hover:text-[#00A8E8]"
                        >
                          Edit
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(item)}
                          aria-label={`Hapus ${item.kodeBarang}`}
                          className="flex min-h-[36px] min-w-[44px] items-center justify-center rounded-lg border border-red-200 bg-red-50 px-2.5 text-xs font-medium text-[#EF4444] hover:bg-red-100"
                        >
                          Hapus
                        </button>
                      )}
                    </span>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      {/* ── Desktop: table ────────────────────────────── */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] md:block">
        <div className="max-h-[58vh] overflow-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-[#1E3A5F] text-xs font-bold uppercase tracking-wider text-white">
              <tr>
                <th className="w-10 px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allSelected && someSelected;
                    }}
                    onChange={(e) => onToggleAll(e.target.checked)}
                    aria-label="Pilih semua"
                    className="h-4 w-4 accent-white"
                  />
                </th>
                <th className="w-14 px-3 py-3">No</th>
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
              {barang.map((item, index) => {
                const checked = selectedIds.has(item.id);
                return (
                  <tr
                    key={item.id}
                    onClick={() => onRowClick(item)}
                    className={`group cursor-pointer transition-colors ${checked ? "bg-sky-50 hover:bg-sky-100" : "hover:bg-[#F5F7FA]"}`}
                  >
                    <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggle(item.id)}
                        aria-label={`Pilih ${item.kodeBarang}`}
                        className="h-4 w-4 accent-[#00A8E8]"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-xs tabular-nums text-[#6B7280]">
                      {(currentPage - 1) * 20 + index + 1}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-sm font-bold text-[#1E3A5F] group-hover:text-[#00A8E8] group-hover:underline">
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
                      {item.batch ? `BC${String(item.batch.nomorBatch).padStart(3, "0")}` : "-"}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-[#6B7280]">{formatDate(item.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-[#6B7280]">
                      <span title={formatDate(item.createdAt)}>{formatRelativeTime(item.createdAt, now)}</span>
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
                              className="rounded-lg border border-[#D1D5DB] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1E3A5F] hover:border-[#00A8E8] hover:text-[#00A8E8]"
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
                              className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-[#EF4444] hover:bg-red-100"
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 bg-[#F5F7FA] px-4 py-2.5 text-xs tabular-nums text-[#6B7280]">
          <span>
            Menampilkan {barang.length} dari {totalBarang.toLocaleString("id-ID")} barang
            {selectedIds.size > 0 && <span className="ml-2 font-semibold text-[#1E3A5F]">• {selectedIds.size} dipilih</span>}
          </span>
          <span>
            {totalBarang > 0 ? `${((currentPage - 1) * 20 + 1).toLocaleString("id-ID")}–${Math.min(currentPage * 20, totalBarang).toLocaleString("id-ID")}` : "0"}
          </span>
        </div>
      </div>

      {/* Mobile count line */}
      <p className="mt-2 text-center text-xs tabular-nums text-[#6B7280] md:hidden">
        {barang.length} dari {totalBarang.toLocaleString("id-ID")} • Hal. {currentPage}
        {selectedIds.size > 0 && <span className="font-semibold text-[#1E3A5F]"> • {selectedIds.size} dipilih</span>}
      </p>
    </div>
  );
}
