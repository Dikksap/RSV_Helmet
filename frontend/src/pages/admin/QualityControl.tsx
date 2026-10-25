import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  claimWipReject,
  createWipReject,
  createWipRejectReason,
  createWipRejectRepairAttempt,
  getQualityDailyReport,
  getWipRejectOptions,
  listWipRejects,
  reviewWipRejectRepair,
  type QualityDailyReport,
  type WipReject,
  type WipRejectOptions,
} from "../../api/erp";
import { getUser, getUserPermissions } from "../../api/auth";

const field = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";
const primaryButton = "rounded-lg bg-[#00A8E8] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = "rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50";

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function quantity(value: number | string) {
  return Number(value).toLocaleString("id-ID", { maximumFractionDigits: 3 });
}

function dateTime(value: string) {
  return new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

const statusLabel: Record<WipReject["status"], string> = {
  OPEN: "Menunggu dikerjakan",
  IN_PROGRESS: "Sedang diperbaiki",
  WAITING_QC: "Menunggu pemeriksaan QC",
  COMPLETED: "Selesai",
};

type RepairForm = { attempted: string; repaired: string; notes: string };

export default function QualityControl() {
  const user = getUser();
  const permissions = getUserPermissions();
  const isAdmin = user?.role === "admin";
  const isQcRole = isAdmin || user?.role === "qc";
  const canQualityInspect = isQcRole && (isAdmin || permissions.includes("QUALITY_INSPECT"));
  const canReview = isQcRole && (isAdmin || permissions.includes("QUALITY_FINALIZE"));
  const canRepair = permissions.includes("REPAIR_WORK") && !isQcRole;
  const [options, setOptions] = useState<WipRejectOptions | null>(null);
  const [rejects, setRejects] = useState<WipReject[]>([]);
  const [report, setReport] = useState<QualityDailyReport | null>(null);
  const [reportDate, setReportDate] = useState(today);
  const [itemId, setItemId] = useState("");
  const [rejectQuantity, setRejectQuantity] = useState("");
  const [reasonId, setReasonId] = useState("");
  const [repairDivisionId, setRepairDivisionId] = useState("");
  const [newReason, setNewReason] = useState("");
  const [repairForms, setRepairForms] = useState<Record<number, RepairForm>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [nextOptions, nextRejects, nextReport] = await Promise.all([
      canQualityInspect ? getWipRejectOptions() : Promise.resolve(null),
      (canQualityInspect || canRepair) ? listWipRejects() : Promise.resolve([]),
      canQualityInspect ? getQualityDailyReport(reportDate) : Promise.resolve(null),
    ]);
    setOptions(nextOptions);
    setRejects(nextRejects);
    setReport(nextReport);
  }, [canQualityInspect, canRepair, reportDate]);

  useEffect(() => {
    load().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Gagal memuat data QC Akhir.");
    });
  }, [load]);

  const queue = useMemo(
    () => rejects.filter((reject) => canReview
      ? reject.status === "WAITING_QC" || reject.status === "OPEN" || reject.status === "IN_PROGRESS" || reject.status === "COMPLETED"
      : reject.status === "OPEN" || reject.status === "IN_PROGRESS" || reject.status === "WAITING_QC"),
    [canReview, rejects],
  );

  async function runAction(key: string, action: () => Promise<unknown>, successMessage: string): Promise<boolean> {
    setBusyKey(key);
    setError(null);
    setNotice(null);
    try {
      await action();
      await load();
      setNotice(successMessage);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Tindakan gagal disimpan.");
      return false;
    } finally {
      setBusyKey(null);
    }
  }

  async function submitReject(event: FormEvent) {
    event.preventDefault();
    if (!itemId || !reasonId || !repairDivisionId || !rejectQuantity) return;
    const saved = await runAction("create-reject", () => createWipReject({
      itemId: Number(itemId),
      quantity: Number(rejectQuantity),
      reasonId: Number(reasonId),
      repairDivisionId: Number(repairDivisionId),
    }), "Reject dicatat dan sudah dikirim ke antrean divisi repair.");
    if (saved) setRejectQuantity("");
  }

  async function submitReason(event: FormEvent) {
    event.preventDefault();
    const clean = newReason.trim();
    if (!clean) return;
    const saved = await runAction("create-reason", () => createWipRejectReason(clean), "Alasan reject ditambahkan.");
    if (saved) setNewReason("");
  }

  async function submitRepair(event: FormEvent, reject: WipReject) {
    event.preventDefault();
    const form = repairForms[reject.id] ?? { attempted: "", repaired: "", notes: "" };
    const saved = await runAction(`repair-${reject.id}`, () => createWipRejectRepairAttempt(reject.id, {
      quantityAttempted: Number(form.attempted),
      quantityRepaired: Number(form.repaired),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    }), Number(form.repaired) > 0
      ? "Hasil repair dikirim ke QC untuk diperiksa."
      : "Hasil pekerjaan dicatat. Reject kembali ke antrean repair.");
    if (saved) setRepairForms((current) => ({ ...current, [reject.id]: { attempted: "", repaired: "", notes: "" } }));
  }

  const setRepairForm = (rejectId: number, update: Partial<RepairForm>) => {
    setRepairForms((current) => ({
      ...current,
      [rejectId]: { attempted: "", repaired: "", notes: "", ...current[rejectId], ...update },
    }));
  };

  const normalLines = report?.normalOutput ?? [];
  const repairLines = report?.repairOutput ?? [];

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#00A8E8]">Kualitas & WIP</p>
        <h1 className="mt-1 text-2xl font-bold text-[#1E3A5F]">QC Akhir & Repair</h1>
        <p className="mt-1 text-sm text-slate-600">
          Catat item Top Coat yang reject, teruskan ke divisi repair, lalu periksa kembali hasil perbaikannya.
          {isQcRole && user?.name ? ` Petugas QC: ${user.name}.` : ""}
        </p>
      </header>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

      {canQualityInspect && (
        <>
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
            <form onSubmit={submitReject} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Tambah reject QC</h2>
                <p className="mt-1 text-sm text-slate-500">Petugas dicatat otomatis dari akun yang sedang masuk.</p>
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Item Top Coat
                <select className={field} value={itemId} onChange={(event) => setItemId(event.target.value)} required>
                  <option value="">Pilih item Top Coat</option>
                  {options?.items.map((item) => (
                    <option key={item.id} value={item.id}>{item.nama} ({item.kode})</option>
                  ))}
                </select>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Jumlah reject
                  <input className={field} type="number" min="0.000001" step="0.001" value={rejectQuantity}
                    onChange={(event) => setRejectQuantity(event.target.value)} placeholder="Contoh: 2" required />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Alasan reject
                  <select className={field} value={reasonId} onChange={(event) => setReasonId(event.target.value)} required>
                    <option value="">Pilih alasan</option>
                    {options?.reasons.map((reason) => (
                      <option key={reason.id} value={reason.id}>{reason.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Divisi yang melakukan repair
                <select className={field} value={repairDivisionId} onChange={(event) => setRepairDivisionId(event.target.value)} required>
                  <option value="">Pilih divisi repair</option>
                  {options?.divisions.map((division) => (
                    <option key={division.id} value={division.id}>{division.nama}</option>
                  ))}
                </select>
              </label>
              <button className={primaryButton} type="submit" disabled={busyKey !== null}>Simpan dan kirim ke antrean repair</button>
            </form>

            <form onSubmit={submitReason} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Alasan reject</h2>
                <p className="mt-1 text-sm text-slate-500">Tambahkan alasan baru agar tersedia sebagai pilihan berikutnya.</p>
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Alasan baru
                <input className={field} value={newReason} onChange={(event) => setNewReason(event.target.value)}
                  placeholder="Contoh: Lapisan cat tidak rata" maxLength={191} />
              </label>
              <button className={secondaryButton} type="submit" disabled={busyKey !== null || !newReason.trim()}>
                Tambahkan alasan
              </button>
              <ul className="max-h-40 space-y-1 overflow-auto text-sm text-slate-600">
                {options?.reasons.map((reason) => <li key={reason.id}>• {reason.name}</li>)}
              </ul>
            </form>
          </section>

          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Antrean reject & pemeriksaan repair</h2>
                <p className="mt-1 text-sm text-slate-500">QC memeriksa hasil repair sebelum jumlah dinyatakan selesai.</p>
              </div>
              <button type="button" className={secondaryButton} onClick={() => void load()} disabled={busyKey !== null}>Muat ulang</button>
            </div>
            {queue.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Belum ada reject WIP.</p> : (
              <div className="space-y-3">
                {queue.map((reject) => (
                  <RejectCard key={reject.id} reject={reject} canReview={canReview} canRepair={false}
                    busyKey={busyKey} reviewNote={reviewNotes[reject.id] ?? ""}
                    onReviewNote={(value) => setReviewNotes((current) => ({ ...current, [reject.id]: value }))}
                    onReview={(attemptId, approved) => void runAction(
                      `review-${attemptId}`,
                      () => reviewWipRejectRepair(reject.id, attemptId, {
                        approved,
                        ...(reviewNotes[reject.id]?.trim() ? { notes: reviewNotes[reject.id].trim() } : {}),
                      }),
                      approved ? "QC menyetujui hasil repair." : "Hasil dikembalikan ke divisi repair.",
                    )}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Laporan produksi harian</h2>
                <p className="mt-1 text-sm text-slate-500">Ringkasan hasil produksi normal dan repair yang sudah disetujui QC.</p>
              </div>
              <label className="text-sm font-medium text-slate-700">
                Tanggal
                <input className={field} type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value)} />
              </label>
            </div>
            {report && (
              <div className="grid gap-5 lg:grid-cols-2">
                <OutputTable title="Produksi normal" rows={normalLines} total={report.normalTotal} empty="Belum ada hasil produksi normal." />
                <OutputTable title="Hasil repair disetujui QC" rows={repairLines} total={report.repairTotal} empty="Belum ada hasil repair yang disetujui." />
              </div>
            )}
          </section>
        </>
      )}

      {canRepair && (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Antrean repair divisi</h2>
            <p className="mt-1 text-sm text-slate-500">Ambil reject, catat jumlah yang diperiksa dan jumlah yang berhasil diperbaiki.</p>
          </div>
          {queue.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Belum ada reject untuk divisi Anda.</p> : (
            <div className="space-y-3">
              {queue.map((reject) => {
                const form = repairForms[reject.id] ?? { attempted: "", repaired: "", notes: "" };
                const ownsTask = reject.claimedBy?.id === user?.id;
                return (
                  <RejectCard key={reject.id} reject={reject} canReview={false} canRepair
                    busyKey={busyKey} onClaim={() => void runAction(`claim-${reject.id}`, () => claimWipReject(reject.id), "Reject berhasil diambil oleh Anda.")}
                    ownTask={ownsTask}
                    repairForm={form}
                    onRepairFormChange={(update) => setRepairForm(reject.id, update)}
                    onRepair={(event) => void submitRepair(event, reject)}
                    onReviewNote={() => undefined}
                    onReview={() => undefined}
                  />
                );
              })}
            </div>
          )}
        </section>
      )}

      {!canQualityInspect && !canRepair && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Akun ini belum memiliki akses QC Akhir atau pekerjaan repair. Hubungi admin untuk mengatur permission.
        </p>
      )}
    </main>
  );
}

function RejectCard({
  reject,
  canReview,
  canRepair,
  busyKey,
  reviewNote = "",
  onReviewNote,
  onReview,
  onClaim,
  ownTask = false,
  repairForm,
  onRepairFormChange,
  onRepair,
}: {
  reject: WipReject;
  canReview: boolean;
  canRepair: boolean;
  busyKey: string | null;
  reviewNote?: string;
  onReviewNote: (value: string) => void;
  onReview: (attemptId: number, approved: boolean) => void;
  onClaim?: () => void;
  ownTask?: boolean;
  repairForm?: RepairForm;
  onRepairFormChange?: (update: Partial<RepairForm>) => void;
  onRepair?: (event: FormEvent) => void;
}) {
  const pendingAttempt = reject.attempts.find((attempt) => attempt.reviewApproved === null && !attempt.reviewedAt);
  const canClaim = canRepair && reject.status === "OPEN" && !reject.claimedBy;
  const isBusy = busyKey !== null;
  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">{reject.item.nama} <span className="font-normal text-slate-500">({reject.item.kode})</span></h3>
          <p className="mt-1 text-sm text-slate-600">
            Reject {quantity(reject.quantity)} {reject.item.unit} · sisa belum selesai {quantity(reject.quantityRemaining)} {reject.item.unit}
            · {reject.reason.name} · Repair: {reject.repairDivision.nama}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Dicatat {dateTime(reject.createdAt)} oleh {reject.recordedBy.name} · {statusLabel[reject.status]}
          </p>
          {reject.claimedBy && <p className="mt-1 text-xs text-slate-500">Diambil oleh {reject.claimedBy.name}</p>}
        </div>
        {canClaim && <button type="button" className={primaryButton} onClick={onClaim} disabled={isBusy}>Ambil pekerjaan</button>}
      </div>

      {pendingAttempt && (
        <div className="mt-4 rounded-lg bg-sky-50 p-3">
          <p className="text-sm font-semibold text-sky-950">
            Hasil repair: {quantity(pendingAttempt.quantityRepaired)} {reject.item.unit} dari {quantity(pendingAttempt.quantityAttempted)} diperiksa oleh {pendingAttempt.performedBy.name}
          </p>
          {pendingAttempt.notes && <p className="mt-1 text-sm text-sky-900">{pendingAttempt.notes}</p>}
          {canReview && (
            <div className="mt-3 space-y-2">
              <input className={field} value={reviewNote} onChange={(event) => onReviewNote(event.target.value)}
                placeholder="Catatan QC (opsional)" />
              <div className="flex flex-wrap gap-2">
                <button type="button" className={primaryButton} onClick={() => onReview(pendingAttempt.id, true)} disabled={isBusy}>Setujui repair</button>
                <button type="button" className={secondaryButton} onClick={() => onReview(pendingAttempt.id, false)} disabled={isBusy}>Kembalikan untuk repair ulang</button>
              </div>
            </div>
          )}
        </div>
      )}

      {canRepair && ownTask && reject.status === "IN_PROGRESS" && repairForm && onRepairFormChange && onRepair && (
        <form className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2" onSubmit={onRepair}>
          <label className="text-sm font-medium text-slate-700">
            Jumlah yang diperiksa
            <input className={field} type="number" min="0.000001" step="0.001" required value={repairForm.attempted}
              onChange={(event) => onRepairFormChange({ attempted: event.target.value })} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Berhasil diperbaiki
            <input className={field} type="number" min="0" step="0.001" required value={repairForm.repaired}
              onChange={(event) => onRepairFormChange({ repaired: event.target.value })} />
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            Catatan (opsional)
            <input className={field} value={repairForm.notes} onChange={(event) => onRepairFormChange({ notes: event.target.value })} />
          </label>
          <button className={primaryButton} type="submit" disabled={isBusy}>Simpan hasil repair</button>
        </form>
      )}

      {reject.attempts.length > 0 && (
        <details className="mt-3 text-sm text-slate-600">
          <summary className="cursor-pointer font-medium">Riwayat repair ({reject.attempts.length})</summary>
          <ul className="mt-2 space-y-1 pl-4">
            {reject.attempts.map((attempt) => (
              <li key={attempt.id}>
                {dateTime(attempt.performedAt)} — {quantity(attempt.quantityRepaired)} {reject.item.unit} berhasil
                {attempt.reviewedAt ? `; ${attempt.reviewApproved ? "disetujui QC" : "perlu repair ulang"}` : "; menunggu QC"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

function OutputTable({
  title,
  rows,
  total,
  empty,
}: {
  title: string;
  rows: QualityDailyReport["normalOutput"];
  total: number;
  empty: string;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200">
      <div className="flex items-center justify-between bg-slate-50 px-4 py-3">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        <span className="text-sm font-bold text-[#1E3A5F]">{quantity(total)} pcs</span>
      </div>
      {rows.length === 0 ? <p className="p-4 text-sm text-slate-500">{empty}</p> : (
        <div className="divide-y divide-slate-100">
          {rows.map((row) => (
            <div key={`${row.divisionId}-${row.itemId}`} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-800">{row.divisionName} — {row.itemName}</p>
                <p className="text-xs text-slate-500">{row.itemCode}</p>
              </div>
              <span className="whitespace-nowrap font-semibold text-slate-800">{quantity(row.quantity)} pcs</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
