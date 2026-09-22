import { useEffect, useRef, useState, type FormEvent } from "react";
import { bulkScanBarang, getScanBarang, type StatusBarang } from "../api/barang";

const STATUS_OPTIONS: { value: StatusBarang; label: string }[] = [
  { value: "FINISHGOOD", label: "Finish Good (Lolos QC)" },
  { value: "RETUR", label: "Retur" },
  { value: "OUT", label: "Keluar (Out)" },
  { value: "BAD", label: "Bad (Reject)" },
  { value: "REGISTER", label: "Register" },
];

type ScannedItem = {
  id: number;
  kode: string;
  variant: string;
  waktu: string;
  loading: boolean;
};

const inputClass =
  "w-full rounded-md border border-slate-300 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-800 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500";

// Beep WebAudio + getar: konfirmasi tanpa lihat layar. Gagal sunyi = aman.
function beep(ok: boolean) {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
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

function ScanQr() {
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<StatusBarang>("FINISHGOOD");
  const [keterangan, setKeterangan] = useState("");
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  const bulkInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // ponytail: antrean validasi FIFO — 1 validasi jalan dalam satu waktu, Enter tidak pernah await.
  const validatingRef = useRef(false);
  const listRef = useRef<ScannedItem[]>([]);
  listRef.current = scannedItems;

  // Auto focus ke input saat render
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto hide toast
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Auto hide success/error inline
  useEffect(() => {
    if (!successMsg && !error) return;
    const id = window.setTimeout(() => {
      setSuccessMsg("");
      setError("");
    }, 4000);
    return () => window.clearTimeout(id);
  }, [successMsg, error]);

  // Enter = langsung tambah baris loading, tanpa validasi. Validasi jalan FIFO di effect bawah.
  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    const kode = (inputRef.current?.value ?? inputValue).trim() || inputValue.trim();

    if (!kode) {
      setError("KODE BARANG KOSONG! Silakan scan ulang.");
      setInputValue("");
      if (inputRef.current) inputRef.current.value = "";
      inputRef.current?.focus();
      beep(false);
      return;
    }

    const newItem: ScannedItem = {
      id: Date.now() + Math.random(),
      kode,
      variant: "MEMERIKSA...",
      waktu: new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      loading: true,
    };

    setScannedItems((prev) => [newItem, ...prev]);
    setError("");
    setInputValue("");
    if (inputRef.current) inputRef.current.value = "";
    inputRef.current?.focus();
  };

  // Queue validasi FIFO: ambil loading tertua, validasi 1-per-1.
  // Valid = loading jadi ceklis, tidak valid/duplikat = baris dihapus.
  useEffect(() => {
    if (validatingRef.current) return;
    const next = [...listRef.current].reverse().find((it) => it.loading);
    if (!next) return;
    validatingRef.current = true;
    (async () => {
      try {
        const barang = await getScanBarang(next.kode);
        const current = listRef.current;
        // duplikat = kode sudah ada di baris valid lain
        const dup = current.some(
          (it) => it.id !== next.id && !it.loading && it.kode.toLowerCase() === barang.kodeBarang.toLowerCase(),
        );
        if (dup) {
          setScannedItems((prev) => prev.filter((it) => it.id !== next.id));
          setError(`DUPLIKAT! Kode ${next.kode} sudah ada — dihapus.`);
          beep(false);
          return;
        }
        const variantName =
          barang.variant?.product && barang.variant?.style && barang.variant?.color && barang.variant?.size
            ? `${barang.variant.product.nama} ${barang.variant.style.nama} ${barang.variant.color.nama} ${barang.variant.size.nama}`
            : "-";
        setScannedItems((prev) =>
          prev.map((it) =>
            it.id === next.id
              ? { ...it, id: barang.id ?? it.id, kode: barang.kodeBarang, variant: variantName, loading: false }
              : it,
          ),
        );
        beep(true);
      } catch {
        setScannedItems((prev) => prev.filter((it) => it.id !== next.id));
        setError(`GAGAL! Kode ${next.kode} tidak ditemukan — dihapus.`);
        beep(false);
      } finally {
        validatingRef.current = false;
      }
    })();
  }, [scannedItems]);

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setSuccessMsg("");
    try {
      const text = await file.text();
      let codes: string[] = [];
      const trimmed = text.trim();

      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) codes = parsed.map((v) => String(v).trim()).filter(Boolean);
        } catch { /* fallback */ }
      }
      if (codes.length === 0) {
        codes = text.split(/[\r\n,;]+/).map((s) => s.trim()).filter(Boolean);
      }
      if (codes.length === 0) {
        setError("File kosong atau format tidak valid.");
        return;
      }

      // Langsung tambah baris loading — validasi ikut antrean FIFO yang sama.
      const now = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const seen = new Set(listRef.current.map((it) => it.kode.toLowerCase()));
      const newItems: ScannedItem[] = [];
      for (const kode of codes) {
        const key = kode.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        newItems.push({ id: Date.now() + Math.random(), kode, variant: "MEMERIKSA...", waktu: now, loading: true });
      }
      setScannedItems((prev) => [...newItems, ...prev]);
      setSuccessMsg(`BULK LOAD: ${newItems.length} kode antre validasi.`);
    } catch {
      setError("Gagal membaca file bulk.");
    } finally {
      if (bulkInputRef.current) bulkInputRef.current.value = "";
    }
  };

  const handleBulkSubmit = async () => {
    const validItems = scannedItems.filter((it) => !it.loading);
    const kodeBarang = validItems.map((it) => it.kode);
    if (kodeBarang.length === 0) {
      setError("BELUM ADA DATA. Scan barang terlebih dahulu!");
      return;
    }
    setIsBulkSubmitting(true);
    setError("");
    setSuccessMsg("");

    try {
      const result = await bulkScanBarang(kodeBarang, status, keterangan || undefined);
      const msg = `PROSES SELESAI: ${result.success.length} Berhasil, ${result.failed.length} Gagal.`;
      setSuccessMsg(msg);
      beep(result.failed.length === 0);
      setToast({ type: result.failed.length === 0 ? "success" : "success", msg });
      window.dispatchEvent(new CustomEvent("app:toast", { detail: { type: "barang.bulk", message: msg } }));

      // ponytail: hanya baris valid yang dikirim, antrean loading tetap jalan.
      setScannedItems((prev) => prev.filter((it) => it.loading));

      if (result.failed.length > 0 && result.success.length === 0) {
        const first = result.failed[0] as unknown as { error?: string; reason?: string; kodeBarang: string };
        const errMsg = first.error ?? first.reason ?? `GAGAL TOTAL: ${result.failed.length} item gagal diproses.`;
        setError(errMsg);
        setToast({ type: "error", msg: errMsg });
      }
    } catch (reqErr) {
      const msg = reqErr instanceof Error ? reqErr.message : "Sistem gagal mengirim data.";
      setError(msg);
      beep(false);
      setToast({ type: "error", msg });
    } finally {
      setIsBulkSubmitting(false);
      inputRef.current?.focus();
    }
  };

  // Intercept Scanner Keyboard Input global
  // ponytail: baca/tulis via inputRef (sinkron DOM), bukan state — burst scanner cepat bikin closure state basi saat Enter.
  useEffect(() => {
    const handleGlobalKeydown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target === inputRef.current) return; // native form submit handle Enter

      if (event.key === "Enter") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.form?.requestSubmit();
        return;
      }

      if (event.key.length === 1) {
        if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
        event.preventDefault();
        inputRef.current?.focus();
        // tulis sinkron ke DOM agar Enter langsung lihat nilai penuh
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

  const itemsPerVariant = scannedItems.filter((it) => !it.loading).reduce((acc, item) => {
    acc[item.variant] = (acc[item.variant] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const loadingCount = scannedItemsCount - Object.values(itemsPerVariant).reduce((a, b) => a + b, 0);

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-transparent font-[Inter,sans-serif] text-slate-800 md:min-h-[calc(100dvh-72px)] lg:h-[calc(100dvh-72px)] lg:overflow-hidden">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed inset-x-0 top-0 z-50 flex justify-center p-4">
          <div className={`flex w-full max-w-3xl items-center justify-between gap-4 rounded-md border bg-white p-4 text-base font-bold shadow-2xl ${toast.type === "error" ? "border-red-600 text-red-700" : "border-emerald-600 text-emerald-700"}`}>
            <div className="flex items-center gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded text-2xl text-white ${toast.type === "error" ? "bg-red-600" : "bg-emerald-600"}`}>
                {toast.type === "error" ? "!" : "✓"}
              </span>
              <span>{toast.msg}</span>
            </div>
            <button onClick={() => setToast(null)} className="shrink-0 rounded border border-slate-300 bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200">TUTUP</button>
          </div>
        </div>
      )}

      {(error || successMsg) && (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 p-4">
          {error && (
            <div className="pointer-events-auto flex w-full max-w-3xl items-center justify-between gap-4 rounded-md bg-red-600 p-4 text-sm text-white shadow-2xl">
              <span className="font-semibold">{error}</span>
              <button
                type="button"
                onClick={() => setError("")}
                className="shrink-0 rounded bg-red-700 px-3 py-1 font-bold hover:bg-red-800 focus:ring-2 focus:ring-white"
              >
                Tutup
              </button>
            </div>
          )}
          {successMsg && (
            <div className="pointer-events-auto flex w-full max-w-3xl items-center justify-between gap-4 rounded-md bg-emerald-600 p-4 text-sm text-white shadow-2xl">
              <span className="font-semibold">{successMsg}</span>
              <button
                type="button"
                onClick={() => setSuccessMsg("")}
                className="shrink-0 rounded bg-emerald-700 px-3 py-1 font-bold hover:bg-emerald-800 focus:ring-2 focus:ring-white"
              >
                Tutup
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Content Area: Split layout */}
      <main className="flex min-h-0 flex-1 flex-col lg:flex-row lg:overflow-hidden">

        {/* Left Panel: Input & Aksi */}
        <section className="w-full min-w-0 border-r border-slate-200 bg-white p-3 sm:p-8 lg:w-2/5 lg:flex-none lg:overflow-y-auto xl:w-1/3">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-2 border-b border-slate-200 pb-2">
            <h2 className="text-lg font-bold text-slate-800">Area Scan</h2>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-bold text-white">
                {STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}
              </span>
              <span className="rounded-md bg-slate-800 px-3 py-1.5 text-base font-bold text-white">
                {scannedItemsCount} ITEM
              </span>
            </div>
          </div>

          <div className="space-y-5">
            {/* Mobile: counter murni. Form tetap di DOM (hidden) agar scanner hardware auto-capture + Enter tetap jalan. */}
            <div className="grid grid-cols-3 gap-2 sm:hidden">
              <div className="rounded-lg bg-slate-800 p-3 text-center text-white">
                <p className="text-3xl font-black tabular-nums">{scannedItemsCount}</p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Total</p>
              </div>
              <div className="rounded-lg bg-emerald-600 p-3 text-center text-white">
                <p className="text-3xl font-black tabular-nums">{scannedItemsCount - loadingCount}</p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">Valid</p>
              </div>
              <div className="rounded-lg bg-sky-600 p-3 text-center text-white">
                <p className="text-3xl font-black tabular-nums">{loadingCount}</p>
                <p className="text-[11px] font-bold uppercase tracking-wider text-sky-100">Antre</p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="hidden sm:block">
              <label className="mb-2 block text-sm font-semibold text-slate-700">1. Scan QR / Kode Barang</label>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Arahkan scanner ke sini..."
                autoComplete="off"
                autoFocus
                enterKeyHint="done"
                className="w-full rounded-lg border-2 border-slate-800 bg-white px-4 py-5 text-center text-3xl font-black uppercase tracking-widest text-slate-900 shadow-sm placeholder:font-medium placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-300 focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
              />
              <button type="submit" className="mt-3 w-full rounded-md bg-slate-800 py-3.5 text-base font-bold text-white transition-colors hover:bg-slate-700 focus:outline-none focus:ring-4 focus:ring-slate-400">
                TAMBAH ITEM (ENTER)
              </button>
            </form>

            {/* Konfirmasi terakhir: verifikasi sekilas tanpa baca tabel */}
            {scannedItemsCount > 0 && (
              <div className="mt-4 rounded-md border-2 border-emerald-600 bg-emerald-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Terakhir masuk ✓</p>
                <p className="mt-1 truncate font-mono text-xl font-black text-slate-900" title={scannedItems[0].kode}>
                  {scannedItems[0].kode}
                </p>
                <p className="truncate text-sm font-semibold text-slate-600" title={scannedItems[0].variant}>
                  {scannedItems[0].variant} • {scannedItems[0].waktu}
                </p>
              </div>
            )}

            <div className="hidden sm:block">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-700">2. Status Tujuan</h3>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusBarang)}
                className={inputClass}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <summary className="cursor-pointer text-sm font-bold text-slate-600">Catatan & opsi lain</summary>
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Catatan (Opsional)</label>
                  <input
                    type="text"
                    value={keterangan}
                    onChange={(e) => setKeterangan(e.target.value)}
                    placeholder="Contoh: Shift 1 - Lolos QC"
                    className={inputClass}
                  />
                  <div className="mt-3 flex gap-3">
                    <input ref={bulkInputRef} type="file" accept=".csv,.txt,.json" className="hidden" onChange={handleBulkUpload} />
                    <button
                      type="button"
                      onClick={() => bulkInputRef.current?.click()}
                      className="flex-1 rounded-md border-2 border-slate-300 bg-white py-3 text-sm font-bold text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      UPLOAD CSV
                    </button>
                    {scannedItemsCount > 0 && (
                      <button
                        type="button"
                        onClick={() => { setScannedItems([]); setSuccessMsg(""); }}
                        className="flex-1 rounded-md border-2 border-red-300 bg-white py-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        RESET TABEL
                      </button>
                    )}
                  </div>
                </div>
              </details>
            </div>
          </div>

          {/* Action Area: sticky agar selalu terjangkau */}
          <div className="sticky bottom-0 -mx-3 mt-6 border-t border-slate-200 bg-white/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
            <button
              type="button"
              onClick={handleBulkSubmit}
              disabled={isBulkSubmitting || scannedItemsCount === 0}
              className="flex w-full transform items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-4 text-xl font-black tracking-wide text-white shadow-lg transition active:scale-[0.98] hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
            >
              {isBulkSubmitting ? "MEMPROSES DATA..." : `SIMPAN SEMUA DATA (${scannedItemsCount - loadingCount})`}
            </button>
          </div>
        </section>

        {/* Right Panel: Daftar Scan */}
        <section className="z-0 flex w-full min-w-0 flex-col border-t border-slate-200 bg-transparent lg:border-l lg:border-t-0 lg:flex-1">
          <div className="flex flex-col p-3 sm:p-8 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Daftar Scan Terbaru</h2>
              <span className="rounded bg-white px-2 py-1 text-xs font-bold text-slate-600 shadow-sm">{scannedItemsCount} Baris{loadingCount > 0 ? ` (${loadingCount} antre)` : ""}</span>
            </div>

            {scannedItemsCount > 0 && (
              <div className="mb-4">
                <button type="button" onClick={() => setShowSummary((v) => !v)} className="text-xs font-bold text-sky-700 hover:underline">
                  {showSummary ? "Sembunyikan ringkasan" : "Tampilkan ringkasan"}
                </button>
                {showSummary && (
                  <table className="mt-1 w-full text-left text-sm">
                    <tbody>
                      {Object.entries(itemsPerVariant).map(([variant, count]) => (
                        <tr key={variant} className="border-b border-slate-200">
                          <td className="py-1 pr-2 font-semibold text-slate-600">{variant}</td>
                          <td className="py-1 text-right font-bold text-slate-800">{count} PCS</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            <div className="flex min-h-[300px] flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="min-w-0 flex-1 overflow-auto">
                {scannedItemsCount === 0 ? (
                  <div className="flex h-full min-h-[300px] flex-col items-center justify-center p-10 text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mb-2 h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    <p className="text-lg font-bold text-slate-500">BELUM ADA BARANG</p>
                    <p className="text-sm">Scan barcode untuk memulai proses entry.</p>
                  </div>
                ) : (
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead className="sticky top-0 bg-slate-800">
                      <tr className="text-sm uppercase text-white">
                        <th className="w-12 px-4 py-3 text-left font-bold">No</th>
                        <th className="px-4 py-3 text-left font-bold">Kode Barang</th>
                        <th className="px-4 py-3 text-left font-bold">Varian</th>
                        <th className="hidden w-24 px-4 py-3 text-right font-bold sm:table-cell">Waktu</th>
                        <th className="w-16 px-4 py-3 text-center font-bold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-slate-200">
                      {scannedItems.map((item, index) => (
                        <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <td className="px-2 py-3 text-base font-black text-sky-700 sm:px-4">{index + 1}</td>
                          <td className="px-2 py-3 font-mono text-base font-black tracking-wide text-slate-900 sm:px-4 sm:text-lg">{item.kode}</td>
                          <td className="max-w-[40vw] truncate px-2 py-3 text-sm font-bold leading-snug text-slate-700 sm:max-w-none sm:px-4 sm:text-base">{item.variant}</td>
                          <td className="hidden px-4 py-3 text-right text-sm font-bold tabular-nums text-slate-700 sm:table-cell">{item.waktu}</td>
                          <td className="px-4 py-3 text-center text-lg font-black">
                            {item.loading ? (
                              <span className="inline-block animate-spin text-sky-600" title="Memvalidasi...">⏳</span>
                            ) : (
                              <span className="text-emerald-600" title="Valid">✓</span>
                            )}
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

