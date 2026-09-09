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

  const bulkInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleSubmit = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const kode = inputValue.trim();

    if (!kode) {
      setError("KODE BARANG KOSONG! Silakan scan ulang.");
      setInputValue("");
      inputRef.current?.focus();
      beep(false);
      return;
    }

    try {
      const barang = await getScanBarang(kode);
      const alreadyExists = scannedItems.some(
        (item) => item.kode.toLowerCase() === barang.kodeBarang.toLowerCase(),
      );

      if (alreadyExists) {
        setError(`DUPLIKAT! Kode ${kode} sudah ada di daftar bawah.`);
        setInputValue("");
        beep(false);
        return;
      }

      const variantName =
        barang.variant?.product &&
        barang.variant?.style &&
        barang.variant?.color &&
        barang.variant?.size
          ? `${barang.variant.product.nama} ${barang.variant.style.nama} ${barang.variant.color.nama} ${barang.variant.size.nama}`
          : "-";

      const newItem: ScannedItem = {
        id: barang.id ?? Date.now(),
        kode: barang.kodeBarang,
        variant: variantName,
        waktu: new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      };

      setScannedItems((prev) => [newItem, ...prev]);
      setError("");
      setSuccessMsg(`SUKSES: ${kode} ditambahkan!`);
      beep(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : `GAGAL! Kode ${kode} tidak ditemukan di sistem.`,
      );
      beep(false);
    } finally {
      setInputValue("");
      inputRef.current?.focus();
    }
  };

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

      const newItems: ScannedItem[] = [];
      for (const kode of codes) {
        if (scannedItems.some((it) => it.kode.toLowerCase() === kode.toLowerCase())) continue;
        if (newItems.some((it) => it.kode.toLowerCase() === kode.toLowerCase())) continue;
        try {
          const barang = await getScanBarang(kode);
          const variantName =
            barang.variant?.product && barang.variant?.style && barang.variant?.color && barang.variant?.size
              ? `${barang.variant.product.nama} ${barang.variant.style.nama} ${barang.variant.color.nama} ${barang.variant.size.nama}`
              : "-";
          newItems.push({
            id: barang.id ?? Date.now() + Math.random(),
            kode: barang.kodeBarang,
            variant: variantName,
            waktu: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
          });
        } catch {
          newItems.push({
            id: Date.now() + Math.random(),
            kode,
            variant: "TIDAK DITEMUKAN",
            waktu: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
          });
        }
      }
      setScannedItems((prev) => [...newItems, ...prev]);
      setSuccessMsg(`BULK LOAD SUKSES: ${newItems.length} kode dimuat.`);
    } catch {
      setError("Gagal membaca file bulk.");
    } finally {
      if (bulkInputRef.current) bulkInputRef.current.value = "";
    }
  };

  const handleBulkSubmit = async () => {
    const kodeBarang = scannedItems.map((it) => it.kode);
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

      setScannedItems([]);

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
  useEffect(() => {
    const handleGlobalKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const activeTag = target?.tagName;

      if (activeTag && ["INPUT", "TEXTAREA", "SELECT"].includes(activeTag)) {
        if (target === inputRef.current) return;
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        void handleSubmit();
        return;
      }

      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        setInputValue((prev) => prev + event.key);
      }
    };

    window.addEventListener("keydown", handleGlobalKeydown);
    return () => window.removeEventListener("keydown", handleGlobalKeydown);
  }, [handleSubmit, inputValue]);

  const scannedItemsCount = scannedItems.length;

  const itemsPerVariant = scannedItems.reduce((acc, item) => {
    acc[item.variant] = (acc[item.variant] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col bg-slate-100 font-[Inter,sans-serif] text-slate-800 md:min-h-[calc(100dvh-72px)] lg:h-[calc(100dvh-72px)] lg:overflow-hidden">
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
        <section className="w-full min-w-0 border-r border-slate-200 bg-white p-5 sm:p-8 lg:w-2/5 lg:flex-none lg:overflow-y-auto xl:w-1/3">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-2 border-b border-slate-200 pb-2">
            <h2 className="text-lg font-bold text-slate-800">Area Scan</h2>
            <span className="rounded-md bg-slate-800 px-3 py-1.5 text-base font-bold text-white">
              {scannedItemsCount} ITEM
            </span>
          </div>

          <div className="space-y-7">
            <form onSubmit={handleSubmit}>
              <label className="mb-2 block text-sm font-semibold text-slate-700">1. Scan QR / Kode Barang</label>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Arahkan scanner ke sini..."
                autoComplete="off"
                className="w-full rounded-md border-2 border-slate-800 bg-white px-4 py-4 text-center text-2xl font-black uppercase tracking-widest text-slate-900 shadow-sm placeholder:font-medium placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-300 focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/20"
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

            <div>
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-700">2. Aksi & Konfigurasi Batch</h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Status Tujuan</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as StatusBarang)}
                    className={inputClass}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Catatan (Opsional)</label>
                  <input
                    type="text"
                    value={keterangan}
                    onChange={(e) => setKeterangan(e.target.value)}
                    placeholder="Contoh: Shift 1 - Lolos QC"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Area: sticky agar selalu terjangkau */}
          <div className="sticky bottom-0 mt-8 border-t border-slate-200 bg-white pt-4 pb-1">
            <button
              type="button"
              onClick={handleBulkSubmit}
              disabled={isBulkSubmitting || scannedItemsCount === 0}
              className="flex w-full transform items-center justify-center gap-2 rounded-md bg-sky-500 px-6 py-4 text-lg font-bold text-white shadow-lg transition active:scale-[0.98] hover:bg-sky-600 focus:outline-none focus:ring-4 focus:ring-sky-300 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
            >
              {isBulkSubmitting ? "MEMPROSES DATA..." : `SIMPAN SEMUA DATA (${scannedItemsCount})`}
            </button>
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
        </section>

        {/* Right Panel: Daftar Scan */}
        <section className="z-0 flex w-full min-w-0 flex-col border-t border-slate-200 bg-slate-100 lg:border-l lg:border-t-0 lg:flex-1">
          <div className="flex flex-col p-5 sm:p-8 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Daftar Scan Terbaru</h2>
              <span className="rounded bg-white px-2 py-1 text-xs font-bold text-slate-600 shadow-sm">{scannedItemsCount} Baris Data</span>
            </div>

            {scannedItemsCount > 0 && (
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Object.entries(itemsPerVariant).map(([variant, count]) => (
                  <div key={variant} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="truncate text-xs font-bold text-slate-500" title={variant}>{variant}</p>
                    <p className="text-xl font-black text-slate-800">{count} <span className="text-xs font-semibold">PCS</span></p>
                  </div>
                ))}
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
                        <th className="w-24 px-4 py-3 text-right font-bold">Waktu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-slate-200">
                      {scannedItems.map((item, index) => (
                        <tr key={item.id} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <td className="px-4 py-3 text-base font-black text-sky-700">{index + 1}</td>
                          <td className="px-4 py-3 font-mono text-lg font-black tracking-wide text-slate-900">{item.kode}</td>
                          <td className="px-4 py-3 text-base font-bold leading-snug text-slate-700">{item.variant}</td>
                          <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-slate-700">{item.waktu}</td>
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

