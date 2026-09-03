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
import { QRModal } from "../components/DaftarBarang/QRModal";
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
  const [statusFilter, setStatusFilter] = useState("");
  const [variantFilter, setVariantFilter] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [tanggalAwal, setTanggalAwal] = useState("");
  const [tanggalAkhir, setTanggalAkhir] = useState("");
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

  const fetchBarang = useCallback(
    async (page = 1) => {
      setIsLoading(true);
      setError(null);
      try {
        const data =
          search &&
          !statusFilter &&
          !variantFilter &&
          !tanggalAwal &&
          !tanggalAkhir
            ? await searchBarang(search, 20)
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
    [tanggalAwal, tanggalAkhir, variantFilter, search, statusFilter],
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

  const hasActiveFilters =
    Boolean(search) ||
    Boolean(statusFilter) ||
    Boolean(variantFilter) ||
    Boolean(tanggalAwal) ||
    Boolean(tanggalAkhir);

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
    "h-10 w-full rounded-xl border border-brand-border bg-brand-surface px-3 text-sm text-white outline-none transition placeholder:text-brand-grey focus:border-brand-gold focus:ring-1 focus:ring-brand-gold";
  const labelCls = "flex flex-col gap-1.5 text-xs font-semibold text-brand-grey";
  const textareaCls =
    "min-h-[72px] w-full rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-sm text-white outline-none transition placeholder:text-brand-grey focus:border-brand-gold focus:ring-1 focus:ring-brand-gold";

  return (
    <div className="space-y-6">
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
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          {successMsg}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center rounded-2xl border border-brand-border bg-brand-surface-card p-12">
          <p className="animate-pulse text-sm text-brand-grey">
            Memuat data barang...
          </p>
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          {error}
        </div>
      )}

      {!isLoading && !error && (
        <section className="space-y-4">
          {barang.length === 0 ? (
            <div className="rounded-2xl border border-brand-border bg-brand-surface-card p-12 text-center text-sm italic text-brand-grey">
              {hasActiveFilters
                ? "Tidak ada barang yang memenuhi kriteria filter."
                : "Belum ada data barang."}
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
        <QRModal barang={selectedBarang} onClose={() => setSelectedBarang(null)} />
      )}

      {/* CREATE MODAL */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl border border-brand-border bg-brand-surface-card p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-brand-border bg-brand-surface text-brand-grey-light hover:border-brand-gold hover:text-white"
            >
              ✕
            </button>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-gold">Tambah Barang</p>
            <h2 className="mt-1 text-lg font-bold text-white">Buat Barang Baru</h2>
            <p className="mt-1 text-xs text-brand-grey">Kode otomatis jika kosong. Batch kosong = pakai batch AKTIF.</p>

            {crudError && (
              <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{crudError}</div>
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

              <div className="grid grid-cols-2 gap-3">
                <label className={labelCls}>
                  <span>Batch ID (opsional)</span>
                  <input type="number" className={inputCls} placeholder="Kosong = auto" value={cBatchId} onChange={(e) => setCBatchId(e.target.value)} />
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

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-xl border border-brand-border bg-brand-surface px-4 py-2 text-xs font-bold text-brand-grey-light hover:text-white"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={crudLoading}
                className="rounded-xl bg-brand-gold px-5 py-2 text-xs font-bold text-brand-black hover:bg-brand-gold-light disabled:opacity-50"
              >
                {crudLoading ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingBarang && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setEditingBarang(null)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl border border-brand-border bg-brand-surface-card p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setEditingBarang(null)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg border border-brand-border bg-brand-surface text-brand-grey-light hover:border-brand-gold hover:text-white"
            >
              ✕
            </button>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-gold">Edit Barang</p>
            <h2 className="mt-1 font-mono text-sm font-bold text-white">{editingBarang.kodeBarang}</h2>

            {crudError && (
              <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{crudError}</div>
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

              <div className="grid grid-cols-2 gap-3">
                <label className={labelCls}>
                  <span>Batch ID</span>
                  <input
                    type="number"
                    className={inputCls}
                    placeholder="ID batch"
                    value={eBatchId}
                    onChange={(e) => setEBatchId(e.target.value)}
                    disabled={eBatchDetach}
                  />
                  <label className="mt-1 flex items-center gap-1.5 text-[11px] font-normal text-brand-grey-light">
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

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingBarang(null)}
                className="rounded-xl border border-brand-border bg-brand-surface px-4 py-2 text-xs font-bold text-brand-grey-light hover:text-white"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleUpdate}
                disabled={crudLoading}
                className="rounded-xl bg-brand-gold px-5 py-2 text-xs font-bold text-brand-black hover:bg-brand-gold-light disabled:opacity-50"
              >
                {crudLoading ? "Menyimpan..." : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deletingBarang && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => setDeletingBarang(null)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-brand-border bg-brand-surface-card p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-white">Hapus Barang?</h2>
            <p className="mt-2 text-sm text-brand-grey">
              Yakin hapus <span className="font-mono font-bold text-brand-gold">{deletingBarang.kodeBarang}</span>? Tindakan ini tidak dapat dibatalkan.
            </p>
            {crudError && (
              <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{crudError}</div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingBarang(null)}
                className="rounded-xl border border-brand-border bg-brand-surface px-4 py-2 text-xs font-bold text-brand-grey-light hover:text-white"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={crudLoading}
                className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50"
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
