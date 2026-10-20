import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faXmark,
  faPrint,
  faBuilding,
  faFileLines,
  faUser,
  faBoxesStacked,
} from "@fortawesome/free-solid-svg-icons";
import type { PemakaianMaterialRecord } from "../../../api/pemakaianMaterial";

interface ModalDetailPemakaianProps {
  record: PemakaianMaterialRecord | null;
  onClose: () => void;
}

export const ModalDetailPemakaian: React.FC<ModalDetailPemakaianProps> = ({
  record,
  onClose,
}) => {
  if (!record) return null;

  const formatDate = (iso: string) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
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

  const handlePrint = () => {
    window.print();
  };

  const totalDipakai = record.items.reduce(
    (acc, item) => acc + (Number(item.jumlahDipakai) || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div
        className="fixed inset-0 bg-[#0F1C2E]/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden print:m-0 print:max-h-none print:w-full print:border-none print:shadow-none">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-[#00A8E8]">
              <FontAwesomeIcon icon={faFileLines} className="text-base" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#1E3A5F]">
                  {record.nomor}
                </h2>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                  Tercatat
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Tanggal: {formatDate(record.tanggal)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
              title="Cetak Rincian"
            >
              <FontAwesomeIcon icon={faPrint} className="text-slate-500" />
              <span>Cetak</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
              aria-label="Tutup modal"
            >
              <FontAwesomeIcon icon={faXmark} className="text-base" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Metadata Cards */}
          <div className="grid gap-3.5 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-400">
                <FontAwesomeIcon icon={faBuilding} className="text-[11px]" />
                <span>Divisi Pemakai</span>
              </span>
              <p className="mt-1 font-bold text-[#1E3A5F]">
                {record.divisi?.nama ?? "Tanpa Divisi"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-400">
                <FontAwesomeIcon icon={faBoxesStacked} className="text-[11px]" />
                <span>Permintaan Asal</span>
              </span>
              <p className="mt-1 font-bold text-[#1E3A5F]">
                {record.permintaan?.noPermintaan ?? "-"}
              </p>
              {record.permintaan?.namaPeminta && (
                <p className="text-xs text-slate-500">
                  Peminta: {record.permintaan.namaPeminta}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase text-slate-400">
                <FontAwesomeIcon icon={faUser} className="text-[11px]" />
                <span>Petugas Pencatat</span>
              </span>
              <p className="mt-1 font-bold text-[#1E3A5F]">
                {record.user?.name ?? "Sistem"}
              </p>
              {record.user?.role && (
                <p className="text-xs capitalize text-slate-400">
                  {record.user.role}
                </p>
              )}
            </div>
          </div>

          {/* Keterangan */}
          {record.keterangan && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <span className="text-xs font-bold uppercase text-slate-400">
                Keterangan Transaksi:
              </span>
              <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">
                {record.keterangan}
              </p>
            </div>
          )}

          {/* Table Items */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Rincian Material ({record.items.length} item)
            </h3>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="w-10 px-3.5 py-2.5 text-center">No</th>
                    <th className="px-3.5 py-2.5">Material</th>
                    <th className="px-3.5 py-2.5 text-right">Stok Awal</th>
                    <th className="px-3.5 py-2.5 text-right">Jumlah Dipakai</th>
                    <th className="px-3.5 py-2.5 text-right">Sisa Akhir</th>
                    <th className="px-3.5 py-2.5">Catatan Item</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {record.items.map((item, idx) => {
                    const nama =
                      item.permintaanItem?.nama ??
                      item.item?.nama ??
                      item.item?.kode ??
                      "Material";
                    const unit = item.satuan || item.item?.unit || "";

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-3.5 py-3 text-center text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="px-3.5 py-3 font-semibold text-slate-800">
                          {nama}
                        </td>
                        <td className="px-3.5 py-3 text-right tabular-nums text-slate-500">
                          {formatNumber(item.jumlahDiterima)} {unit}
                        </td>
                        <td className="px-3.5 py-3 text-right font-bold tabular-nums text-amber-700">
                          {formatNumber(item.jumlahDipakai)} {unit}
                        </td>
                        <td className="px-3.5 py-3 text-right font-bold tabular-nums text-[#1E3A5F]">
                          {formatNumber(item.jumlahSisa)} {unit}
                        </td>
                        <td className="px-3.5 py-3 text-slate-500">
                          {item.keteranganSisa || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t border-slate-200 bg-slate-50/80 font-semibold text-slate-700">
                  <tr>
                    <td colSpan={3} className="px-3.5 py-2.5 text-right">
                      Total Pemakaian:
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-bold text-amber-700">
                      {formatNumber(totalDipakai)} unit
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-200 bg-slate-50/80 px-6 py-4 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition active:scale-95"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
