import { useEffect, useMemo, useState, type FormEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRightArrowLeft, faPlus, faXmark, faTrash } from "@fortawesome/free-solid-svg-icons";
import { getUser } from "../../api/auth";
import { getDivisi, type Divisi } from "../../api/divisi";
import {
  approveWipTransfer,
  createWipTransfer,
  deleteWipTransfer,
  getWipTransfer,
  getWipTransferOpsi,
  listWipTransfer,
  WipTransferApiError,
  type ArahWipTransfer,
  type StatusWipTransfer,
  type WipTransferOpsiItem,
  type WipTransferRecord,
} from "../../api/wipTransfer";
import { FIELD, btnPrimary, miniBtn } from "../../components/admin/HasilProduksiDivisi/ui";
import { angka, formatTanggal, hariIni } from "../../components/admin/HasilProduksiDivisi/utils";
import { useDivisiWorkspace } from "../../layouts/divisi/DivisiContext";
import DivisiGate from "./DivisiGate";

type Baris = { key: string; itemId: string; jumlah: string };

let urutan = 0;
const barisBaru = (): Baris => {
  urutan += 1;
  return { key: `tr-${urutan}`, itemId: "", jumlah: "" };
};

const STATUS_TONE: Record<StatusWipTransfer, string> = {
  MENUNGGU: "bg-amber-100 text-amber-800",
  DISETUJUI: "bg-emerald-100 text-emerald-800",
  DITOLAK: "bg-rose-100 text-rose-800",
};

