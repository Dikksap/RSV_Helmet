import { useCallback, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { Modal } from "../VariantProduk/Modal";
import { inputCls, labelCls } from "../VariantProduk/constants";
import { getStokItem, tambahStokItem, type StokItemResponse } from "../../../api/stokItem";
import type { Item } from "../../../api/item";
import { hasPermission } from "../../../api/auth";

const primaryBtn = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#00A8E8] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0088C0] disabled:opacity-40 disabled:pointer-events-none";

const tipeLabel = (tipe: "MASUK" | "KELUAR") => (tipe === "MASUK" ? "Masuk" : "Keluar");

export function StokItemModal({ item, onClose }: { item: Item; onClose: () => void }) {
  const [data, setData] = useState<StokItemResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jumlah, setJumlah] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [busy, setBusy] = useState(false);
  const canKelola = hasPermission("KELOLA_ITEM");

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      setData(await getStokItem(item.id, p, 20));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat stok item.");
    } finally {
      setLoading(false);
    }
  }, [item.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- muat stok saat modal dibuka / ganti halaman
    void load(page);
  }, [load, page]);

  const simpanMasuk = async () => {
    const n = Number(jumlah);
    if (!Number.isInteger(n) || n <= 0) {
      window.alert("Jumlah harus bilangan bulat lebih dari 0");
      return;
    }
    setBusy(true);
    try {
      await tambahStokItem(item.id, { jumlah: n, keterangan: keterangan.trim() || undefined });
      setJumlah("");
      setKeterangan("");
      setPage(1);
      await load(1);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Gagal mencatat stok.");
    } finally {
      setBusy(false);
    }
  };

  const totalPages = data?.riwayat.meta.totalPages ?? 1;

  return (
    <Modal title={`Stok ${item.nama}`} onClose={onClose} size="lg">
      <div className="space-y-5">
        <div className="flex items-baseline justify-between rounded-lg bg-[#F5F7FA] px-5 py-4">
          <span className="text-sm text-[#6B7280]">Saldo saat ini</span>
          <span className="text-3xl font-bold tabular-nums text-[#1E3A5F]">
            {data ? data.saldo.toLocaleString("id-ID") : "—"} <span className="text-sm font-medium text-[#6B7280]">{item.unit}</span>
          </span>
        </div>

        {canKelola && (
          <div className="space-y-3 rounded-lg border border-[#D1D5DB] p-4">
            <p className="text-sm font-semibold text-[#1F2937]">Catat stok masuk</p>
            <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
              <label className={labelCls}><span>Jumlah</span>
                <input type="number" min={1} step={1} inputMode="numeric" className={inputCls} value={jumlah} onChange={(e) => setJumlah(e.target.value)} />
              </label>
              <label className={labelCls}><span>Keterangan</span>
                <input className={inputCls} placeholder="cth: pembelian PO-123" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
              </label>
            </div>
            <div className="flex justify-end">
              <button type="button" disabled={busy || !jumlah} onClick={() => void simpanMasuk()} className={primaryBtn}>
                {busy && <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" />}
                {busy ? "Menyimpan..." : "Catat masuk"}
              </button>
            </div>
          </div>
        )}

        {error && <p role="alert" className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-sm text-[#EF4444]">{error}</p>}

        <div>
          <p className="mb-2 text-sm font-semibold text-[#1F2937]">Riwayat</p>
          <div className="max-h-[50vh] overflow-auto rounded-lg border border-slate-100">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-[#F5F7FA] text-[#6B7280]">
                <tr>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider">Tanggal</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider">Tipe</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider">Jumlah</th>
                  <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wider">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && !data ? (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-[#6B7280]">Memuat...</td></tr>
                ) : data && data.riwayat.data.length > 0 ? (
                  data.riwayat.data.map((m) => (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap px-3 py-2 text-[#6B7280]">{new Date(m.tanggal).toLocaleString("id-ID")}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${m.tipe === "MASUK" ? "bg-[#10B981]/10 text-[#0E7A55]" : "bg-[#EF4444]/10 text-[#B91C1C]"}`}>
                          {tipeLabel(m.tipe)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{m.jumlah.toLocaleString("id-ID")}</td>
                      <td className="px-3 py-2 text-[#6B7280]">{m.keterangan ?? "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="px-3 py-6 text-center italic text-[#6B7280]">Belum ada mutasi.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {data && totalPages > 1 && (
            <div className="mt-3 flex items-center justify-end gap-2 text-sm">
              <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-[#D1D5DB] px-3 py-1.5 disabled:opacity-40">Sebelumnya</button>
              <span className="text-[#6B7280]">{page} / {totalPages}</span>
              <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-[#D1D5DB] px-3 py-1.5 disabled:opacity-40">Berikutnya</button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
