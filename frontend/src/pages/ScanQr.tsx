import { useEffect, useRef, useState, type FormEvent } from "react";
import { bulkScanBarang, getScanBarang, type StatusBarang } from "../api/barang";

const STATUS_OPTIONS: { value: StatusBarang; label: string }[] = [
  { value: "FINISHGOOD", label: "Finish Good" },
  { value: "RETUR", label: "Retur" },
  { value: "OUT", label: "Out" },
  { value: "BAD", label: "Bad" },
  { value: "REGISTER", label: "Register" },
];

type ScannedItem = {
  id: number;
  kode: string;
  variant: string;
  waktu: string;
};

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

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(id);
  }, [toast]);

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
      setError("Kode barang belum diisi.");
      setInputValue("");
      inputRef.current?.focus();
      return;
    }

    try {
      const barang = await getScanBarang(kode);
      const alreadyExists = scannedItems.some(
        (item) => item.kode.toLowerCase() === barang.kodeBarang.toLowerCase(),
      );

      if (alreadyExists) {
        setError("Kode barang sudah ada di tabel.");
        return;
      }

      const variantName =
        barang.variant?.product &&
        barang.variant?.style &&
        barang.variant?.color &&
        barang.variant?.size
          ? `${barang.variant.product.nama} / ${barang.variant.style.nama} / ${barang.variant.color.nama} / ${barang.variant.size.nama}`
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
      setSuccessMsg("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Kode barang tidak ditemukan.",
      );
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
        setError("File tidak berisi kodeBarang valid.");
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
              ? `${barang.variant.product.nama} / ${barang.variant.style.nama} / ${barang.variant.color.nama} / ${barang.variant.size.nama}`
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
            variant: "-", 
            waktu: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) 
          });
        }
      }
      setScannedItems((prev) => [...newItems, ...prev]);
      setSuccessMsg(`${newItems.length} kode dimuat dari ${file.name} (total ${codes.length} di file).`);
    } catch {
      setError("Gagal membaca file bulk.");
    } finally {
      if (bulkInputRef.current) bulkInputRef.current.value = "";
    }
  };

  const handleBulkSubmit = async () => {
    const kodeBarang = scannedItems.map((it) => it.kode);
    if (kodeBarang.length === 0) {
      const msg = "Belum ada kode untuk dikirim. Scan atau upload file terlebih dahulu.";
      setError(msg);
      setToast({ type: "error", msg });
      return;
    }
    setIsBulkSubmitting(true);
    setError("");
    setSuccessMsg("");
    
    try {
      const result = await bulkScanBarang(kodeBarang, status, keterangan || undefined);
      const msg = `Bulk selesai: ${result.success.length} berhasil, ${result.failed.length} gagal dari ${kodeBarang.length} kode.`;
      setSuccessMsg(msg);
      setToast({ type: result.failed.length === 0 ? "success" : "success", msg });
      window.dispatchEvent(new CustomEvent("app:toast", { detail: { type: "barang.bulk", message: msg } }));
      
      setScannedItems([]);
      
      if (result.failed.length > 0 && result.success.length === 0) {
        const first = result.failed[0] as unknown as { error?: string; reason?: string; kodeBarang: string };
        const errMsg = first.error ?? first.reason ?? `Gagal bulk: ${result.failed.length} item gagal.`;
        setError(errMsg);
        setToast({ type: "error", msg: errMsg });
      }
    } catch (reqErr) {
      const msg = reqErr instanceof Error ? reqErr.message : "Gagal bulk scan barang";
      setError(msg);
      setToast({ type: "error", msg });
    } finally {
      setIsBulkSubmitting(false);
    }
  };

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
    <main className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      {/* Toast Notification */}
      {toast && (
        <div 
          className={`fixed right-4 top-4 z-50 flex w-[calc(100%-2rem)] max-w-md items-start gap-3 rounded-xl border p-4 text-sm shadow-xl backdrop-blur-sm sm:right-6 sm:top-6 transition-all animate-in slide-in-from-top-4 
            ${toast.type === "error" ? "border-red-200 bg-red-50/90 text-red-900" : "border-emerald-200 bg-emerald-50/90 text-emerald-900"}`} 
          role={toast.type === "error" ? "alert" : "status"}
        >
          <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${toast.type === "error" ? "bg-red-600 text-white" : "bg-emerald-600 text-white"}`}>
            {toast.type === "error" ? "!" : "✓"}
          </span>
          <span className="flex-1 font-medium leading-relaxed">{toast.msg}</span>
          <button type="button" className="text-slate-400 hover:text-slate-600 transition-colors" onClick={() => setToast(null)}>✕</button>
        </div>
      )}

      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-bold tracking-widest text-indigo-600 uppercase">
              Sistem Gudang
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Entry Barang Baru
            </h1>
          </div>
          {scannedItemsCount > 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
              <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center">
                <span className="text-indigo-600 font-black text-lg">{scannedItemsCount}</span>
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Scan</p>
                <p className="text-sm font-semibold text-slate-900">Item siap kirim</p>
              </div>
            </div>
          )}
        </header>

        {/* Main Input Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Scan QR / Ketik kode barang lalu tekan Enter..."
                  autoComplete="off"
                  className="h-14 w-full rounded-xl border border-slate-300 bg-slate-50 pl-4 pr-4 text-base font-medium text-slate-900 transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none"
                />
              </div>
              <button
                type="submit"
                className="h-14 whitespace-nowrap rounded-xl bg-slate-900 px-8 text-sm font-bold text-white transition-all hover:bg-slate-800 focus:ring-4 focus:ring-slate-900/20 active:scale-95"
              >
                Cari Item
              </button>
            </div>
          </form>

          {/* Alert Messages */}
          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800 border border-red-100">
              <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
              {error}
            </div>
          )}
          {successMsg && (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 border border-emerald-100">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              {successMsg}
            </div>
          )}

          {/* Separator */}
          <div className="my-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-100"></div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pengaturan Batch</span>
            <div className="h-px flex-1 bg-slate-100"></div>
          </div>

          {/* Settings & Actions */}
          <div className="grid gap-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Status Barang
                </label>
                <div className="relative">
                  <select 
                    value={status} 
                    onChange={(e) => setStatus(e.target.value as StatusBarang)} 
                    className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 transition-all focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:outline-none cursor-pointer"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-500">
                    ▼
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Keterangan (Opsional)
                </label>
                <input 
                  value={keterangan} 
                  onChange={(e) => setKeterangan(e.target.value)} 
                  placeholder="Misal: Lolos QC Tahap 1" 
                  className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-900 transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:outline-none" 
                />
              </div>
            </div>
            
            {/* Toolbar Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <input ref={bulkInputRef} type="file" accept=".csv,.txt,.json" className="hidden" onChange={handleBulkUpload} />
              
              <button 
                type="button" 
                onClick={() => bulkInputRef.current?.click()} 
                className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 text-sm font-bold text-slate-700 transition-all hover:bg-slate-50 hover:text-slate-900 focus:ring-4 focus:ring-slate-100"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Upload File (.csv)
              </button>

              <button 
                type="button" 
                onClick={handleBulkSubmit} 
                disabled={isBulkSubmitting || scannedItemsCount === 0} 
                className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-8 text-sm font-bold text-white transition-all hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 focus:ring-4 focus:ring-indigo-600/20 shadow-sm shadow-indigo-600/20"
              >
                {isBulkSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Menyimpan...
                  </span>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Simpan {scannedItemsCount > 0 ? `(${scannedItemsCount} Item)` : ""}
                  </>
                )}
              </button>

              {scannedItemsCount > 0 && (
                <button 
                  type="button" 
                  onClick={() => { setScannedItems([]); setSuccessMsg(""); }} 
                  className="w-full sm:w-auto sm:ml-auto inline-flex h-12 items-center justify-center rounded-xl bg-slate-100 px-5 text-sm font-bold text-slate-600 transition-all hover:bg-red-50 hover:text-red-700 focus:ring-4 focus:ring-red-100"
                >
                  Clear Semua
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Ringkasan Variant */}
        {scannedItemsCount > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 px-1">Ringkasan Varian</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(itemsPerVariant).map(([variant, count]) => (
                <div key={variant} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3.5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md">
                  <span className="text-sm font-semibold text-slate-700 truncate pr-4" title={variant}>
                    {variant}
                  </span>
                  <div className="min-w-[2.5rem] text-center bg-slate-100 text-slate-900 text-sm font-black px-2.5 py-1 rounded-lg">
                    {count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Table Section */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
            <h2 className="text-base font-bold text-slate-900">
              Riwayat Scan Terbaru
            </h2>
          </div>

          {scannedItemsCount === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-20 text-center">
              <div className="mb-4 rounded-full bg-slate-50 p-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
              </div>
              <p className="text-sm font-semibold text-slate-900">Belum ada barang di-scan</p>
              <p className="mt-1 text-sm text-slate-500">Mulai scan QR atau masukkan kode barang di atas.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider w-16">
                      No
                    </th>
                    <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Kode Barang
                    </th>
                    <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Varian
                    </th>
                    <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider w-32">
                      Waktu
                    </th>
                    <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider w-32 text-center">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scannedItems.map((item, index) => (
                    <tr
                      key={item.id}
                      className="group bg-white hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-6 py-4 font-semibold text-slate-500">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-1 text-xs font-bold font-mono text-slate-800">
                          {item.kode}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">
                        {item.variant}
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-medium">
                        {item.waktu}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                          Siap
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default ScanQr;