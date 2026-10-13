import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner, faXmark } from "@fortawesome/free-solid-svg-icons";

import {
  petakanItemPermintaan,
  setApprovalPermintaan,
  type KeputusanItemInput,
  type PermintaanBarangRecord,
  type PermintaanItemRecord,
} from "../../../api/permintaanBarang";
import { getSaldoBulk } from "../../../api/stokItem";
import { createItem, getItems, type Item } from "../../../api/item";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/60";

type Row = {
  item: PermintaanItemRecord;
  saldo: number | null;
  maks: number;
  nilai: string;
  error: string | null;
  mapping?: { masterId: string; kode: string; nama: string; busy: boolean; showNew: boolean };
};

/**
 * Keputusan persetujuan per item. Batas tiap item = min(jumlah diminta, saldo).
 * Item teks bebas dipetakan ke master langsung di sini (pilih yang ada atau
 * buat baru), baru bisa disetujui.
 */
export default function KeputusanApprovalModal({
  record,
  onClose,
  onDone,
}: {
  record: PermintaanBarangRecord;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [masterList, setMasterList] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const muatSaldo = async (items: PermintaanItemRecord[]) => {
    const ids = [...new Set(items.map((it) => it.itemId).filter((x): x is number => x != null))];
    const map = ids.length > 0 ? (await getSaldoBulk(ids)).saldo : {};
    setRows(
      items.map((it) => {
        const saldo = it.itemId != null ? (map[it.itemId] ?? 0) : null;
        const maks = saldo == null ? 0 : Math.max(0, Math.min(it.jumlah, saldo));
        return { item: it, saldo, maks, nilai: String(maks), error: null };
      }),
    );
  };

  useEffect(() => {
    let aktif = true;
    Promise.all([getItems({ aktif: true }), muatSaldo(record.items).catch((e: unknown) => { throw e; })])
      .then(([masters]) => {
        if (!aktif) return;
        setMasterList(masters);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!aktif) return;
        setMasterList([]);
        // muatSaldo sudah set rows bila saldo ok; kalau gagal total:
        setRows((prev) =>
          prev.length > 0 ? prev : record.items.map((it) => ({ item: it, saldo: 0, maks: 0, nilai: "0", error: null })),
        );
        setLoadError(e instanceof Error ? e.message : "Gagal memuat stok item.");
        setLoading(false);
      });
    return () => {
      aktif = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- muat sekali per record
  }, [record.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const ubahNilai = (index: number, value: string) =>
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        const n = Number(value);
        let error: string | null = null;
        if (value.trim() === "" || !Number.isInteger(n) || n < 0) {
          error = "Isi bilangan bulat 0 atau lebih.";
        } else if (n > r.maks) {
          error = `Maksimal ${r.maks} (stok ${r.saldo ?? 0}, diminta ${r.item.jumlah}).`;
        }
        return { ...r, nilai: value, error };
      }),
    );

  const setMapping = (index: number, patch: Partial<NonNullable<Row["mapping"]>>) =>
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, mapping: { masterId: "", kode: "", nama: r.item.nama, busy: false, showNew: false, ...r.mapping, ...patch } } : r)),
    );

  const petakan = async (index: number) => {
    const r = rows[index];
    const masterId = Number(r.mapping?.masterId);
    if (!Number.isInteger(masterId) || masterId <= 0) return;
    setMapping(index, { busy: true });
    setSubmitError(null);
    try {
      const updated = await petakanItemPermintaan(record.id, r.item.id, masterId);
      const { saldo } = await getSaldoBulk([masterId]);
      const s = saldo[masterId] ?? 0;
      const maks = Math.max(0, Math.min(updated.jumlah, s));
      setRows((prev) =>
        prev.map((x, i) => (i === index ? { item: updated, saldo: s, maks, nilai: String(maks), error: null } : x)),
      );
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Gagal memetakan item.");
    } finally {
      setMapping(index, { busy: false });
    }
  };

  const buatBaru = async (index: number) => {
    const r = rows[index];
    const kode = (r.mapping?.kode ?? "").trim().toUpperCase();
    const nama = (r.mapping?.nama ?? "").trim() || r.item.nama.trim();
    if (!kode || !nama) {
      setSubmitError("Kode dan nama item baru wajib diisi.");
      return;
    }
    setMapping(index, { busy: true });
    setSubmitError(null);
    try {
      const master = await createItem({ kode, nama, unit: r.item.satuan ?? "pcs" });
      setMasterList((prev) => [...prev, master]);
      const updated = await petakanItemPermintaan(record.id, r.item.id, master.id);
      setRows((prev) =>
        prev.map((x, i) => (i === index ? { item: updated, saldo: 0, maks: 0, nilai: "0", error: null } : x)),
      );
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Gagal membuat item master.");
    } finally {
      setMapping(index, { busy: false });
    }
  };

  const tanpaMaster = rows.filter((r) => r.item.itemId == null).length;
  const adaError = useMemo(() => rows.some((r) => r.error !== null), [rows]);
  const adaDisetujui = useMemo(
    () => rows.some((r) => r.error === null && Number(r.nilai) > 0),
    [rows],
  );
  const blokir = tanpaMaster > 0 || loading || adaError || saving;

  const setujui = async () => {
    setSaving(true);
    setSubmitError(null);
    const items: KeputusanItemInput[] = rows.map((r) => ({
      id: r.item.id,
      jumlahDisetujui: Number(r.nilai),
    }));
    try {
      const updated = await setApprovalPermintaan(record.id, "DISETUJUI", items);
      const disetujui = updated.approval === "DISETUJUI";
      onDone(
        disetujui
          ? `Permintaan ${record.noPermintaan} berhasil disetujui.`
          : `Tidak ada item yang disetujui. Permintaan ${record.noPermintaan} tetap belum disetujui.`,
      );
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Gagal menyetujui permintaan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="keputusan-title" className="fixed inset-0 z-[60] grid place-items-center p-4">
      <button
        type="button"
        aria-label="Tutup"
        onClick={() => !saving && onClose()}
        className="absolute inset-0 cursor-default bg-slate-900/40"
      />
      <div className="relative w-full max-w-2xl rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="keputusan-title" className="font-mono text-base font-bold text-[#1E3A5F]">
              Setujui {record.noPermintaan}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Atur jumlah yang disetujui per item. Maksimal sesuai stok. Isi 0 untuk menolak item.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Tutup"
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 ${FOCUS}`}
          >
            <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {loading && (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" /> Memuat stok...
            </p>
          )}
          {loadError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {loadError}
            </p>
          )}

          {!loading && !loadError && rows.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3 text-right">Diminta</th>
                  <th className="py-2 pr-3 text-right">Stok</th>
                  <th className="py-2 text-right">Disetujui</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <tr key={r.item.id} className="align-top">
                    <td className="py-2 pr-3">
                      <p className="font-semibold text-slate-700">{r.item.nama}</p>
                      {r.item.itemId == null && (
                        <div className="mt-2 space-y-2 rounded-lg bg-amber-50 p-2">
                          <p className="text-xs font-semibold text-amber-700">Belum terdaftar — petakan ke master:</p>
                          <select
                            aria-label={`Master untuk ${r.item.nama}`}
                            value={r.mapping?.masterId ?? ""}
                            disabled={saving || r.mapping?.busy}
                            onChange={(e) => setMapping(i, { masterId: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                          >
                            <option value="">— Pilih item master —</option>
                            {masterList.map((m) => (
                              <option key={m.id} value={String(m.id)}>{m.kode} — {m.nama}</option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={saving || r.mapping?.busy || !r.mapping?.masterId}
                              onClick={() => void petakan(i)}
                              className="rounded-lg bg-[#1E3A5F] px-2 py-1 text-[11px] font-bold text-white disabled:opacity-40"
                            >
                              {r.mapping?.busy ? "…" : "Petakan"}
                            </button>
                            <button
                              type="button"
                              disabled={saving || r.mapping?.busy}
                              onClick={() => setMapping(i, { showNew: !r.mapping?.showNew })}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600"
                            >
                              {r.mapping?.showNew ? "Tutup" : "Buat baru"}
                            </button>
                          </div>
                          {r.mapping?.showNew && (
                            <div className="grid gap-1">
                              <input
                                aria-label="Kode item baru"
                                placeholder="Kode baru"
                                value={r.mapping?.kode ?? ""}
                                disabled={saving || r.mapping?.busy}
                                onChange={(e) => setMapping(i, { kode: e.target.value })}
                                className="rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs"
                              />
                              <input
                                aria-label="Nama item baru"
                                placeholder="Nama item baru"
                                value={r.mapping?.nama ?? ""}
                                disabled={saving || r.mapping?.busy}
                                onChange={(e) => setMapping(i, { nama: e.target.value })}
                                className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                              />
                              <button
                                type="button"
                                disabled={saving || r.mapping?.busy}
                                onClick={() => void buatBaru(i)}
                                className="rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-40"
                              >
                                Buat + petakan
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.item.jumlah}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {r.saldo == null ? "-" : r.saldo}
                    </td>
                    <td className="py-2 text-right">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={r.maks}
                        step={1}
                        aria-label={`Jumlah disetujui ${r.item.nama}`}
                        value={r.nilai}
                        disabled={r.item.itemId == null || saving}
                        onChange={(e) => ubahNilai(i, e.target.value)}
                        className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-right tabular-nums focus:border-[#00A8E8] focus:outline-none disabled:bg-slate-50"
                      />
                      {r.error && <p className="mt-1 text-xs text-red-600">{r.error}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {submitError && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {submitError}
            </p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className={`rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-[#1E3A5F] hover:bg-slate-50 ${FOCUS}`}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => void setujui()}
            disabled={blokir || !adaDisetujui}
            className={`inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`}
          >
            {saving && <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" />}
            {saving ? "Memproses…" : "Setujui"}
          </button>
        </div>
      </div>
    </div>
  );
}
