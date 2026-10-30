import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  claimWipReject,
  createWipRejectReason,
  createWipRejectRepairAttempt,
  getQualityDailyReport,
  getWipRejectOptions,
  inspectFinalWip,
  listWipRejects,
  reviewWipRejectRepair,
  type QualityDailyReport,
  type WipReject,
  type WipRejectOptions,
} from "../../api/erp";
import { getUser, getUserPermissions } from "../../api/auth";
import { getDivisi, type Divisi } from "../../api/divisi";

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

type RepairForm = { attempted: string; repaired: string; outputItemId: string; notes: string };

type Props = {
  selectedDivisionId?: number | null;
};

export default function QualityControl({ selectedDivisionId }: Props) {
  const user = getUser();
  const permissions = getUserPermissions();
  const isAdmin = user?.role === "admin";
  const isQcRole = isAdmin || user?.role === "qc";
  const canRepairWork = isAdmin || user?.role === "produksi" || permissions.includes("REPAIR_WORK");
  const canQualityInspect = isQcRole && (isAdmin || permissions.includes("QUALITY_INSPECT"));
  const canReview = isQcRole && (isAdmin || permissions.includes("QUALITY_FINALIZE"));
  const [adminDivisions, setAdminDivisions] = useState<Divisi[]>([]);
  const [adminDivisionId, setAdminDivisionId] = useState<number | null>(null);
  const repairDivisionId = isAdmin
    ? selectedDivisionId !== undefined
      ? selectedDivisionId
      : adminDivisionId
    : user?.divisiId ?? null;
  const canRepair = isAdmin
    ? repairDivisionId !== null
    : canRepairWork && !isQcRole;
  const [options, setOptions] = useState<WipRejectOptions | null>(null);
  const [rejects, setRejects] = useState<WipReject[]>([]);
  const [report, setReport] = useState<QualityDailyReport | null>(null);
  const [reportDate, setReportDate] = useState(today);
  const [itemId, setItemId] = useState("");
  const [passedQuantity, setPassedQuantity] = useState("");
  const [rejectQuantity, setRejectQuantity] = useState("");
  const [reasonId, setReasonId] = useState("");
  const [repairStageId, setRepairStageId] = useState("");
  const [newReason, setNewReason] = useState("");
  const [repairForms, setRepairForms] = useState<Record<number, RepairForm>>({});
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    let activeRepairDivisionId = isAdmin
      ? selectedDivisionId !== undefined
        ? selectedDivisionId
        : adminDivisionId
      : undefined;
    if (isAdmin && selectedDivisionId === undefined) {
      const divisions = await getDivisi();
      setAdminDivisions(divisions);
      if (!activeRepairDivisionId) {
        const storedId = Number(localStorage.getItem("rsv_divisi_workspace"));
        activeRepairDivisionId =
          divisions.find((division) => division.id === storedId)?.id ??
          divisions[0]?.id;
        setAdminDivisionId(activeRepairDivisionId ?? null);
      }
    }
    const [nextOptions, nextRejects, nextReport] = await Promise.all([
      canQualityInspect ? getWipRejectOptions() : Promise.resolve(null),
      (canQualityInspect || canRepair)
        ? listWipRejects(
            canReview ? undefined : "ACTIVE",
            isAdmin ? activeRepairDivisionId ?? undefined : undefined,
          )
        : Promise.resolve([]),
      canQualityInspect ? getQualityDailyReport(reportDate) : Promise.resolve(null),
    ]);
    setOptions(nextOptions);
    setRejects(nextRejects);
    setReport(nextReport);
  }, [
    adminDivisionId,
    canQualityInspect,
    canRepair,
    canReview,
    isAdmin,
    reportDate,
    selectedDivisionId,
  ]);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load data when role or date changes
    load().catch((reason: unknown) => {
      if (!active) return;
      setError(reason instanceof Error ? reason.message : "Gagal memuat data QC Akhir.");
    });
    return () => { active = false; };
  }, [load]);

  const queue = useMemo(
    () => rejects.filter((reject) => canReview
      ? reject.status === "WAITING_QC" || reject.status === "OPEN" || reject.status === "IN_PROGRESS" || reject.status === "COMPLETED"
      : reject.status === "OPEN" || reject.status === "IN_PROGRESS" || reject.status === "WAITING_QC"),
    [canReview, rejects],
  );
  const selectedFinalItem = options?.items.find((item) => item.id === Number(itemId));
  const inspectionTotal = Number(passedQuantity || 0) + Number(rejectQuantity || 0);
  const exceedsAvailable = selectedFinalItem !== undefined &&
    inspectionTotal > selectedFinalItem.availableQuantity;

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
    if (!itemId || (!passedQuantity && !rejectQuantity)) return;
    if (exceedsAvailable) {
      setError("Jumlah lolos dan reject melebihi stok hasil produksi yang tersedia.");
      return;
    }
    const rejected = Number(rejectQuantity || 0);
    if (rejected > 0 && (!reasonId || !repairStageId)) return;
    const saved = await runAction("final-inspection", () => inspectFinalWip({
      itemId: Number(itemId),
      passedQuantity: Number(passedQuantity || 0),
      rejectedQuantity: rejected,
      ...(rejected > 0 ? {
        reasonId: Number(reasonId),
        repairStageId: Number(repairStageId),
      } : {}),
    }), rejected > 0
      ? `Pemeriksaan tersimpan. ${passedQuantity || 0} lolos dipindahkan ke lokasi QC dan ${rejected} reject dikirim ke divisi repair.`
      : `Pemeriksaan tersimpan. ${passedQuantity} lolos QC dan dipindahkan ke lokasi inventori divisi QC.`);
    if (saved) {
      setPassedQuantity("");
      setRejectQuantity("");
      setReasonId("");
      setRepairStageId("");
      setItemId("");
    }
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
    const form = repairForms[reject.id] ?? { attempted: "", repaired: "", outputItemId: "", notes: "" };
    const saved = await runAction(`repair-${reject.id}`, () => createWipRejectRepairAttempt(reject.id, {
      ...(isAdmin && repairDivisionId !== null ? { divisionId: repairDivisionId } : {}),
      quantityAttempted: Number(form.attempted),
      quantityRepaired: Number(form.repaired),
      ...(Number(form.repaired) > 0 && reject.repairStage
        ? { outputItemId: Number(form.outputItemId) }
        : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    }), Number(form.repaired) > 0
      ? reject.repairStage
        ? "Hasil repair tercatat dan diteruskan ke tahap routing berikutnya."
        : "Hasil repair dikirim ke QC untuk diperiksa."
      : "Hasil pekerjaan dicatat. Reject kembali ke antrean repair.");
    if (saved) setRepairForms((current) => ({ ...current, [reject.id]: { attempted: "", repaired: "", outputItemId: "", notes: "" } }));
  }

  const setRepairForm = (rejectId: number, update: Partial<RepairForm>) => {
    setRepairForms((current) => {
      const previous = current[rejectId] ?? { attempted: "", repaired: "", outputItemId: "", notes: "" };
      return { ...current, [rejectId]: { ...previous, ...update } };
    });
  };

  const normalLines = report?.normalOutput ?? [];
  const repairLines = report?.repairOutput ?? [];

  const chooseAdminDivision = (divisionId: number) => {
    setAdminDivisionId(divisionId);
    localStorage.setItem("rsv_divisi_workspace", String(divisionId));
  };

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#00A8E8]">Kualitas & WIP</p>
        <h1 className="mt-1 text-2xl font-bold text-[#1E3A5F]">QC Akhir & Repair</h1>
        <p className="mt-1 text-sm text-slate-600">
          Periksa output tahap terakhir routing. Catat jumlah yang lolos dan reject; reject akan dikirim ke divisi repair pilihan Anda.
          {isQcRole && user?.name ? ` Petugas QC: ${user.name}.` : ""}
        </p>
      </header>

      <section className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
        <h2 className="font-semibold">Alur QC yang tersedia saat ini</h2>
        <ol className="mt-2 list-inside list-decimal space-y-1">
          <li>QC memilih item output tahap terakhir, lalu mencatat jumlah lolos dan reject.</li>
          <li>Untuk reject, QC wajib memilih alasan dan tahap/divisi tempat proses diulang.</li>
          <li>Petugas divisi terpilih mengambil tugas dan mencatat output rework; output lalu meneruskan routing sampai diperiksa QC di tahap terakhir.</li>
        </ol>
        <p className="mt-2">
          QC 2 setelah Perakitan belum tersedia: routing aktif saat ini belum memiliki tahap Perakitan dan belum mencatat output varian Assembly.
        </p>
        <p className="mt-2">
          Reject pada alur ini adalah rework melalui routing. Repair lokal untuk cacat kecil dengan pemeriksaan QC 2 ulang belum tersedia.
        </p>
        {canQualityInspect && canReview && (
          <p className="mt-2">
            Akun QC mengisi pemeriksaan. Petugas yang ditugaskan dapat mengerjakan repair melalui formulir pada daftar tugas di bawah.
          </p>
        )}
      </section>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

      {isAdmin && selectedDivisionId === undefined && (
        <label className="block max-w-sm text-sm font-medium text-slate-700">
          Divisi kerja rework
          <select
            className={field}
            value={adminDivisionId ?? ""}
            onChange={(event) => chooseAdminDivision(Number(event.target.value))}
          >
            <option value="">Pilih divisi kerja</option>
            {adminDivisions
              .filter((division) => division.nama.toLocaleLowerCase("id-ID") !== "qc")
              .map((division) => (
                <option key={division.id} value={division.id}>{division.nama}</option>
              ))}
          </select>
        </label>
      )}

      {canQualityInspect && (
        <>
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
            <form onSubmit={submitReject} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">1. Periksa hasil produksi</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Pilih item dari tahap terakhir routing dan bagi jumlahnya menjadi lolos atau reject.
                  Barang yang lolos masuk ke lokasi inventori divisi QC.
                </p>
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Item output tahap terakhir yang tersedia
                <select className={field} value={itemId} onChange={(event) => setItemId(event.target.value)} required>
                  <option value="">Pilih item untuk diperiksa</option>
                  {options?.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nama} ({item.kode}) — tersedia {quantity(item.availableQuantity)} {item.unit}
                    </option>
                  ))}
                </select>
                {options?.items.length === 0 && (
                  <span className="mt-1 block text-xs text-amber-700">
                    Belum ada stok output tahap terakhir routing aktif yang menunggu QC.
                  </span>
                )}
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Jumlah lolos QC
                  <input className={field} type="number" min="0" max={selectedFinalItem?.availableQuantity} step="1" value={passedQuantity}
                    onChange={(event) => setPassedQuantity(event.target.value)} placeholder="Contoh: 8" />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Jumlah reject
                  <input className={field} type="number" min="0" max={selectedFinalItem?.availableQuantity} step="1" value={rejectQuantity}
                    onChange={(event) => setRejectQuantity(event.target.value)} placeholder="Contoh: 2" />
                </label>
              </div>
              {selectedFinalItem && (
                <p className={`text-xs ${exceedsAvailable ? "text-red-700" : "text-slate-500"}`}>
                  Diperiksa: {quantity(inspectionTotal)} / tersedia: {quantity(selectedFinalItem.availableQuantity)} {selectedFinalItem.unit}
                  {exceedsAvailable ? " — jumlah melebihi stok." : ""}
                </p>
              )}
              {Number(rejectQuantity) > 0 && (
                <div className="grid gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-slate-700">
                    Alasan reject
                    <select className={field} value={reasonId} onChange={(event) => setReasonId(event.target.value)} required>
                      <option value="">Pilih alasan reject</option>
                      {options?.reasons.map((reason) => (
                        <option key={reason.id} value={reason.id}>{reason.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Tahap mulai rework
                    <select className={field} value={repairStageId} onChange={(event) => setRepairStageId(event.target.value)} required>
                      <option value="">Pilih tahap dan divisi</option>
                      {selectedFinalItem?.repairStages.filter((stage) => stage.outputItems.length > 0).map((stage) => (
                        <option key={stage.id} value={stage.id}>{stage.stage} — {stage.divisionName}</option>
                      ))}
                    </select>
                  </label>
                  <p className="text-xs text-amber-900 sm:col-span-2">
                    Rework berarti proses produksi diulang dari tahap terpilih. Barang masuk ke antrean divisi tersebut; setelah dikerjakan, hasilnya dicatat sebagai output tahap
                    dan diteruskan melalui divisi routing berikutnya. QC memeriksa kembali setelah tahap terakhir.
                  </p>
                </div>
              )}
              <p className="text-xs text-slate-500">
                Alur: produksi menyelesaikan tahap terakhir → QC mencatat lolos/reject → repair mengulang dari tahap terpilih
                → routing berlanjut → QC akhir memeriksa kembali.
                Lolos + reject tidak boleh melebihi jumlah tersedia. Petugas QC dicatat otomatis.
              </p>
              <button className={primaryButton} type="submit" disabled={busyKey !== null || !itemId || (!passedQuantity && !rejectQuantity) || exceedsAvailable}>
                Simpan hasil pemeriksaan
              </button>
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
                <h2 className="text-lg font-semibold text-slate-900">2. Periksa hasil repair</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Setujui hasil yang sudah sesuai. Jika belum sesuai, kembalikan ke antrean divisi repair untuk dikerjakan ulang.
                </p>
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
            <p className="mt-1 text-sm text-slate-500">
              Ambil tugas terlebih dahulu. Setelah tugas diambil oleh akun Anda, form input jumlah yang diperiksa, jumlah yang berhasil diperbaiki, output, dan catatan akan muncul pada kartu tugas.
            </p>
            {isAdmin && repairDivisionId !== null && (
              <p className="mt-1 text-xs font-medium text-sky-800">
                Divisi kerja aktif: {adminDivisions.find((division) => division.id === repairDivisionId)?.nama ?? `#${repairDivisionId}`}
              </p>
            )}
          </div>
          {queue.length === 0 ? <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Belum ada reject untuk divisi Anda.</p> : (
            <div className="space-y-3">
              {queue.map((reject) => {
                const form = repairForms[reject.id] ?? { attempted: "", repaired: "", outputItemId: "", notes: "" };
                const ownsTask = reject.claimedBy?.id === user?.id;
                return (
                  <RejectCard key={reject.id} reject={reject} canReview={false} canRepair
                    busyKey={busyKey} onClaim={() => void runAction(
                      `claim-${reject.id}`,
                      () => claimWipReject(reject.id, isAdmin ? repairDivisionId ?? undefined : undefined),
                      "Reject berhasil diambil oleh Anda.",
                    )}
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
  const pendingAttempt = reject.status === "WAITING_QC"
    ? reject.attempts.find((attempt) =>
        attempt.outputItem === null && attempt.reviewApproved === null && !attempt.reviewedAt,
      )
    : undefined;
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
          {reject.repairStage ? ` — ulang dari ${reject.repairStage.stage}` : ""}
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
          <p className="text-sm font-semibold text-sky-900 sm:col-span-2">
            Input hasil repair — isi jumlah yang dikerjakan dan jumlah yang berhasil diperbaiki.
          </p>
          <label className="text-sm font-medium text-slate-700">
            Jumlah yang diperiksa
            <input className={field} type="number" min="1" step="1" required value={repairForm.attempted}
              onChange={(event) => onRepairFormChange({ attempted: event.target.value })} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Berhasil diperbaiki
            <input className={field} type="number" min="0" step="1" required value={repairForm.repaired}
              onChange={(event) => onRepairFormChange({ repaired: event.target.value })} />
          </label>
          {reject.repairStage && (
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              Output repair untuk tahap ini
              <select
                className={field}
                value={repairForm.outputItemId}
                onChange={(event) => onRepairFormChange({ outputItemId: event.target.value })}
                required={Number(repairForm.repaired) > 0}
              >
                <option value="">Pilih item output</option>
                {reject.repairStage.outputItems.map(({ item }) => (
                  <option key={item.id} value={item.id}>{item.nama} ({item.kode})</option>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Item ini akan tersedia di {reject.repairDivision.nama}; transfer ke divisi berikutnya sesuai routing.
              </span>
            </label>
          )}
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
                {attempt.outputItem ? `; output ${attempt.outputItem.nama}` : ""}
                {attempt.outputItem
                  ? (
                    "; output tercatat sebagai WIP untuk proses routing berikutnya."
                  )
                  : attempt.reviewedAt
                    ? `; ${attempt.reviewApproved ? "disetujui QC" : "perlu repair ulang"}`
                    : "; menunggu QC"}
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
