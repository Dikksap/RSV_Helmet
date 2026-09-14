import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createBarang,
  deleteBarang,
  exportBarang,
  getBarangPage,
  searchBarang,
  updateBarang,
  type Barang,
  type StatusBarang,
} from "../api/barang";
import { getProducts, type Product } from "../api/products";
import { HeaderSection } from "../components/DaftarBarang/HeaderSection";
import { FilterSection } from "../components/DaftarBarang/FilterSection";
import { BarangTable } from "../components/DaftarBarang/BarangTable";
import { Pagination } from "../components/DaftarBarang/Pagination";
import { HangtagModal } from "../components/DaftarBarang/HangtagModal";
import { useLiveSocketContext } from "../lib/LiveSocketContext";

const STATUS_OPTIONS: { value: StatusBarang; label: string }[] = [
  { value: "REGISTER", label: "REGISTER" },
  { value: "FINISHGOOD", label: "FINISHGOOD" },
  { value: "RETUR", label: "RETUR" },
  { value: "OUT", label: "OUT" },
  { value: "BAD", label: "BAD" },
];

function DaftarBarang() {
  const [barang, setBarang] = useState<Barang[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [variantFilter, setVariantFilter] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [tanggalAwal, setTanggalAwal] = useState(() => new Date().toISOString().slice(0, 10));
  const [tanggalAkhir, setTanggalAkhir] = useState(() => new Date().toISOString().slice(0, 10));
  const [datePreset, setDatePreset] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBarang, setTotalBarang] = useState(0);
  const [selectedBarang, setSelectedBarang] = useState<Barang | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isExporting, setIsExporting] = useState(false);

  // CRUD modal state
  const [showCreate, setShowCreate] = useState(false);
  const [editingBarang, setEditingBarang] = useState<Barang | null>(null);
  const [deletingBarang, setDeletingBarang] = useState<Barang | null>(null);
  const [crudLoading, setCrudLoading] = useState(false);
  const [crudError, setCrudError] = useState<string | null>(null);

  // Create form state
  const [cVariantId, setCVariantId] = useState("");
  const [cBatchId, setCBatchId] = useState("");
  const [cKodeBarang, setCKodeBarang] = useState("");
  const [cTanggal, setCTanggal] = useState("");
  const [cStatus, setCStatus] = useState<StatusBarang>("REGISTER");
  const [cKeterangan, setCKeterangan] = useState("");

  // Edit form state
  const [eVariantId, setEVariantId] = useState("");
  const [eBatchId, setEBatchId] = useState("");
  const [eBatchDetach, setEBatchDetach] = useState(false);
  const [eKodeBarang, setEKodeBarang] = useState("");
  const [eTanggal, setETanggal] = useState("");
  const [eStatus, setEStatus] = useState<StatusBarang>("REGISTER");
  const [eKeterangan, setEKeterangan] = useState("");

  const { subscribe } = useLiveSocketContext();
  const currentPageRef = useRef(currentPage);
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const hasActiveFilters =
    Boolean(search) ||
    Boolean(statusFilter) ||
    Boolean(variantFilter) ||
    Boolean(tanggalAwal) ||
    Boolean(tanggalAkhir);

  // Debounce ketikan search 400ms agar tidak hit /barang/search tiap keystroke
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => window.clearTimeout(t);
  }, [search]);

  const fetchBarang = useCallback(
    async (page = 1) => {
      setIsLoading(true);
      setError(null);
      try {
        const data =
          debouncedSearch &&
          !statusFilter &&
          !variantFilter &&
          !tanggalAwal &&
          !tanggalAkhir
            ? await searchBarang(debouncedSearch, 20)
            : await getBarangPage({
                page,
                limit: 20,
                variantId: variantFilter ? Number(variantFilter) : undefined,
                status: statusFilter
                  ? (statusFilter as StatusBarang)
                  : undefined,
                tanggalAwal: tanggalAwal || undefined,
                tanggalAkhir: tanggalAkhir || undefined,
              });
        setBarang(data.data);
        setTotalPages("totalPages" in data.meta ? data.meta.totalPages : 1);
        setTotalBarang(
          "total" in data.meta ? data.meta.total : data.meta.count,
        );
        setCurrentPage(page);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat barang");
      } finally {
        setIsLoading(false);
      }
    },
    [tanggalAwal, tanggalAkhir, variantFilter, debouncedSearch, statusFilter],
  );

  useEffect(() => {
    const refreshId = window.setTimeout(() => void fetchBarang(1), 0);
    return () => window.clearTimeout(refreshId);
  }, [fetchBarang]);

  // live update: refetch saat ada event barang.* — aman dipakai bareng AdminDashboard karena subscribe = Set multi-subscriber
  useEffect(() => {
    return subscribe((payload) => {
      if (payload.type.startsWith("barang.")) {
        void fetchBarang(currentPageRef.current);
      }
    });
  }, [subscribe, fetchBarang]);

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedBarang(null);
        setShowCreate(false);
        setEditingBarang(null);
        setDeletingBarang(null);
      }
    };
    if (selectedBarang || showCreate || editingBarang || deletingBarang) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedBarang, showCreate, editingBarang, deletingBarang]);

  useEffect(() => {
    if (!successMsg) return;
    const t = window.setTimeout(() => setSuccessMsg(null), 3000);
    return () => window.clearTimeout(t);
  }, [successMsg]);

  const variantOptions = useMemo(
    () =>
      products
        .flatMap((product) =>
          product.variants.map((variant) => ({
            id: variant.id,
            nama: `${product.nama} / ${variant.style.nama} / ${variant.color.nama} / ${variant.size.nama}`,
          })),
        )
        .sort((a, b) => a.nama.localeCompare(b.nama)),
    [products],
  );

  const handleResetFilters = () => {
    setSearch("");
    setStatusFilter("");
    setVariantFilter("");
    setTanggalAwal("");
    setTanggalAkhir("");
    setDatePreset("");
  };

  const handleExport = async (format: "json" | "csv") => {
    setIsExporting(true);
    try {
      const blob = await exportBarang({
        format,
        variantId: variantFilter ? Number(variantFilter) : undefined,
        status: statusFilter ? (statusFilter as StatusBarang) : undefined,
        tanggalAwal: tanggalAwal || undefined,
        tanggalAkhir: tanggalAkhir || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `barang-export-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal export barang");
    } finally {
      setIsExporting(false);
    }
  };

  // CRUD handlers
  const openCreate = () => {
    setCrudError(null);
    setCVariantId(variantFilter || "");
    setCBatchId("");
    setCKodeBarang("");
    setCTanggal("");
    setCStatus("REGISTER");
    setCKeterangan("");
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!cVariantId) {
      setCrudError("Field 'variantId' wajib diisi");
      return;
    }
    setCrudLoading(true);
    setCrudError(null);
    try {
      const payload: {
        variantId: number;
        batchId?: number | null;
        kodeBarang?: string;
        tanggal?: string;
        status?: StatusBarang;
        keterangan?: string;
      } = {
        variantId: Number(cVariantId),
      };
      if (cBatchId.trim()) payload.batchId = Number(cBatchId);
      if (cKodeBarang.trim()) payload.kodeBarang = cKodeBarang.trim();
      if (cTanggal) payload.tanggal = new Date(cTanggal).toISOString();
      if (cStatus) payload.status = cStatus;
      if (cKeterangan.trim()) payload.keterangan = cKeterangan.trim();

      const created = await createBarang(payload);
      setShowCreate(false);
      setSuccessMsg(`Barang ${created.kodeBarang} berhasil dibuat`);
      window.dispatchEvent(new CustomEvent("app:toast", { detail: { type: "barang.created", message: `Barang ${created.kodeBarang} berhasil dibuat` } }));
      await fetchBarang(1);
    } catch (err) {
      setCrudError(err instanceof Error ? err.message : "Gagal membuat barang");
    } finally {
      setCrudLoading(false);
    }
  };

  const openEdit = (item: Barang) => {
    setCrudError(null);
    setEditingBarang(item);
    setEVariantId(String(item.variantId));
    setEBatchId(item.batchId ? String(item.batchId) : "");
    setEBatchDetach(false);
    setEKodeBarang(item.kodeBarang);
    setETanggal(item.tanggal ? item.tanggal.slice(0, 10) : "");
    setEStatus(item.status);
    setEKeterangan("");
  };

  const handleUpdate = async () => {
    if (!editingBarang) return;
    setCrudLoading(true);
    setCrudError(null);
    try {
      const payload: {
        variantId?: number;
        batchId?: number | null;
        kodeBarang?: string;
        tanggal?: string;
        status?: StatusBarang;
        keterangan?: string;
      } = {};

      if (eVariantId) {
        const vNum = Number(eVariantId);
        if (!Number.isNaN(vNum) && vNum !== editingBarang.variantId) payload.variantId = vNum;
        else if (Number.isNaN(vNum)) {
          setCrudError("Field 'variantId' harus angka");
          setCrudLoading(false);
          return;
        }
      }
      if (eBatchDetach) payload.batchId = null;
      else if (eBatchId.trim()) {
        const n = Number(eBatchId);
        if (Number.isNaN(n)) {
          setCrudError("Field 'batchId' harus angka");
          setCrudLoading(false);
          return;
        }
        if (n !== editingBarang.batchId) payload.batchId = n;
      }
      if (eKodeBarang.trim() && eKodeBarang.trim() !== editingBarang.kodeBarang) payload.kodeBarang = eKodeBarang.trim();
      // tanggal: compare YYYY-MM-DD strings to avoid timezone shift
      if (eTanggal) {
        const originalSlice = editingBarang.tanggal ? editingBarang.tanggal.slice(0, 10) : "";
        if (eTanggal !== originalSlice) {
          // send as ISO at midnight local -> backend parses to Date
          const d = new Date(eTanggal + "T00:00:00");
          if (Number.isNaN(d.getTime())) {
            setCrudError("Field 'tanggal' harus tanggal valid");
            setCrudLoading(false);
            return;
          }
          payload.tanggal = d.toISOString();
        }
      }
      if (eStatus !== editingBarang.status) {
        payload.status = eStatus;
        if (eKeterangan.trim()) payload.keterangan = eKeterangan.trim();
      } else if (eKeterangan.trim()) {
        // keterangan tanpa ganti status tidak valid (backend butuh minimal 1 field dari 5 utama)
        setCrudError("Keterangan hanya bisa diisi jika status diubah");
        setCrudLoading(false);
        return;
      }

      const hasChanges = Object.keys(payload).length > 0;
      if (!hasChanges) {
        setCrudError("Tidak ada perubahan untuk disimpan");
        setCrudLoading(false);
        return;
      }

      const updated = await updateBarang(editingBarang.id, payload);
      setEditingBarang(null);
      setSuccessMsg(`Barang ${updated.kodeBarang} berhasil diperbarui`);
      window.dispatchEvent(new CustomEvent("app:toast", { detail: { type: "barang.updated", message: `Barang ${updated.kodeBarang} berhasil diperbarui` } }));
      await fetchBarang(currentPage);
    } catch (err) {
      setCrudError(err instanceof Error ? err.message : "Gagal memperbarui barang");
    } finally {
      setCrudLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingBarang) return;
    setCrudLoading(true);
    setCrudError(null);
    try {
      await deleteBarang(deletingBarang.id);
      setDeletingBarang(null);
      setSuccessMsg(`Barang ${deletingBarang.kodeBarang} berhasil dihapus`);
      window.dispatchEvent(new CustomEvent("app:toast", { detail: { type: "barang.deleted", message: `Barang ${deletingBarang.kodeBarang} berhasil dihapus` } }));
      // if last item on page, go prev page
      const nextPage = barang.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
      await fetchBarang(nextPage);
    } catch (err) {
      setCrudError(err instanceof Error ? err.message : "Gagal menghapus barang");
    } finally {
      setCrudLoading(false);
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const formatRelativeTime = (date: string, nowMs: number) => {
    const diffMs = nowMs - new Date(date).getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return "baru saja";
    if (minutes < 60) return `${minutes} menit lalu`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} jam lalu`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} hari lalu`;
    return `${Math.floor(days / 7)} minggu lalu`;
  };

  const inputCls =
    "h-12 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-[15px] text-[#1F2937] outline-none transition duration-200 ease placeholder:text-[#6B7280]/70 focus:border-[#00A8E8] focus:ring-2 focus:ring-[#00A8E8]/20";
  const labelCls = "flex flex-col gap-1.5 text-sm font-medium text-[#1F2937]";
  const textareaCls =
    "min-h-[88px] w-full rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-[15px] text-[#1F2937] outline-none transition duration-200 ease placeholder:text-[#6B7280]/70 focus:border-[#00A8E8] focus:ring-2 focus:ring-[#00A8E8]/20";

  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-6">
      <HeaderSection
        totalBarang={totalBarang}
        isExporting={isExporting}
        onExportCSV={() => handleExport("csv")}
        onExportJSON={() => handleExport("json")}
        onCreate={openCreate}
      />

      <FilterSection
        search={search}
        statusFilter={statusFilter}
        variantFilter={variantFilter}
        tanggalAwal={tanggalAwal}
        tanggalAkhir={tanggalAkhir}
        datePreset={datePreset}
        variantOptions={variantOptions}
        currentPage={currentPage}
        totalPages={totalPages}
        hasActiveFilters={hasActiveFilters}
        onSearchChange={setSearch}
        onStatusChange={setStatusFilter}
        onVariantChange={setVariantFilter}
        onDatePresetChange={setDatePreset}
        onTanggalAwalChange={setTanggalAwal}
        onTanggalAkhirChange={setTanggalAkhir}
        onResetFilters={handleResetFilters}
      />

      {successMsg && (
        <div role="status" className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-[15px] text-emerald-700">
          <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
          <span>{successMsg}</span>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3" aria-label="Memuat data barang">
          {/* Mobile skeleton cards */}
          <div className="grid gap-3 md:hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-xl border border-slate-200 bg-white p-6">
                <div className="h-3 w-2/5 rounded bg-slate-200" />
                <div className="mt-2 h-4 w-3/5 rounded bg-slate-200" />
                <div className="mt-2 h-3 w-4/5 rounded bg-slate-100" />
              </div>
            ))}
          </div>
          {/* Desktop skeleton */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)] md:block">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex animate-pulse gap-4 border-b border-slate-100 py-3 last:border-0">
                <div className="h-4 w-8 rounded bg-slate-200" />
                <div className="h-4 flex-1 rounded bg-slate-200" />
                <div className="h-4 w-24 rounded bg-slate-100" />
              </div>
            ))}
            <p className="pt-2 text-center text-sm text-[#6B7280]">Memuat data barang...</p>
          </div>
        </div>
      )}

      {error && !isLoading && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-[15px] text-[#EF4444]">
          <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          <span>{error}</span>
        </div>
      )}

      {!isLoading && !error && (
        <section className="space-y-3 sm:space-y-4">
          {barang.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-white p-8 text-center shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:p-12">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#F5F7FA] text-[#1E3A5F]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>
              </div>
              <p className="mt-3 text-base font-semibold text-[#1F2937]">
                {hasActiveFilters ? "Tidak ada hasil" : "Belum ada data barang"}
              </p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-[#6B7280]">
                {hasActiveFilters
                  ? "Coba ubah kata kunci atau reset filter untuk melihat data lain."
                  : "Tambahkan barang pertama untuk mulai mengelola inventory."}
              </p>
              {hasActiveFilters ? (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-4 inline-flex min-h-[48px] items-center rounded-lg border-2 border-[#1E3A5F] bg-transparent px-6 py-3 text-sm font-medium text-[#1E3A5F] transition duration-200 ease hover:bg-[#1E3A5F]/5 active:scale-[0.98]"
                >
                  Reset Filter
                </button>
              ) : (
                <button
                  type="button"
                  onClick={openCreate}
                  className="mt-4 inline-flex min-h-[48px] items-center rounded-lg bg-[#00A8E8] px-6 py-3 text-sm font-medium text-white transition duration-200 ease hover:bg-[#0088C0] active:scale-[0.98]"
                >
                  + Tambah Barang
                </button>
              )}
            </div>
          ) : (
            <>
              <BarangTable
                barang={barang}
                currentPage={currentPage}
                totalBarang={totalBarang}
                now={now}
                onRowClick={setSelectedBarang}
                onEdit={openEdit}
                onDelete={setDeletingBarang}
                formatDate={formatDate}
                formatRelativeTime={formatRelativeTime}
              />
              {totalPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={fetchBarang}
                />
              )}
            </>
          )}
        </section>
      )}

      {selectedBarang && (
        <HangtagModal
          barang={selectedBarang}
          products={products}
          onClose={() => setSelectedBarang(null)}
        />
      )}

      {/* CREATE MODAL — bottom sheet on mobile */}
      {showCreate && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0F1C2E]/60 backdrop-blur-sm sm:items-center sm:p-4"
          role="presentation"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-xl border border-slate-200 bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_4px_20px_rgba(0,0,0,0.12)] sm:max-w-lg sm:rounded-xl"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              aria-label="Tutup"
              className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F5F7FA] hover:text-[#1F2937]"
            >
              ✕
            </button>
            <p className="text-xs font-bold uppercase tracking-widest text-[#00A8E8]">Tambah Barang</p>
            <h2 className="mt-1 text-xl font-bold text-[#1E3A5F]">Buat Barang Baru</h2>
            <p className="mt-1 text-sm text-[#6B7280]">Kode otomatis jika kosong. Batch kosong = pakai batch AKTIF.</p>

            {crudError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#EF4444]">{crudError}</div>
            )}

            <div className="mt-4 grid gap-3">
              <label className={labelCls}>
                <span>Variant *</span>
                <select className={inputCls} value={cVariantId} onChange={(e) => setCVariantId(e.target.value)}>
                  <option value="">Pilih variant...</option>
                  {variantOptions.map((opt) => (
                    <option key={opt.id} value={String(opt.id)}>{opt.nama}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className={labelCls}>
                  <span>Batch ID (opsional)</span>
                  <input type="number" inputMode="numeric" className={inputCls} placeholder="Kosong = auto" value={cBatchId} onChange={(e) => setCBatchId(e.target.value)} />
                </label>
                <label className={labelCls}>
                  <span>Status</span>
                  <select className={inputCls} value={cStatus} onChange={(e) => setCStatus(e.target.value as StatusBarang)}>
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className={labelCls}>
                <span>Kode Barang (opsional, unik)</span>
                <input className={inputCls} placeholder="Kosong = auto-generate BCxxx-..." value={cKodeBarang} onChange={(e) => setCKodeBarang(e.target.value)} />
              </label>

              <label className={labelCls}>
                <span>Tanggal (opsional)</span>
                <input type="date" className={inputCls} value={cTanggal} onChange={(e) => setCTanggal(e.target.value)} />
              </label>

              <label className={labelCls}>
                <span>Keterangan (opsional, masuk RiwayatBarang)</span>
                <textarea className={textareaCls} placeholder="Barang dibuat (manual)" value={cKeterangan} onChange={(e) => setCKeterangan(e.target.value)} />
              </label>
            </div>

            <div className="sticky bottom-0 -mx-5 mt-6 flex gap-2 border-t border-slate-200 bg-white/95 px-5 pb-[max(0px,env(safe-area-inset-bottom))] pt-4 backdrop-blur sm:static sm:mx-0 sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-lg border border-[#D1D5DB] bg-white px-4 py-3 text-sm font-medium text-[#1F2937] hover:bg-[#F5F7FA] sm:flex-none"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={crudLoading}
                className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-lg bg-[#00A8E8] px-6 py-3 text-sm font-medium text-white hover:bg-[#0088C0] disabled:opacity-50 sm:flex-none"
              >
                {crudLoading ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL — bottom sheet on mobile */}
      {editingBarang && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0F1C2E]/60 backdrop-blur-sm sm:items-center sm:p-4"
          role="presentation"
          onClick={() => setEditingBarang(null)}
        >
          <div
            className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-xl border border-slate-200 bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_4px_20px_rgba(0,0,0,0.12)] sm:max-w-lg sm:rounded-xl"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setEditingBarang(null)}
              aria-label="Tutup"
              className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F5F7FA] hover:text-[#1F2937]"
            >
              ✕
            </button>
            <p className="text-xs font-bold uppercase tracking-widest text-[#00A8E8]">Edit Barang</p>
            <h2 className="mt-1 font-mono text-sm font-bold text-[#1E3A5F]">{editingBarang.kodeBarang}</h2>

            {crudError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#EF4444]">{crudError}</div>
            )}

            <div className="mt-4 grid gap-3">
              <label className={labelCls}>
                <span>Variant</span>
                <select className={inputCls} value={eVariantId} onChange={(e) => setEVariantId(e.target.value)}>
                  {variantOptions.map((opt) => (
                    <option key={opt.id} value={String(opt.id)}>{opt.nama}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className={labelCls}>
                  <span>Batch ID</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    className={inputCls}
                    placeholder="ID batch"
                    value={eBatchId}
                    onChange={(e) => setEBatchId(e.target.value)}
                    disabled={eBatchDetach}
                  />
                  <label className="mt-1 flex items-center gap-1.5 text-xs font-normal text-[#6B7280]">
                    <input type="checkbox" checked={eBatchDetach} onChange={(e) => setEBatchDetach(e.target.checked)} />
                    Lepas dari batch (null)
                  </label>
                </label>
                <label className={labelCls}>
                  <span>Status</span>
                  <select className={inputCls} value={eStatus} onChange={(e) => setEStatus(e.target.value as StatusBarang)}>
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className={labelCls}>
                <span>Kode Barang</span>
                <input className={inputCls} value={eKodeBarang} onChange={(e) => setEKodeBarang(e.target.value)} />
              </label>

              <label className={labelCls}>
                <span>Tanggal</span>
                <input type="date" className={inputCls} value={eTanggal} onChange={(e) => setETanggal(e.target.value)} />
              </label>

              <label className={labelCls}>
                <span>Keterangan</span>
                <textarea className={textareaCls} placeholder="Tambahkan keterangan jika diperlukan" value={eKeterangan} onChange={(e) => setEKeterangan(e.target.value)} />
              </label>
            </div>

            <div className="sticky bottom-0 -mx-5 mt-6 flex gap-2 border-t border-slate-200 bg-white/95 px-5 pb-[max(0px,env(safe-area-inset-bottom))] pt-4 backdrop-blur sm:static sm:mx-0 sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
              <button
                type="button"
                onClick={() => setEditingBarang(null)}
                className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-lg border border-[#D1D5DB] bg-white px-4 py-3 text-sm font-medium text-[#1F2937] hover:bg-[#F5F7FA] sm:flex-none"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleUpdate}
                disabled={crudLoading}
                className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-lg bg-[#00A8E8] px-6 py-3 text-sm font-medium text-white hover:bg-[#0088C0] disabled:opacity-50 sm:flex-none"
              >
                {crudLoading ? "Menyimpan..." : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM — bottom sheet on mobile */}
      {deletingBarang && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0F1C2E]/60 backdrop-blur-sm sm:items-center sm:p-4"
          role="presentation"
          onClick={() => setDeletingBarang(null)}
        >
          <div
            className="relative w-full rounded-t-xl border border-slate-200 bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_4px_20px_rgba(0,0,0,0.12)] sm:max-w-md sm:rounded-xl"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
            <h2 className="pr-8 text-lg font-bold text-[#1E3A5F]">Hapus Barang?</h2>
            <p className="mt-2 text-[15px] text-[#6B7280]">
              Yakin hapus <span className="font-mono font-bold text-[#1E3A5F]">{deletingBarang.kodeBarang}</span>? Tindakan ini tidak dapat dibatalkan.
            </p>
            {crudError && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#EF4444]">{crudError}</div>
            )}
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setDeletingBarang(null)}
                className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-lg border border-[#D1D5DB] bg-white px-4 py-3 text-sm font-medium text-[#1F2937] hover:bg-[#F5F7FA] sm:flex-none sm:px-6"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={crudLoading}
                className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-lg bg-[#EF4444] px-6 py-3 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50 sm:flex-none"
              >
                {crudLoading ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DaftarBarang;
