import { useEffect, useMemo, useState, type FormEvent } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowRightArrowLeft, faPlus, faTrash, faXmark } from "@fortawesome/free-solid-svg-icons";
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
import DivisiPageHeader from "../../components/divisi/DivisiPageHeader";
import { CARD, FIELD, btnPrimary, miniBtn } from "../../components/admin/HasilProduksiDivisi/ui";
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

function StatusBadge({ status }: { status: StatusWipTransfer }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_TONE[status]}`}>
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
    <article className="rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-[#0077A8]">{row.nomor}</p>
          <p className="mt-1 text-sm font-bold text-[#1E3A5F]">
            {row.divisiAsal.nama} <span className="text-slate-400">→</span> {row.divisiTujuan.nama}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {row.arah === "KIRIM" ? "Dikirim divisi asal" : "Diminta divisi tujuan"} ·{" "}
            {formatTanggal(row.tanggal)}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-bold text-sky-800">
            {row.arah}
          </span>
          <StatusBadge status={row.status} />
        </div>
      </div>

      <ul className="mt-3 divide-y divide-slate-100 rounded-lg bg-slate-50 px-3">
        {row.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="min-w-0 truncate text-[#1F2937]">
              <span className="font-mono text-xs text-slate-500">{item.item.kode}</span> {item.item.nama}
            </span>
            <span className="shrink-0 tabular-nums font-semibold text-[#1E3A5F]">
              {item.jumlah.toLocaleString("id-ID")} {item.satuan ?? item.item.unit}
              {item.jumlahDisetujui !== null && item.jumlahDisetujui !== item.jumlah
                ? ` (disetujui ${item.jumlahDisetujui.toLocaleString("id-ID")})`
                : ""}
            </span>
          </li>
        ))}
      </ul>

      {row.keterangan && <p className="mt-2 text-xs text-slate-500">{row.keterangan}</p>}

      {(approver || pembuat) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {approver && (
            <button type="button" onClick={() => onApprove(row)} className={miniBtn}>
              Tinjau & setujui
            </button>
          )}
          {pembuat && (
            <button
              type="button"
              onClick={() => onDelete(row)}
              disabled={deleting}
              className={`${miniBtn} inline-flex items-center gap-1 text-rose-700 ring-rose-200 hover:bg-rose-50`}
            >
              <FontAwesomeIcon icon={faTrash} className="h-3 w-3" />
              {deleting ? "Menghapus..." : "Hapus"}
            </button>
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
      .then((data) => {
        if (!cancelled) setDivisis(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Gagal memuat divisi.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- filter berubah memuat ulang daftar
    setLoading(true);
    void listWipTransfer({
      limit: 50,
      status: statusFilter || undefined,
      arah: arahFilter || undefined,
    })
      .then((result) => {
        if (cancelled) return;
        setTransfers(
          result.data.filter(
            (row) => row.divisiAsalId === divisiAktif || row.divisiTujuanId === divisiAktif,
          ),
        );
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setTransfers([]);
        setError(err instanceof Error ? err.message : "Gagal memuat transfer WIP.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [divisiAktif, statusFilter, arahFilter, refreshKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- arah/divisi berubah mengosongkan baris
    setRows([barisBaru()]);
    setFormKurang(null);
    setFormError(null);
    setSuccess(null);
  }, [arah, sumberId, tujuanId]);

  useEffect(() => {
    if (!sumber) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- tidak ada divisi asal
      setOpsi([]);
      return;
    }
    let cancelled = false;
    setOpsiLoading(true);
    void getWipTransferOpsi({ arah, divisiAsalId: Number(sumber) })
      .then((data) => {
        if (cancelled) return;
        setOpsi(data);
        setOpsiError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setOpsi([]);
        setOpsiError(err instanceof Error ? err.message : "Gagal memuat opsi item.");
      })
      .finally(() => {
        if (!cancelled) setOpsiLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [arah, sumber]);

  const pilihArah = (next: ArahWipTransfer) => {
    setArah(next);
    setSumberId("");
    setTujuanId("");
    setOpsi([]);
  };

  const ubahBaris = (key: string, patch: Partial<Baris>) => {
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    setFormError(null);
    setFormKurang(null);
  };

  const hapusBaris = (key: string) => {
    setRows((prev) => prev.filter((row) => row.key !== key));
  };

  const simpan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setFormError(null);
    setFormKurang(null);
    setSuccess(null);

    if (!sumber || !tujuan) {
      setFormError("Pilih divisi asal dan tujuan.");
      return;
    }
    if (sumber === tujuan) {
      setFormError("Divisi asal dan tujuan tidak boleh sama.");
      return;
    }
    const items = rows
      .map((row) => ({ itemId: Number(row.itemId), jumlah: Number(row.jumlah) }))
      .filter((row) => Number.isInteger(row.itemId) && row.itemId > 0);
    if (items.length === 0) {
      setFormError("Pilih minimal satu item dan jumlah.");
      return;
    }
    if (items.some((row) => !Number.isInteger(row.jumlah) || row.jumlah <= 0)) {
      setFormError("Jumlah setiap item harus bilangan bulat lebih dari 0.");
      return;
    }

    setSaving(true);
    try {
      const row = await createWipTransfer({
        arah,
        tanggal,
        divisiAsalId: Number(sumber),
        divisiTujuanId: Number(tujuan),
        keterangan: keterangan.trim() || null,
        items,
      });
      setSuccess(`Transfer ${row.nomor} dibuat dan menunggu approval.`);
      setRows([barisBaru()]);
      setKeterangan("");
      setRefreshKey((value) => value + 1);
    } catch (err) {
      if (err instanceof WipTransferApiError && err.kode === "WIP_KURANG") {
        setFormKurang(err);
      } else {
        setFormError(err instanceof Error ? err.message : "Gagal membuat transfer WIP.");
      }
    } finally {
      setSaving(false);
    }
  };

  const bukaApproval = async (row: WipTransferRecord) => {
    setApprovalOpen(true);
    setDetail(null);
    setApprovalError(null);
    setDetailLoading(true);
    try {
      const data = await getWipTransfer(row.id);
      setDetail(data);
      setApprovalJumlah(
        Object.fromEntries(data.items.map((item) => [item.id, String(item.jumlah)])),
      );
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "Gagal memuat detail transfer.");
    } finally {
      setDetailLoading(false);
    }
  };

  const kirimApproval = async (status: "DISETUJUI" | "DITOLAK") => {
    if (!detail || approvalSaving) return;
    setApprovalError(null);
    setApprovalSaving(true);
    try {
      await approveWipTransfer(detail.id, {
        status,
        ...(status === "DISETUJUI"
          ? {
              items: detail.items.map((item) => ({
                id: item.id,
                jumlahDisetujui: Number(approvalJumlah[item.id] ?? 0),
              })),
            }
          : {}),
      });
      setApprovalOpen(false);
      setDetail(null);
      setSuccess(`Transfer ${detail.nomor} ${status === "DISETUJUI" ? "disetujui" : "ditolak"}.`);
      setRefreshKey((value) => value + 1);
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "Gagal memproses approval.");
    } finally {
      setApprovalSaving(false);
    }
  };

  const hapus = async (row: WipTransferRecord) => {
    if (deletingId || !window.confirm(`Hapus transfer ${row.nomor}?`)) return;
    setDeletingId(row.id);
    setError(null);
    try {
      await deleteWipTransfer(row.id);
      setSuccess(`Transfer ${row.nomor} dihapus.`);
      setRefreshKey((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus transfer.");
    } finally {
      setDeletingId(null);
    }
  };

  const opsiSumber = divisis.filter((divisi) => divisi.id !== divisiAktif);
  const opsiTujuan = divisis.filter((divisi) => divisi.id !== divisiAktif);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5">
      <DivisiPageHeader
        icon={faArrowRightArrowLeft}
        title="Transfer WIP"
        description={`Kirim atau minta material WIP antar divisi tanpa mengubah stok gudang. Divisi aktif: ${activeDivisiNama ?? "-"}.`}
        divisiNama={activeDivisiNama ?? "Divisi"}
      />

      <section className={CARD}>
        <div className="border-b border-slate-100 p-4">
          <h2 className="font-semibold text-[#1E3A5F]">Buat transfer</h2>
          <p className="mt-1 text-xs text-slate-500">
            KIRIM: divisi aktif mengirim, divisi tujuan menyetujui. MINTA: divisi aktif meminta, divisi asal menyetujui.
          </p>
        </div>

        <form onSubmit={simpan} className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold text-[#1F2937]">
              Arah
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                {(["KIRIM", "MINTA"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => pilihArah(value)}
                    aria-pressed={arah === value}
                    className={`rounded-md px-3 py-2 text-sm font-bold transition ${
                      arah === value ? "bg-white text-[#1E3A5F] shadow-sm" : "text-slate-500"
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-[#1F2937]">
              Tanggal
              <input
                type="date"
                value={tanggal}
                onChange={(event) => setTanggal(event.target.value)}
                className={FIELD}
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm font-semibold text-[#1F2937]">
              Divisi asal
              {arah === "KIRIM" ? (
                <p className="rounded-lg bg-sky-50 px-3 py-2.5 text-sm font-semibold text-[#0077A8]">
                  {activeDivisiNama ?? "Divisi aktif"}
                </p>
              ) : (
                <select
                  value={sumberId}
                  onChange={(event) => setSumberId(event.target.value)}
                  className={FIELD}
                >
                  <option value="">Pilih divisi asal</option>
                  {opsiSumber.map((divisi) => (
                    <option key={divisi.id} value={divisi.id}>
                      {divisi.nama}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-[#1F2937]">
              Divisi tujuan
              {arah === "MINTA" ? (
                <p className="rounded-lg bg-sky-50 px-3 py-2.5 text-sm font-semibold text-[#0077A8]">
                  {activeDivisiNama ?? "Divisi aktif"}
                </p>
              ) : (
                <select
                  value={tujuanId}
                  onChange={(event) => setTujuanId(event.target.value)}
                  className={FIELD}
                >
                  <option value="">Pilih divisi tujuan</option>
                  {opsiTujuan.map((divisi) => (
                    <option key={divisi.id} value={divisi.id}>
                      {divisi.nama}
                    </option>
                  ))}
                </select>
              )}
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 bg-[#F9FAFC] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#1E3A5F]">Item WIP</h3>
                <p className="text-xs text-slate-500">
                  {arah === "KIRIM"
                    ? "Hanya item SM aktif dengan saldo WIP tersedia di divisi asal."
                    : "Semua item SM aktif. WIP 0 tetap bisa diminta; approval akan menolak jika saldo asal kurang."}
                </p>
              </div>
              <button type="button" onClick={() => setRows((prev) => [...prev, barisBaru()])} className={miniBtn}>
                <FontAwesomeIcon icon={faPlus} className="mr-1 h-3 w-3" /> Tambah item
              </button>
            </div>

            {opsiLoading && <p className="mt-3 text-sm text-slate-500">Memuat opsi item...</p>}
            {opsiError && (
              <p role="alert" className="mt-3 text-sm text-rose-600">
                {opsiError}
              </p>
            )}
            {!opsiLoading && !opsiError && opsi.length === 0 && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {arah === "KIRIM"
                  ? "Belum ada WIP SM bersaldo di divisi aktif. Tambahkan hasil produksi SM atau minta transfer dari divisi lain."
                  : "Belum ada item SM aktif yang bisa diminta."}
              </p>
            )}

            <div className="mt-3 space-y-2">
              {rows.map((row) => (
                <div key={row.key} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px_40px] sm:items-end">
                  <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                    Item
                    <select
                      value={row.itemId}
                      onChange={(event) => ubahBaris(row.key, { itemId: event.target.value })}
                      className={FIELD}
                    >
                      <option value="">Pilih item</option>
                      {opsi.map((item) => (
                        <option key={item.itemId} value={item.itemId}>
                          {item.kode} - {item.nama} (WIP {item.wipTersedia.toLocaleString("id-ID")} {item.unit})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
                    Jumlah
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={row.jumlah}
                      onChange={(event) => ubahBaris(row.key, { jumlah: event.target.value })}
                      className={FIELD}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => hapusBaris(row.key)}
                    disabled={rows.length === 1}
                    aria-label="Hapus baris item"
                    className={`${miniBtn} grid h-[46px] place-items-center px-0 text-rose-700 ring-rose-200 disabled:opacity-30`}
                  >
                    <FontAwesomeIcon icon={faXmark} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1 text-sm font-semibold text-[#1F2937]">
            Keterangan (opsional)
            <textarea
              value={keterangan}
              onChange={(event) => setKeterangan(event.target.value)}
              rows={2}
              className={`${FIELD} resize-y`}
            />
          </label>

          {formError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {formError}
            </p>
          )}
          {formKurang && (
            <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900">
              <p className="font-bold">Transfer belum dibuat: WIP asal kurang.</p>
              <ul className="mt-1 list-inside list-disc text-xs">
                {formKurang.dataKekurangan?.items.map((item) => (
                  <li key={item.itemId}>
                    {item.nama}: diminta {item.diminta.toLocaleString("id-ID")} {item.unit}, tersedia{" "}
                    {item.tersedia.toLocaleString("id-ID")}, kurang {item.kekurangan.toLocaleString("id-ID")}.
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs">Form tidak direset. Kurangi jumlah atau tunggu WIP asal bertambah.</p>
            </div>
          )}
          {success && (
            <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {success}
            </p>
          )}

          <button type="submit" disabled={saving} className={`${btnPrimary} w-full disabled:opacity-50 sm:w-auto`}>
            {saving ? "Menyimpan..." : `Buat transfer ${arah}`}
          </button>
        </form>
      </section>

      <section className={CARD}>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <h2 className="font-semibold text-[#1E3A5F]">Riwayat transfer</h2>
            <p className="mt-1 text-xs text-slate-500">Transfer yang melibatkan divisi aktif.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={arahFilter}
              onChange={(event) => setArahFilter(event.target.value as "" | ArahWipTransfer)}
              className={`${FIELD} py-2 text-sm`}
              aria-label="Filter arah"
            >
              <option value="">Semua arah</option>
              <option value="KIRIM">KIRIM</option>
              <option value="MINTA">MINTA</option>
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "" | StatusWipTransfer)}
              className={`${FIELD} py-2 text-sm`}
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
          <p className="p-6 text-center text-sm text-slate-500">Memuat transfer...</p>
        ) : error ? (
          <p role="alert" className="p-6 text-center text-sm text-rose-600">
            {error}
          </p>
        ) : transfers.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">Belum ada transfer WIP pada filter ini.</p>
        ) : (
          <div className="space-y-3 p-4">
            {transfers.map((row) => (
              <TransferCard
                key={row.id}
                row={row}
                activeDivisiId={divisiAktif}
                admin={admin}
                onApprove={(item) => void bukaApproval(item)}
                onDelete={(item) => void hapus(item)}
                deleting={deletingId === row.id}
              />
            ))}
          </div>
        )}
      </section>

      {approvalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="approval-title"
            className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:max-w-lg sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="approval-title" className="text-lg font-bold text-[#1E3A5F]">
                  Approval transfer
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {detail ? `${detail.nomor} · ${detail.divisiAsal.nama} → ${detail.divisiTujuan.nama}` : "Memuat detail..."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setApprovalOpen(false);
                  setDetail(null);
                  setApprovalError(null);
                }}
                className={miniBtn}
                aria-label="Tutup"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            {detailLoading && <p className="mt-4 text-sm text-slate-500">Memuat detail...</p>}
            {approvalError && (
              <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {approvalError}
              </p>
            )}

            {detail && (
              <>
                <div className="mt-4 space-y-2">
                  {detail.items.map((item) => (
                    <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[#1F2937]">
                          <span className="font-mono text-xs text-slate-500">{item.item.kode}</span> {item.item.nama}
                        </p>
                        <p className="text-xs text-slate-500">
                          Diminta {item.jumlah.toLocaleString("id-ID")} {item.satuan ?? item.item.unit} · WIP{" "}
                          {angka(item.wipTersedia ?? 0).toLocaleString("id-ID")}
                        </p>
                      </div>
                      <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-600">
                        Disetujui
                        <input
                          type="number"
                          min={0}
                          max={item.jumlah}
                          step={1}
                          value={approvalJumlah[item.id] ?? ""}
                          onChange={(event) =>
                            setApprovalJumlah((prev) => ({ ...prev, [item.id]: event.target.value }))
                          }
                          className={`${FIELD} w-28 py-1.5`}
                        />
                        {item.satuan ?? item.item.unit}
                      </label>
                    </div>
                  ))}
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  Setujui sebagian dengan menurunkan jumlah. Jumlah 0 untuk semua item akan menolak transfer.
                </p>

                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => void kirimApproval("DITOLAK")}
                    disabled={approvalSaving}
                    className={`${miniBtn} h-[46px] px-4 text-rose-700 ring-rose-200 hover:bg-rose-50`}
                  >
                    Tolak
                  </button>
                  <button
                    type="button"
                    onClick={() => void kirimApproval("DISETUJUI")}
                    disabled={approvalSaving}
                    className={`${btnPrimary} disabled:opacity-50`}
                  >
                    {approvalSaving ? "Memproses..." : "Setujui transfer"}
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
