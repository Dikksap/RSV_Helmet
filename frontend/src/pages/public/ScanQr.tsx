import { useCallback, useEffect, useRef, useState, type FormEvent, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { bulkScanBarang, getScanBarang, type BulkScanItemResult, type StatusBarang } from "../../api/barang";
import { familyOfDus, nextDusName } from "../../lib/dus";
import { useStatusOptions } from "../../lib/useStatusOptions";
import {
  assignBarangToGroup,
  createBarangGroup,
  getBarangGroups,
  type BarangGroup,
} from "../../api/barangGroup";

const DUS_CAPACITY = 8; // 1 dus = 8 kode barang

type ScannedItem = {
  id: number;
  kode: string;
  variant: string;
  waktu: string;
  loading: boolean;
  targetStatus: StatusBarang;
  pernahRetur?: boolean;
};

type FailedItem = BulkScanItemResult;

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30";

let sharedAudio: AudioContext | null = null;

function beep(ok: boolean) {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    if (!sharedAudio || sharedAudio.state === "closed") sharedAudio = new Ctx();
    const ctx = sharedAudio;
    void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = ok ? 880 : 220;
    osc.type = ok ? "sine" : "square";
    gain.gain.value = 0.08;
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.12 : 0.25));
    osc.onended = () => void ctx.close();
  } catch {
    /* suara opsional */
  }
  try {
    navigator.vibrate?.(ok ? 30 : [80, 40, 80]);
  } catch {
    /* abaikan */
  }
}

function groupByStatus<T extends { targetStatus: StatusBarang; kode: string }>(items: T[]): [StatusBarang, string[]][] {
  const m = new Map<StatusBarang, string[]>();
  for (const it of items) {
    const arr = m.get(it.targetStatus) ?? [];
    arr.push(it.kode);
    m.set(it.targetStatus, arr);
  }
  return [...m.entries()];
}

