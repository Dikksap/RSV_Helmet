import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { bulkScanBarang, getScanBarang, type Barang, type BulkScanItemResult, type StatusBarang } from "../../api/barang";
import { DUS_CAPACITY, familyOfDus, nextDusName } from "../../lib/dus";
import { useStatusOptions } from "../../lib/useStatusOptions";
import { beep } from "../../lib/beep";
import { assignBarangToGroup, createBarangGroup, getBarangGroups, type BarangGroup } from "../../api/barangGroup";

type ScannedItem = {
  id: number;
  kode: string;
  variant: string;
  waktu: string;
  loading: boolean;
  targetStatus: StatusBarang;
  pernahRetur?: boolean;
  statusSaved?: boolean;
};

type Toast = { type: "success" | "error"; msg: string };

const MAX_PARALLEL = 5;
const MAX_UPLOAD_CODES = 2000;
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A8E8]";
const CARD = "rounded-xl border border-[#E5E9F0] bg-white";
const FIELD = `h-11 w-full rounded-lg border border-[#E5E9F0] bg-white px-3 text-sm font-medium text-[#0F1C2E] placeholder:text-[#94A3B8] focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/25 disabled:opacity-60`;
const PRIMARY_BTN = `flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#10B981] px-6 text-base font-bold text-white shadow-sm transition hover:bg-[#059669] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none ${FOCUS}`;

function groupByStatus(items: ScannedItem[]): [StatusBarang, string[]][] {
  const m = new Map<StatusBarang, string[]>();
  for (const it of items) m.set(it.targetStatus, [...(m.get(it.targetStatus) ?? []), it.kode]);
  return [...m.entries()];
}

const keyOf = (kode: string) => kode.trim().toLowerCase();
const nowTime = () => new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

function variantName(b: Barang) {
  const v = b.variant;
  return v?.product && v.style && v.color && v.size
    ? `${v.product.nama} ${v.style.nama} ${v.color.nama} ${v.size.nama}`
    : "-";
}

function firstAvailable(groups: BarangGroup[]) {
  return groups.find((g) => !g.isArsip && g._count.barang < DUS_CAPACITY)?.id ?? null;
}

