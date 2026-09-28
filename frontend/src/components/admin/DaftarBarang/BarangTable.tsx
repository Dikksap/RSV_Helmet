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
  const allSelected =
    barang.length > 0 && barang.every((b) => selectedIds.has(b.id));

  const someSelected = barang.some((b) => selectedIds.has(b.id));

  const size = pageSize === "all" ? barang.length : pageSize;

  const rowNo = (index: number) =>
    (currentPage - 1) * size + index + 1;

  const hasActions = Boolean(onEdit || onDelete || onRiwayat);

  return (
    <div className="space-y-3">
      {/* =========================================================
          MOBILE SELECT BAR
      ========================================================= */}
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm lg:hidden">
        <input
          type="checkbox"
          checked={allSelected}
          ref={(el) => {
            if (el) {
              el.indeterminate = !allSelected && someSelected;
            }
          }}
          onChange={(e) => onToggleAll(e.target.checked)}
          aria-label="Pilih semua di halaman ini"
          className="h-4 w-4 cursor-pointer accent-[#00A8E8]"
        />

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">
            Pilih semua
          </span>

          {selectedIds.size > 0 && (
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
              {selectedIds.size} dipilih
            </span>
          )}
        </div>

        <span className="text-xs font-medium tabular-nums text-slate-500">
          {barang.length} item
        </span>
      </div>

      {/* =========================================================
          MOBILE CARD
      ========================================================= */}
      <ul
        className="grid gap-3 lg:hidden"
        aria-label="Daftar barang"
      >
        {barang.map((item, index) => {
          const checked = selectedIds.has(item.id);

          return (
            <li key={item.id}>
              <article
                onClick={() => onRowClick(item)}
                className={[
                  "group cursor-pointer overflow-hidden rounded-2xl border bg-white",
                  "transition-all duration-200",
                  "hover:-translate-y-[1px] hover:shadow-md",
                  "active:scale-[0.995]",
                  checked
                    ? "border-sky-300 bg-sky-50/30 ring-1 ring-sky-200"
                    : "border-slate-200 shadow-sm",
                ].join(" ")}
              >
                {/* Top */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Pilih ${item.kodeBarang}`}
                      className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[#00A8E8]"
                    />

                    <div className="min-w-0 flex-1">
                      {/* Number + relative time */}
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-[11px] font-semibold tabular-nums text-slate-400">
                          #{rowNo(index)}
                        </span>

                        <span className="h-1 w-1 rounded-full bg-slate-300" />

                        <span className="truncate text-[11px] text-slate-400">
                          {formatRelativeTime(item.createdAt, now)}
                        </span>
                      </div>

                      {/* Code + status */}
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 truncate font-mono text-[15px] font-bold tracking-tight text-[#1E3A5F]">
                          {item.kodeBarang}
                        </p>

                        <div className="shrink-0">
                          <StatusBadge status={item.status} />
                        </div>
                      </div>

                      {/* Product */}
                      <p className="mt-2 truncate text-sm font-bold text-slate-800">
                        {item.variant.product.nama}
                      </p>

                      {/* Variant */}
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {item.variant.style.nama}
                        <span className="mx-1 text-slate-300">•</span>
                        {item.variant.color.nama}
                        <span className="mx-1 text-slate-300">•</span>
                        {item.variant.size.nama}
                      </p>
                    </div>
                  </div>

                  {/* Detail */}
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Batch
                      </p>

                      <p className="mt-0.5 font-mono text-xs font-semibold text-slate-700">
                        {item.batch
                          ? `BC${String(item.batch.nomorBatch).padStart(
                              3,
                              "0"
                            )}`
                          : "No Batch"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Tanggal
                      </p>

                      <p className="mt-0.5 text-xs font-medium text-slate-700">
                        {item.tanggal
                          ? formatDate(item.tanggal)
                          : formatDate(item.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {hasActions && (
                  <div
                    className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-2.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {onRiwayat && (
                      <button
                        type="button"
                        onClick={() => onRiwayat(item)}
                        className="rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-50"
                      >
                        Riwayat
                      </button>
                    )}

                    {onEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(item)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-600"
                      >
                        Edit
                      </button>
                    )}

                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(item)}
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                      >
                        Hapus
                      </button>
                    )}
                  </div>
                )}
              </article>
            </li>
          );
        })}
      </ul>

      {/* =========================================================
          DESKTOP TABLE
      ========================================================= */}
      <div className="hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
        {/* Table wrapper */}
        <div>
          <table className="w-full border-collapse text-left">
            {/* Header */}
            <thead className="bg-[#1E3A5F] text-[11px] font-bold uppercase tracking-wider text-white">
              <tr>
                <th className="w-12 px-3 py-3.5 text-center">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) {
                        el.indeterminate =
                          !allSelected && someSelected;
                      }
                    }}
                    onChange={(e) =>
                      onToggleAll(e.target.checked)
                    }
                    aria-label="Pilih semua"
                    className="h-4 w-4 cursor-pointer accent-white"
                  />
                </th>

                <th className="w-14 px-3 py-3.5">
                  No
                </th>

                <th className="px-4 py-3.5">
                  Kode Barang
                </th>

                <th className="px-4 py-3.5">
                  Produk
                </th>

                <th className="px-4 py-3.5">
                  Varian
                </th>

                <th className="px-4 py-3.5">
                  Batch
                </th>

                <th className="px-4 py-3.5">
                  Status
                </th>

                <th className="px-4 py-3.5">
                  Tanggal
                </th>

                <th className="px-4 py-3.5">
                  Dibuat
                </th>

                {hasActions && (
                  <th className="px-4 py-3.5 text-right">
                    Aksi
                  </th>
                )}
              </tr>
            </thead>

            {/* Body */}
            <tbody className="divide-y divide-slate-100">
              {barang.map((item, index) => {
                const checked = selectedIds.has(item.id);

                return (
                  <tr
                    key={item.id}
                    onClick={() => onRowClick(item)}
                    className={[
                      "group cursor-pointer transition-colors",
                      checked
                        ? "bg-sky-50/70 hover:bg-sky-100"
                        : "bg-white hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {/* Checkbox */}
                    <td
                      className="px-3 py-3 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggle(item.id)}
                        aria-label={`Pilih ${item.kodeBarang}`}
                        className="h-4 w-4 cursor-pointer accent-[#00A8E8]"
                      />
                    </td>

                    {/* No */}
                    <td className="px-3 py-3 text-xs font-medium tabular-nums text-slate-400">
                      {rowNo(index)}
                    </td>

                    {/* Kode */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="h-7 w-1 rounded-full bg-sky-400 opacity-0 transition-opacity group-hover:opacity-100" />

                        <span className="font-mono text-sm font-bold tracking-tight text-[#1E3A5F] transition-colors group-hover:text-[#00A8E8]">
                          {item.kodeBarang}
                        </span>
                      </div>
                    </td>

                    {/* Product */}
                    <td className="max-w-[180px] px-4 py-3">
                      <span className="block truncate text-sm font-semibold text-slate-800">
                        {item.variant.product.nama}
                      </span>
                    </td>

                    {/* Variant */}
                    <td className="max-w-[220px] px-4 py-3">
                      <div className="flex max-w-full flex-wrap items-center gap-1 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">
                          {item.variant.style.nama}
                        </span>

                        <span className="text-slate-300">
                          •
                        </span>

                        <span>
                          {item.variant.color.nama}
                        </span>

                        <span className="text-slate-300">
                          •
                        </span>

                        <span>
                          {item.variant.size.nama}
                        </span>
                      </div>
                    </td>

                    {/* Batch */}
                    <td className="px-4 py-3">
                      {item.batch ? (
                        <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-semibold text-slate-700">
                          BC
                          {String(item.batch.nomorBatch).padStart(
                            3,
                            "0"
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">
                          -
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>

                    {/* Tanggal */}
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-600">
                      {item.tanggal
                        ? formatDate(item.tanggal)
                        : "-"}
                    </td>

                    {/* Dibuat */}
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        title={formatDate(item.createdAt)}
                        className="text-xs text-slate-500"
                      >
                        {formatRelativeTime(item.createdAt, now)}
                      </span>
                    </td>

                    {/* Actions */}
                    {hasActions && (
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end gap-1.5">
                          {onRiwayat && (
                            <button
                              type="button"
                              onClick={() =>
                                onRiwayat(item)
                              }
                              className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px] font-semibold text-sky-700 transition hover:bg-sky-100"
                            >
                              Riwayat
                            </button>
                          )}

                          {onEdit && (
                            <button
                              type="button"
                              onClick={() =>
                                onEdit(item)
                              }
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-600"
                            >
                              Edit
                            </button>
                          )}

                          {onDelete && (
                            <button
                              type="button"
                              onClick={() =>
                                onDelete(item)
                              }
                              className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-600 transition hover:bg-red-100"
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

        {/* =======================================================
            TABLE FOOTER
        ======================================================= */}
        <div className="flex min-h-[48px] items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-4 py-3">
          <div className="min-w-0 text-xs text-slate-500">
            <span className="font-medium">
              {caption ??
                `Menampilkan ${barang.length.toLocaleString(
                  "id-ID"
                )} dari ${totalBarang.toLocaleString(
                  "id-ID"
                )} barang`}
            </span>

            {selectedIds.size > 0 && (
              <span className="ml-2 inline-flex rounded-full bg-sky-100 px-2 py-0.5 font-semibold text-sky-700">
                {selectedIds.size} dipilih
              </span>
            )}
          </div>

          {!caption && (
            <span className="shrink-0 text-xs font-medium tabular-nums text-slate-500">
              {totalBarang > 0 && size > 0
                ? `${(
                    (currentPage - 1) * size +
                    1
                  ).toLocaleString(
                    "id-ID"
                  )}–${Math.min(
                    currentPage * size,
                    totalBarang
                  ).toLocaleString("id-ID")}`
                : "0"}
            </span>
          )}
        </div>
      </div>

      {/* =========================================================
          MOBILE FOOTER
      ========================================================= */}
      <div className="flex items-center justify-center gap-2 text-xs text-slate-500 lg:hidden">
        <span>
          {barang.length.toLocaleString("id-ID")} dari{" "}
          {totalBarang.toLocaleString("id-ID")}
        </span>

        <span className="text-slate-300">•</span>

        <span>Hal. {currentPage}</span>

        {selectedIds.size > 0 && (
          <>
            <span className="text-slate-300">•</span>

            <span className="font-semibold text-sky-700">
              {selectedIds.size} dipilih
            </span>
          </>
        )}
      </div>
    </div>
  );
}