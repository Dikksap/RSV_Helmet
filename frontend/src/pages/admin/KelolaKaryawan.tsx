import { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen, faTrash, faCirclePlus, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import {
  getKaryawan, createKaryawan, updateKaryawan, deleteKaryawan,
  type Karyawan,
} from "../../api/karyawan";
import { Modal } from "../../components/admin/VariantProduk/Modal";
import { inputCls, labelCls } from "../../components/admin/VariantProduk/constants";

const primaryBtn = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#00A8E8] px-6 py-3 text-[15px] font-medium text-white transition hover:bg-[#0088C0] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none";
const secondaryBtn = "inline-flex items-center justify-center gap-2 rounded-lg border border-[#D1D5DB] bg-white px-4 py-3 text-[15px] font-medium text-[#1F2937] hover:bg-[#F5F7FA]";

export default function KelolaKaryawan() {
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Karyawan[]>([]);
  const [modal, setModal] = useState<{ open: boolean; editing: Karyawan | null; nama: string; jabatan: string; busy: boolean }>({
    open: false, editing: null, nama: "", jabatan: "", busy: false,
  });

  const flash = (msg: string) => { setNotice(msg); window.setTimeout(() => setNotice(null), 3000); };
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await getKaryawan());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data karyawan.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => !q || r.nama.toLowerCase().includes(q) || r.jabatan.toLowerCase().includes(q))
      .sort((a, b) => a.nama.localeCompare(b.nama));
  }, [rows, search]);

  const submit = async () => {
    const nama = modal.nama.trim();
    const jabatan = modal.jabatan.trim();
    if (!nama) return window.alert("Field 'nama' wajib diisi");
    if (!jabatan) return window.alert("Field 'jabatan' wajib diisi");
    setModal((m) => ({ ...m, busy: true }));
    try {
      if (modal.editing) await updateKaryawan(modal.editing.id, { nama, jabatan });
      else await createKaryawan({ nama, jabatan });
      flash(modal.editing ? "Karyawan diperbarui." : "Karyawan ditambahkan.");
      setModal({ open: false, editing: null, nama: "", jabatan: "", busy: false });
      await load();
    } catch (e) {
      setModal((m) => ({ ...m, busy: false }));
      window.alert(e instanceof Error ? e.message : "Gagal menyimpan.");
    }
  };

  const remove = async (row: Karyawan) => {
    if (!window.confirm(`Hapus karyawan "${row.nama}"?`)) return;
    try {
      await deleteKaryawan(row.id);
      flash("Karyawan dihapus.");
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Gagal hapus.");
    }
  };

  const openAdd = () => setModal({ open: true, editing: null, nama: "", jabatan: "", busy: false });
  const openEdit = (r: Karyawan) => setModal({ open: true, editing: r, nama: r.nama, jabatan: r.jabatan, busy: false });

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">Karyawan</p>
          <h1 className="text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">Kelola Karyawan</h1>
          <p className="mt-2 text-base text-[#6B7280]">Data master karyawan: nama dan jabatan.</p>
        </div>
        <button type="button" onClick={openAdd} className={primaryBtn}>
          <FontAwesomeIcon icon={faCirclePlus} className="h-4 w-4" /> Tambah Karyawan
        </button>
      </header>

      <div aria-live="polite" className="space-y-3">
        {loading && <p className="animate-pulse text-[15px] text-[#6B7280]">Memuat data karyawan...</p>}
        {error && <p role="alert" className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-[#EF4444]">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-4 py-3 text-[#1F2937]">{notice}</p>}
      </div>

      {!loading && !error && (
        <main className="space-y-4">
          <section className="rounded-xl bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <div className="w-full lg:max-w-sm">
              <label htmlFor="karyawan-search" className="mb-1 block text-sm font-medium text-[#1F2937]">Cari karyawan</label>
              <div className="relative">
                <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                <input id="karyawan-search" type="search" className={`${inputCls} pl-9`} placeholder="ketik nama / jabatan..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <p className="mt-3 text-[13px] text-[#6B7280]">{filtered.length}/{rows.length} tampil</p>
          </section>

          <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead className="bg-[#F5F7FA] text-[#6B7280]">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">ID</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Nama</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Jabatan</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center italic text-[#6B7280]">Belum ada karyawan.</td></tr>
                  ) : filtered.map((r) => (
                    <tr key={r.id} className="text-[15px] hover:bg-[#F5F7FA]">
                      <td className="px-6 py-4 font-mono text-sm text-[#6B7280]">{r.id}</td>
                      <td className="px-6 py-4 font-medium text-[#1F2937]">{r.nama}</td>
                      <td className="px-6 py-4 text-[#6B7280]">{r.jabatan}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-1">
                          <button type="button" aria-label={`Edit ${r.nama}`} onClick={() => openEdit(r)} className="rounded-lg p-2 text-[#1E3A5F] hover:bg-[#1E3A5F]/5"><FontAwesomeIcon icon={faPen} className="h-4 w-4" /></button>
                          <button type="button" aria-label={`Hapus ${r.nama}`} onClick={() => void remove(r)} className="rounded-lg p-2 text-[#6B7280] hover:bg-[#EF4444]/10 hover:text-[#EF4444]"><FontAwesomeIcon icon={faTrash} className="h-4 w-4" /></button>
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

      {modal.open && (
        <Modal title={`${modal.editing ? "Edit" : "Tambah"} Karyawan`} onClose={() => setModal({ open: false, editing: null, nama: "", jabatan: "", busy: false })}>
          <div className="space-y-4">
            <label className={labelCls}><span>Nama *</span><input className={inputCls} placeholder="cth: Budi Santoso" value={modal.nama} onChange={(e) => setModal((m) => ({ ...m, nama: e.target.value }))} /></label>
            <label className={labelCls}><span>Jabatan *</span><input className={inputCls} placeholder="cth: Operator" value={modal.jabatan} onChange={(e) => setModal((m) => ({ ...m, jabatan: e.target.value }))} /></label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setModal({ open: false, editing: null, nama: "", jabatan: "", busy: false })} className={secondaryBtn}>Batal</button>
              <button type="button" disabled={modal.busy || !modal.nama.trim() || !modal.jabatan.trim()} onClick={() => void submit()} className={primaryBtn}>{modal.busy ? "Menyimpan..." : modal.editing ? "Simpan" : "Tambah"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
