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
      <ul className="grid gap-2.5 md:hidden" aria-label="Daftar barang">
        {barang.map((item, index) => (
          <li key={item.id}>
            <article
              onClick={() => onRowClick(item)}
              className="cursor-pointer rounded-2xl border border-brand-border bg-brand-surface-card p-3.5 transition active:scale-[0.99] active:border-brand-gold/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium tabular-nums text-brand-grey">
                    #{(currentPage - 1) * 20 + index + 1} • {formatRelativeTime(item.createdAt, now)}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-sm font-bold text-brand-gold">
                    {item.kodeBarang}
                  </p>
                </div>
                <StatusBadge status={item.status} />
              </div>

              <p className="mt-2 truncate text-sm font-semibold text-white">
                {item.variant.product.nama}
              </p>
              <p className="mt-0.5 truncate text-xs text-brand-grey-light">
                {item.variant.style.nama} • {item.variant.color.nama} • {item.variant.size.nama}
              </p>

              <div className="mt-2.5 flex items-center justify-between border-t border-brand-border/60 pt-2.5">
                <span className="font-mono text-[11px] font-semibold text-brand-grey-light">
                  {item.batch ? `BC${String(item.batch.nomorBatch).padStart(3, "0")}` : "No Batch"}
                  <span className="ml-2 font-sans font-normal text-brand-grey">• {formatDate(item.createdAt)}</span>
                </span>
                {(onEdit || onDelete) && (
                  <span className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {onEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        aria-label={`Edit ${item.kodeBarang}`}
                        className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-brand-border bg-brand-surface px-2.5 text-[11px] font-bold text-brand-grey-light transition hover:border-amber-500/40 hover:text-amber-400 active:scale-95"
                      >
                        Edit
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(item)}
                        aria-label={`Hapus ${item.kodeBarang}`}
                        className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 text-[11px] font-bold text-rose-400 transition hover:bg-rose-500/20 active:scale-95"
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
      <div className="hidden overflow-hidden rounded-2xl border border-brand-border bg-brand-surface-card shadow-sm md:block">
        <div className="max-h-[58vh] overflow-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-brand-surface-card/95 text-xs font-semibold uppercase tracking-wider text-brand-grey backdrop-blur supports-[backdrop-filter]:bg-brand-surface-card/80">
              <tr className="border-b border-brand-border">
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
            <tbody className="divide-y divide-brand-border/60 text-sm">
              {barang.map((item, index) => (
                <tr
                  key={item.id}
                  onClick={() => onRowClick(item)}
                  className="group cursor-pointer transition-colors hover:bg-brand-surface/60"
                >
                  <td className="px-4 py-2.5 text-xs tabular-nums text-brand-grey">
                    {(currentPage - 1) * 20 + index + 1}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs font-bold text-brand-gold transition group-hover:underline">
                      {item.kodeBarang}
                    </span>
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-2.5 text-sm font-semibold text-white">
                    {item.variant.product.nama}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-2.5 text-xs text-brand-grey-light">
                    {item.variant.style.nama} {item.variant.color.nama} {item.variant.size.nama}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-brand-grey-light">
                    {item.batch
                      ? `BC${String(item.batch.nomorBatch).padStart(3, "0")}`
                      : "-"}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-brand-grey">
                    {formatDate(item.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-brand-grey-light">
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
                            className="rounded-lg border border-brand-border bg-brand-surface px-2.5 py-1.5 text-[11px] font-bold text-brand-grey-light transition hover:border-amber-500/40 hover:text-amber-400"
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
                            className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-bold text-rose-400 transition hover:bg-rose-500/20"
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
        <div className="flex items-center justify-between border-t border-brand-border bg-brand-surface/40 px-4 py-2.5 text-xs tabular-nums text-brand-grey">
          <span>
            Menampilkan {barang.length} dari {totalBarang.toLocaleString("id-ID")} barang
          </span>
          <span>
            {totalBarang > 0 ? `${((currentPage - 1) * 20 + 1).toLocaleString("id-ID")}–${Math.min(currentPage * 20, totalBarang).toLocaleString("id-ID")}` : "0"}
          </span>
        </div>
      </div>

      {/* Mobile count line */}
      <p className="mt-2 text-center text-[11px] tabular-nums text-brand-grey md:hidden">
        {barang.length} dari {totalBarang.toLocaleString("id-ID")} • Hal. {currentPage}
      </p>
    </div>
  );
}
