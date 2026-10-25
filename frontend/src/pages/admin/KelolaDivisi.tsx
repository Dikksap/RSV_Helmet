import { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen, faTrash, faCirclePlus, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import {
  getDivisi, createDivisi, updateDivisi, deleteDivisi,
  type Divisi,
} from "../../api/divisi";
import { Modal } from "../../components/admin/VariantProduk/Modal";
import { inputCls, labelCls } from "../../components/admin/VariantProduk/constants";

const primaryBtn = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#00A8E8] px-3.5 py-2 text-xs font-medium text-white transition hover:bg-[#0088C0] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none sm:px-5 sm:py-2.5 sm:text-sm";
const secondaryBtn = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#D1D5DB] bg-white px-3 py-2 text-xs font-medium text-[#1F2937] hover:bg-[#F5F7FA] sm:px-4 sm:py-2.5 sm:text-sm";

export default function KelolaDivisi() {
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Divisi[]>([]);
  const [modal, setModal] = useState<{ open: boolean; editing: Divisi | null; nama: string; busy: boolean }>({
    open: false, editing: null, nama: "", busy: false,
  });

  const flash = (msg: string) => { setNotice(msg); window.setTimeout(() => setNotice(null), 3000); };
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await getDivisi());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data divisi.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => !q || r.nama.toLowerCase().includes(q))
      .sort((a, b) => a.nama.localeCompare(b.nama));
  }, [rows, search]);

  const submit = async () => {
    const nama = modal.nama.trim();
    if (!nama) return window.alert("Field 'nama' wajib diisi");
    setModal((m) => ({ ...m, busy: true }));
    try {
      if (modal.editing) await updateDivisi(modal.editing.id, { nama });
      else await createDivisi({ nama });
      flash(modal.editing ? "Divisi diperbarui." : "Divisi ditambahkan.");
      setModal({ open: false, editing: null, nama: "", busy: false });
      await load();
    } catch (e) {
      setModal((m) => ({ ...m, busy: false }));
      window.alert(e instanceof Error ? e.message : "Gagal menyimpan.");
    }
  };

  const remove = async (row: Divisi) => {
    const count = row._count?.karyawan ?? 0;
    if (!window.confirm(`Hapus divisi "${row.nama}"?${count > 0 ? ` (${count} karyawan akan kehilangan divisi)` : ""}`)) return;
    try {
      await deleteDivisi(row.id);
      flash("Divisi dihapus.");
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Gagal hapus.");
    }
  };

  const openAdd = () => setModal({ open: true, editing: null, nama: "", busy: false });
  const openEdit = (r: Divisi) => setModal({ open: true, editing: r, nama: r.nama, busy: false });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header Compact */}
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="max-w-2xl space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#00A8E8] sm:text-xs">Divisi</p>
          <h1 className="text-xl font-bold tracking-tight text-[#1E3A5F] sm:text-3xl">Kelola Divisi</h1>
          <p className="text-xs text-[#6B7280] sm:text-sm">Data master divisi lini produksi: dipakai pengelompokan karyawan dan SPK.</p>
        </div>
        <button type="button" onClick={openAdd} className={`${primaryBtn} w-full sm:w-auto`}>
          <FontAwesomeIcon icon={faCirclePlus} className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> Tambah Divisi
        </button>
      </header>

      {/* Notifikasi / Status */}
      <div aria-live="polite" className="space-y-2">
        {loading && <p className="animate-pulse text-xs text-[#6B7280] sm:text-sm">Memuat data divisi...</p>}
        {error && <p role="alert" className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-3 py-2 text-xs text-[#EF4444] sm:px-4 sm:py-3 sm:text-sm">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-3 py-2 text-xs text-[#1F2937] sm:px-4 sm:py-3 sm:text-sm">{notice}</p>}
      </div>

      {!loading && !error && (
        <main className="space-y-3 sm:space-y-4">
          {/* Section Pencarian */}
          <section className="rounded-xl bg-white p-3.5 shadow-xs sm:p-5">
            <div className="w-full lg:max-w-sm">
              <label htmlFor="divisi-search" className="mb-1 block text-xs font-medium text-[#1F2937] sm:text-sm">Cari divisi</label>
              <div className="relative">
                <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7280]" />
                <input id="divisi-search" type="search" className={`${inputCls} py-2 pl-8 text-xs sm:text-sm`} placeholder="ketik nama divisi..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-[#6B7280] sm:text-xs">{filtered.length}/{rows.length} tampil</p>
          </section>

          {/* Tabel Data Divisi */}
          <section className="overflow-hidden rounded-xl bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#F5F7FA] text-[#6B7280]">
                  <tr>
                    <th className="px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider sm:px-6 sm:py-3.5 sm:text-xs">ID</th>
                    <th className="px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wider sm:px-6 sm:py-3.5 sm:text-xs">Nama</th>
                    <th className="px-3.5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider sm:px-6 sm:py-3.5 sm:text-xs">Karyawan</th>
                    <th className="px-3.5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider sm:px-6 sm:py-3.5 sm:text-xs">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-xs italic text-[#6B7280]">Belum ada divisi.</td></tr>
                  ) : filtered.map((r) => (
                    <tr key={r.id} className="text-xs hover:bg-[#F5F7FA] sm:text-sm">
                      <td className="px-3.5 py-2.5 font-mono text-xs text-[#6B7280] sm:px-6 sm:py-3.5">{r.id}</td>
                      <td className="px-3.5 py-2.5 font-medium text-[#1F2937] sm:px-6 sm:py-3.5">{r.nama}</td>
                      <td className="px-3.5 py-2.5 text-right tabular-nums text-[#6B7280] sm:px-6 sm:py-3.5">{r._count?.karyawan ?? 0}</td>
                      <td className="px-3.5 py-2.5 sm:px-6 sm:py-3.5">
                        <div className="flex justify-end gap-1">
                          <button type="button" aria-label={`Edit ${r.nama}`} onClick={() => openEdit(r)} className="rounded-lg p-1.5 text-[#1E3A5F] hover:bg-[#1E3A5F]/5 sm:p-2"><FontAwesomeIcon icon={faPen} className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></button>
                          <button type="button" aria-label={`Hapus ${r.nama}`} onClick={() => void remove(r)} className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[#EF4444]/10 hover:text-[#EF4444] sm:p-2"><FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}

      {/* Modal Edit/Tambah */}
      {modal.open && (
        <Modal title={`${modal.editing ? "Edit" : "Tambah"} Divisi`} onClose={() => setModal({ open: false, editing: null, nama: "", busy: false })}>
          <div className="space-y-3 sm:space-y-4">
            <label className={labelCls}><span className="text-xs sm:text-sm">Nama *</span><input className={`${inputCls} py-2 text-xs sm:text-sm`} placeholder="cth: Buffing" value={modal.nama} onChange={(e) => setModal((m) => ({ ...m, nama: e.target.value }))} /></label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setModal({ open: false, editing: null, nama: "", busy: false })} className={secondaryBtn}>Batal</button>
              <button type="button" disabled={modal.busy || !modal.nama.trim()} onClick={() => void submit()} className={primaryBtn}>{modal.busy ? "Menyimpan..." : modal.editing ? "Simpan" : "Tambah"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}