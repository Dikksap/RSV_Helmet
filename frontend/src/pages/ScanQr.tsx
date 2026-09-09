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

const inputClass =
  "h-12 w-full rounded-lg border border-[#D1D5DB] bg-white px-4 text-[15px] font-medium text-[#1F2937] transition-colors duration-200 placeholder:text-[#6B7280] focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/25";

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
    <div className="min-h-screen bg-[#F5F7FA] text-[#1F2937] pb-16 md:pb-24">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 flex w-[calc(100%-2rem)] max-w-md items-start gap-3 rounded-xl border p-4 text-sm shadow-xl sm:right-6 sm:top-6 transition-all duration-200
            ${toast.type === "error" ? "border-[#EF4444]/30 bg-white text-[#1F2937]" : "border-[#10B981]/30 bg-white text-[#1F2937]"}`}
          role={toast.type === "error" ? "alert" : "status"}
        >
          <span aria-hidden="true" className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white ${toast.type === "error" ? "bg-[#EF4444]" : "bg-[#10B981]"}`}>
            {toast.type === "error" ? "!" : "✓"}
          </span>
          <span className="flex-1 font-medium leading-[1.6]">{toast.msg}</span>
          <button type="button" aria-label="Tutup notifikasi" className="rounded-lg px-1 text-[#6B7280] transition-colors duration-200 hover:text-[#1F2937] focus-visible:outline-2 focus-visible:outline-[#00A8E8]" onClick={() => setToast(null)}>✕</button>
        </div>
      )}

      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-6 py-8 md:px-12 md:py-12">

        {/* Header Section */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#00A8E8]">
              Sistem Gudang / Scan
            </p>
            <h1 className="text-[28px] font-semibold leading-[1.3] text-[#1E3A5F] md:text-4xl">
              Entry Barang Baru
            </h1>
            <p className="mt-2 text-[15px] leading-[1.6] text-[#6B7280]">
              Scan QR atau ketik kode barang, atur status batch, lalu simpan sekaligus.
            </p>
          </div>
          {scannedItemsCount > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00A8E8]/10">
                <span className="font-bold text-lg text-[#0088C0]">{scannedItemsCount}</span>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">Total Scan</p>
                <p className="text-sm font-semibold text-[#1F2937]">Item siap kirim</p>
              </div>
            </div>
          )}
        </header>

        {/* Main Input Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <label htmlFor="scan-input" className="sr-only">Kode barang</label>
                <input
                  id="scan-input"
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Scan QR / Ketik kode barang lalu tekan Enter..."
                  autoComplete="off"
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-lg bg-[#00A8E8] px-6 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-[#0088C0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A8E8]"
              >
                Cari Item
              </button>
            </div>
          </form>

          {/* Alert Messages */}
          {error && (
            <div role="alert" className="mt-4 flex items-center gap-2 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/5 px-4 py-3 text-sm font-medium text-[#1F2937]">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#EF4444]" />
              {error}
            </div>
          )}
          {successMsg && (
            <div role="status" className="mt-4 flex items-center gap-2 rounded-lg border border-[#10B981]/30 bg-[#10B981]/5 px-4 py-3 text-sm font-medium text-[#1F2937]">
              <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-[#10B981]" />
              {successMsg}
            </div>
          )}

          {/* Separator */}
          <div className="my-8 flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-200"></div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Pengaturan Batch</span>
            <div className="h-px flex-1 bg-slate-200"></div>
          </div>

          {/* Settings & Actions */}
          <div className="grid gap-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="scan-status" className="text-sm font-medium text-[#1F2937]">
                  Status Barang
                </label>
                <div className="relative">
                  <select
                    id="scan-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as StatusBarang)}
                    className={`${inputClass} cursor-pointer appearance-none pr-10`}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <svg aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-4 my-auto h-4 w-4 text-[#6B7280]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="scan-keterangan" className="text-sm font-medium text-[#1F2937]">
                  Keterangan (Opsional)
                </label>
                <input
                  id="scan-keterangan"
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Misal: Lolos QC Tahap 1"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Toolbar Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <input ref={bulkInputRef} type="file" accept=".csv,.txt,.json" className="hidden" onChange={handleBulkUpload} />

              <button
                type="button"
                onClick={() => bulkInputRef.current?.click()}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border-2 border-[#1E3A5F] bg-transparent px-6 text-[15px] font-medium text-[#1E3A5F] transition-colors duration-200 hover:bg-[#1E3A5F] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A5F] sm:w-auto"
              >
                <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Upload File (.csv)
              </button>

              <button
                type="button"
                onClick={handleBulkSubmit}
                disabled={isBulkSubmitting || scannedItemsCount === 0}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#00A8E8] px-6 text-[15px] font-medium text-white transition-colors duration-200 hover:bg-[#0088C0] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A8E8] sm:w-auto"
              >
                {isBulkSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg aria-hidden="true" className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Menyimpan...
                  </span>
                ) : (
                  <>
                    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Simpan {scannedItemsCount > 0 ? `(${scannedItemsCount} Item)` : ""}
                  </>
                )}
              </button>

              {scannedItemsCount > 0 && (
                <button
                  type="button"
                  onClick={() => { setScannedItems([]); setSuccessMsg(""); }}
                  className="inline-flex h-12 w-full items-center justify-center rounded-lg px-5 text-[15px] font-medium text-[#6B7280] transition-colors duration-200 hover:bg-[#EF4444]/5 hover:text-[#EF4444] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#EF4444] sm:ml-auto sm:w-auto"
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
            <h2 className="px-1 text-[15px] font-semibold text-[#1F2937]">Ringkasan Varian</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(itemsPerVariant).map(([variant, count]) => (
                <div key={variant} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)]">
                  <span className="truncate pr-4 text-sm font-semibold text-[#1F2937]" title={variant}>
                    {variant}
                  </span>
                  <div className="min-w-[2.5rem] rounded-lg bg-[#1E3A5F] px-2.5 py-1 text-center text-sm font-bold text-white">
                    {count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Table Section */}
        <section aria-labelledby="riwayat-scan-h" className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between border-b border-slate-200 bg-[#F5F7FA] px-6 py-4">
            <h2 id="riwayat-scan-h" className="text-[15px] font-semibold text-[#1F2937]">
              Riwayat Scan Terbaru
            </h2>
          </div>

          {scannedItemsCount === 0 ? (
            <div className="flex flex-col items-center justify-center px-5 py-20 text-center">
              <div className="mb-4 rounded-full bg-[#F5F7FA] p-4">
                <svg aria-hidden="true" className="h-8 w-8 text-[#6B7280]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" /></svg>
              </div>
              <p className="text-sm font-semibold text-[#1F2937]">Belum ada barang di-scan</p>
              <p className="mt-1 text-sm text-[#6B7280]">Mulai scan QR atau masukkan kode barang di atas.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-[#F5F7FA]">
                    <th scope="col" className="w-16 px-6 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                      No
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                      Kode Barang
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                      Varian
                    </th>
                    <th scope="col" className="w-32 px-6 py-3.5 text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                      Waktu
                    </th>
                    <th scope="col" className="w-32 px-6 py-3.5 text-center text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scannedItems.map((item, index) => (
                    <tr
                      key={item.id}
                      className="bg-white transition-colors duration-200 hover:bg-[#F5F7FA]"
                    >
                      <td className="px-6 py-4 font-semibold text-[#6B7280]">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-lg bg-[#F5F7FA] px-2 py-1 font-mono text-xs font-bold text-[#1E3A5F]">
                          {item.kode}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-[#1F2937]">
                        {item.variant}
                      </td>
                      <td className="px-6 py-4 font-medium text-[#6B7280]">
                        {item.waktu}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center rounded-full border border-[#10B981]/30 bg-[#10B981]/15 px-2.5 py-1 text-[11px] font-bold text-[#0d9468]">
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
    </div>
  );
}

export default ScanQr;
