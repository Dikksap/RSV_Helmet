import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  bulkStatusBarang,
  createBarang,
  deleteBarang,
  exportBarang,
  getBarangPage,
  searchBarang,
  updateBarang,
  type Barang,
  type CreateBarangPayload,
  type StatusBarang,
  type UpdateBarangPayload,
} from "../../api/barang";
import { getProducts, type Product } from "../../api/products";
import { getColors, getSizes, getStyles } from "../../api/masterData";
import { HeaderSection } from "../../components/admin/DaftarBarang/HeaderSection";
import { FilterSection } from "../../components/admin/DaftarBarang/FilterSection";
import { BarangTable } from "../../components/admin/DaftarBarang/BarangTable";
import { Pagination } from "../../components/admin/DaftarBarang/Pagination";
import { HangtagModal } from "../../components/admin/DaftarBarang/HangtagModal";
import { RiwayatModal } from "../../components/admin/DaftarBarang/RiwayatModal";
import { BarangImportModal } from "../../components/admin/DaftarBarang/BarangImportModal";
import { useLiveSocketContext } from "../../lib/LiveSocketContext";
import { downloadCsv } from "../../lib/csv";
import { useStatusOptions, type StatusOption } from "../../lib/useStatusOptions";

type Option = { id: number; nama: string };
type FormState = {
  variantId: string;
  batchId: string;
  batchDetach: boolean;
  kodeBarang: string;
  tanggal: string;
  status: StatusBarang;
  keterangan: string;
};
type Result = { key: string; rows: Barang[]; totalPages: number; total: number; error: string | null };

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/50";
const FIELD =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20 disabled:bg-slate-50 disabled:opacity-60";
const LABEL = "flex flex-col gap-1.5 text-xs font-semibold text-slate-600";
const BTN = `inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
const BTN_PRIMARY = `${BTN} bg-[#1E3A5F] text-white hover:bg-[#162C48]`;
const BTN_GHOST = `${BTN} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
const BTN_DANGER = `${BTN} bg-[#EF4444] text-white hover:bg-red-600`;

const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const num = (s: string) => (s ? Number(s) : undefined);
// Tanggal disimpan sebagai ISO dari tengah malam lokal; baca kembali sebagai tanggal lokal, bukan potongan UTC.
const toLocalDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("sv-SE") : "");
const toDateParam = (d: string) => new Date(`${d}T00:00:00`).toISOString();
const variantLabel = (v: Barang["variant"]) => `${v.product.nama} / ${v.style.nama} / ${v.color.nama} / ${v.size.nama}`;

function toast(message: string, type: "success" | "error" = "success") {
  window.dispatchEvent(new CustomEvent("app:toast", { detail: { type, message } }));
}

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

function formatRelativeTime(date: string, nowMs: number) {
  const minutes = Math.floor((nowMs - new Date(date).getTime()) / 60000);
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  return `${Math.floor(days / 7)} minggu lalu`;
}

function Modal({ eyebrow, title, onClose, children, footer, narrow }: { eyebrow?: string; title: ReactNode; onClose: () => void; children?: ReactNode; footer: ReactNode; narrow?: boolean }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0F1C2E]/50 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${narrow ? "sm:max-w-md" : "sm:max-w-lg"}`}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0088C0]">{eyebrow}</p>}
            <h2 className="truncate text-base font-bold text-slate-900">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 ${FOCUS}`}>
            ✕
          </button>
        </div>
        {children && <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>}
        <div className="flex gap-2 border-t border-slate-100 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] [&>*]:flex-1 sm:justify-end sm:[&>*]:flex-none">
          {footer}
        </div>
      </div>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string | null }) {
  return msg ? <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-[#EF4444]">{msg}</p> : null;
}

function BarangForm({
  mode,
  value,
  onChange,
  variantOptions,
  statusOptions,
  productsError,
}: {
  mode: "create" | "edit";
  value: FormState;
  onChange: (patch: Partial<FormState>) => void;
  variantOptions: Option[];
  statusOptions: StatusOption[];
  productsError: string | null;
}) {
  const create = mode === "create";
  return (
    <div className="grid gap-3">
      <label className={LABEL}>
        Variant{create && " *"}
        <select className={FIELD} value={value.variantId} onChange={(e) => onChange({ variantId: e.target.value })}>
          {create && <option value="">Pilih variant…</option>}
          {variantOptions.map((o) => (
            <option key={o.id} value={String(o.id)}>
              {o.nama}
            </option>
          ))}
        </select>
        {productsError && <span className="font-normal text-[#EF4444]">{productsError}</span>}
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={LABEL}>
          Batch ID{create && " (opsional)"}
          <input
            type="number"
            inputMode="numeric"
            className={FIELD}
            placeholder={create ? "Kosong = batch aktif" : "ID batch"}
            value={value.batchId}
            disabled={value.batchDetach}
            onChange={(e) => onChange({ batchId: e.target.value })}
          />
          {!create && (
            <span className="flex items-center gap-1.5 font-normal text-slate-500">
              <input type="checkbox" checked={value.batchDetach} onChange={(e) => onChange({ batchDetach: e.target.checked })} className="accent-[#1E3A5F]" />
              Lepas dari batch
            </span>
          )}
        </label>
        <label className={LABEL}>
          Status
          <select className={FIELD} value={value.status} onChange={(e) => onChange({ status: e.target.value })}>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={LABEL}>
        Kode barang{create && " (opsional, unik)"}
        <input className={`${FIELD} font-mono`} placeholder={create ? "Kosong = otomatis BCxxx-…" : ""} value={value.kodeBarang} onChange={(e) => onChange({ kodeBarang: e.target.value })} />
      </label>
      <label className={LABEL}>
        Tanggal{create && " (opsional)"}
        <input type="date" className={FIELD} value={value.tanggal} onChange={(e) => onChange({ tanggal: e.target.value })} />
      </label>
      <label className={LABEL}>
        Keterangan {create ? "(opsional, masuk riwayat)" : "(hanya jika status diubah)"}
        <textarea
          className={`${FIELD} h-auto min-h-[80px] py-2.5`}
          placeholder={create ? "Barang dibuat (manual)" : "Keterangan riwayat"}
          value={value.keterangan}
          onChange={(e) => onChange({ keterangan: e.target.value })}
        />
      </label>
    </div>
  );
}

const EMPTY_FORM: FormState = { variantId: "", batchId: "", batchDetach: false, kodeBarang: "", tanggal: "", status: "REGISTER", keterangan: "" };

function DaftarBarang() {
  const { options: statusOptions } = useStatusOptions();
  const { subscribe } = useLiveSocketContext();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [variantFilter, setVariantFilter] = useState("");
  const [styleFilter, setStyleFilter] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [tanggalAwal, setTanggalAwal] = useState("");
  const [tanggalAkhir, setTanggalAkhir] = useState("");
  const [hanyaPernahRetur, setHanyaPernahRetur] = useState(false);
  const [datePreset, setDatePreset] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | "all">(20);
  const [result, setResult] = useState<Result | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [styleOptions, setStyleOptions] = useState<Option[]>([]);
  const [colorOptions, setColorOptions] = useState<Option[]>([]);
  const [sizeOptions, setSizeOptions] = useState<Option[]>([]);

  const [now, setNow] = useState(() => Date.now());
  const [isExporting, setIsExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [selectedBarang, setSelectedBarang] = useState<Barang | null>(null);
  const [riwayatBarang, setRiwayatBarang] = useState<Barang | null>(null);
  const [showImport, setShowImport] = useState(false);

  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingBarang, setEditingBarang] = useState<Barang | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [pendingDelete, setPendingDelete] = useState<{ kind: "single"; barang: Barang } | { kind: "bulk" } | null>(null);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulk, setBulk] = useState({ status: "", tanggal: "", keterangan: "" });
  const [busy, setBusy] = useState(false);
  const [crudError, setCrudError] = useState<string | null>(null);

  const reqRef = useRef(0);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(() => setProductsError("Gagal memuat daftar variant — filter dan form variant tidak tersedia"));
    const toOptions = (rows: Option[]) => rows.map((r) => ({ id: r.id, nama: r.nama }));
    getStyles().then((r) => setStyleOptions(toOptions(r))).catch(() => setStyleOptions([]));
    getColors().then((r) => setColorOptions(toOptions(r))).catch(() => setColorOptions([]));
    getSizes().then((r) => setSizeOptions(toOptions(r))).catch(() => setSizeOptions([]));
  }, []);

  const matchesAttr = useCallback(
    (v: { styleId: number; colorId: number; sizeId: number }) =>
      (!styleFilter || String(v.styleId) === styleFilter) &&
      (!colorFilter || String(v.colorId) === colorFilter) &&
      (!sizeFilter || String(v.sizeId) === sizeFilter),
    [styleFilter, colorFilter, sizeFilter],
  );

  const filterVariantOptions = useMemo(
    () =>
      products
        .flatMap((p) =>
          p.variants.filter(matchesAttr).map((v) => ({ id: v.id, nama: `${p.nama} / ${v.style.nama} / ${v.color.nama} / ${v.size.nama}` })),
        )
        .sort((a, b) => a.nama.localeCompare(b.nama)),
    [products, matchesAttr],
  );

  const formVariantOptions = useMemo(() => {
    const all = products
      .flatMap((p) => p.variants.map((v) => ({ id: v.id, nama: `${p.nama} / ${v.style.nama} / ${v.color.nama} / ${v.size.nama}` })))
      .sort((a, b) => a.nama.localeCompare(b.nama));
    const cur = editingBarang?.variant;
    return cur && !all.some((o) => o.id === cur.id) ? [{ id: cur.id, nama: variantLabel(cur) }, ...all] : all;
  }, [products, editingBarang]);

  const effectiveVariant = filterVariantOptions.some((o) => String(o.id) === variantFilter) ? variantFilter : "";
  const hasOtherFilters = Boolean(statusFilter || effectiveVariant || styleFilter || colorFilter || sizeFilter || tanggalAwal || tanggalAkhir || hanyaPernahRetur);
  const hasActiveFilters = Boolean(search) || hasOtherFilters;
  const isSearchMode = Boolean(debouncedSearch) && !hasOtherFilters;
  const searchLimit = typeof pageSize === "number" ? Math.min(50, pageSize) : 50;

  const filterParams = useMemo(
    () => ({
      variantId: num(effectiveVariant),
      status: statusFilter || undefined,
      tanggalAwal: tanggalAwal || undefined,
      tanggalAkhir: tanggalAkhir || undefined,
      pernahRetur: hanyaPernahRetur || undefined,
      styleId: num(styleFilter),
      colorId: num(colorFilter),
      sizeId: num(sizeFilter),
    }),
    [effectiveVariant, statusFilter, tanggalAwal, tanggalAkhir, hanyaPernahRetur, styleFilter, colorFilter, sizeFilter],
  );

  const key = JSON.stringify(isSearchMode ? { q: debouncedSearch, searchLimit } : { ...filterParams, page, pageSize });

  const load = useCallback(() => {
    const req = ++reqRef.current;
    const request = isSearchMode ? searchBarang(debouncedSearch, searchLimit) : getBarangPage({ page, limit: pageSize, ...filterParams });
    request
      .then((data) => {
        if (req !== reqRef.current) return;
        setResult({
          key,
          rows: data.data,
          totalPages: "totalPages" in data.meta ? data.meta.totalPages : 1,
          total: "total" in data.meta ? data.meta.total : data.meta.count,
          error: null,
        });
      })
      .catch((e) => {
        if (req !== reqRef.current) return;
        setResult((prev) => (prev?.key === key && !prev.error ? prev : { key, rows: [], totalPages: 1, total: 0, error: errMsg(e, "Gagal memuat barang") }));
      });
  }, [key, isSearchMode, debouncedSearch, searchLimit, page, pageSize, filterParams]);

  useEffect(() => {
    load();
  }, [load]);

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  // Live update: muat ulang diam-diam, digabung per 1 detik agar banjir event scan tidak memicu banyak request.
  useEffect(() => {
    let timer: number | undefined;
    const unsub = subscribe((payload) => {
      if (!payload.type.startsWith("barang.")) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => loadRef.current(), 1000);
    });
    return () => {
      unsub();
      window.clearTimeout(timer);
    };
  }, [subscribe]);

  const isLoading = result?.key !== key;
  const barang = useMemo(() => (result && !isLoading ? result.rows : []), [result, isLoading]);
  const totalBarang = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 1;
  const error = !isLoading ? (result?.error ?? null) : null;
  const visibleSelected = useMemo(() => new Set(barang.filter((b) => selectedIds.has(b.id)).map((b) => b.id)), [barang, selectedIds]);
  const selectedCount = visibleSelected.size;

  const anyModal = formMode !== null || pendingDelete !== null || showBulkEdit || selectedBarang !== null || riwayatBarang !== null || showImport;
  const closeAll = useCallback(() => {
    if (busy) return;
    setFormMode(null);
    setPendingDelete(null);
    setShowBulkEdit(false);
    setSelectedBarang(null);
    setRiwayatBarang(null);
    setShowImport(false);
  }, [busy]);

  useEffect(() => {
    if (!anyModal) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeAll();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anyModal, closeAll]);

  const resetPage = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch("");
    setStatusFilter("");
    setVariantFilter("");
    setStyleFilter("");
    setColorFilter("");
    setSizeFilter("");
    setTanggalAwal("");
    setTanggalAkhir("");
    setDatePreset("");
    setHanyaPernahRetur(false);
    setPage(1);
  };

  const toggleSelect = (id: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const toggleSelectAll = (checked: boolean) => setSelectedIds(checked ? new Set(barang.map((b) => b.id)) : new Set());

  const afterRemove = (removed: number) => {
    if (removed >= barang.length && page > 1) setPage(page - 1);
    else load();
  };

  const openCreate = () => {
    setCrudError(null);
    setEditingBarang(null);
    setForm({ ...EMPTY_FORM, variantId: effectiveVariant });
    setFormMode("create");
  };

  const openEdit = (item: Barang) => {
    setCrudError(null);
    setEditingBarang(item);
    setForm({
      variantId: String(item.variantId),
      batchId: item.batchId ? String(item.batchId) : "",
      batchDetach: false,
      kodeBarang: item.kodeBarang,
      tanggal: toLocalDate(item.tanggal),
      status: item.status,
      keterangan: "",
    });
    setFormMode("edit");
  };

  const submitForm = async (e?: FormEvent) => {
    e?.preventDefault();
    setCrudError(null);
    const keterangan = form.keterangan.trim();
    const kode = form.kodeBarang.trim();
    try {
      if (formMode === "create") {
        if (!form.variantId) return setCrudError("Variant wajib dipilih");
        const payload: CreateBarangPayload = { variantId: Number(form.variantId), status: form.status };
        if (form.batchId.trim()) payload.batchId = Number(form.batchId);
        if (kode) payload.kodeBarang = kode;
        if (form.tanggal) payload.tanggal = toDateParam(form.tanggal);
        if (keterangan) payload.keterangan = keterangan;
        setBusy(true);
        const created = await createBarang(payload);
        setFormMode(null);
        toast(`Barang ${created.kodeBarang} dibuat`);
        if (page === 1) load();
        else setPage(1);
        return;
      }
      const orig = editingBarang;
      if (!orig) return;
      const payload: UpdateBarangPayload = {};
      if (form.variantId && Number(form.variantId) !== orig.variantId) payload.variantId = Number(form.variantId);
      if (form.batchDetach) {
        if (orig.batchId !== null) payload.batchId = null;
      } else if (form.batchId.trim() && Number(form.batchId) !== orig.batchId) payload.batchId = Number(form.batchId);
      if (kode && kode !== orig.kodeBarang) payload.kodeBarang = kode;
      if (form.tanggal && form.tanggal !== toLocalDate(orig.tanggal)) payload.tanggal = toDateParam(form.tanggal);
      if (form.status !== orig.status) {
        payload.status = form.status;
        if (keterangan) payload.keterangan = keterangan;
      } else if (keterangan) return setCrudError("Keterangan hanya bisa diisi jika status diubah");
      if (Object.keys(payload).length === 0) return setCrudError("Tidak ada perubahan untuk disimpan");
      setBusy(true);
      const updated = await updateBarang(orig.id, payload);
      setFormMode(null);
      toast(`Barang ${updated.kodeBarang} diperbarui`);
      load();
    } catch (err) {
      setCrudError(errMsg(err, "Gagal menyimpan barang"));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const targets = pendingDelete.kind === "single" ? [pendingDelete.barang] : barang.filter((b) => visibleSelected.has(b.id));
    if (targets.length === 0) return;
    setBusy(true);
    setCrudError(null);
    const failed: Barang[] = [];
    let firstError = "";
    for (const b of targets) {
      try {
        await deleteBarang(b.id);
      } catch (err) {
        failed.push(b);
        firstError ||= errMsg(err, "Gagal menghapus");
      }
    }
    setBusy(false);
    const ok = targets.length - failed.length;
    if (ok > 0) afterRemove(ok);
    if (failed.length === 0) {
      setPendingDelete(null);
      setSelectedIds(new Set());
      toast(targets.length === 1 ? `Barang ${targets[0].kodeBarang} dihapus` : `${ok} barang dihapus`);
    } else {
      setSelectedIds(new Set(failed.map((b) => b.id)));
      if (pendingDelete.kind === "single") setCrudError(firstError);
      else {
        setPendingDelete({ kind: "bulk" });
        setCrudError(`${ok} terhapus, ${failed.length} gagal. Contoh: ${firstError}`);
      }
    }
  };

  const openBulkEdit = () => {
    setCrudError(null);
    setBulk({ status: "", tanggal: "", keterangan: "" });
    setShowBulkEdit(true);
  };

  const handleBulkEdit = async (e: FormEvent) => {
    e.preventDefault();
    const ids = [...visibleSelected];
    if (ids.length === 0) return;
    const keterangan = bulk.keterangan.trim();
    if (!bulk.status && !bulk.tanggal) return setCrudError("Pilih status dan/atau isi tanggal");
    if (keterangan && !bulk.status) return setCrudError("Keterangan hanya bisa diisi jika status diubah");
    const payload: UpdateBarangPayload = {};
    if (bulk.status) payload.status = bulk.status;
    if (bulk.tanggal) payload.tanggal = toDateParam(bulk.tanggal);
    if (keterangan) payload.keterangan = keterangan;

    setBusy(true);
    setCrudError(null);
    const failedIds: number[] = [];
    let firstError = "";
    try {
      if (payload.tanggal) {
        for (const id of ids) {
          try {
            await updateBarang(id, payload);
          } catch (err) {
            failedIds.push(id);
            firstError ||= errMsg(err, "Gagal memperbarui");
          }
        }
      } else {
        const items = ids.map((id) => ({ id, status: bulk.status, keterangan: payload.keterangan }));
        for (let i = 0; i < items.length; i += 500) {
          const res = await bulkStatusBarang(items.slice(i, i + 500));
          failedIds.push(...res.failed.map((f) => f.id));
          firstError ||= res.failed[0]?.error ?? "";
        }
      }
    } catch (err) {
      setCrudError(errMsg(err, "Gagal memperbarui barang"));
      setBusy(false);
      load();
      return;
    }
    setBusy(false);
    load();
    const ok = ids.length - failedIds.length;
    if (failedIds.length === 0) {
      setSelectedIds(new Set());
      setShowBulkEdit(false);
      toast(`${ok} barang diperbarui`);
    } else {
      setSelectedIds(new Set(failedIds));
      setCrudError(`${ok} berhasil, ${failedIds.length} gagal. Contoh: ${firstError || "tidak diketahui"}`);
    }
  };

  const handleBulkExport = () => {
    const selected = barang.filter((b) => visibleSelected.has(b.id));
    if (selected.length === 0) return;
    downloadCsv(`barang-selected-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["id", "kodeBarang", "status", "produk", "varian", "batch", "createdAt"],
      ...selected.map((b) => [
        b.id,
        b.kodeBarang,
        b.status,
        b.variant.product.nama,
        `${b.variant.style.nama} ${b.variant.color.nama} ${b.variant.size.nama}`,
        b.batch ? `BC${String(b.batch.nomorBatch).padStart(3, "0")}` : "",
        toLocalDate(b.createdAt),
      ]),
    ]);
    toast(`Export ${selected.length} barang terpilih ke CSV`);
  };

  const handleExport = async (format: "json" | "csv") => {
    setIsExporting(true);
    try {
      const blob = await exportBarang({ format, ...filterParams });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `barang-export-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast(`Export ${format.toUpperCase()} berhasil`);
    } catch (err) {
      toast(errMsg(err, "Gagal export barang"), "error");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full space-y-3">
      <HeaderSection
        totalBarang={totalBarang}
        isExporting={isExporting}
        exportDisabled={isSearchMode}
        exportDisabledReason="Export tidak mendukung pencarian — gunakan filter"
        onExportCSV={() => void handleExport("csv")}
        onExportJSON={() => void handleExport("json")}
        onCreate={openCreate}
        onImport={() => setShowImport(true)}
      />

      <FilterSection
        search={search}
        statusFilter={statusFilter}
        variantFilter={effectiveVariant}
        styleFilter={styleFilter}
        colorFilter={colorFilter}
        sizeFilter={sizeFilter}
        tanggalAwal={tanggalAwal}
        tanggalAkhir={tanggalAkhir}
        datePreset={datePreset}
        variantOptions={filterVariantOptions}
        styleOptions={styleOptions}
        colorOptions={colorOptions}
        sizeOptions={sizeOptions}
        currentPage={page}
        totalPages={totalPages}
        hasActiveFilters={hasActiveFilters}
        hanyaPernahRetur={hanyaPernahRetur}
        onPernahReturChange={resetPage(setHanyaPernahRetur)}
        searchDisabled={hasOtherFilters}
        searchHint="Pencarian dinonaktifkan saat filter lain dipakai"
        variantError={productsError}
        onSearchChange={resetPage(setSearch)}
        onStatusChange={resetPage(setStatusFilter)}
        onVariantChange={resetPage(setVariantFilter)}
        onStyleChange={resetPage(setStyleFilter)}
        onColorChange={resetPage(setColorFilter)}
        onSizeChange={resetPage(setSizeFilter)}
        onDatePresetChange={setDatePreset}
        onTanggalAwalChange={resetPage(setTanggalAwal)}
        onTanggalAkhirChange={resetPage(setTanggalAkhir)}
        onResetFilters={handleResetFilters}
      />

      {selectedCount > 0 && (
        <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-[#00A8E8]/30 bg-white/95 px-4 py-2.5 shadow-sm backdrop-blur sm:top-16">
          <span className="text-sm font-semibold text-[#1E3A5F]">{selectedCount} dipilih</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" onClick={() => setSelectedIds(new Set())} className={`${BTN_GHOST} h-9`}>
              Batal
            </button>
            <button type="button" onClick={handleBulkExport} className={`${BTN_GHOST} h-9`}>
              Export
            </button>
            <button type="button" onClick={openBulkEdit} className={`${BTN_PRIMARY} h-9`}>
              Edit massal
            </button>
            <button
              type="button"
              onClick={() => {
                setCrudError(null);
                setPendingDelete({ kind: "bulk" });
              }}
              className={`${BTN_DANGER} h-9`}
            >
              Hapus
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4" aria-label="Memuat data barang">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex animate-pulse gap-4 py-2">
              <div className="h-4 w-8 rounded bg-slate-200" />
              <div className="h-4 flex-1 rounded bg-slate-200" />
              <div className="h-4 w-24 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-[#EF4444]">
          {error}
          <button type="button" onClick={load} className={`${BTN_GHOST} h-9`}>
            Coba lagi
          </button>
        </div>
      ) : barang.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="font-semibold text-slate-700">{hasActiveFilters ? "Tidak ada hasil" : "Belum ada data barang"}</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">
            {hasActiveFilters ? "Ubah kata kunci atau reset filter." : "Tambahkan barang pertama untuk mulai mengelola inventory."}
          </p>
          <button type="button" onClick={hasActiveFilters ? handleResetFilters : openCreate} className={`${hasActiveFilters ? BTN_GHOST : BTN_PRIMARY} mt-4`}>
            {hasActiveFilters ? "Reset filter" : "+ Tambah barang"}
          </button>
        </div>
      ) : (
        <section className="space-y-3">
          <BarangTable
            barang={barang}
            currentPage={page}
            pageSize={isSearchMode ? barang.length : pageSize}
            caption={isSearchMode ? `Pencarian "${debouncedSearch}" — ${barang.length} dari maks ${searchLimit} hasil` : undefined}
            totalBarang={totalBarang}
            now={now}
            selectedIds={visibleSelected}
            onToggle={toggleSelect}
            onToggleAll={toggleSelectAll}
            onRowClick={setSelectedBarang}
            onEdit={openEdit}
            onDelete={(b) => {
              setCrudError(null);
              setPendingDelete({ kind: "single", barang: b });
            }}
            onRiwayat={setRiwayatBarang}
            formatDate={formatDate}
            formatRelativeTime={formatRelativeTime}
          />
          {!isSearchMode && (
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-500">
                Per halaman
                <select
                  value={String(pageSize)}
                  onChange={(e) => {
                    setPageSize(e.target.value === "all" ? "all" : Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:border-[#00A8E8] focus:outline-none"
                >
                  {[20, 50, 100].map((n) => (
                    <option key={n} value={String(n)}>
                      {n}
                    </option>
                  ))}
                  <option value="all">Semua ({totalBarang.toLocaleString("id-ID")})</option>
                </select>
              </label>
              {totalPages > 1 && <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />}
            </div>
          )}
        </section>
      )}

      {selectedBarang && (
        <HangtagModal
          barang={selectedBarang}
          products={products}
          onClose={() => setSelectedBarang(null)}
          onRiwayat={() => {
            setRiwayatBarang(selectedBarang);
            setSelectedBarang(null);
          }}
        />
      )}

      {riwayatBarang && <RiwayatModal barangId={riwayatBarang.id} kodeBarang={riwayatBarang.kodeBarang} onClose={() => setRiwayatBarang(null)} />}

      <BarangImportModal open={showImport} onClose={() => setShowImport(false)} variantOptions={formVariantOptions} onImported={() => (page === 1 ? load() : setPage(1))} />

      {formMode && (
        <Modal
          eyebrow={formMode === "create" ? "Tambah barang" : "Edit barang"}
          title={formMode === "create" ? "Buat barang baru" : <span className="font-mono">{editingBarang?.kodeBarang}</span>}
          onClose={closeAll}
          footer={
            <>
              <button type="button" onClick={closeAll} disabled={busy} className={BTN_GHOST}>
                Batal
              </button>
              <button type="submit" form="barang-form" disabled={busy} className={BTN_PRIMARY}>
                {busy ? "Menyimpan…" : "Simpan"}
              </button>
            </>
          }
        >
          <form id="barang-form" onSubmit={(e) => void submitForm(e)}>
            <ErrorBox msg={crudError} />
            {formMode === "create" && <p className="mb-3 text-sm text-slate-500">Kode otomatis jika kosong. Batch kosong = batch AKTIF.</p>}
            <BarangForm
              mode={formMode}
              value={form}
              onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
              variantOptions={formVariantOptions}
              statusOptions={statusOptions}
              productsError={productsError}
            />
          </form>
        </Modal>
      )}

      {showBulkEdit && (
        <Modal
          eyebrow="Edit massal"
          title={`${selectedCount} barang terpilih`}
          onClose={closeAll}
          footer={
            <>
              <button type="button" onClick={closeAll} disabled={busy} className={BTN_GHOST}>
                Batal
              </button>
              <button type="submit" form="bulk-form" disabled={busy || selectedCount === 0} className={BTN_PRIMARY}>
                {busy ? "Menyimpan…" : `Perbarui ${selectedCount} barang`}
              </button>
            </>
          }
        >
          <form id="bulk-form" onSubmit={(e) => void handleBulkEdit(e)} className="grid gap-3">
            <ErrorBox msg={crudError} />
            <label className={LABEL}>
              Status
              <select className={FIELD} value={bulk.status} onChange={(e) => setBulk((b) => ({ ...b, status: e.target.value }))}>
                <option value="">— Tidak diubah —</option>
                {statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={LABEL}>
              Tanggal (opsional)
              <input type="date" className={FIELD} value={bulk.tanggal} onChange={(e) => setBulk((b) => ({ ...b, tanggal: e.target.value }))} />
            </label>
            <label className={LABEL}>
              Keterangan (hanya jika status diubah)
              <textarea
                className={`${FIELD} h-auto min-h-[80px] py-2.5`}
                placeholder="Keterangan riwayat"
                value={bulk.keterangan}
                onChange={(e) => setBulk((b) => ({ ...b, keterangan: e.target.value }))}
              />
            </label>
          </form>
        </Modal>
      )}

      {pendingDelete && (
        <Modal
          narrow
          title={pendingDelete.kind === "bulk" ? `Hapus ${selectedCount} barang?` : "Hapus barang?"}
          onClose={closeAll}
          footer={
            <>
              <button type="button" onClick={closeAll} disabled={busy} className={BTN_GHOST}>
                Batal
              </button>
              <button type="button" onClick={() => void handleDelete()} disabled={busy} className={BTN_DANGER}>
                {busy ? "Menghapus…" : "Ya, hapus"}
              </button>
            </>
          }
        >
          <ErrorBox msg={crudError} />
          <p className="text-sm text-slate-600">
            {pendingDelete.kind === "bulk" ? (
              <>
                Yakin hapus <span className="font-semibold text-slate-900">{selectedCount} barang</span> terpilih?
              </>
            ) : (
              <>
                Yakin hapus <span className="font-mono font-semibold text-slate-900">{pendingDelete.barang.kodeBarang}</span>?
              </>
            )}{" "}
            Tindakan ini tidak dapat dibatalkan.
          </p>
        </Modal>
      )}
    </div>
  );
}

export default DaftarBarang;