function StatusPill({ status }: { status: StatusWipTransfer }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_TONE[status]}`}>
      {status}
    </span>
  );
}

function TransferCard({
  row,
  activeDivisiId,
  admin,
  onApprove,
  onDelete,
  deleting,
}: {
  row: WipTransferRecord;
  activeDivisiId: number;
  admin: boolean;
  onApprove: (row: WipTransferRecord) => void;
  onDelete: (row: WipTransferRecord) => void;
  deleting: boolean;
}) {
  const [open, setOpen] = useState(false);

  const approver =
    row.status === "MENUNGGU" &&
    (admin ||
      (row.arah === "KIRIM"
        ? row.divisiTujuanId === activeDivisiId
        : row.divisiAsalId === activeDivisiId));
  const pembuat =
    row.status === "MENUNGGU" &&
    (admin ||
      (row.arah === "KIRIM"
        ? row.divisiAsalId === activeDivisiId
        : row.divisiTujuanId === activeDivisiId));

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
      >
        <span
          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
            row.arah === "KIRIM" ? "bg-sky-100 text-sky-800" : "bg-violet-100 text-violet-800"
          }`}
        >
          {row.arah}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#1E3A5F]">
          {row.divisiAsal.nama} {"→"} {row.divisiTujuan.nama}
        </span>
        <StatusPill status={row.status} />
        <svg
          xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
          className={`h-4 w-4 shrink-0 text-slate-300 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-3 pb-3 pt-2">
          <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
            <span className="font-mono font-semibold text-[#0077A8]">{row.nomor}</span>
            <span>{row.arah === "KIRIM" ? "Dikirim" : "Diminta"} · {formatTanggal(row.tanggal)}</span>
          </div>

          <ul className="mt-2 divide-y divide-slate-100 rounded-lg bg-slate-50 px-2.5">
            {row.items.map((item) => (
              <li key={item.id} className="flex items-baseline justify-between gap-2 py-1.5 text-xs">
                <span className="min-w-0 truncate text-slate-700">{item.item.nama}</span>
                <span className="shrink-0 tabular-nums font-semibold text-[#1E3A5F]">
                  {item.jumlah.toLocaleString("id-ID")} {item.satuan ?? item.item.unit}
                  {item.jumlahDisetujui !== null && item.jumlahDisetujui !== item.jumlah && (
                    <span className="ml-1 font-normal text-slate-400">
                      ({"\u2713"}{item.jumlahDisetujui.toLocaleString("id-ID")})
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          {row.keterangan && <p className="mt-1.5 text-[11px] italic text-slate-400">{row.keterangan}</p>}

          {(approver || pembuat) && (
            <div className="mt-2.5 flex gap-2">
              {approver && (
                <button type="button" onClick={() => onApprove(row)} className={`${miniBtn} flex-1 justify-center`}>
                  Tinjau &amp; setujui
                </button>
              )}
              {pembuat && (
                <button
                  type="button" onClick={() => onDelete(row)} disabled={deleting}
                  className={`${miniBtn} inline-flex items-center gap-1 text-rose-700 ring-rose-200 hover:bg-rose-50`}
                >
                  <FontAwesomeIcon icon={faTrash} className="h-3 w-3" />
                  {deleting ? "..." : "Hapus"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function IsiTransferWip() {
  const { activeDivisiId, activeDivisiNama } = useDivisiWorkspace();
  const user = getUser();
  const admin = user?.role === "admin";
  const divisiAktif = activeDivisiId ?? 0;

  const [divisis, setDivisis] = useState<Divisi[]>([]);
  const [transfers, setTransfers] = useState<WipTransferRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [arah, setArah] = useState<ArahWipTransfer>("KIRIM");
  const [tanggal, setTanggal] = useState(hariIni);
  const [sumberId, setSumberId] = useState("");
  const [tujuanId, setTujuanId] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [rows, setRows] = useState<Baris[]>(() => [barisBaru()]);
  const [opsi, setOpsi] = useState<WipTransferOpsiItem[]>([]);
  const [opsiLoading, setOpsiLoading] = useState(false);
  const [opsiError, setOpsiError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formKurang, setFormKurang] = useState<WipTransferApiError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [statusFilter, setStatusFilter] = useState<"" | StatusWipTransfer>("");
  const [arahFilter, setArahFilter] = useState<"" | ArahWipTransfer>("");

  const [approvalOpen, setApprovalOpen] = useState(false);
  const [detail, setDetail] = useState<WipTransferRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [approvalJumlah, setApprovalJumlah] = useState<Record<number, string>>({});
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [approvalSaving, setApprovalSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const sumber = useMemo(
    () => (arah === "KIRIM" ? String(divisiAktif) : sumberId),
    [arah, divisiAktif, sumberId],
  );
  const tujuan = useMemo(
    () => (arah === "MINTA" ? String(divisiAktif) : tujuanId),
    [arah, divisiAktif, tujuanId],
  );

  useEffect(() => {
    let cancelled = false;
    void getDivisi()
      .then((data) => { if (!cancelled) setDivisis(data); })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof Error ? err.message : "Gagal memuat divisi."); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- filter berubah memuat ulang daftar
    setLoading(true);
    void listWipTransfer({ limit: 50, status: statusFilter || undefined, arah: arahFilter || undefined })
      .then((result) => {
        if (cancelled) return;
        setTransfers(result.data.filter((row) => row.divisiAsalId === divisiAktif || row.divisiTujuanId === divisiAktif));
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setTransfers([]);
        setError(err instanceof Error ? err.message : "Gagal memuat transfer WIP.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [divisiAktif, statusFilter, arahFilter, refreshKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- arah/divisi berubah mengosongkan baris
    setRows([barisBaru()]);
    setFormKurang(null);
    setFormError(null);
    setSuccess(null);
  }, [arah, sumberId, tujuanId]);

  useEffect(() => {
    if (!sumber) { setOpsi([]); return; }
    let cancelled = false;
    setOpsiLoading(true);
    void getWipTransferOpsi({ arah, divisiAsalId: Number(sumber) })
      .then((data) => { if (cancelled) return; setOpsi(data); setOpsiError(null); })
      .catch((err: unknown) => { if (cancelled) return; setOpsi([]); setOpsiError(err instanceof Error ? err.message : "Gagal memuat opsi item."); })
      .finally(() => { if (!cancelled) setOpsiLoading(false); });
    return () => { cancelled = true; };
  }, [arah, sumber]);

  const pilihArah = (next: ArahWipTransfer) => { setArah(next); setSumberId(""); setTujuanId(""); setOpsi([]); };
  const ubahBaris = (key: string, patch: Partial<Baris>) => {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    setFormError(null); setFormKurang(null);
  };
  const hapusBaris = (key: string) => setRows((prev) => prev.filter((row) => row.key !== key));

  const simpan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setFormError(null); setFormKurang(null); setSuccess(null);
    if (!sumber || !tujuan) { setFormError("Pilih divisi asal dan tujuan."); return; }
    if (sumber === tujuan) { setFormError("Divisi asal dan tujuan tidak boleh sama."); return; }
    const items = rows
      .map((row) => ({ itemId: Number(row.itemId), jumlah: Number(row.jumlah) }))
      .filter((row) => Number.isInteger(row.itemId) && row.itemId > 0);
    if (items.length === 0) { setFormError("Pilih minimal satu item dan jumlah."); return; }
    if (items.some((row) => !Number.isInteger(row.jumlah) || row.jumlah <= 0)) {
      setFormError("Jumlah setiap item harus bilangan bulat lebih dari 0."); return;
    }
    setSaving(true);
    try {
      const row = await createWipTransfer({
        arah, tanggal,
        divisiAsalId: Number(sumber),
        divisiTujuanId: Number(tujuan),
        keterangan: keterangan.trim() || null,
        items,
      });
      setSuccess(`Transfer ${row.nomor} dibuat dan menunggu approval.`);
      setRows([barisBaru()]); setKeterangan("");
      setRefreshKey((v) => v + 1);
    } catch (err) {
      if (err instanceof WipTransferApiError && err.kode === "WIP_KURANG") setFormKurang(err);
      else setFormError(err instanceof Error ? err.message : "Gagal membuat transfer WIP.");
    } finally { setSaving(false); }
  };

  const bukaApproval = async (row: WipTransferRecord) => {
    setApprovalOpen(true); setDetail(null); setApprovalError(null); setDetailLoading(true);
    try {
      const data = await getWipTransfer(row.id);
      setDetail(data);
      setApprovalJumlah(Object.fromEntries(data.items.map((item) => [item.id, String(item.jumlah)])));
    } catch (err) { setApprovalError(err instanceof Error ? err.message : "Gagal memuat detail transfer."); }
    finally { setDetailLoading(false); }
  };

  const kirimApproval = async (status: "DISETUJUI" | "DITOLAK") => {
    if (!detail || approvalSaving) return;
    setApprovalError(null); setApprovalSaving(true);
    try {
      await approveWipTransfer(detail.id, {
        status,
        ...(status === "DISETUJUI"
          ? { items: detail.items.map((item) => ({ id: item.id, jumlahDisetujui: Number(approvalJumlah[item.id] ?? 0) })) }
          : {}),
      });
      setApprovalOpen(false); setDetail(null);
      setSuccess(`Transfer ${detail.nomor} ${status === "DISETUJUI" ? "disetujui" : "ditolak"}.`);
      setRefreshKey((v) => v + 1);
    } catch (err) { setApprovalError(err instanceof Error ? err.message : "Gagal memproses approval."); }
    finally { setApprovalSaving(false); }
  };

  const hapus = async (row: WipTransferRecord) => {
    if (deletingId || !window.confirm(`Hapus transfer ${row.nomor}?`)) return;
    setDeletingId(row.id); setError(null);
    try {
      await deleteWipTransfer(row.id);
      setSuccess(`Transfer ${row.nomor} dihapus.`);
      setRefreshKey((v) => v + 1);
    } catch (err) { setError(err instanceof Error ? err.message : "Gagal menghapus transfer."); }
    finally { setDeletingId(null); }
  };

  const opsiSumber = divisis.filter((d) => d.id !== divisiAktif);
  const opsiTujuan = divisis.filter((d) => d.id !== divisiAktif);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-3 px-3 pb-10 pt-3">

      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1E3A5F]">
          <FontAwesomeIcon icon={faArrowRightArrowLeft} className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-bold text-[#1E3A5F]">Transfer WIP</h1>
          <p className="truncate text-[11px] text-slate-500">
            {activeDivisiNama ?? "—"} · Kirim atau minta material antar divisi
          </p>
        </div>
      </div>

      {/* Global toasts */}
      {success && (
        <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800">
          <span className="flex-1">{success}</span>
          <button type="button" onClick={() => setSuccess(null)} aria-label="Tutup" className="shrink-0 text-emerald-400 hover:text-emerald-600">
            <FontAwesomeIcon icon={faXmark} className="h-3 w-3" />
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>
      )}

      {/* Form buat transfer */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-[#1E3A5F]">Buat transfer baru</h2>
          <p className="mt-0.5 text-[11px] text-slate-400">
            KIRIM: divisi aktif mengirim, tujuan menyetujui. MINTA: divisi aktif meminta, asal menyetujui.
          </p>
        </div>

        <form onSubmit={simpan} className="space-y-3 px-4 pb-4 pt-3">

          {/* Arah + Tanggal */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-500">Arah</span>
              <div className="grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                {(["KIRIM", "MINTA"] as const).map((v) => (
                  <button
                    key={v} type="button" onClick={() => pilihArah(v)} aria-pressed={arah === v}
                    className={`rounded-md py-1.5 text-xs font-bold transition ${arah === v ? "bg-[#1E3A5F] text-white shadow-sm" : "text-slate-500"}`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-500">Tanggal</span>
              <input
                type="date" value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className={`${FIELD} min-h-0 py-2 text-xs`}
              />
            </label>
          </div>

          {/* Divisi asal + tujuan */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-500">Asal</span>
              {arah === "KIRIM" ? (
                <p className="rounded-lg bg-sky-50 px-2.5 py-2 text-xs font-semibold text-[#0077A8]">{activeDivisiNama ?? "Aktif"}</p>
              ) : (
                <select value={sumberId} onChange={(e) => setSumberId(e.target.value)} className={`${FIELD} min-h-0 py-2 text-xs`}>
                  <option value="">Pilih...</option>
                  {opsiSumber.map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
                </select>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-slate-500">Tujuan</span>
              {arah === "MINTA" ? (
                <p className="rounded-lg bg-sky-50 px-2.5 py-2 text-xs font-semibold text-[#0077A8]">{activeDivisiNama ?? "Aktif"}</p>
              ) : (
                <select value={tujuanId} onChange={(e) => setTujuanId(e.target.value)} className={`${FIELD} min-h-0 py-2 text-xs`}>
                  <option value="">Pilih...</option>
                  {opsiTujuan.map((d) => <option key={d.id} value={d.id}>{d.nama}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Item WIP */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#1E3A5F]">Item WIP</span>
              <button type="button" onClick={() => setRows((prev) => [...prev, barisBaru()])} className={`${miniBtn} py-1 text-[11px]`}>
                <FontAwesomeIcon icon={faPlus} className="h-2.5 w-2.5" /> Tambah
              </button>
            </div>

            {opsiLoading && <p className="py-2 text-center text-[11px] text-slate-400">Memuat item...</p>}
            {opsiError && <p role="alert" className="text-[11px] text-rose-600">{opsiError}</p>}
            {!opsiLoading && !opsiError && opsi.length === 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
                {arah === "KIRIM" ? "Belum ada WIP SM bersaldo di divisi aktif." : "Belum ada item SM aktif yang bisa diminta."}
              </p>
            )}

            <div className="space-y-2">
              {rows.map((row) => {
                const selected = opsi.find((o) => String(o.itemId) === row.itemId);
                return (
                  <div key={row.key} className="flex items-end gap-1.5">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <select
                        value={row.itemId}
                        onChange={(e) => ubahBaris(row.key, { itemId: e.target.value })}
                        className={`${FIELD} min-h-0 py-2 text-xs`}
                        aria-label="Pilih item"
                      >
                        <option value="">Pilih item...</option>
                        {opsi.map((item) => (
                          <option key={item.itemId} value={item.itemId}>
                            {item.kode} — {item.nama} (WIP {item.wipTersedia.toLocaleString("id-ID")} {item.unit})
                          </option>
                        ))}
                      </select>
                      {selected && (
                        <span className="text-[10px] text-slate-400">
                          Tersedia: {selected.wipTersedia.toLocaleString("id-ID")} {selected.unit}
                        </span>
                      )}
                    </div>
                    <input
                      type="number" min={1} step={1} value={row.jumlah}
                      onChange={(e) => ubahBaris(row.key, { jumlah: e.target.value })}
                      placeholder="Jml"
                      className={`${FIELD} min-h-0 w-20 py-2 text-right text-xs tabular-nums`}
                      aria-label="Jumlah"
                    />
                    <button
                      type="button" onClick={() => hapusBaris(row.key)}
                      disabled={rows.length === 1} aria-label="Hapus baris"
                      className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg border border-rose-200 text-rose-500 transition hover:bg-rose-50 disabled:opacity-30"
                    >
                      <FontAwesomeIcon icon={faXmark} className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Keterangan */}
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-500">Keterangan (opsional)</span>
            <input
              type="text" value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder="Catatan singkat..."
              className={`${FIELD} min-h-0 py-2 text-xs`}
            />
          </label>

          {formError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{formError}</p>
          )}
          {formKurang && (
            <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
              <p className="font-bold">WIP asal kurang:</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {formKurang.dataKekurangan?.items.map((item) => (
                  <li key={item.itemId}>
                    {item.nama}: diminta {item.diminta.toLocaleString("id-ID")}, tersedia {item.tersedia.toLocaleString("id-ID")}, kurang {item.kekurangan.toLocaleString("id-ID")} {item.unit}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button type="submit" disabled={saving} className={`${btnPrimary} w-full disabled:opacity-50`}>
            {saving ? "Menyimpan..." : `Buat transfer ${arah}`}
          </button>
        </form>
      </section>

      {/* Riwayat transfer */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-[#1E3A5F]">Riwayat transfer</h2>
          <div className="mt-2 flex gap-2">
            <select
              value={arahFilter}
              onChange={(e) => setArahFilter(e.target.value as "" | ArahWipTransfer)}
              className={`${FIELD} min-h-0 flex-1 py-1.5 text-xs`}
              aria-label="Filter arah"
            >
              <option value="">Semua arah</option>
              <option value="KIRIM">KIRIM</option>
              <option value="MINTA">MINTA</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "" | StatusWipTransfer)}
              className={`${FIELD} min-h-0 flex-1 py-1.5 text-xs`}
              aria-label="Filter status"
            >
              <option value="">Semua status</option>
              <option value="MENUNGGU">MENUNGGU</option>
              <option value="DISETUJUI">DISETUJUI</option>
              <option value="DITOLAK">DITOLAK</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="py-8 text-center text-xs text-slate-400">Memuat transfer...</p>
        ) : transfers.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-400">Belum ada transfer WIP pada filter ini.</p>
        ) : (
          <div className="space-y-2 p-3">
            {transfers.map((row) => (
              <TransferCard
                key={row.id} row={row} activeDivisiId={divisiAktif} admin={admin}
                onApprove={(item) => void bukaApproval(item)}
                onDelete={(item) => void hapus(item)}
                deleting={deletingId === row.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* Approval bottom-sheet */}
      {approvalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50"
          onClick={() => { if (!approvalSaving) { setApprovalOpen(false); setDetail(null); setApprovalError(null); } }}
        >
          <div
            role="dialog" aria-modal="true" aria-labelledby="approval-title"
            className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white px-4 pb-8 pt-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="approval-title" className="text-sm font-bold text-[#1E3A5F]">Approval Transfer</h2>
                <p className="text-[11px] text-slate-400">
                  {detail ? `${detail.nomor} · ${detail.divisiAsal.nama} → ${detail.divisiTujuan.nama}` : "Memuat detail..."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setApprovalOpen(false); setDetail(null); setApprovalError(null); }}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50"
                aria-label="Tutup"
              >
                <FontAwesomeIcon icon={faXmark} className="h-3.5 w-3.5" />
              </button>
            </div>

            {detailLoading && <p className="mt-6 text-center text-xs text-slate-400">Memuat detail...</p>}
            {approvalError && (
              <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {approvalError}
              </p>
            )}

            {detail && (
              <>
                <div className="mt-4 space-y-2">
                  {detail.items.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-1">
                        <p className="text-xs font-semibold text-[#1F2937]">
                          <span className="font-mono text-[10px] text-slate-400">{item.item.kode}</span>{" "}
                          {item.item.nama}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Diminta {item.jumlah.toLocaleString("id-ID")} · WIP {angka(item.wipTersedia ?? 0).toLocaleString("id-ID")} {item.satuan ?? item.item.unit}
                        </p>
                      </div>
                      <label className="mt-2.5 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                        <span className="shrink-0">Disetujui</span>
                        <input
                          type="number" min={0} max={item.jumlah} step={1}
                          value={approvalJumlah[item.id] ?? ""}
                          onChange={(e) => setApprovalJumlah((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          className={`${FIELD} min-h-0 w-24 py-1.5 text-right text-xs`}
                        />
                        <span className="shrink-0">{item.satuan ?? item.item.unit}</span>
                      </label>
                    </div>
                  ))}
                </div>

                <p className="mt-2 text-[10px] text-slate-400">
                  Jumlah 0 semua item = tolak. Turunkan jumlah untuk setujui sebagian.
                </p>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button" onClick={() => void kirimApproval("DITOLAK")} disabled={approvalSaving}
                    className={`${miniBtn} flex-1 justify-center py-2.5 text-rose-700 ring-rose-200 hover:bg-rose-50`}
                  >
                    Tolak
                  </button>
                  <button
                    type="button" onClick={() => void kirimApproval("DISETUJUI")} disabled={approvalSaving}
                    className={`${btnPrimary} flex-1 justify-center disabled:opacity-50`}
                  >
                    {approvalSaving ? "Memproses..." : "Setujui"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DivisiTransferWip() {
  return (
    <DivisiGate>
      <IsiTransferWip />
    </DivisiGate>
  );
}