import { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen, faTrash, faCirclePlus, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import {
  getGudangList, createGudang, updateGudang, deleteGudang,
  type Gudang,
} from "../../api/gudang";
import { Modal } from "../../components/admin/VariantProduk/Modal";
import { inputCls, labelCls } from "../../components/admin/VariantProduk/constants";

const primaryBtn = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#00A8E8] px-6 py-3 text-[15px] font-medium text-white transition hover:bg-[#0088C0] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none";
const secondaryBtn = "inline-flex items-center justify-center gap-2 rounded-lg border border-[#D1D5DB] bg-white px-4 py-3 text-[15px] font-medium text-[#1F2937] hover:bg-[#F5F7FA]";

const emptyModal = { open: false, editing: null as Gudang | null, kode: "", name: "", isActive: true, busy: false };

export default function KelolaGudang() {
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Gudang[]>([]);
  const [modal, setModal] = useState(emptyModal);

  const flash = (msg: string) => { setNotice(msg); window.setTimeout(() => setNotice(null), 3000); };
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await getGudangList());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data gudang.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- muat awal sekali, pola sama seperti KelolaUser
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => !q || r.kode.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, search]);

  const totalIsi = useMemo(() => rows.reduce((n, r) => n + (r._count?.barang ?? 0), 0), [rows]);

  const submit = async () => {
    const kode = modal.kode.trim().toUpperCase();
    const name = modal.name.trim();
    if (!kode) return window.alert("Field 'kode' wajib diisi");
    if (!name) return window.alert("Field 'name' wajib diisi");
    setModal((m) => ({ ...m, busy: true }));
    try {
      if (modal.editing) await updateGudang(modal.editing.id, { kode, name, isActive: modal.isActive });
      else await createGudang({ kode, name, isActive: modal.isActive });
      flash(modal.editing ? "Gudang diperbarui." : "Gudang ditambahkan.");
      setModal(emptyModal);
      await load();
    } catch (e) {
      setModal((m) => ({ ...m, busy: false }));
      window.alert(e instanceof Error ? e.message : "Gagal menyimpan.");
    }
  };

  const remove = async (row: Gudang) => {
    const isi = row._count?.barang ?? 0;
    if (!window.confirm(`Hapus gudang "${row.name}"?${isi > 0 ? ` ${isi} barang di dalamnya akan menjadi tanpa lokasi.` : ""}`)) return;
    try {
      await deleteGudang(row.id);
      flash("Gudang dihapus. Barang di dalamnya menjadi tanpa lokasi.");
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Gagal hapus.");
    }
  };

  const openAdd = () => setModal({ ...emptyModal, open: true });
  const openEdit = (r: Gudang) => setModal({ open: true, editing: r, kode: r.kode, name: r.name, isActive: r.isActive, busy: false });

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">Warehouse</p>
          <h1 className="text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">Kelola Gudang</h1>
          <p className="mt-2 text-base text-[#6B7280]">Master lokasi penyimpanan. Total {totalIsi.toLocaleString("id-ID")} barang di gudang.</p>
        </div>
        <button type="button" onClick={openAdd} className={primaryBtn}>
          <FontAwesomeIcon icon={faCirclePlus} className="h-4 w-4" /> Tambah Gudang
        </button>
      </header>

      <div aria-live="polite" className="space-y-3">
        {loading && <p className="animate-pulse text-[15px] text-[#6B7280]">Memuat data gudang...</p>}
        {error && <p role="alert" className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-[#EF4444]">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-4 py-3 text-[#1F2937]">{notice}</p>}
      </div>

      {!loading && !error && (
        <main className="space-y-4">
          <section className="rounded-xl bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <div className="w-full lg:max-w-sm">
              <label htmlFor="gudang-search" className="mb-1 block text-sm font-medium text-[#1F2937]">Cari gudang</label>
              <div className="relative">
                <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                <input id="gudang-search" type="search" className={`${inputCls} pl-9`} placeholder="ketik kode / nama..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <p className="mt-3 text-[13px] text-[#6B7280]">{filtered.length}/{rows.length} tampil</p>
          </section>

          <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead className="bg-[#F5F7FA] text-[#6B7280]">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Kode</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Nama</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Isi Barang</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center italic text-[#6B7280]">Belum ada gudang.</td></tr>
                  ) : filtered.map((r) => (
                    <tr key={r.id} className="text-[15px] hover:bg-[#F5F7FA]">
                      <td className="px-6 py-4 font-mono text-sm font-semibold text-[#1E3A5F]">{r.kode}</td>
                      <td className="px-6 py-4 font-medium text-[#1F2937]">{r.name}</td>
                      <td className="px-6 py-4 tabular-nums text-[#1F2937]">{(r._count?.barang ?? 0).toLocaleString("id-ID")}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-md px-2 py-0.5 text-[13px] font-medium ${r.isActive ? "bg-[#10B981]/10 text-[#0E7A55]" : "bg-slate-100 text-slate-500"}`}>
                          {r.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-1">
                          <button type="button" aria-label={`Edit ${r.name}`} onClick={() => openEdit(r)} className="rounded-lg p-2 text-[#1E3A5F] hover:bg-[#1E3A5F]/5"><FontAwesomeIcon icon={faPen} className="h-4 w-4" /></button>
                          <button type="button" aria-label={`Hapus ${r.name}`} onClick={() => void remove(r)} className="rounded-lg p-2 text-[#6B7280] hover:bg-[#EF4444]/10 hover:text-[#EF4444]"><FontAwesomeIcon icon={faTrash} className="h-4 w-4" /></button>
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
        <Modal title={`${modal.editing ? "Edit" : "Tambah"} Gudang`} onClose={() => setModal(emptyModal)}>
          <div className="space-y-4">
            <label className={labelCls}><span>Kode *</span><input className={`${inputCls} font-mono`} placeholder="cth: GDA" value={modal.kode} onChange={(e) => setModal((m) => ({ ...m, kode: e.target.value }))} /></label>
            <label className={labelCls}><span>Nama *</span><input className={inputCls} placeholder="cth: Gudang A" value={modal.name} onChange={(e) => setModal((m) => ({ ...m, name: e.target.value }))} /></label>
            <label className="flex items-center gap-2 text-sm font-medium text-[#1F2937]">
              <input type="checkbox" checked={modal.isActive} onChange={(e) => setModal((m) => ({ ...m, isActive: e.target.checked }))} className="h-4 w-4 accent-[#00A8E8]" />
              Aktif
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setModal(emptyModal)} className={secondaryBtn}>Batal</button>
              <button type="button" disabled={modal.busy || !modal.kode.trim() || !modal.name.trim()} onClick={() => void submit()} className={primaryBtn}>{modal.busy ? "Menyimpan..." : modal.editing ? "Simpan" : "Tambah"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
