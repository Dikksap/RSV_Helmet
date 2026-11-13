import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faXmark,
  faArrowRightArrowLeft,
  faPlusCircle,
  faSpinner,
  faTriangleExclamation,
  faCheckCircle,
} from "@fortawesome/free-solid-svg-icons";
import {
  fetchSumberWip,
  executeWipTransfer,
  executeWipAdjust,
  type SumberWipResponse,
} from "../../api/wipTransfer";

export interface ModalTransferWipData {
  itemId: number;
  itemKode: string;
  itemNama: string;
  unit: string;
  jumlahDibutuhkan: number;
  divisiTujuanId: number;
  divisiTujuanNama: string;
  divisiAsalId?: number | null;
  divisiAsalNama?: string | null;
}

interface ModalTransferWipProps {
  data: ModalTransferWipData;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const ModalTransferWip: React.FC<ModalTransferWipProps> = ({
  data,
  onClose,
  onSuccess,
}) => {
  const [tab, setTab] = useState<"transfer" | "direct">("transfer");
  const [jumlah, setJumlah] = useState<number>(data.jumlahDibutuhkan || 1);
  const [sumberData, setSumberData] = useState<SumberWipResponse | null>(null);
  const [selectedDivisiAsalId, setSelectedDivisiAsalId] = useState<number>(
    data.divisiAsalId ?? 0
  );
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchSumberWip(data.itemId)
      .then((res) => {
        if (!active) return;
        setSumberData(res);
        if (res.sumber.length > 0) {
          // Pilih sumber default: divisiAsal jika ada dan punya saldo, atau sumber pertama
          const matching = res.sumber.find((s) => s.divisiId === data.divisiAsalId);
          setSelectedDivisiAsalId(matching ? matching.divisiId : res.sumber[0].divisiId);
        } else if (data.divisiAsalId) {
          setSelectedDivisiAsalId(data.divisiAsalId);
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [data.itemId, data.divisiAsalId]);

  const sumberTerpilih = sumberData?.sumber.find((s) => s.divisiId === selectedDivisiAsalId);
  const saldoAsal = sumberTerpilih?.saldo ?? 0;
  const isSaldoCukup = saldoAsal >= jumlah;

  const handleTransfer = async () => {
    if (!selectedDivisiAsalId) {
      setError("Pilih divisi asal transfer.");
      return;
    }
    if (jumlah <= 0) {
      setError("Jumlah harus lebih dari 0.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await executeWipTransfer({
        divisiAsalId: selectedDivisiAsalId,
        divisiTujuanId: data.divisiTujuanId,
        items: [{ itemId: data.itemId, jumlah }],
        keterangan: `Transfer WIP ke ${data.divisiTujuanNama}`,
        autoApprove: true,
      });
      onSuccess(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memproses transfer WIP.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDirectAdd = async () => {
    if (jumlah <= 0) {
      setError("Jumlah harus lebih dari 0.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await executeWipAdjust({
        divisiId: data.divisiTujuanId,
        itemId: data.itemId,
        jumlah,
        keterangan: `Penambahan saldo WIP langsung ke ${data.divisiTujuanNama}`,
      });
      onSuccess(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambahkan saldo WIP.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-[#00A8E8]">
              <FontAwesomeIcon icon={faArrowRightArrowLeft} className="text-base" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#1E3A5F]">Penyediaan WIP Divisi</h2>
              <p className="text-xs text-slate-500">
                Pindahkan atau tambahkan saldo WIP ke {data.divisiTujuanNama}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-slate-600"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-6 pt-3">
          <button
            type="button"
            onClick={() => setTab("transfer")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-bold transition ${
              tab === "transfer"
                ? "border-[#00A8E8] text-[#00A8E8]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <FontAwesomeIcon icon={faArrowRightArrowLeft} />
            <span>Transfer dari Divisi Lain</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("direct")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-bold transition ${
              tab === "direct"
                ? "border-emerald-600 text-emerald-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            <FontAwesomeIcon icon={faPlusCircle} />
            <span>Tambah Langsung (Admin)</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Item Info Box */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Material / Item:</span>
              <span className="font-bold text-slate-800">
                {data.itemKode} · {data.itemNama}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Divisi Tujuan:</span>
              <span className="font-bold text-[#1E3A5F]">{data.divisiTujuanNama}</span>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {tab === "transfer" ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Divisi Asal:
                </label>
                {loading ? (
                  <div className="flex items-center gap-2 py-2 text-xs text-slate-500">
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin text-sky-500" />
                    <span>Mengecek saldo WIP divisi lain...</span>
                  </div>
                ) : (
                  <>
                    <select
                      value={selectedDivisiAsalId}
                      onChange={(e) => setSelectedDivisiAsalId(Number(e.target.value))}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                    >
                      {data.divisiAsalId && (
                        <option value={data.divisiAsalId}>
                          {data.divisiAsalNama ?? `Divisi ${data.divisiAsalId}`} (Divisi Asal Komponen)
                        </option>
                      )}
                      {sumberData?.sumber.map((s) => (
                        <option key={s.divisiId} value={s.divisiId}>
                          {s.divisiNama} (Tersedia: {s.saldo.toLocaleString("id-ID")} {data.unit})
                        </option>
                      ))}
                    </select>

                    <p className="mt-1 text-[11px] text-slate-500">
                      Saldo tersedia di divisi asal:{" "}
                      <span className={`font-bold ${saldoAsal >= jumlah ? "text-emerald-700" : "text-amber-700"}`}>
                        {saldoAsal.toLocaleString("id-ID")} {data.unit}
                      </span>
                    </p>

                    {saldoAsal === 0 && (
                      <p className="mt-1 text-[11px] text-amber-700">
                        Divisi asal saat ini tidak memiliki saldo WIP. Anda dapat menggunakan tab{" "}
                        <button
                          type="button"
                          onClick={() => setTab("direct")}
                          className="font-bold underline text-emerald-700"
                        >
                          Tambah Langsung (Admin)
                        </button>{" "}
                        untuk mengisi saldo awal.
                      </p>
                    )}
                  </>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Jumlah yang Ditransfer ({data.unit}):
                </label>
                <input
                  type="number"
                  min="1"
                  value={jumlah || ""}
                  onChange={(e) => setJumlah(Number(e.target.value))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleTransfer}
                  disabled={submitting || !selectedDivisiAsalId || !isSaldoCukup}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#00A8E8] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#0090C8] disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faArrowRightArrowLeft} />
                      <span>Transfer WIP Sekarang</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs text-emerald-800">
                <p className="font-semibold flex items-center gap-1.5">
                  <FontAwesomeIcon icon={faCheckCircle} />
                  <span>Inisialisasi Saldo WIP Cepat</span>
                </p>
                <p className="mt-1 text-[11px] text-emerald-700">
                  Fitur ini akan langsung menambahkan saldo WIP ke divisi {data.divisiTujuanNama} tanpa mengurangi saldo divisi lain.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Jumlah Saldo Baru ({data.unit}):
                </label>
                <input
                  type="number"
                  min="1"
                  value={jumlah || ""}
                  onChange={(e) => setJumlah(Number(e.target.value))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDirectAdd}
                  disabled={submitting || jumlah <= 0}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                      <span>Menambahkan...</span>
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faPlusCircle} />
                      <span>Tambah Saldo WIP ({jumlah} {data.unit})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

