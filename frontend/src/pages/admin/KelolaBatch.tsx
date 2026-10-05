import { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen, faTrash, faCirclePlus, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import {
  getBatches, createBatch, updateBatch, deleteBatch, batchLabel,
  type Batch, type BatchStatus,
} from "../../api/batch";
import { Modal } from "../../components/admin/VariantProduk/Modal";
import { inputCls, labelCls } from "../../components/admin/VariantProduk/constants";

const primaryBtn = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#00A8E8] px-6 py-3 text-[15px] font-medium text-white transition hover:bg-[#0088C0] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none";
const secondaryBtn = "inline-flex items-center justify-center gap-2 rounded-lg border border-[#D1D5DB] bg-white px-4 py-3 text-[15px] font-medium text-[#1F2937] hover:bg-[#F5F7FA]";

const statusBadge = (s: BatchStatus) =>
  s === "AKTIF"
    ? "bg-emerald-100 text-emerald-800"
    : "bg-slate-100 text-slate-500";

export default function KelolaBatch() {
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Batch[]>([]);
  const [modal, setModal] = useState<{ open: boolean; editing: Batch | null; kapasitas: string; status: BatchStatus; busy: boolean }>({
    open: false, editing: null, kapasitas: "5000", status: "AKTIF", busy: false,
  });

  const flash = (msg: string) => { setNotice(msg); window.setTimeout(() => setNotice(null), 3000); };
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await getBatches());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data batch.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => !q || batchLabel(r.nomorBatch).toLowerCase().includes(q) || String(r.nomorBatch).includes(q))
      .sort((a, b) => a.nomorBatch - b.nomorBatch);
  }, [rows, search]);

  const submit = async () => {
    const kapasitas = modal.kapasitas === "" ? undefined : Number(modal.kapasitas);
    if (kapasitas !== undefined && (!Number.isInteger(kapasitas) || kapasitas < 0)) {
      return window.alert("Field 'kapasitas' harus bilangan bulat >= 0");
    }
    setModal((m) => ({ ...m, busy: true }));
    try {
      if (modal.editing) {
        await updateBatch(modal.editing.id, { kapasitas, status: modal.status });
        flash("Batch diperbarui.");
      } else {
        const created = await createBatch(kapasitas === undefined ? {} : { kapasitas });
        flash(`Batch ${batchLabel(created.nomorBatch)} ditambahkan.`);
      }
      setModal({ open: false, editing: null, kapasitas: "5000", status: "AKTIF", busy: false });
      await load();
    } catch (e) {
      setModal((m) => ({ ...m, busy: false }));
      window.alert(e instanceof Error ? e.message : "Gagal menyimpan.");
    }
  };

  const remove = async (row: Batch) => {
    const count = row._count?.barang ?? 0;
    if (count > 0) return window.alert(`Batch ${batchLabel(row.nomorBatch)} masih berisi ${count.toLocaleString("id-ID")} barang dan tidak boleh dihapus.`);
    if (!window.confirm(`Hapus batch ${batchLabel(row.nomorBatch)}?`)) return;
    try {
      await deleteBatch(row.id);
      flash("Batch dihapus.");
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Gagal hapus.");
    }
  };

  const openAdd = () => setModal({ open: true, editing: null, kapasitas: "5000", status: "AKTIF", busy: false });
  const openEdit = (r: Batch) => setModal({ open: true, editing: r, kapasitas: String(r.kapasitas), status: r.status, busy: false });

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">Manajemen</p>
          <h1 className="text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">Kelola Batch</h1>
          <p className="mt-2 text-base text-[#6B7280]">Batch produksi barang: nomor otomatis berurutan, kapasitas dan status bisa diubah.</p>
        </div>
        <button type="button" onClick={openAdd} className={primaryBtn}>
          <FontAwesomeIcon icon={faCirclePlus} className="h-4 w-4" /> Tambah Batch
        </button>
      </header>

      <div aria-live="polite" className="space-y-3">
        {loading && <p className="animate-pulse text-[15px] text-[#6B7280]">Memuat data batch...</p>}
        {error && <p role="alert" className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-[#EF4444]">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-4 py-3 text-[#1F2937]">{notice}</p>}
      </div>

      {!loading && !error && (
        <main className="space-y-4">
          <section className="rounded-xl bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <div className="w-full lg:max-w-sm">
              <label htmlFor="batch-search" className="mb-1 block text-sm font-medium text-[#1F2937]">Cari batch</label>
              <div className="relative">
                <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                <input id="batch-search" type="search" className={`${inputCls} pl-9`} placeholder="cth: BC001 / 1..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
            <p className="mt-3 text-[13px] text-[#6B7280]">{filtered.length}/{rows.length} tampil</p>
          </section>

          <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead className="bg-[#F5F7FA] text-[#6B7280]">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Batch</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">Total Produksi</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">Kapasitas</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Barang</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center italic text-[#6B7280]">Belum ada batch.</td></tr>
                  ) : filtered.map((r) => (
                    <tr key={r.id} className="text-[15px] hover:bg-[#F5F7FA]">
                      <td className="px-6 py-4 font-mono font-semibold text-[#1E3A5F]">{batchLabel(r.nomorBatch)}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-[#1F2937]">{r.totalProduksi.toLocaleString("id-ID")}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-[#6B7280]">{r.kapasitas.toLocaleString("id-ID")}</td>
                      <td className="px-6 py-4 tabular-nums text-[#6B7280]">{(r._count?.barang ?? 0).toLocaleString("id-ID")} pcs</td>
                      <td className="px-6 py-4"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(r.status)}`}>{r.status}</span></td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-1">
                          <button type="button" aria-label={`Edit ${batchLabel(r.nomorBatch)}`} onClick={() => openEdit(r)} className="rounded-lg p-2 text-[#1E3A5F] hover:bg-[#1E3A5F]/5"><FontAwesomeIcon icon={faPen} className="h-4 w-4" /></button>
                          <button type="button" aria-label={`Hapus ${batchLabel(r.nomorBatch)}`} onClick={() => void remove(r)} className="rounded-lg p-2 text-[#6B7280] hover:bg-[#EF4444]/10 hover:text-[#EF4444]"><FontAwesomeIcon icon={faTrash} className="h-4 w-4" /></button>
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
        <Modal title={`${modal.editing ? "Edit" : "Tambah"} Batch`} onClose={() => setModal({ open: false, editing: null, kapasitas: "5000", status: "AKTIF", busy: false })}>
          <div className="space-y-4">
            {modal.editing && (
              <p className="text-sm text-[#6B7280]">Batch <b className="font-mono text-[#1E3A5F]">{batchLabel(modal.editing.nomorBatch)}</b> · {modal.editing.totalProduksi.toLocaleString("id-ID")} pcs terproduksi</p>
            )}
            {!modal.editing && (
              <p className="text-sm text-[#6B7280]">Nomor batch otomatis berurutan mengikuti batch terakhir.</p>
            )}
            <label className={labelCls}><span>Kapasitas</span><input type="number" min={0} className={inputCls} placeholder="5000" value={modal.kapasitas} onChange={(e) => setModal((m) => ({ ...m, kapasitas: e.target.value }))} /></label>
            {modal.editing && (
              <label className={labelCls}><span>Status</span>
                <select className={inputCls} value={modal.status} onChange={(e) => setModal((m) => ({ ...m, status: e.target.value as BatchStatus }))}>
                  <option value="AKTIF">AKTIF</option>
                  <option value="SELESAI">SELESAI</option>
                </select>
              </label>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setModal({ open: false, editing: null, kapasitas: "5000", status: "AKTIF", busy: false })} className={secondaryBtn}>Batal</button>
              <button type="button" disabled={modal.busy} onClick={() => void submit()} className={primaryBtn}>{modal.busy ? "Menyimpan..." : modal.editing ? "Simpan" : "Tambah"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