function ScanQr() {
  const [searchParams] = useSearchParams();
  const isDusMode = searchParams.get("mode") === "dus";
  const { options: statusOptions } = useStatusOptions();
  const statusLabel = (kode: string) => statusOptions.find((o) => o.value === kode)?.label ?? kode;
  const statusBadge = (kode: string) => {
    const opt = statusOptions.find((o) => o.value === kode);
    return opt?.warna
      ? { className: "", style: { backgroundColor: opt.warna, color: "#fff" } as CSSProperties }
      : { className: "bg-slate-100 text-slate-600", style: undefined as CSSProperties | undefined };
  };

  const [groups, setGroups] = useState<BarangGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [savingDus, setSavingDus] = useState(false);

  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [status, setStatus] = useState<StatusBarang>(() => searchParams.get("status")?.trim() || "FINISHGOOD");
  const [keterangan, setKeterangan] = useState("");
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [failedItems, setFailedItems] = useState<FailedItem[]>([]);
  const [showFailedDetail, setShowFailedDetail] = useState(false);
  const [resetArmed, setResetArmed] = useState(false);
  const resetArmTimer = useRef<number | null>(null);

  const bulkInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<ScannedItem[]>([]);
  const statusRef = useRef(status);

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

  const notify = useCallback((type: "success" | "error", msg: string) => setToast({ type, msg }), []);

  // --- Mode dus: 1 dus = BarangGroup, muat 8 kode barang ---
  const refreshGroups = useCallback(async () => {
    if (!isDusMode) return;
    const data = await getBarangGroups();
    setGroups(data);
  }, [isDusMode]);

  useEffect(() => {
    if (!isDusMode) return;
    let cancelled = false;
    getBarangGroups()
      .then(async (data) => {
        if (cancelled) return;
        setGroups(data);
        const available = data.filter((g) => !g.isArsip && g._count.barang < DUS_CAPACITY);
        if (available.length === 0) {
          try {
            const created = await createBarangGroup(nextDusName(data, false));
            if (cancelled) return;
            setGroups((prev) => [...prev, created]);
            setActiveGroupId((prev) => prev ?? created.id);
            notify("success", `Dus "${created.nama}" dibuat otomatis.`);
          } catch (e) {
            if (!cancelled) notify("error", e instanceof Error ? e.message : "Gagal membuat dus otomatis.");
          }
          return;
        }
        setActiveGroupId((prev) => prev ?? available[0]?.id ?? null);
      })
      .catch((e) => {
        if (cancelled) return;
        notify("error", e instanceof Error ? e.message : "Gagal memuat daftar dus.");
      });
    return () => {
      cancelled = true;
    };
  }, [isDusMode, notify]);

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null;
  const remainingCapacity = DUS_CAPACITY - (activeGroup?._count.barang ?? 0);

  const handleCreateGroup = async () => {
    const nama = newGroupName.trim();
    if (!nama) {
      notify("error", "Nama dus wajib diisi.");
      return;
    }
    setCreatingGroup(true);
    try {
      const created = await createBarangGroup(nama);
      setGroups((prev) => [...prev, created]);
      setActiveGroupId(created.id);
      setNewGroupName("");
      notify("success", `Dus "${created.nama}" dibuat.`);
      beep(true);
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Gagal membuat dus.");
      beep(false);
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleSaveDus = async () => {
    const validItems = scannedItems.filter((it) => !it.loading);
    if (validItems.length === 0) {
      notify("error", "Belum ada data — scan barang dulu.");
      return;
    }
    const needsPengganti = validItems.some((it) => it.pernahRetur);
    const familyOf = (nama: string) => (familyOfDus(nama) === "pengganti") === needsPengganti;
    let target = activeGroup;
    if (!target || !familyOf(target.nama) || validItems.length > remainingCapacity) {
      const candidate = groups.find(
        (g) => !g.isArsip && familyOf(g.nama) && DUS_CAPACITY - g._count.barang >= validItems.length,
      );
      if (candidate) {
        target = candidate;
        setActiveGroupId(candidate.id);
        notify("success", target.id !== activeGroup?.id ? `Otomatis masuk "${target.nama}".` : `Disimpan ke "${target.nama}".`);
      } else {
        try {
          const created = await createBarangGroup(nextDusName(groups, needsPengganti));
          setGroups((prev) => [...prev, created]);
          setActiveGroupId(created.id);
          target = created;
          beep(true);
        } catch (e) {
          notify("error", e instanceof Error ? e.message : "Gagal membuat dus otomatis.");
          beep(false);
          return;
        }
      }
    }
    setSavingDus(true);
    setSubmitProgress(0);
    setFailedItems([]);
    setShowFailedDetail(false);
    const failed: FailedItem[] = [];
    try {
      const successKodes = new Set<string>();
      for (const [st, kodes] of groupByStatus(validItems)) {
        const result = await bulkScanBarang(kodes, st, keterangan.trim() || undefined);
        for (const s of result.success) successKodes.add(s.kodeBarang.toLowerCase());
        failed.push(...result.failed);
      }
      setFailedItems(failed);
      if (failed.length > 0) setShowFailedDetail(true);
      const successItems = validItems.filter((it) => successKodes.has(it.kode.toLowerCase()));
      if (successItems.length === 0) {
        notify("error", "Tidak ada item yang berhasil disimpan.");
        return;
      }
      let assigned: number;
      try {
        assigned = (await assignBarangToGroup(target.id, successItems.map((it) => it.id))).updated;
      } catch {
        notify("error", `${successItems.length} item sudah berstatus baru, tapi gagal masuk dus — coba simpan lagi.`);
        beep(false);
        return;
      }
      if (assigned < successItems.length) {
        notify("error", `${successItems.length - assigned} item tidak masuk dus (kode tidak ditemukan di server).`);
        return;
      }
      setScannedItems((prev) => prev.filter((it) => it.loading || !successKodes.has(it.kode.toLowerCase())));
      await refreshGroups();
      notify("success", target ? `${successItems.length} item tersimpan ke dus "${target.nama}".` : `${successItems.length} item tersimpan.`);
      beep(true);
    } catch (e) {
      notify("error", e instanceof Error ? e.message : "Gagal menyimpan dus.");
      beep(false);
    } finally {
      setSavingDus(false);
      setSubmitProgress(0);
      inputRef.current?.focus();
    }
  };

  const removeItem = (id: number) => {
    setScannedItems((prev) => prev.filter((it) => it.id !== id));
    inputRef.current?.focus();
  };

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    const kode = inputValue.trim();
    if (!kode) {
      notify("error", "Kode kosong — scan ulang.");
      setInputValue("");
      if (inputRef.current) inputRef.current.value = "";
      inputRef.current?.focus();
      beep(false);
      return;
    }
    const newItem: ScannedItem = {
      id: Date.now() + Math.random(),
      kode,
      variant: "Memeriksa...",
      waktu: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      loading: true,
      targetStatus: statusRef.current,
    };
    setScannedItems((prev) => [newItem, ...prev]);
    setInputValue("");
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.focus();
  };

  const validateOne = useCallback(
    async (item: ScannedItem) => {
      try {
        const barang = await getScanBarang(item.kode);
        if (String(barang.status).toUpperCase() === item.targetStatus) {
          setScannedItems((prev) => prev.filter((it) => it.id !== item.id));
          notify("error", `Kode ${item.kode} dilewati — statusnya sudah ${barang.status}.`);
          beep(false);
          return;
        }
        const dup = listRef.current.some(
          (it) => it.id !== item.id && !it.loading && it.kode.toLowerCase() === barang.kodeBarang.toLowerCase(),
        );
        if (dup) {
          setScannedItems((prev) => prev.filter((it) => it.id !== item.id));
          notify("error", `Kode ${item.kode} duplikat — tidak dimasukkan.`);
          beep(false);
          return;
        }
        const variantName =
          barang.variant?.product && barang.variant?.style && barang.variant?.color && barang.variant?.size
            ? `${barang.variant.product.nama} ${barang.variant.style.nama} ${barang.variant.color.nama} ${barang.variant.size.nama}`
            : "-";
        setScannedItems((prev) =>
          prev.map((it) =>
            it.id === item.id ? { ...it, id: barang.id ?? it.id, kode: barang.kodeBarang, variant: variantName, loading: false, pernahRetur: barang.pernahRetur } : it,
          ),
        );
        beep(true);
      } catch {
        setScannedItems((prev) => prev.filter((it) => it.id !== item.id));
        notify("error", `Kode ${item.kode} tidak ditemukan.`);
        beep(false);
      }
    },
    [notify],
  );

  useEffect(() => {
    const pending = [...listRef.current].reverse().filter((it) => it.loading);
    if (pending.length === 0) return;
    const seen = new Set<string>();
    const batch = pending
      .filter((it) => {
        const key = it.kode.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 5);
    void Promise.allSettled(batch.map((it) => validateOne(it)));
  }, [scannedItems, validateOne]);

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      notify("error", "File terlalu besar — maksimal 1 MB.");
      return;
    }
    try {
      const text = await file.text();
      let codes: string[] = [];
      const trimmed = text.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) codes = parsed.map((v) => String(v).trim()).filter(Boolean);
        } catch {
          /* fallback */
        }
      }
      if (codes.length === 0) codes = text.split(/[\r\n,;]+/).map((s) => s.trim()).filter(Boolean);
      if (codes.length === 0) {
        notify("error", "File kosong atau format tidak valid.");
        return;
      }
      const now = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const seen = new Set(listRef.current.map((it) => it.kode.toLowerCase()));
      const newItems: ScannedItem[] = [];
      for (const kode of codes) {
        const key = kode.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        newItems.push({ id: Date.now() + Math.random(), kode, variant: "Memeriksa...", waktu: now, loading: true, targetStatus: statusRef.current });
      }
      setScannedItems((prev) => [...newItems, ...prev]);
      notify("success", `${newItems.length} kode masuk antre validasi.`);
    } catch {
      notify("error", "Gagal membaca file bulk.");
    } finally {
      if (bulkInputRef.current) bulkInputRef.current.value = "";
    }
  };

  const handleReset = () => {
    if (scannedItems.length === 0) return;
    if (!resetArmed) {
      setResetArmed(true);
      if (resetArmTimer.current) window.clearTimeout(resetArmTimer.current);
      resetArmTimer.current = window.setTimeout(() => setResetArmed(false), 3000);
      return;
    }
    if (resetArmTimer.current) window.clearTimeout(resetArmTimer.current);
    setResetArmed(false);
    setScannedItems([]);
    setFailedItems([]);
    setShowFailedDetail(false);
    setSubmitProgress(0);
    inputRef.current?.focus();
    beep(true);
  };

  const handleBulkSubmit = async () => {
    const validItems = scannedItems.filter((it) => !it.loading);
    if (validItems.length === 0) {
      notify("error", "Belum ada data — scan barang dulu.");
      return;
    }
    setIsBulkSubmitting(true);
    setSubmitProgress(0);
    setFailedItems([]);
    setShowFailedDetail(false);

    const total = validItems.length;
    let done = 0;
    const allSuccess: string[] = [];
    const allFailed: FailedItem[] = [];

    try {
      for (const [st, kodes] of groupByStatus(validItems)) {
        const result = await bulkScanBarang(kodes, st, keterangan.trim() || undefined);
        allSuccess.push(...result.success.map((s) => s.kodeBarang));
        allFailed.push(...result.failed);
        done += kodes.length;
        setSubmitProgress(Math.round((done / total) * 100));
      }
      setSubmitProgress(100);
      const successSet = new Set(allSuccess.map((k) => k.toLowerCase()));
      if (successSet.size > 0) {
        setScannedItems((prev) => prev.filter((it) => it.loading || !successSet.has(it.kode.toLowerCase())));
      }
      setFailedItems(allFailed);
      if (allFailed.length > 0) setShowFailedDetail(true);

      if (allFailed.length === 0) {
        notify("success", `${allSuccess.length} item tersimpan.`);
        beep(true);
      } else if (allSuccess.length === 0) {
        const first = allFailed[0] as { error?: string; reason?: string };
        notify("error", first.error ?? first.reason ?? `${allFailed.length} item gagal diproses.`);
        beep(false);
      } else {
        notify("error", `${allSuccess.length} tersimpan, ${allFailed.length} gagal — sisa di tabel bisa diperbaiki lalu simpan ulang.`);
        beep(false);
      }
    } catch (reqErr) {
      const msg = reqErr instanceof Error ? reqErr.message : "Sistem gagal mengirim data.";
      notify("error", msg);
      beep(false);
    } finally {
      setIsBulkSubmitting(false);
      setTimeout(() => setSubmitProgress(0), 1000);
      inputRef.current?.focus();
    }
  };

  useEffect(() => {
    const handleGlobalKeydown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const interactive =
        target &&
        (["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A", "SUMMARY"].includes(target.tagName) || target.isContentEditable);
      if (interactive) return;
      if (event.key === "Enter") {
        inputRef.current?.focus();
        return;
      }
      if (event.key.length === 1) {
        event.preventDefault();
        inputRef.current?.focus();
        if (inputRef.current) {
          inputRef.current.value += event.key;
          setInputValue(inputRef.current.value);
        }
      }
    };
    window.addEventListener("keydown", handleGlobalKeydown);
    return () => window.removeEventListener("keydown", handleGlobalKeydown);
  }, []);

  const scannedItemsCount = scannedItems.length;
  const itemsPerVariant = scannedItems
    .filter((it) => !it.loading)
    .reduce((acc, item) => {
      acc[item.variant] = (acc[item.variant] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  const loadingCount = scannedItems.filter((it) => it.loading).length;
  const validItemsCount = scannedItemsCount - loadingCount;
  const statusCounts = new Map<StatusBarang, number>();
  for (const it of scannedItems) {
    if (!it.loading) statusCounts.set(it.targetStatus, (statusCounts.get(it.targetStatus) ?? 0) + 1);
  }
  const groupSummary = [...statusCounts.entries()].map(([st, n]) => `${statusLabel(st)}: ${n}`).join(" · ");
  const hasMultipleStatus = statusCounts.size > 1;

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col bg-transparent font-[Inter,sans-serif] text-slate-800 lg:h-[calc(100dvh-3.5rem)] lg:overflow-hidden">
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
          <div
            role={toast.type === "error" ? "alert" : "status"}
            aria-live={toast.type === "error" ? "assertive" : "polite"}
            className={`pointer-events-auto flex w-full max-w-3xl items-center justify-between gap-4 rounded-md border bg-white p-4 text-sm font-bold shadow-2xl ${toast.type === "error" ? "border-red-600 text-red-700" : "border-emerald-600 text-emerald-700"}`}
          >
            <div className="flex items-center gap-3">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded text-lg text-white ${toast.type === "error" ? "bg-red-600" : "bg-emerald-600"}`}>
                {toast.type === "error" ? "!" : "✓"}
              </span>
              <span className="leading-snug">{toast.msg}</span>
            </div>
            <button type="button" onClick={() => setToast(null)} className="shrink-0 rounded border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500">
              Tutup
            </button>
          </div>
        </div>
      )}

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row lg:overflow-hidden">
        <section className="w-full min-w-0 border-r border-slate-200 bg-white p-3 sm:p-6 lg:w-2/5 lg:flex-none lg:overflow-y-auto xl:w-1/3">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-slate-200 pb-3">
            <h2 className="text-lg font-bold text-slate-800">Area Scan</h2>
            <span className="rounded-md bg-slate-800 px-3 py-1.5 text-sm font-bold text-white tabular-nums">{scannedItemsCount} item</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Status tujuan</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusBarang)}
                className={inputClass}
                disabled={isBulkSubmitting || savingDus}
              >
                {statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs font-medium text-slate-500">Berlaku untuk scan berikutnya. Tabel boleh berisi beberapa status — akan disimpan per grup.</p>
            </div>

            {isDusMode && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="dus-select" className="text-sm font-semibold text-slate-700">
                    Dus tujuan
                  </label>
                  {activeGroup && (
                    <span
                      className={`text-xs font-bold ${
                        remainingCapacity === 0 ? "text-red-600" : "text-slate-600"
                      }`}
                    >
                      {activeGroup._count.barang}/{DUS_CAPACITY}
                      {remainingCapacity === 0 && " · PENUH"}
                    </span>
                  )}
                </div>
                <select
                  id="dus-select"
                  value={activeGroupId ?? ""}
                  onChange={(e) => setActiveGroupId(e.target.value ? Number(e.target.value) : null)}
                  className={inputClass}
                >
                  <option value="">{groups.length === 0 ? "Belum ada dus" : "— Pilih dus —"}</option>
                  {groups
                    .filter((g) => !g.isArsip)
                    .map((g) => (
                      <option key={g.id} value={g.id} disabled={g._count.barang >= DUS_CAPACITY}>
                        {g.nama} — {g._count.barang}/{DUS_CAPACITY}
                      </option>
                    ))}
                </select>
                {activeGroup && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full transition-all ${remainingCapacity === 0 ? "bg-red-500" : "bg-emerald-600"}`}
                      style={{ width: `${(activeGroup._count.barang / DUS_CAPACITY) * 100}%` }}
                    />
                  </div>
                )}
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Nama dus baru"
                    aria-label="Nama dus baru"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={handleCreateGroup}
                    disabled={creatingGroup || !newGroupName.trim()}
                    className="shrink-0 rounded-md bg-slate-800 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {creatingGroup ? "..." : "Dus Baru"}
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Scan QR / Kode barang</label>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Arahkan scanner ke sini..."
                  autoComplete="off"
                  enterKeyHint="enter"
                  disabled={isBulkSubmitting || savingDus}
                  className="w-full rounded-lg border-2 border-slate-800 bg-white px-4 py-4 text-center font-mono text-2xl font-bold text-slate-900 shadow-sm placeholder:font-sans placeholder:text-base placeholder:font-medium placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20 sm:py-5 sm:text-3xl"
                />
              </div>
              <button
                type="submit"
                disabled={isBulkSubmitting || savingDus}
                className="w-full rounded-md bg-slate-800 py-3.5 text-base font-bold text-white transition-colors hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Tambah item (Enter)
              </button>
              <p className="text-center text-xs font-medium text-slate-500">Scanner hardware otomatis masuk ke input di atas — Enter untuk tambah</p>
            </form>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-slate-800 p-3 text-center text-white">
                <p className="text-2xl font-black tabular-nums">{scannedItemsCount}</p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Total</p>
              </div>
              <div className="rounded-lg bg-emerald-600 p-3 text-center text-white">
                <p className="text-2xl font-black tabular-nums">{validItemsCount}</p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">Siap</p>
              </div>
              <div className="rounded-lg bg-sky-600 p-3 text-center text-white">
                <p className="text-2xl font-black tabular-nums">{loadingCount}</p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-sky-100">Antre</p>
              </div>
            </div>
            {groupSummary && <p className="text-center text-xs font-medium text-slate-500">{groupSummary}</p>}

            {scannedItemsCount > 0 && (
              <button
                type="button"
                onClick={() => document.getElementById("scan-table-top")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="flex w-full flex-col rounded-md border border-emerald-200 bg-emerald-50 p-4 text-left transition-colors hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
              >
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Terakhir masuk — ketuk untuk lihat</span>
                <span className="mt-1 truncate font-mono text-lg font-black text-slate-900" title={scannedItems[0].kode}>
                  {scannedItems[0].kode}
                </span>
                <span className="truncate text-sm font-medium text-slate-600" title={scannedItems[0].variant}>
                  {scannedItems[0].variant} · {scannedItems[0].waktu}
                </span>
                <span className={`mt-1 inline-flex w-fit rounded px-2 py-0.5 text-xs font-bold ${statusBadge(scannedItems[0].targetStatus).className}`} style={statusBadge(scannedItems[0].targetStatus).style}>{statusLabel(scannedItems[0].targetStatus)}</span>
              </button>
            )}

            <details className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <summary className="cursor-pointer list-none text-sm font-bold text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 [&::-webkit-details-marker]:hidden">
                Catatan & opsi lain
              </summary>
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-500">Catatan (opsional)</span>
                  <input type="text" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="Contoh: Shift 1 — Lolos QC" className={inputClass} />
                </label>
                <div className="flex gap-3">
                  <input ref={bulkInputRef} type="file" accept=".csv,.txt,.json" className="hidden" onChange={handleBulkUpload} />
                  <button
                    type="button"
                    onClick={() => bulkInputRef.current?.click()}
                    className="flex-1 rounded-md border-2 border-slate-300 bg-white py-3 text-sm font-bold text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500"
                  >
                    Upload CSV / TXT / JSON
                  </button>
                  {scannedItemsCount > 0 && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className={`flex-1 rounded-md border-2 py-3 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 ${
                        resetArmed
                          ? "border-red-600 bg-red-600 text-white hover:bg-red-700"
                          : "border-red-200 bg-white text-red-600 hover:bg-red-50"
                      }`}
                    >
                      {resetArmed ? "Yakin? Ketuk lagi" : "Buang semua"}
                    </button>
                  )}
                </div>
                <p className="text-xs leading-snug text-slate-500">Format file: satu kode per baris, atau dipisah koma / titik-koma. JSON array juga diterima.</p>
              </div>
            </details>
          </div>

          <div className="sticky bottom-0 -mx-3 mt-6 border-t border-slate-200 bg-white/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
            {(isBulkSubmitting || savingDus) && (
              <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-emerald-600 transition-all duration-300" style={{ width: `${submitProgress}%` }} />
              </div>
            )}
            {!isDusMode && validItemsCount > 0 && failedItems.length === 0 && hasMultipleStatus && (
              <p className="mb-2 text-center text-xs font-medium text-slate-500">Akan disimpan per grup status</p>
            )}
            {isDusMode ? (
              <button
                type="button"
                onClick={handleSaveDus}
                disabled={savingDus || validItemsCount === 0 || !activeGroup}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-4 text-lg font-black tracking-wide text-white shadow-lg transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
              >
                {savingDus ? "Memproses..." : `Simpan ke ${activeGroup?.nama ?? "dus"}`}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleBulkSubmit}
                disabled={isBulkSubmitting || validItemsCount === 0}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-4 text-lg font-black tracking-wide text-white shadow-lg transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
              >
                {isBulkSubmitting ? "Memproses..." : `Simpan ${validItemsCount} item`}
              </button>
            )}
          </div>
        </section>

        <section className="z-0 flex w-full min-w-0 flex-col border-t border-slate-200 bg-slate-50 lg:border-l lg:border-t-0 lg:flex-1">
          <div className="flex flex-col p-3 sm:p-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Daftar scan</h2>
              <span className="rounded bg-white px-2 py-1 text-xs font-bold text-slate-600 shadow-sm">
                {scannedItemsCount} baris{loadingCount > 0 ? ` · ${loadingCount} antre` : ""}
              </span>
            </div>

            {scannedItemsCount > 0 && (
              <div className="mb-4">
                <button type="button" onClick={() => setShowSummary((v) => !v)} aria-expanded={showSummary} className="text-xs font-bold text-sky-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500">
                  {showSummary ? "Sembunyikan ringkasan" : "Tampilkan ringkasan"}
                </button>
                {showSummary && (
                  <table className="mt-2 w-full text-left text-sm">
                    <tbody>
                      {Object.entries(itemsPerVariant).map(([variant, count]) => (
                        <tr key={variant} className="border-b border-slate-200">
                          <td className="py-1.5 pr-2 font-medium text-slate-600">{variant}</td>
                          <td className="py-1.5 text-right font-bold text-slate-800">{count} pcs</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {failedItems.length > 0 && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
                <button
                  type="button"
                  onClick={() => setShowFailedDetail((v) => !v)}
                  aria-expanded={showFailedDetail}
                  className="flex w-full items-center justify-between text-left text-sm font-bold text-red-700 hover:text-red-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500"
                >
                  <span>
                    {showFailedDetail ? "▼" : "▶"} {failedItems.length} item gagal
                  </span>
                  <span className="text-xs font-normal text-red-500">ketuk untuk {showFailedDetail ? "tutup" : "detail"}</span>
                </button>
                {showFailedDetail && (
                  <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                    {failedItems.slice(0, 10).map((item, idx) => (
                      <div key={idx} className="rounded bg-white p-2 font-mono text-xs">
                        <div className="font-bold text-red-700">{item.kodeBarang}</div>
                        <div className="text-red-500">{item.reason || item.error || "Kesalahan tidak diketahui"}</div>
                      </div>
                    ))}
                    {failedItems.length > 10 && <div className="pt-2 text-xs italic text-red-600">…dan {failedItems.length - 10} item lainnya</div>}
                  </div>
                )}
              </div>
            )}

            <div className="flex min-h-[300px] flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div id="scan-table-top" className="min-w-0 flex-1 overflow-auto">
                {scannedItemsCount === 0 ? (
                  <div className="flex h-full min-h-[300px] flex-col items-center justify-center p-8 text-center text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mb-3 h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <p className="text-base font-bold text-slate-500">Belum ada barang</p>
                    <p className="mt-1 max-w-xs text-sm leading-snug text-slate-400">Scan QR atau masukkan kode, lalu tambah item. Status tujuan bisa diubah kapan saja — tabel boleh berisi beberapa status.</p>
                  </div>
                ) : (
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-800 shadow-sm">
                      <tr className="border-b-2 border-sky-500 text-xs uppercase tracking-wide text-white">
                        <th className="w-10 px-3 py-3 text-left font-bold">No</th>
                        <th className="px-3 py-3 text-left font-bold">Kode barang</th>
                        <th className="px-3 py-3 text-left font-bold">Varian</th>
                        <th className="px-3 py-3 text-left font-bold">Tujuan</th>
                        <th className="hidden px-3 py-3 text-right font-bold sm:table-cell">Waktu</th>
                        <th className="w-14 px-3 py-3 text-center font-bold">Validasi</th>
                        <th className="w-12 px-2 py-3 text-center font-bold" aria-label="Hapus">
                          <span className="sr-only">Hapus</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {scannedItems.map((item, index) => (
                        <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <td className="px-3 py-3 text-sm font-bold text-sky-700">{index + 1}</td>
                          <td className="max-w-[28vw] truncate px-3 py-3 font-mono text-sm font-bold text-slate-900 sm:max-w-none">{item.kode}</td>
                          <td className="max-w-[30vw] truncate px-3 py-3 text-sm font-medium leading-snug text-slate-700 sm:max-w-none">{item.variant}</td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex rounded px-2 py-0.5 text-xs font-bold ${statusBadge(item.targetStatus).className}`} style={statusBadge(item.targetStatus).style}>{statusLabel(item.targetStatus)}</span>
                          </td>
                          <td className="hidden whitespace-nowrap px-3 py-3 text-right text-sm font-medium tabular-nums text-slate-600 sm:table-cell">{item.waktu}</td>
                          <td className="px-3 py-3 text-center">
                            {item.loading ? (
                              <span className="inline-flex items-center gap-1.5" title="Memvalidasi...">
                                <span className="h-3 w-3 animate-pulse rounded-full bg-sky-500" aria-hidden="true" />
                                <span className="hidden text-xs font-bold text-sky-600 sm:inline">Validasi</span>
                              </span>
                            ) : (
                              <span className="text-base font-bold text-emerald-600" title="Siap disimpan">
                                ✓
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              aria-label={`Hapus ${item.kode}`}
                              title="Hapus baris ini"
                              className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-500 disabled:opacity-40"
                              disabled={isBulkSubmitting || savingDus}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="h-4 w-4">
                                <path d="M18 6L6 18M6 6l12 12" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default ScanQr;
