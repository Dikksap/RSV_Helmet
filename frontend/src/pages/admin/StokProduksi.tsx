import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  createBarangGroup,
  deleteBarangGroup,
  getBarangGroups,
  getBarangInGroup,
  unassignBarangFromGroup,
  updateBarangGroup,
  type BarangGroup,
  type BarangInGroup,
} from "../../api/barangGroup";
import type { StatusBarang } from "../../api/barang";
import { downloadCsv } from "../../lib/csv";

const DUS_CAPACITY = 8;

const STATUS_BADGE: Record<StatusBarang, string> = {
  FINISHGOOD: "bg-emerald-100 text-emerald-700",
  RETUR: "bg-amber-100 text-amber-800",
  OUT: "bg-sky-100 text-sky-700",
  BAD: "bg-red-100 text-red-700",
  REGISTER: "bg-slate-100 text-slate-600",
};

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-[#1F2937] outline-none transition placeholder:text-slate-400 focus:border-[#00A8E8] focus:ring-2 focus:ring-[#00A8E8]/20";
const labelCls = "flex flex-col gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-700";

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function variantName(barang: BarangInGroup) {
  const v = barang.variant;
  if (v?.product && v?.style && v?.color && v?.size)
    return `${v.product.nama} ${v.style.nama} ${v.color.nama} ${v.size.nama}`;
  return "-";
}

function summarize(barang: BarangInGroup[]): string {
  const m = new Map<string, number>();
  for (const b of barang) {
    const k = variantName(b);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([k, n]) => `${k} × ${n}`).join(" · ");
}

function toast(message: string, type: "success" | "error" = "success") {
  window.dispatchEvent(
    new CustomEvent("app:toast", {
      detail: { type: type === "success" ? "barang.created" : "barang.updated", message },
    }),
  );
}

function StokProduksi() {
  const [groups, setGroups] = useState<BarangGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "penuh" | "tersedia">("all");

  const [showCreate, setShowCreate] = useState(false);
  const [editingGroup, setEditingGroup] = useState<BarangGroup | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<BarangGroup | null>(null);
  const [cNama, setCNama] = useState("");
  const [eNama, setENama] = useState("");
  const [crudLoading, setCrudLoading] = useState(false);
  const [crudError, setCrudError] = useState<string | null>(null);

  const [detailGroup, setDetailGroup] = useState<BarangGroup | null>(null);
  const [detailBarang, setDetailBarang] = useState<BarangInGroup[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [unassigningId, setUnassigningId] = useState<number | null>(null);

  const fetchGroups = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setGroups(await getBarangGroups());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat daftar dus");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void fetchGroups(), 0);
    return () => window.clearTimeout(id);
  }, [fetchGroups]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowCreate(false);
        setEditingGroup(null);
        setDeletingGroup(null);
        setDetailGroup(null);
      }
    };
    if (showCreate || editingGroup || deletingGroup || detailGroup) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCreate, editingGroup, deletingGroup, detailGroup]);

  const totalBarang = groups.reduce((acc, g) => acc + g._count.barang, 0);
  const maxCapacity = groups.length * DUS_CAPACITY;
  const fullDusCount = groups.filter((g) => g._count.barang >= DUS_CAPACITY).length;
  const availableDusCount = groups.length - fullDusCount;

  const filteredGroups = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return groups.filter((g) => {
      const matchKeyword = g.nama.toLowerCase().includes(keyword);
      const isFull = g._count.barang >= DUS_CAPACITY;
      const matchStatus =
        statusFilter === "all" || (statusFilter === "penuh" ? isFull : !isFull);
      return matchKeyword && matchStatus;
    });
  }, [groups, search, statusFilter]);

  const openCreate = () => {
    setCrudError(null);
    setCNama("");
    setShowCreate(true);
  };

  const handleCreate = async () => {
    const nama = cNama.trim();
    if (!nama) {
      setCrudError("Field 'nama' wajib diisi");
      return;
    }
    setCrudLoading(true);
    setCrudError(null);
    try {
      await createBarangGroup(nama);
      setShowCreate(false);
      toast(`Dus "${nama}" berhasil dibuat`);
      await fetchGroups();
    } catch (err) {
      setCrudError(err instanceof Error ? err.message : "Gagal membuat dus");
    } finally {
      setCrudLoading(false);
    }
  };

  const openEdit = (group: BarangGroup) => {
    setCrudError(null);
    setENama(group.nama);
    setEditingGroup(group);
  };

  const handleUpdate = async () => {
    if (!editingGroup) return;
    const nama = eNama.trim();
    if (!nama) {
      setCrudError("Field 'nama' tidak boleh kosong");
      return;
    }
    setCrudLoading(true);
    setCrudError(null);
    try {
      await updateBarangGroup(editingGroup.id, nama);
      setEditingGroup(null);
      toast(`Dus berhasil diubah menjadi "${nama}"`);
      await fetchGroups();
    } catch (err) {
      setCrudError(err instanceof Error ? err.message : "Gagal memperbarui dus");
    } finally {
      setCrudLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingGroup) return;
    setCrudLoading(true);
    setCrudError(null);
    try {
      await deleteBarangGroup(deletingGroup.id);
      setDeletingGroup(null);
      toast(`Dus "${deletingGroup.nama}" berhasil dihapus`);
      await fetchGroups();
    } catch (err) {
      setCrudError(err instanceof Error ? err.message : "Gagal menghapus dus");
    } finally {
      setCrudLoading(false);
    }
  };

  const openDetail = async (group: BarangGroup) => {
    setDetailError(null);
    setDetailBarang(group.barang ?? []);
    setDetailGroup(group);
    setIsLoadingDetail(true);
    try {
      setDetailBarang(await getBarangInGroup(group.id));
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Gagal memuat isi dus");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleUnassign = async (barangId: number) => {
    if (!detailGroup) return;
    setUnassigningId(barangId);
    try {
      await unassignBarangFromGroup(detailGroup.id, [barangId]);
      setDetailBarang((prev) => prev.filter((b) => b.id !== barangId));
      toast("Barang dilepas dari dus");
      await fetchGroups();
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Gagal melepas barang");
    } finally {
      setUnassigningId(null);
    }
  };

  const handleExportCSV = () => {
    if (filteredGroups.length === 0) return;
    try {
      const rows: unknown[][] = [
        ["Nama Dus", "Kode Barang", "Kode Variant", "Status", "Produk", "Style", "Color", "Size"],
      ];
      for (const g of filteredGroups) {
        for (const b of g.barang ?? []) {
          const v = b.variant;
          rows.push([
            g.nama,
            b.kodeBarang,
            v?.kodeVariant ?? "",
            b.status,
            v?.product?.nama ?? "",
            v?.style?.nama ?? "",
            v?.color?.nama ?? "",
            v?.size?.nama ?? "",
          ]);
        }
      }
      const stamp = new Date().toISOString().slice(0, 10);
      const suffix = statusFilter === "all" ? "" : `-${statusFilter}`;
      downloadCsv(`stok-produksi-${stamp}${suffix}.csv`, rows);
      toast(`Export ${rows.length - 1} barang ke CSV`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Gagal export CSV", "error");
    }
  };

  const modalShell = (onClose: () => void, children: ReactNode) => (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Barang Produksi</p>
          <h2 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900">
            Stok Produksi — Dus Barang
            <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              Total {groups.length} Dus
            </span>
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Satu dus maksimal {DUS_CAPACITY} barang. Klik kartu untuk melihat isi dus.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={isLoading || filteredGroups.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-50"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
            Export CSV
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#00A8E8] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#00A8E8]/25 transition hover:bg-[#0088C0] active:scale-95"
          >
            <span className="text-base leading-none">+</span> Dus Baru
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-50 text-xl text-[#00A8E8]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Kapasitas Terpakai</p>
            <p className="text-lg font-bold text-slate-900">
              {totalBarang} / {maxCapacity} Barang
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-xl text-emerald-600">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m9 11 3 3L22 4" /></svg>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Dus Penuh</p>
            <p className="text-lg font-bold text-slate-900">{fullDusCount} Dus</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-xl text-amber-600">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /><path d="M7.5 4.27 16.5 9.4" /></svg>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Dus Tersedia / Sebagian</p>
            <p className="text-lg font-bold text-slate-900">{availableDusCount} Dus</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="relative w-full sm:w-80">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama dus..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | "penuh" | "tersedia")}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20 sm:w-auto"
        >
          <option value="all">Semua Status</option>
          <option value="penuh">Penuh (8/8)</option>
          <option value="tersedia">Belum Penuh</option>
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Memuat daftar dus">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-slate-200" />
                <div className="h-4 w-1/2 rounded bg-slate-200" />
              </div>
              <div className="mt-4 h-2 w-full rounded-full bg-slate-100" />
              <div className="mt-3 h-3 w-3/4 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-[#EF4444]">
          <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
          <span>{error}</span>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white py-16 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-2xl text-slate-400">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>
          </div>
          <h3 className="text-base font-bold text-slate-800">Tidak ada dus ditemukan</h3>
          <p className="mt-1 text-sm text-slate-500">Coba kata kunci pencarian lain atau buat dus baru.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredGroups.map((g) => {
            const count = g._count.barang;
            const isFull = count >= DUS_CAPACITY;
            const percentage = Math.round((count / DUS_CAPACITY) * 100);
            const barColor = isFull ? "bg-rose-500" : count === 0 ? "bg-slate-300" : "bg-[#00A8E8]";
            const ringkasan = summarize(g.barang ?? []);
            return (
              <div
                key={g.id}
                role="button"
                tabIndex={0}
                onClick={() => void openDetail(g)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); void openDetail(g); } }}
                className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#00A8E8]/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-[#00A8E8]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#00A8E8] transition group-hover:bg-[#00A8E8] group-hover:text-white">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900">Dus {g.nama}</p>
                      <p className="text-[11px] text-slate-400">{formatDate(g.updatedAt)}</p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                      isFull ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {count}/{DUS_CAPACITY}
                    {isFull && " PENUH"}
                  </span>
                </div>
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full border border-slate-200/60 bg-slate-100">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="mt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Isi Dus</p>
                  <p className="mt-0.5 text-sm font-medium leading-relaxed text-slate-700">
                    {ringkasan || "Kosong"}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openEdit(g); }}
                    className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 transition hover:bg-slate-200"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setCrudError(null); setDeletingGroup(g); }}
                    className="rounded-lg bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-600 transition hover:bg-rose-100"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate &&
        modalShell(() => setShowCreate(false), (
          <>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900">Tambah Dus Baru</h3>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                aria-label="Tutup"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 pt-4">
              <label className={labelCls}>
                <span>Nama / Nomor Dus</span>
                <input
                  className={inputCls}
                  placeholder="Contoh: 5 atau Dus A-1"
                  value={cNama}
                  onChange={(e) => setCNama(e.target.value)}
                  autoFocus
                />
              </label>
              {crudError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#EF4444]">{crudError}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={crudLoading}
                  className="flex-1 rounded-xl bg-[#00A8E8] py-3 text-sm font-semibold text-white shadow-lg shadow-[#00A8E8]/25 transition hover:bg-[#0088C0] disabled:opacity-50"
                >
                  {crudLoading ? "Menyimpan..." : "Simpan Dus"}
                </button>
              </div>
            </div>
          </>
        ))}

      {editingGroup &&
        modalShell(() => setEditingGroup(null), (
          <>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900">Edit Dus — {editingGroup.nama}</h3>
              <button
                type="button"
                onClick={() => setEditingGroup(null)}
                aria-label="Tutup"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 pt-4">
              <label className={labelCls}>
                <span>Nama / Nomor Dus</span>
                <input
                  className={inputCls}
                  value={eNama}
                  onChange={(e) => setENama(e.target.value)}
                  autoFocus
                />
              </label>
              {crudError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#EF4444]">{crudError}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleUpdate}
                  disabled={crudLoading}
                  className="flex-1 rounded-xl bg-[#00A8E8] py-3 text-sm font-semibold text-white shadow-lg shadow-[#00A8E8]/25 transition hover:bg-[#0088C0] disabled:opacity-50"
                >
                  {crudLoading ? "Menyimpan..." : "Simpan Dus"}
                </button>
              </div>
            </div>
          </>
        ))}

      {deletingGroup &&
        modalShell(() => setDeletingGroup(null), (
          <>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900">Hapus Dus?</h3>
              <button
                type="button"
                onClick={() => setDeletingGroup(null)}
                aria-label="Tutup"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4 pt-4">
              <p className="text-sm text-slate-600">
                Yakin hapus <span className="font-bold text-slate-900">Dus {deletingGroup.nama}</span>? Tindakan ini
                tidak dapat dibatalkan.
              </p>
              {deletingGroup._count.barang > 0 && (
                <p className="text-sm text-amber-600">
                  {deletingGroup._count.barang} barang di dalam dus akan dilepas (barang tetap ada di sistem).
                </p>
              )}
              {crudError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#EF4444]">{crudError}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingGroup(null)}
                  className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={crudLoading}
                  className="flex-1 rounded-xl bg-[#EF4444] py-3 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-50"
                >
                  {crudLoading ? "Menghapus..." : "Ya, Hapus"}
                </button>
              </div>
            </div>
          </>
        ))}

      {detailGroup &&
        modalShell(() => setDetailGroup(null), (
          <>
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#00A8E8]">Detail Dus</p>
                <h3 className="text-lg font-bold text-slate-900">Kelola Isi Dus {detailGroup.nama}</h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailGroup(null)}
                aria-label="Tutup"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
              >
                ✕
              </button>
            </div>
            <div className="py-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Daftar Barang (Maks {DUS_CAPACITY})
                </span>
                <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  {detailGroup._count.barang}/{DUS_CAPACITY} Barang
                </span>
              </div>
              {detailError && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-[#EF4444]">{detailError}</div>
              )}
              {isLoadingDetail ? (
                <p className="py-4 text-center text-sm text-slate-500">Memuat isi dus...</p>
              ) : detailBarang.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                  Dus kosong — scan barang lalu simpan ke dus ini lewat halaman Scan QR.
                </p>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {detailBarang.map((b, i) => (
                    <div
                      key={b.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#00A8E8] text-xs font-bold text-white">
                          {i + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-slate-800">{b.kodeBarang}</p>
                          <p className="truncate text-[11px] text-slate-500">{variantName(b)}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[b.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {b.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleUnassign(b.id)}
                          disabled={unassigningId === b.id}
                          className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          {unassigningId === b.id ? "..." : "Lepas"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setDetailGroup(null)}
                className="rounded-xl bg-[#00A8E8] px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#00A8E8]/25 transition hover:bg-[#0088C0]"
              >
                Selesai
              </button>
            </div>
          </>
        ))}
    </div>
  );
}

export default StokProduksi;
