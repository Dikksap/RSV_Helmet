import React, { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faSpinner,
  faXmark,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import type { Divisi } from "../../../api/divisi";
import type { PermintaanBarangRecord } from "../../../api/permintaanBarang";
import type { ModalFormState } from "./types";

interface ModalCatatPemakaianProps {
  state: ModalFormState;
  divisis: Divisi[];
  permintaans: PermintaanBarangRecord[];
  onClose: () => void;
  onChangeDivisi: (divisiId: string) => void;
  onChangePermintaan: (permintaanId: string) => void;
  onUpdateField: (field: "tanggal" | "keterangan", value: string) => void;
  onToggleItem: (permintaanBarangItemId: number, used: boolean) => void;
  onChangeItemSisa: (permintaanBarangItemId: number, sisa: string) => void;
  onChangeItemKeterangan: (permintaanBarangItemId: number, ket: string) => void;
  onSetQuickSisa: (permintaanBarangItemId: number, type: "habis" | "utuh") => void;
  onSetAllQuick: (type: "habis" | "utuh") => void;
  onSubmit: () => void;
}

export const ModalCatatPemakaian: React.FC<ModalCatatPemakaianProps> = ({
  state,
  divisis,
  permintaans,
  onClose,
  onChangeDivisi,
  onChangePermintaan,
  onUpdateField,
  onToggleItem,
  onChangeItemSisa,
  onChangeItemKeterangan,
  onSetQuickSisa,
  onSetAllQuick,
  onSubmit,
}) => {
  const formatNumber = (value: number) => {
    if (!Number.isFinite(value)) return "0";
    return value.toLocaleString("id-ID", {
      maximumFractionDigits: 6,
      minimumFractionDigits: 0,
    });
  };

  const selectedDivisi = divisis.find((d) => String(d.id) === state.divisiId);

  // Filter approved permintaans matching selected division
  const matchingPermintaans = useMemo(() => {
    if (!selectedDivisi) return [];
    return permintaans.filter(
      (p) =>
        p.approval === "DISETUJUI" &&
        p.departemen.trim().toLowerCase() === selectedDivisi.nama.trim().toLowerCase()
    );
  }, [permintaans, selectedDivisi]);

  const itemsList = Object.values(state.items);
  const selectedItems = itemsList.filter((item) => item.used);

  // Validate items
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!state.divisiId) errors.push("Divisi wajib dipilih");
    if (!state.permintaanId) errors.push("Permintaan barang asal wajib dipilih");
    if (!state.tanggal) errors.push("Tanggal pencatatan wajib diisi");

    if (selectedItems.length === 0) {
      errors.push("Pilih minimal satu material yang dicatat pemakaiannya");
    }

    for (const item of selectedItems) {
      const sisaNum = Number(item.sisaFisik.replace(",", "."));
      if (item.sisaFisik.trim() === "" || Number.isNaN(sisaNum)) {
        errors.push(`Nilai sisa untuk "${item.nama}" harus berupa angka valid`);
      } else if (sisaNum < 0) {
        errors.push(`Nilai sisa untuk "${item.nama}" tidak boleh negatif`);
      } else if (sisaNum > item.stokSebelum) {
        errors.push(
          `Nilai sisa "${item.nama}" (${sisaNum}) tidak boleh melebihi stok terkini (${item.stokSebelum})`
        );
      }
    }

    return errors;
  }, [state.divisiId, state.permintaanId, state.tanggal, selectedItems]);

  const totalDipakai = useMemo(() => {
    return selectedItems.reduce((acc, item) => {
      const sisaNum = Number(item.sisaFisik.replace(",", "."));
      if (Number.isFinite(sisaNum)) {
        return acc + Math.max(item.stokSebelum - sisaNum, 0);
      }
      return acc;
    }, 0);
  }, [selectedItems]);

  const canSubmit = !state.busy && validationErrors.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0F1C2E]/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#1E3A5F] sm:text-xl">
              {state.mode === "edit"
                ? "Edit Pemakaian Material"
                : "Catat Pemakaian Material"}
            </h2>
            <p className="text-xs text-slate-500">
              {state.mode === "edit"
                ? "Perbarui jumlah sisa fisik atau keterangan pemakaian material."
                : "Catat sisa fisik material divisi. Jumlah pemakaian otomatis dihitung dari selisih stok."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
            aria-label="Tutup modal"
          >
            <FontAwesomeIcon icon={faXmark} className="text-base" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Global Alert / Error */}
          {state.error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700">
              <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 text-red-500" />
              <span>{state.error}</span>
            </div>
          )}

          {/* Section 1: Divisi, Permintaan, Tanggal */}
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Divisi */}
            <div>
              <label htmlFor="modal-divisi" className="mb-1 block text-xs font-semibold text-slate-700">
                Divisi Pemakai <span className="text-red-500">*</span>
              </label>
              <select
                id="modal-divisi"
                value={state.divisiId}
                onChange={(e) => onChangeDivisi(e.target.value)}
                disabled={state.mode === "edit"}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20 disabled:bg-slate-50 disabled:text-slate-500"
              >
                <option value="">Pilih Divisi...</option>
                {divisis.map((divisi) => (
                  <option key={divisi.id} value={divisi.id}>
                    {divisi.nama}
                  </option>
                ))}
              </select>
            </div>

            {/* Permintaan Asal */}
            <div>
              <label htmlFor="modal-permintaan" className="mb-1 block text-xs font-semibold text-slate-700">
                Permintaan Barang Disetujui <span className="text-red-500">*</span>
              </label>
              <select
                id="modal-permintaan"
                value={state.permintaanId}
                onChange={(e) => onChangePermintaan(e.target.value)}
                disabled={!state.divisiId || state.mode === "edit"}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20 disabled:bg-slate-50 disabled:text-slate-500"
              >
                {!state.divisiId ? (
                  <option value="">Pilih divisi dahulu...</option>
                ) : matchingPermintaans.length === 0 ? (
                  <option value="">Tidak ada permintaan disetujui</option>
                ) : (
                  <>
                    <option value="">Pilih Permintaan...</option>
                    {matchingPermintaans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.noPermintaan} · {p.namaPeminta} ({p.items?.length || 0} item)
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* Tanggal */}
            <div>
              <label htmlFor="modal-tanggal" className="mb-1 block text-xs font-semibold text-slate-700">
                Tanggal Pemakaian <span className="text-red-500">*</span>
              </label>
              <input
                id="modal-tanggal"
                type="date"
                value={state.tanggal}
                onChange={(e) => onUpdateField("tanggal", e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
              />
            </div>
          </div>

          {/* Keterangan Umum */}
          <div>
            <label htmlFor="modal-keterangan" className="mb-1 block text-xs font-semibold text-slate-700">
              Keterangan / Catatan Pemakaian
            </label>
            <textarea
              id="modal-keterangan"
              rows={2}
              placeholder="Catatan kondisi material, lokasi pengerjaan, atau PIC penerima sisa (opsional)..."
              value={state.keterangan}
              onChange={(e) => onUpdateField("keterangan", e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
            />
          </div>

          {/* Section 2: Items Table */}
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Daftar Material yang Digunakan
                </h3>
                <p className="text-xs text-slate-400">
                  Centang material, lalu isi sisa fisik terkini. Jumlah dipakai otomatis terhitung.
                </p>
              </div>

              {itemsList.length > 0 && (
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => onSetAllQuick("habis")}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition active:scale-95"
                  >
                    Habiskan Semua (Sisa = 0)
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetAllQuick("utuh")}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition active:scale-95"
                  >
                    Utuhkan Semua (Sisa = Stok)
                  </button>
                </div>
              )}
            </div>

            {/* If no division or no request selected */}
            {!state.divisiId ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center text-xs text-slate-500">
                Silakan pilih divisi terlebih dahulu untuk memuat daftar permintaan.
              </div>
            ) : matchingPermintaans.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-6 text-center text-xs text-amber-800">
                <FontAwesomeIcon icon={faTriangleExclamation} className="mb-2 text-base text-amber-500" />
                <p className="font-semibold">Tidak ada permintaan yang disetujui untuk divisi {selectedDivisi?.nama}.</p>
                <p className="mt-1 text-amber-700">
                  Pencatatan pemakaian material hanya dapat dilakukan apabila divisi memiliki permintaan barang berstatus "DISETUJUI".
                </p>
              </div>
            ) : !state.permintaanId ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center text-xs text-slate-500">
                Pilih nomor permintaan disetujui di atas untuk menampilkan rincian material.
              </div>
            ) : itemsList.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-xs text-slate-500">
                Tidak ada item material yang dapat dicatat pada permintaan ini.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[700px] text-left text-xs">
                  <thead className="bg-slate-50/80 font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="w-10 px-3 py-3 text-center">Catat</th>
                      <th className="px-3 py-3">Material</th>
                      <th className="px-3 py-3 text-right">Stok Sebelum</th>
                      <th className="px-3 py-3 text-right w-36">Sisa Fisik (Input)</th>
                      <th className="px-3 py-3 text-right">Jumlah Dipakai</th>
                      <th className="px-3 py-3">Catatan Item</th>
                      <th className="px-3 py-3 text-center">Aksi Cepat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itemsList.map((item) => {
                      const sisaNum = Number(item.sisaFisik.replace(",", "."));
                      const isInvalid =
                        item.used &&
                        (item.sisaFisik.trim() === "" ||
                          Number.isNaN(sisaNum) ||
                          sisaNum < 0 ||
                          sisaNum > item.stokSebelum);

                      const dipakai = item.used && Number.isFinite(sisaNum)
                        ? Math.max(item.stokSebelum - sisaNum, 0)
                        : 0;

                      return (
                        <tr
                          key={item.permintaanBarangItemId}
                          className={`transition ${
                            item.used ? "bg-sky-50/20" : "bg-white opacity-60"
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={item.used}
                              onChange={(e) =>
                                onToggleItem(
                                  item.permintaanBarangItemId,
                                  e.target.checked
                                )
                              }
                              className="h-4 w-4 rounded border-slate-300 text-[#00A8E8] focus:ring-[#00A8E8]"
                            />
                          </td>

                          {/* Material Name */}
                          <td className="px-3 py-3">
                            <span className="font-semibold text-slate-800">
                              {item.nama}
                            </span>
                            <span className="block text-[11px] text-slate-400">
                              Satuan: {item.satuan || "-"}
                            </span>
                          </td>

                          {/* Stok Sebelum */}
                          <td className="px-3 py-3 text-right font-medium tabular-nums text-slate-600">
                            {formatNumber(item.stokSebelum)} {item.satuan}
                          </td>

                          {/* Sisa Fisik Input */}
                          <td className="px-3 py-3 text-right">
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.sisaFisik}
                                disabled={!item.used}
                                onChange={(e) =>
                                  onChangeItemSisa(
                                    item.permintaanBarangItemId,
                                    e.target.value
                                  )
                                }
                                className={`h-8 w-28 rounded-lg border px-2.5 text-right font-semibold tabular-nums text-slate-800 outline-none transition focus:ring-2 disabled:bg-slate-100 disabled:text-slate-400 ${
                                  isInvalid
                                    ? "border-red-400 bg-red-50/50 focus:border-red-500 focus:ring-red-200"
                                    : "border-slate-200 bg-white focus:border-[#00A8E8] focus:ring-[#00A8E8]/20"
                                }`}
                              />
                            </div>
                            {isInvalid && (
                              <span className="block text-[10px] text-red-500 mt-0.5">
                                {sisaNum > item.stokSebelum
                                  ? `Max ${item.stokSebelum}`
                                  : "Nilai invalid"}
                              </span>
                            )}
                          </td>

                          {/* Otomatis Dipakai */}
                          <td className="px-3 py-3 text-right">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 font-bold tabular-nums ${
                                item.used && dipakai > 0
                                  ? "bg-amber-50 text-amber-700"
                                  : "text-slate-400"
                              }`}
                            >
                              {formatNumber(dipakai)} {item.satuan}
                            </span>
                          </td>

                          {/* Catatan Sisa Item */}
                          <td className="px-3 py-3">
                            <input
                              type="text"
                              placeholder="Keterangan..."
                              value={item.keteranganSisa}
                              disabled={!item.used}
                              onChange={(e) =>
                                onChangeItemKeterangan(
                                  item.permintaanBarangItemId,
                                  e.target.value
                                )
                              }
                              className="h-8 w-full min-w-[120px] rounded-lg border border-slate-200 px-2 text-xs text-slate-700 outline-none focus:border-[#00A8E8] disabled:bg-slate-100 disabled:opacity-50"
                            />
                          </td>

                          {/* Quick Buttons */}
                          <td className="px-3 py-3 text-center">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                disabled={!item.used}
                                onClick={() =>
                                  onSetQuickSisa(
                                    item.permintaanBarangItemId,
                                    "habis"
                                  )
                                }
                                className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-200 disabled:opacity-40 transition"
                                title="Set sisa jadi 0 (habis)"
                              >
                                0
                              </button>
                              <span className="text-slate-300">|</span>
                              <button
                                type="button"
                                disabled={!item.used}
                                onClick={() =>
                                  onSetQuickSisa(
                                    item.permintaanBarangItemId,
                                    "utuh"
                                  )
                                }
                                className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-200 disabled:opacity-40 transition"
                                title="Set sisa sama dengan stok awal (tanpa pemakaian)"
                              >
                                Max
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/80 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-slate-600">
            <span className="font-bold text-[#1E3A5F]">
              {selectedItems.length} material dipilih
            </span>
            {selectedItems.length > 0 && (
              <span className="ml-2 text-slate-500">
                • Total pemakaian:{" "}
                <span className="font-semibold text-amber-700">
                  {formatNumber(totalDipakai)} unit
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={state.busy}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition active:scale-95 disabled:opacity-50"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-xl bg-[#00A8E8] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0088C0] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state.busy && <FontAwesomeIcon icon={faSpinner} spin />}
              <span>
                {state.mode === "edit" ? "Perbarui Pemakaian" : "Simpan Pemakaian"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
