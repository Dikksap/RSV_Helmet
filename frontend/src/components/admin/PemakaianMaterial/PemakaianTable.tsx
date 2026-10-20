import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEye,
  faPen,
  faTrash,
  faInbox,
  faChevronLeft,
  faChevronRight,
  faFileCirclePlus,
} from "@fortawesome/free-solid-svg-icons";
import type { PemakaianMaterialRecord } from "../../../api/pemakaianMaterial";
import type { PemakaianPaginationState } from "./types";

interface PemakaianTableProps {
  rows: PemakaianMaterialRecord[];
  loading: boolean;
  pagination: PemakaianPaginationState;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onViewDetail: (row: PemakaianMaterialRecord) => void;
  onEdit: (row: PemakaianMaterialRecord) => void;
  onDelete: (row: PemakaianMaterialRecord) => void;
  onOpenCreate: () => void;
}

export const PemakaianTable: React.FC<PemakaianTableProps> = ({
  rows,
  loading,
  pagination,
  onPageChange,
  onLimitChange,
  onViewDetail,
  onEdit,
  onDelete,
  onOpenCreate,
}) => {
  const formatDate = (iso: string) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
  };

  const formatNumber = (value: number) => {
    if (!Number.isFinite(value)) return "0";
    return value.toLocaleString("id-ID", {
      maximumFractionDigits: 6,
      minimumFractionDigits: 0,
    });
  };

  if (loading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div className="h-6 w-48 animate-pulse rounded-lg bg-slate-100" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl border border-slate-100 bg-slate-50/60"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-[#00A8E8]">
          <FontAwesomeIcon icon={faInbox} className="text-2xl" />
        </div>
        <h3 className="mt-4 text-base font-bold text-[#1E3A5F]">
          Belum Ada Transaksi Pemakaian
        </h3>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          Tidak ada data yang sesuai filter atau belum ada pencatatan pemakaian material baru.
        </p>
        <button
          type="button"
          onClick={onOpenCreate}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#00A8E8] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0088C0] active:scale-[0.98]"
        >
          <FontAwesomeIcon icon={faFileCirclePlus} />
          <span>Catat Pemakaian Sekarang</span>
        </button>
      </div>
    );
  }

  const startEntry = (pagination.page - 1) * pagination.limit + 1;
  const endEntry = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <tr>
              <th scope="col" className="px-5 py-3.5">
                Dokumen & Tanggal
              </th>
              <th scope="col" className="px-5 py-3.5">
                Divisi & Permintaan
              </th>
              <th scope="col" className="px-5 py-3.5">
                Material Digunakan
              </th>
              <th scope="col" className="px-5 py-3.5">
                Petugas / PIC
              </th>
              <th scope="col" className="px-5 py-3.5">
                Catatan
              </th>
              <th scope="col" className="px-5 py-3.5 text-right">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const totalItems = row.items?.length ?? 0;
              const previewItems = row.items?.slice(0, 2) ?? [];

              return (
                <tr
                  key={row.id}
                  className="group transition hover:bg-sky-50/30"
                >
                  {/* Dokumen & Tanggal */}
                  <td className="px-5 py-4">
                    <span className="font-bold text-[#1E3A5F]">
                      {row.nomor}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {formatDate(row.tanggal)}
                    </span>
                  </td>

                  {/* Divisi & Permintaan */}
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                      {row.divisi?.nama ?? "Tanpa Divisi"}
                    </span>
                    {row.permintaan && (
                      <span className="mt-1 block text-xs text-slate-500">
                        Permintaan:{" "}
                        <span className="font-medium text-slate-700">
                          {row.permintaan.noPermintaan}
                        </span>
                      </span>
                    )}
                  </td>

                  {/* Material Digunakan */}
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {previewItems.map((item) => {
                        const nama =
                          item.permintaanItem?.nama ??
                          item.item?.nama ??
                          "Material";
                        const unit = item.satuan || item.item?.unit || "";
                        return (
                          <span
                            key={item.id}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 shadow-2xs"
                          >
                            <span className="font-medium">{nama}:</span>
                            <span className="font-semibold text-amber-700">
                              {formatNumber(item.jumlahDipakai)} {unit}
                            </span>
                          </span>
                        );
                      })}
                      {totalItems > 2 && (
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                          +{totalItems - 2} lagi
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Petugas / PIC */}
                  <td className="px-5 py-4 text-xs">
                    <span className="font-medium text-slate-800">
                      {row.user?.name ?? "Sistem / Otomatis"}
                    </span>
                    {row.user?.role && (
                      <span className="block capitalize text-slate-400">
                        {row.user.role}
                      </span>
                    )}
                  </td>

                  {/* Catatan */}
                  <td className="px-5 py-4 text-xs text-slate-500 max-w-[200px] truncate">
                    {row.keterangan ? (
                      <span title={row.keterangan}>{row.keterangan}</span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>

                  {/* Aksi */}
                  <td className="px-5 py-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onViewDetail(row)}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-sky-50 hover:text-[#00A8E8] active:scale-95"
                        title="Lihat Rincian Transaksi"
                        aria-label={`Lihat rincian ${row.nomor}`}
                      >
                        <FontAwesomeIcon icon={faEye} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onEdit(row)}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-amber-50 hover:text-amber-600 active:scale-95"
                        title="Edit Pemakaian"
                        aria-label={`Edit ${row.nomor}`}
                      >
                        <FontAwesomeIcon icon={faPen} />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDelete(row)}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600 active:scale-95"
                        title="Hapus Pemakaian"
                        aria-label={`Hapus ${row.nomor}`}
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-600">
        <div className="flex items-center gap-3">
          <span>
            Menampilkan <span className="font-semibold">{startEntry}</span>-
            <span className="font-semibold">{endEntry}</span> dari{" "}
            <span className="font-semibold">{pagination.total}</span> data
          </span>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Baris:</span>
            <select
              value={pagination.limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-[#00A8E8]"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            title="Halaman sebelumnya"
          >
            <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
          </button>

          <span className="px-2 font-medium">
            Hal. {pagination.page} dari {pagination.totalPages || 1}
          </span>

          <button
            type="button"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            title="Halaman selanjutnya"
          >
            <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
          </button>
        </div>
      </div>
    </div>
  );
};