function ScanQr() {
  const [searchParams] = useSearchParams();
  const isDusMode = searchParams.get("mode") === "dus";
  const { options: statusOptions, loading: statusLoading } = useStatusOptions();

  const [rawStatus, setRawStatus] = useState<StatusBarang>(
    () => searchParams.get("status")?.trim().toUpperCase() || "FINISHGOOD",
  );
  const status =
    statusLoading || statusOptions.some((o) => o.value === rawStatus)
      ? rawStatus
      : (statusOptions.find((o) => o.value === "FINISHGOOD") ?? statusOptions[0]).value;
  const statusOpt = (kode: string) => statusOptions.find((o) => o.value === kode);
  const statusLabel = (kode: string) => statusOpt(kode)?.label ?? kode;

  const [groups, setGroups] = useState<BarangGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const [failedItems, setFailedItems] = useState<BulkScanItemResult[]>([]);
  const [showFailed, setShowFailed] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<ScannedItem[]>([]);
  const statusRef = useRef(status);
  const inFlight = useRef(new Set<number>());

  useEffect(() => {
    listRef.current = scannedItems;
  }, [scannedItems]);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (!resetArmed) return;
    const id = window.setTimeout(() => setResetArmed(false), 3000);
    return () => window.clearTimeout(id);
  }, [resetArmed]);

  const notify = useCallback((type: Toast["type"], msg: string) => setToast({ type, msg }), []);
  const focusInput = () => inputRef.current?.focus();

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null;
  const dusFree = activeGroup ? DUS_CAPACITY - activeGroup._count.barang : 0;
  const slotsLeft = isDusMode ? Math.max(0, dusFree - scannedItems.length) : Infinity;
  const scanBlocked = isDusMode && slotsLeft === 0;
  const blockReason = !activeGroup
    ? "Pilih atau buat dus dulu."
    : `${activeGroup.nama} penuh (${DUS_CAPACITY}) — simpan dulu atau buat dus baru.`;
  const needsPengganti = scannedItems.some((it) => it.pernahRetur);
  const dusProblem = !isDusMode
    ? null
    : !activeGroup
      ? "Pilih atau buat dus dulu."
      : scannedItems.length > dusFree
        ? `${activeGroup.nama} hanya muat ${dusFree} lagi — hapus ${scannedItems.length - dusFree} item atau ganti dus.`
        : (familyOfDus(activeGroup.nama) === "pengganti") !== needsPengganti
          ? needsPengganti
            ? "Ada barang pernah retur — pilih atau buat DUS PENGGANTI."
            : "DUS PENGGANTI hanya untuk barang pernah retur — pilih dus biasa."
          : null;

  const applyGroups = useCallback((data: BarangGroup[]) => {
    setGroups(data);
    setActiveGroupId((prev) => {
      const cur = data.find((g) => g.id === prev);
      return cur && !cur.isArsip ? prev : firstAvailable(data);
    });
  }, []);
  const refreshGroups = () => getBarangGroups().then(applyGroups);

  useEffect(() => {
    if (!isDusMode) return;
    getBarangGroups()
      .then(applyGroups)
      .catch((e) => notify("error", errMsg(e, "Gagal memuat daftar dus.")));
  }, [isDusMode, applyGroups, notify]);

  const validateOne = useCallback(
    async (item: ScannedItem) => {
      const barang = await getScanBarang(item.kode).catch(() => null);
      inFlight.current.delete(item.id);
      const drop = (msg: string) => {
        setScannedItems((prev) => prev.filter((it) => it.id !== item.id));
        notify("error", msg);
        beep(false);
      };
      if (!barang) return drop(`Kode ${item.kode} tidak ditemukan.`);
      if (String(barang.status).toUpperCase() === item.targetStatus.toUpperCase()) {
        return drop(`Kode ${item.kode} dilewati — statusnya sudah ${barang.status}.`);
      }
      const kode = barang.kodeBarang;
      const dup = listRef.current.some((it) => it.id !== item.id && !it.loading && keyOf(it.kode) === keyOf(kode));
      if (dup) return drop(`Kode ${item.kode} duplikat — tidak dimasukkan.`);
      const found = barang;
      setScannedItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, id: found.id ?? it.id, kode, variant: variantName(found), loading: false, pernahRetur: found.pernahRetur }
            : it,
        ),
      );
      beep(true);
    },
    [notify],
  );

  useEffect(() => {
    const slots = MAX_PARALLEL - inFlight.current.size;
    if (slots <= 0) return;
    const busy = new Set(scannedItems.filter((it) => inFlight.current.has(it.id)).map((it) => keyOf(it.kode)));
    const batch: ScannedItem[] = [];
    for (const it of [...scannedItems].reverse()) {
      if (batch.length >= slots) break;
      if (!it.loading || inFlight.current.has(it.id) || busy.has(keyOf(it.kode))) continue;
      busy.add(keyOf(it.kode));
      batch.push(it);
    }
    for (const it of batch) {
      inFlight.current.add(it.id);
      void validateOne(it);
    }
  }, [scannedItems, validateOne]);

  const enqueue = (kodes: string[]) =>
    kodes.map<ScannedItem>((kode) => ({
      id: Date.now() + Math.random(),
      kode,
      variant: "Memeriksa...",
      waktu: nowTime(),
      loading: true,
      targetStatus: statusRef.current,
    }));

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    const kode = inputValue.trim();
    setInputValue("");
    focusInput();
    if (!kode) {
      notify("error", "Kode kosong — scan ulang.");
      beep(false);
      return;
    }
    if (scanBlocked) {
      notify("error", blockReason);
      beep(false);
      return;
    }
    if (listRef.current.some((it) => keyOf(it.kode) === keyOf(kode))) {
      notify("error", `Kode ${kode} sudah ada di daftar.`);
      beep(false);
      return;
    }
    setScannedItems((prev) => [...enqueue([kode]), ...prev]);
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    try {
      if (!file) return;
      if (scanBlocked) {
        notify("error", blockReason);
        return;
      }
      if (file.size > 1024 * 1024) {
        notify("error", "File terlalu besar — maksimal 1 MB.");
        return;
      }
      const text = (await file.text()).trim();
      let codes: string[] = [];
      if (text.startsWith("[") && text.endsWith("]")) {
        try {
          const parsed: unknown = JSON.parse(text);
          if (Array.isArray(parsed)) codes = parsed.map((v) => String(v).trim()).filter(Boolean);
        } catch {
          codes = [];
        }
      }
      if (codes.length === 0) codes = text.split(/[\r\n,;]+/).map((s) => s.trim()).filter(Boolean);
      const seen = new Set(listRef.current.map((it) => keyOf(it.kode)));
      const fresh = codes.filter((k) => !seen.has(keyOf(k)) && seen.add(keyOf(k)));
      if (fresh.length === 0) {
        notify("error", "Tidak ada kode baru di file.");
        return;
      }
      const limit = Math.min(MAX_UPLOAD_CODES, slotsLeft);
      const taken = fresh.slice(0, limit);
      setScannedItems((prev) => [...enqueue(taken), ...prev]);
      notify(
        "success",
        fresh.length > limit
          ? `${taken.length} kode masuk antre (batas ${isDusMode ? "sisa dus" : "upload"} ${limit}; ${fresh.length - taken.length} diabaikan).`
          : `${taken.length} kode masuk antre validasi.`,
      );
    } catch {
      notify("error", "Gagal membaca file.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleCreateGroup = async (custom: boolean) => {
    const nama = custom ? newGroupName.trim() : nextDusName(groups, needsPengganti);
    if (!nama) return;
    setCreatingGroup(true);
    try {
      const created = await createBarangGroup(nama);
      setGroups((prev) => [...prev, created]);
      setActiveGroupId(created.id);
      setNewGroupName("");
      notify("success", `Dus "${created.nama}" dibuat.`);
      beep(true);
    } catch (e) {
      notify("error", errMsg(e, "Gagal membuat dus."));
      beep(false);
    } finally {
      setCreatingGroup(false);
    }
  };

  const saveStatuses = async (items: ScannedItem[], onStep: () => void) => {
    const ok = new Set<string>();
    const failed: BulkScanItemResult[] = [];
    for (const [st, kodes] of groupByStatus(items)) {
      const result = await bulkScanBarang(kodes, st, keterangan.trim() || undefined);
      result.success.forEach((s) => ok.add(keyOf(s.kodeBarang)));
      failed.push(...result.failed);
      onStep();
    }
    setFailedItems(failed);
    setShowFailed(failed.length > 0);
    return { ok, failed };
  };

  const handleSave = async () => {
    const items = scannedItems.filter((it) => !it.loading);
    if (items.length === 0 || saving) return;
    if (dusProblem) {
      notify("error", dusProblem);
      beep(false);
      return;
    }
    const target = activeGroup;
    setSaving(true);
    setProgress(0);
    setFailedItems([]);
    try {
      const pending = items.filter((it) => !it.statusSaved);
      let step = 0;
      const total = groupByStatus(pending).length + (isDusMode ? 1 : 0);
      const tick = () => setProgress(Math.round((++step / Math.max(total, 1)) * 100));

      const { ok, failed } = await saveStatuses(pending, tick);

      if (!isDusMode) {
        setScannedItems((prev) => prev.filter((it) => it.loading || !ok.has(keyOf(it.kode))));
        if (failed.length === 0) notify("success", `${ok.size} item tersimpan.`);
        else if (ok.size === 0) notify("error", failed[0].reason ?? failed[0].error ?? `${failed.length} item gagal diproses.`);
        else notify("error", `${ok.size} tersimpan, ${failed.length} gagal — perbaiki lalu simpan ulang.`);
        beep(failed.length === 0);
        return;
      }

      setScannedItems((prev) => prev.map((it) => (ok.has(keyOf(it.kode)) ? { ...it, statusSaved: true } : it)));
      const ready = items.filter((it) => it.statusSaved || ok.has(keyOf(it.kode)));
      if (ready.length === 0 || !target) {
        notify("error", "Tidak ada item yang berhasil disimpan.");
        beep(false);
        return;
      }

      await assignBarangToGroup(target.id, ready.map((it) => it.id));
      const keys = new Set(ready.map((it) => keyOf(it.kode)));
      setScannedItems((prev) => prev.filter((it) => !keys.has(keyOf(it.kode))));
      tick();
      notify(
        failed.length ? "error" : "success",
        `${ready.length} item masuk ${target.nama}${failed.length ? ` · ${failed.length} gagal` : ""}.`,
      );
      beep(failed.length === 0);
    } catch (e) {
      notify("error", `${errMsg(e, "Gagal menyimpan.")} Item tetap di daftar — tekan Simpan lagi.`);
      beep(false);
    } finally {
      if (isDusMode) await refreshGroups().catch(() => undefined);
      setSaving(false);
      setProgress(0);
      focusInput();
    }
  };

  const handleReset = () => {
    if (scannedItems.length === 0) return;
    if (!resetArmed) {
      setResetArmed(true);
      return;
    }
    setResetArmed(false);
    setScannedItems([]);
    setFailedItems([]);
    focusInput();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const input = inputRef.current;
      if (!input || input.disabled) return;
      const target = event.target as HTMLElement | null;
      if (target && (["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A", "SUMMARY"].includes(target.tagName) || target.isContentEditable)) return;
      if (event.key === "Enter") return input.focus();
      if (event.key.length === 1) {
        event.preventDefault();
        input.focus();
        setInputValue((v) => v + event.key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const loadingCount = scannedItems.filter((it) => it.loading).length;
  const validItems = scannedItems.filter((it) => !it.loading);
  const validCount = validItems.length;
  const visibleGroups = groups.filter((g) => !g.isArsip);
  const perVariant = Object.entries(
    validItems.reduce<Record<string, number>>((acc, it) => ({ ...acc, [it.variant]: (acc[it.variant] ?? 0) + 1 }), {}),
  );
  const last = scannedItems[0];

  const statusBadge = (kode: string) => {
    const warna = statusOpt(kode)?.warna;
    return (
      <span
        className={`inline-flex shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${warna ? "text-white" : "bg-slate-100 text-slate-600"}`}
        style={warna ? { backgroundColor: warna } : undefined}
      >
        {statusLabel(kode)}
      </span>
    );
  };

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col bg-[#F6F8FB] pb-28 font-[Inter,sans-serif] text-[#0F1C2E] antialiased lg:h-[calc(100dvh-3.5rem)] lg:overflow-hidden lg:pb-0">
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
          <div
            role={toast.type === "error" ? "alert" : "status"}
            aria-live={toast.type === "error" ? "assertive" : "polite"}
            className={`pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-xl border bg-white px-4 py-3 text-sm font-medium shadow-[0_12px_32px_rgba(15,28,46,0.15)] ${
              toast.type === "error" ? "border-[#EF4444]/40" : "border-[#10B981]/40"
            }`}
          >
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold text-white ${
                toast.type === "error" ? "bg-[#EF4444]" : "bg-[#10B981]"
              }`}
              aria-hidden="true"
            >
              {toast.type === "error" ? "!" : "✓"}
            </span>
            <span className="flex-1 leading-snug">{toast.msg}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Tutup notifikasi"
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 ${FOCUS}`}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex flex-col border-[#E5E9F0] bg-white lg:w-[400px] lg:shrink-0 lg:border-r">
          <div className="flex-1 space-y-5 p-4 sm:p-5 lg:overflow-y-auto">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-lg font-bold">Scan Barang</h1>
              <span className="rounded-full bg-[#00A8E8]/10 px-2.5 py-1 text-xs font-semibold text-[#0088C0]">
                {isDusMode ? `Per Dus · ${DUS_CAPACITY}/dus` : "Semua Barang"}
              </span>
            </div>

            <section>
              <p id="status-label" className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#64748B]">
                Status tujuan
              </p>
              <div role="radiogroup" aria-labelledby="status-label" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5 lg:mx-0 lg:flex-wrap lg:px-0">
                {statusOptions.map((o) => {
                  const on = o.value === status;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={saving}
                      onClick={() => setRawStatus(o.value)}
                      className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition disabled:opacity-50 ${FOCUS} ${
                        on ? "border-[#1E3A5F] bg-[#1E3A5F] text-white" : "border-[#E5E9F0] bg-white text-[#475569] hover:border-[#1E3A5F]/40"
                      }`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full ring-2 ring-white/60" style={{ backgroundColor: o.warna ?? "#94A3B8" }} />
                      {o.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-[#64748B]">Berlaku untuk scan berikutnya.</p>
            </section>

            {isDusMode && (
              <section className={`${CARD} p-3.5`}>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="dus-select" className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64748B]">
                    Dus aktif
                  </label>
                  {activeGroup && (
                    <span className={`text-xs font-semibold tabular-nums ${slotsLeft === 0 ? "text-[#EF4444]" : "text-[#475569]"}`}>
                      {activeGroup._count.barang + scannedItems.length}/{DUS_CAPACITY}
                      {slotsLeft === 0 && " · PENUH"}
                    </span>
                  )}
                </div>
                <select
                  id="dus-select"
                  value={activeGroupId ?? ""}
                  onChange={(e) => setActiveGroupId(e.target.value ? Number(e.target.value) : null)}
                  disabled={saving}
                  className={`${FIELD} mt-2`}
                >
                  <option value="">{visibleGroups.length === 0 ? "Belum ada dus — buat dulu" : "— Pilih dus —"}</option>
                  {visibleGroups.map((g) => (
                    <option key={g.id} value={g.id} disabled={g._count.barang >= DUS_CAPACITY && g.id !== activeGroupId}>
                      {g.nama} — {g._count.barang}/{DUS_CAPACITY}
                    </option>
                  ))}
                </select>
                {activeGroup && (
                  <>
                    <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                      <div className="h-full bg-[#1E3A5F]" style={{ width: `${(activeGroup._count.barang / DUS_CAPACITY) * 100}%` }} />
                      <div
                        className="h-full bg-[#10B981] transition-all"
                        style={{ width: `${(Math.min(scannedItems.length, dusFree) / DUS_CAPACITY) * 100}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-[#64748B]">
                      {activeGroup._count.barang} sudah di dus · {scannedItems.length} di daftar ·{" "}
                      <span className="font-semibold text-[#0F1C2E]">sisa {slotsLeft}</span>
                    </p>
                  </>
                )}
                {(!activeGroup || slotsLeft === 0) && (
                  <button
                    type="button"
                    onClick={() => handleCreateGroup(false)}
                    disabled={creatingGroup || saving || (activeGroup !== null && scannedItems.length > 0)}
                    title={activeGroup && scannedItems.length > 0 ? "Simpan daftar ke dus ini dulu" : undefined}
                    className={`mt-3 h-10 w-full rounded-lg bg-[#1E3A5F] text-sm font-semibold text-white transition hover:bg-[#162C48] disabled:opacity-40 ${FOCUS}`}
                  >
                    {creatingGroup ? "Membuat…" : `+ Dus baru (${nextDusName(groups, needsPengganti)})`}
                  </button>
                )}
                <details className="group mt-3">
                  <summary className={`cursor-pointer list-none rounded text-xs font-semibold text-[#0088C0] [&::-webkit-details-marker]:hidden ${FOCUS}`}>
                    + Buat dus dengan nama sendiri
                  </summary>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="Nama dus"
                      aria-label="Nama dus baru"
                      className={FIELD}
                    />
                    <button
                      type="button"
                      onClick={() => handleCreateGroup(true)}
                      disabled={creatingGroup || !newGroupName.trim()}
                      className={`h-11 shrink-0 rounded-lg bg-[#1E3A5F] px-4 text-sm font-semibold text-white transition hover:bg-[#162C48] disabled:opacity-40 ${FOCUS}`}
                    >
                      {creatingGroup ? "..." : "Buat"}
                    </button>
                  </div>
                </details>
              </section>
            )}

            <form onSubmit={handleSubmit}>
              <label htmlFor="scan-input" className="mb-2 block text-xs font-semibold uppercase tracking-[0.1em] text-[#64748B]">
                Scan QR / kode barang
              </label>
              <div className="relative">
                <input
                  id="scan-input"
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={scanBlocked ? blockReason : "Arahkan scanner ke sini…"}
                  autoComplete="off"
                  enterKeyHint="enter"
                  disabled={saving || scanBlocked}
                  className="h-16 w-full rounded-xl border-2 border-[#1E3A5F]/20 bg-[#F8FAFC] px-4 pr-14 text-center font-mono text-xl font-bold tracking-wide text-[#0F1C2E] placeholder:font-sans placeholder:text-sm placeholder:font-medium placeholder:tracking-normal placeholder:text-[#94A3B8] focus:border-[#00A8E8] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#00A8E8]/15 disabled:opacity-60 sm:text-2xl"
                />
                <button
                  type="submit"
                  disabled={saving || scanBlocked}
                  aria-label="Tambah item"
                  className={`absolute right-2 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-lg bg-[#1E3A5F] text-xl font-bold text-white transition hover:bg-[#162C48] disabled:opacity-40 ${FOCUS}`}
                >
                  ↵
                </button>
              </div>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[#64748B]">
                <span
                  className={`h-2 w-2 rounded-full ${saving ? "bg-amber-400" : scanBlocked ? "bg-[#EF4444]" : "animate-pulse bg-[#10B981]"}`}
                  aria-hidden="true"
                />
                <span className={scanBlocked && !saving ? "font-semibold text-[#EF4444]" : undefined}>
                  {saving ? "Sedang menyimpan…" : scanBlocked ? blockReason : "Siap scan — scanner otomatis masuk, Enter untuk tambah"}
                </span>
              </p>
            </form>

            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { n: scannedItems.length, label: "Total", cls: "text-[#0F1C2E]" },
                { n: validCount, label: "Siap", cls: "text-[#10B981]" },
                { n: loadingCount, label: "Antre", cls: "text-[#0088C0]" },
              ].map((s) => (
                <div key={s.label} className={`${CARD} py-2.5`}>
                  <p className={`text-xl font-bold tabular-nums ${s.cls}`}>{s.n}</p>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#64748B]">{s.label}</p>
                </div>
              ))}
            </div>

            {last && (
              <div className="rounded-xl border border-[#10B981]/30 bg-[#10B981]/5 px-3.5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#059669]">Terakhir masuk</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-base font-bold" title={last.kode}>
                    {last.kode}
                  </span>
                  {statusBadge(last.targetStatus)}
                </div>
                <p className="truncate text-xs text-[#64748B]" title={last.variant}>
                  {last.variant} · {last.waktu}
                </p>
              </div>
            )}

            <details className={`${CARD} px-3.5 py-3`}>
              <summary className={`cursor-pointer list-none rounded text-sm font-semibold text-[#475569] [&::-webkit-details-marker]:hidden ${FOCUS}`}>
                Opsi lain
              </summary>
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-[#64748B]">Catatan (opsional)</span>
                  <input
                    type="text"
                    value={keterangan}
                    onChange={(e) => setKeterangan(e.target.value)}
                    placeholder="Contoh: Shift 1 — Lolos QC"
                    className={FIELD}
                  />
                </label>
                <input ref={fileRef} type="file" accept=".csv,.txt,.json" className="hidden" onChange={handleUpload} />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={saving}
                    className={`h-11 flex-1 rounded-lg border border-[#E5E9F0] bg-white text-sm font-semibold text-[#475569] transition hover:border-[#1E3A5F]/40 disabled:opacity-50 ${FOCUS}`}
                  >
                    Upload CSV/TXT/JSON
                  </button>
                  {scannedItems.length > 0 && (
                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={saving}
                      className={`h-11 flex-1 rounded-lg border text-sm font-semibold transition disabled:opacity-50 ${FOCUS} ${
                        resetArmed ? "border-[#EF4444] bg-[#EF4444] text-white" : "border-red-200 bg-white text-[#EF4444] hover:bg-red-50"
                      }`}
                    >
                      {resetArmed ? "Yakin? Ketuk lagi" : "Buang semua"}
                    </button>
                  )}
                </div>
                <p className="text-xs leading-snug text-[#64748B]">
                  Satu kode per baris, atau dipisah koma/titik-koma. JSON array juga diterima. Maks {MAX_UPLOAD_CODES} kode.
                </p>
              </div>
            </details>
          </div>

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#E5E9F0] bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:static lg:px-5 lg:pb-4">
            {saving && (
              <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[#10B981] transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            )}
            {isDusMode && validCount > 0 && !saving && dusProblem && (
              <p role="alert" className="mb-2 text-center text-xs font-semibold text-[#EF4444]">
                {dusProblem}
              </p>
            )}
            <button type="button" onClick={handleSave} disabled={saving || validCount === 0 || !!dusProblem} className={PRIMARY_BTN}>
              {saving
                ? "Menyimpan…"
                : isDusMode && activeGroup
                  ? `Simpan ${validCount} item ke ${activeGroup.nama}`
                  : `Simpan ${validCount} item`}
            </button>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col p-4 sm:p-5 lg:overflow-y-auto">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-[#64748B]">Daftar scan</h2>
            {validCount > 0 && (
              <button
                type="button"
                onClick={() => setShowSummary((v) => !v)}
                aria-expanded={showSummary}
                className={`rounded text-xs font-semibold text-[#0088C0] hover:underline ${FOCUS}`}
              >
                {showSummary ? "Sembunyikan ringkasan" : "Ringkasan per varian"}
              </button>
            )}
          </div>

          {showSummary && validCount > 0 && (
            <div className={`${CARD} mb-3 divide-y divide-[#E5E9F0] text-sm`}>
              {perVariant.map(([variant, count]) => (
                <div key={variant} className="flex justify-between gap-3 px-4 py-2">
                  <span className="min-w-0 truncate text-[#475569]">{variant}</span>
                  <span className="shrink-0 font-semibold tabular-nums">{count} pcs</span>
                </div>
              ))}
            </div>
          )}

          {failedItems.length > 0 && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3.5">
              <button
                type="button"
                onClick={() => setShowFailed((v) => !v)}
                aria-expanded={showFailed}
                className={`flex w-full items-center justify-between rounded text-left text-sm font-semibold text-[#B91C1C] ${FOCUS}`}
              >
                {failedItems.length} item gagal
                <span className="text-xs font-medium">{showFailed ? "Tutup" : "Detail"}</span>
              </button>
              {showFailed && (
                <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                  {failedItems.slice(0, 20).map((it, i) => (
                    <li key={`${it.kodeBarang}-${i}`} className="rounded-lg bg-white px-3 py-2 text-xs">
                      <span className="font-mono font-bold text-[#B91C1C]">{it.kodeBarang}</span>
                      <span className="block text-[#EF4444]">{it.reason || it.error || "Kesalahan tidak diketahui"}</span>
                    </li>
                  ))}
                  {failedItems.length > 20 && <li className="pt-1 text-xs text-[#B91C1C]">…dan {failedItems.length - 20} lainnya</li>}
                </ul>
              )}
            </div>
          )}

          <div className={`${CARD} flex min-h-[260px] flex-1 flex-col overflow-hidden`}>
            {scannedItems.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#00A8E8]/10 text-[#0088C0]">
                  <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <path d="M14 14h3v3h-3zM17 17h4M14 20h4M17 20h4" />
                  </svg>
                </span>
                <p className="mt-3 font-semibold text-[#475569]">Belum ada barang</p>
                <p className="mt-1 max-w-xs text-sm text-[#94A3B8]">Scan QR atau ketik kode lalu tekan Enter.</p>
              </div>
            ) : (
              <ul className="divide-y divide-[#E5E9F0] overflow-y-auto">
                {scannedItems.map((it, i) => (
                  <li key={it.id} className="flex items-center gap-3 px-3.5 py-3 sm:px-4">
                    <span className="w-7 shrink-0 text-right text-xs font-semibold tabular-nums text-[#94A3B8]">
                      {scannedItems.length - i}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="min-w-0 truncate font-mono text-sm font-bold">{it.kode}</span>
                        {statusBadge(it.targetStatus)}
                        {it.pernahRetur && (
                          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">Pernah retur</span>
                        )}
                        {it.statusSaved && (
                          <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[11px] font-semibold text-sky-700">
                            Status ✓ · belum masuk dus
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[#64748B]">
                        {it.variant} · {it.waktu}
                      </p>
                    </div>
                    {it.loading ? (
                      <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-[#00A8E8]" title="Memvalidasi…" aria-label="Memvalidasi" />
                    ) : (
                      <span className="shrink-0 text-sm font-bold text-[#10B981]" title="Siap disimpan" aria-label="Siap">
                        ✓
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setScannedItems((prev) => prev.filter((x) => x.id !== it.id));
                        focusInput();
                      }}
                      disabled={saving}
                      aria-label={`Hapus ${it.kode}`}
                      title="Hapus"
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#94A3B8] transition hover:bg-red-50 hover:text-[#EF4444] disabled:opacity-40 ${FOCUS}`}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default ScanQr;
