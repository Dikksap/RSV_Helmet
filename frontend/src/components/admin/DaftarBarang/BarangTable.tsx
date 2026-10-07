import type { Barang } from "../../../api/barang";
import { StatusBadge } from "./StatusBadge";

type BarangTableProps = {
  barang: Barang[];
  currentPage: number;
  pageSize: number | "all";
  totalBarang: number;
  now: number;
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: (checked: boolean) => void;
  onRowClick: (item: Barang) => void;
  onEdit?: (item: Barang) => void;
  onDelete?: (item: Barang) => void;
  onRiwayat?: (item: Barang) => void;
  formatDate: (date: string) => string;
  formatRelativeTime: (date: string, nowMs: number) => string;
  caption?: string;
};

const MINI =
  "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/50";
const batchLabel = (b: Barang) => (b.batch ? `BC${String(b.batch.nomorBatch).padStart(3, "0")}` : null);

export function BarangTable({
  barang,
  currentPage,
  pageSize,
  totalBarang,
  now,
  selectedIds,
  onToggle,
  onToggleAll,
  onRowClick,
  onEdit,
  onDelete,
  onRiwayat,
  formatDate,
  formatRelativeTime,
  caption,
}: BarangTableProps) {
  const allSelected = barang.length > 0 && barang.every((b) => selectedIds.has(b.id));
  const someSelected = !allSelected && barang.some((b) => selectedIds.has(b.id));
  const size = pageSize === "all" ? barang.length : pageSize;
  const rowNo = (i: number) => (currentPage - 1) * size + i + 1;
  const hasActions = Boolean(onEdit || onDelete || onRiwayat);
  const range =
    totalBarang > 0 && size > 0
      ? `${((currentPage - 1) * size + 1).toLocaleString("id-ID")}–${Math.min(currentPage * size, totalBarang).toLocaleString("id-ID")}`
      : "0";
  const footer = caption ?? `Menampilkan ${range} dari ${totalBarang.toLocaleString("id-ID")} barang`;

  const selectAll = (label: string) => (
    <input
      type="checkbox"
      checked={allSelected}
      ref={(el) => {
        if (el) el.indeterminate = someSelected;
      }}
      onChange={(e) => onToggleAll(e.target.checked)}
      aria-label={label}
      className="h-4 w-4 cursor-pointer accent-[#1E3A5F]"
    />
  );

  const retur = (item: Barang) =>
    item.pernahRetur && (
      <span
        title={item.tanggalReturTerakhir ? `Retur ${item.jumlahRetur ?? 1}x, terakhir ${formatDate(item.tanggalReturTerakhir)}` : "Pernah retur"}
        className="inline-flex rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700"
      >
        RETUR{(item.jumlahRetur ?? 0) > 1 ? ` ×${item.jumlahRetur}` : ""}
      </span>
    );

  const actions = (item: Barang) =>
    hasActions && (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        {onRiwayat && (
          <button type="button" onClick={() => onRiwayat(item)} className={`${MINI} text-slate-600 hover:bg-slate-100`}>
            Riwayat
          </button>
        )}
        {onEdit && (
          <button type="button" onClick={() => onEdit(item)} className={`${MINI} text-slate-600 hover:bg-slate-100`}>
            Edit
          </button>
        )}
        {onDelete && (
          <button type="button" onClick={() => onDelete(item)} className={`${MINI} text-[#EF4444] hover:bg-red-50`}>
            Hapus
          </button>
        )}
      </div>
    );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 lg:hidden">
        {selectAll("Pilih semua di halaman ini")}
        <span className="text-sm font-medium text-slate-700">Pilih semua</span>
        <span className="ml-auto text-xs tabular-nums text-slate-400">{barang.length} item</span>
      </div>

      <ul className="divide-y divide-slate-100 lg:hidden" aria-label="Daftar barang">
        {barang.map((item, i) => {
          const checked = selectedIds.has(item.id);
          return (
            <li key={item.id} onClick={() => onRowClick(item)} className={`cursor-pointer px-4 py-3 transition ${checked ? "bg-[#00A8E8]/5" : "active:bg-slate-50"}`}>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(item.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Pilih ${item.kodeBarang}`}
                  className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[#1E3A5F]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate font-mono text-sm font-bold text-[#1E3A5F]">{item.kodeBarang}</p>
                    <div className="flex shrink-0 items-center gap-1">
                      {retur(item)}
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-slate-700">
                    {item.variant.product.nama} · {item.variant.style.nama} · {item.variant.color.nama} · {item.variant.size.nama}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    #{rowNo(i)} · {batchLabel(item) ?? "Tanpa batch"}
                    {item.group ? ` · ${item.group.nama}` : ""} · {formatRelativeTime(item.createdAt, now)}
                  </p>
                </div>
              </div>
              {hasActions && <div className="mt-2">{actions(item)}</div>}
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-10 px-3 py-3 text-center">{selectAll("Pilih semua")}</th>
              <th className="w-12 px-2 py-3">No</th>
              <th className="px-3 py-3">Kode barang</th>
              <th className="px-3 py-3">Produk & varian</th>
              <th className="px-3 py-3">Batch</th>
              <th className="px-3 py-3">Dus</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Tanggal</th>
              <th className="px-3 py-3">Dibuat</th>
              {hasActions && <th className="px-3 py-3 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {barang.map((item, i) => {
              const checked = selectedIds.has(item.id);
              return (
                <tr key={item.id} onClick={() => onRowClick(item)} className={`group cursor-pointer transition-colors ${checked ? "bg-[#00A8E8]/5" : "hover:bg-slate-50"}`}>
                  <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(item.id)}
                      aria-label={`Pilih ${item.kodeBarang}`}
                      className="h-4 w-4 cursor-pointer accent-[#1E3A5F]"
                    />
                  </td>
                  <td className="px-2 py-2.5 text-xs tabular-nums text-slate-400">{rowNo(i)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[13px] font-bold text-[#1E3A5F] group-hover:text-[#0088C0]">{item.kodeBarang}</td>
                  <td className="max-w-[260px] px-3 py-2.5">
                    <span className="block truncate font-medium text-slate-800">{item.variant.product.nama}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {item.variant.style.nama} · {item.variant.color.nama} · {item.variant.size.nama}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {batchLabel(item) ? (
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-slate-600">{batchLabel(item)}</span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="max-w-[140px] truncate px-3 py-2.5 text-xs text-slate-600">{item.group?.nama ?? <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-1">
                      <StatusBadge status={item.status} />
                      {retur(item)}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-600">{item.tanggal ? formatDate(item.tanggal) : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-500" title={formatDate(item.createdAt)}>
                    {formatRelativeTime(item.createdAt, now)}
                  </td>
                  {hasActions && <td className="px-3 py-2">{actions(item)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 text-xs text-slate-500">
        <span className="min-w-0 truncate">{footer}</span>
        {selectedIds.size > 0 && <span className="shrink-0 font-semibold text-[#0088C0]">{selectedIds.size} dipilih</span>}
      </div>
    </div>
  );
}
