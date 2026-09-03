import { useEffect, useRef, useState, type FormEvent } from "react";
import { bulkScanBarang, getScanBarang, type BulkScanResponse, type StatusBarang } from "../api/barang";

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
  const [bulkResult, setBulkResult] = useState<BulkScanResponse | null>(null);
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
    if (e) {
      e.preventDefault();
    }

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
      setBulkResult(null);
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
    setBulkResult(null);
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
      // dedup preview tetap kirim semua (backend akan flag duplicate)
      const newItems: ScannedItem[] = [];
      for (const kode of codes) {
        if (scannedItems.some((it) => it.kode.toLowerCase() === kode.toLowerCase())) continue;
        if (newItems.some((it) => it.kode.toLowerCase() === kode.toLowerCase())) continue;
        // coba lookup untuk tampilkan variant, jika gagal tetap tambah dengan variant -
        try {
          const barang = await getScanBarang(kode);
          const variantName =
            barang.variant?.product && barang.variant?.style && barang.variant?.color && barang.variant?.size
              ? `${barang.variant.product.nama} / ${barang.variant.style.nama} / ${barang.variant.color.nama} / ${barang.variant.size.nama}`
              : "-";
          newItems.push({ id: barang.id ?? Date.now() + Math.random(), kode: barang.kodeBarang, variant: variantName, waktu: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) });
        } catch {
          newItems.push({ id: Date.now() + Math.random(), kode, variant: "-", waktu: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) });
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
    setBulkResult(null);
    try {
      const result = await bulkScanBarang(kodeBarang, status, keterangan || undefined);
      setBulkResult(result);
      const msg = `Bulk selesai: ${result.success.length} berhasil, ${result.failed.length} gagal dari ${kodeBarang.length} kode.`;
      setSuccessMsg(msg);
      setToast({ type: result.failed.length === 0 ? "success" : "success", msg });
      window.dispatchEvent(new CustomEvent("app:toast", { detail: { type: "barang.bulk", message: msg } }));
      // reset table setelah bulk selesai
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
        if (target === inputRef.current) {
          return;
        }
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        void handleSubmit();
        return;
      }

      if (
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        setInputValue((prev) => prev + event.key);
      }
    };

    window.addEventListener("keydown", handleGlobalKeydown);

    return () => {
      window.removeEventListener("keydown", handleGlobalKeydown);
    };
  }, [handleSubmit, inputValue]);

  const scannedItemsCount = scannedItems.length;
  
  // Hitung jumlah barang per variant
  const itemsPerVariant = scannedItems.reduce((acc, item) => {
    acc[item.variant] = (acc[item.variant] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-950">
      {toast && (
        <div className={`fixed right-4 top-20 z-50 flex w-[calc(100%-2rem)] max-w-md items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-xl backdrop-blur sm:right-6 sm:top-24 ${toast.type === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`} role={toast.type === "error" ? "alert" : "status"} aria-live="polite">
          <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${toast.type === "error" ? "bg-red-600 text-white" : "bg-emerald-600 text-white"}`}>{toast.type === "error" ? "!" : "✓"}</span>
          <span className="flex-1 leading-6">{toast.msg}</span>
          <button type="button" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-black/5 hover:bg-black/10" aria-label="Tutup notifikasi" onClick={() => setToast(null)}>×</button>
        </div>
      )}

      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              SCAN QR / INPUT BARANG
            </p>
            <h1 className="text-3xl font-black tracking-tight text-zinc-950">
              Entry Barang
            </h1>
          </div>
          {scannedItemsCount > 0 && (
            <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-3 shadow-sm">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Total Barang</p>
              <p className="text-2xl font-black text-zinc-950">{scannedItemsCount}</p>
            </div>
          )}
        </header>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4"
          >
            <div className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Masukkan kode barang atau scan QR"
                autoComplete="off"
                className="h-14 flex-1 rounded-xl border border-zinc-300 bg-zinc-50 px-4 text-base text-zinc-950 outline-none transition focus:border-zinc-500 focus:ring-4 focus:ring-zinc-100"
              />
              <button
                type="submit"
                className="h-14 rounded-xl bg-zinc-950 px-8 text-sm font-semibold text-white transition hover:bg-zinc-800 active:scale-95"
              >
                Cari
              </button>
            </div>
          </form>

          {error && <p className="mt-4 text-sm font-medium text-red-600 bg-red-50 px-4 py-2 rounded-lg">{error}</p>}
          {successMsg && <p className="mt-4 text-sm font-medium text-emerald-700 bg-emerald-50 px-4 py-2 rounded-lg">{successMsg}</p>}

          <div className="mt-6 border-t border-zinc-100 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Status</span>
                <select value={status} onChange={(e) => setStatus(e.target.value as StatusBarang)} className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-semibold text-zinc-950 focus:border-zinc-500 focus:outline-none">
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Keterangan (opsional)</span>
                <input value={keterangan} onChange={(e) => setKeterangan(e.target.value)} placeholder="Misal: QC Pass" className="h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none" />
              </label>
            </div>
            
            <div className="mt-6 flex items-center gap-3">
              <input ref={bulkInputRef} type="file" accept=".csv,.txt,.json" className="hidden" onChange={handleBulkUpload} />
              <button type="button" onClick={() => bulkInputRef.current?.click()} className="inline-flex h-12 items-center justify-center rounded-xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-950 hover:bg-zinc-50 transition">Upload File</button>
              <button type="button" onClick={handleBulkSubmit} disabled={isBulkSubmitting || scannedItemsCount === 0} className="inline-flex h-12 items-center justify-center rounded-xl bg-zinc-950 px-6 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-40 transition">
                {isBulkSubmitting ? "Mengirim..." : `Simpan Semua (${scannedItemsCount})`}
              </button>
              {scannedItemsCount > 0 && <button type="button" onClick={() => { setScannedItems([]); setBulkResult(null); setSuccessMsg(""); }} className="ml-auto inline-flex h-12 items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-600 hover:text-red-600 hover:border-red-200 transition">Clear</button>}
            </div>
          </div>
        </div>

        {/* Ringkasan Variant */}
        {scannedItemsCount > 0 && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6">
            <h3 className="text-sm font-bold text-zinc-950 mb-4 uppercase tracking-wider">Ringkasan per Variant</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(itemsPerVariant).map(([variant, count]) => (
                <div key={variant} className="flex justify-between items-center bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-3">
                  <span className="text-sm font-medium text-zinc-700 truncate mr-4">{variant}</span>
                  <span className="text-sm font-black text-zinc-950 bg-white px-3 py-1 rounded-lg border border-zinc-200 shadow-sm">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-5 py-4">
            <h2 className="text-lg font-black tracking-tight text-zinc-900">
              Daftar Input Terbaru
            </h2>
            <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-bold text-zinc-700">
              {scannedItemsCount} item
            </span>
          </div>

          {scannedItemsCount === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-zinc-500">
              Belum ada data yang sesuai dengan kode barang.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-zinc-50 text-zinc-600">
                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider">
                      No
                    </th>
                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider">
                      Kode Barang
                    </th>
                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider">
                      Variant
                    </th>
                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider">
                      Waktu
                    </th>
                    <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {scannedItems.map((item, index) => (
                    <tr
                      key={item.id}
                      className="border-t border-zinc-200 hover:bg-zinc-50"
                    >
                      <td className="px-5 py-3 font-semibold text-zinc-700">
                        {index + 1}
                      </td>
                      <td className="px-5 py-3 font-mono font-bold text-zinc-900">
                        {item.kode}
                      </td>
                      <td className="px-5 py-3 text-zinc-700">
                        {item.variant}
                      </td>
                      <td className="px-5 py-3 text-zinc-600">{item.waktu}</td>
                      <td className="px-5 py-3">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          Ditemukan
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
