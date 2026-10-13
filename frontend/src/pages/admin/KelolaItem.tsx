import { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen, faTrash, faCirclePlus, faMagnifyingGlass, faFileExport, faFileImport } from "@fortawesome/free-solid-svg-icons";
import {
  getItems, createItem, updateItem, deleteItem,
  type Item,
} from "../../api/item";
import { getDivisi, type Divisi } from "../../api/divisi";
import { getSaldoBulk } from "../../api/stokItem";
import { Modal } from "../../components/admin/VariantProduk/Modal";
import { inputCls, labelCls } from "../../components/admin/VariantProduk/constants";
import { ItemImportModal } from "../../components/admin/KelolaItem/ItemImportModal";
import { StokItemModal } from "../../components/admin/KelolaItem/StokItemModal";
import { downloadCsv } from "../../lib/csv";

const primaryBtn = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#00A8E8] px-6 py-3 text-[15px] font-medium text-white transition hover:bg-[#0088C0] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none";
const secondaryBtn = "inline-flex items-center justify-center gap-2 rounded-lg border border-[#D1D5DB] bg-white px-4 py-3 text-[15px] font-medium text-[#1F2937] hover:bg-[#F5F7FA]";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/60";

function ItemActions({
  nama,
  onStok,
  onEdit,
  onHapus,
}: {
  nama: string;
  onStok: () => void;
  onEdit: () => void;
  onHapus: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <button type="button" aria-label={`Stok ${nama}`} title="Lihat stok" onClick={onStok} className={`min-h-[40px] rounded-lg bg-[#00A8E8]/10 px-3 py-2 text-xs font-semibold text-[#0088C0] transition hover:bg-[#00A8E8] hover:text-white ${FOCUS}`}>Stok</button>
      <button type="button" aria-label={`Edit ${nama}`} title="Edit" onClick={onEdit} className={`grid min-h-[40px] min-w-[40px] place-items-center rounded-lg bg-[#F59E0B]/10 p-2 text-[#B45309] transition hover:bg-[#F59E0B] hover:text-white ${FOCUS}`}><FontAwesomeIcon icon={faPen} className="h-4 w-4" /></button>
      <button type="button" aria-label={`Hapus ${nama}`} title="Hapus" onClick={onHapus} className={`grid min-h-[40px] min-w-[40px] place-items-center rounded-lg bg-[#EF4444]/10 p-2 text-[#EF4444] transition hover:bg-[#EF4444] hover:text-white ${FOCUS}`}><FontAwesomeIcon icon={faTrash} className="h-4 w-4" /></button>
    </div>
  );
}

const emptyModal = { open: false, editing: null as Item | null, kode: "", nama: "", divisiId: "", unit: "pcs", isActive: true, busy: false };

export default function KelolaItem() {
  const [search, setSearch] = useState("");
  const [divisiFilter, setDivisiFilter] = useState("");
  const [hanyaAktif, setHanyaAktif] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Item[]>([]);
  const [divisi, setDivisi] = useState<Divisi[]>([]);
  const [modal, setModal] = useState(emptyModal);
  const [showImport, setShowImport] = useState(false);
  const [stokItem, setStokItem] = useState<Item | null>(null);
  const [saldo, setSaldo] = useState<Record<number, number>>({});
  const [saldoLoading, setSaldoLoading] = useState(false);

  const refreshSaldo = useCallback(async (ids: number[]) => {
    if (ids.length === 0) {
      setSaldo({});
      return;
    }
    setSaldoLoading(true);
    try {
      const { saldo: map } = await getSaldoBulk(ids);
      setSaldo(map);
    } catch {
      // Saldo pelengkap: gagal dimuat tak boleh menggagalkan halaman.
      setSaldo({});
    } finally {
      setSaldoLoading(false);
    }
  }, []);

  const flash = (msg: string) => { setNotice(msg); window.setTimeout(() => setNotice(null), 3000); };
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [items, div] = await Promise.all([getItems(), getDivisi()]);
      setRows(items);
      setDivisi(div);
      setError(null);
      await refreshSaldo(items.map((it) => it.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data item.");
    } finally {
      setLoading(false);
    }
  }, [refreshSaldo]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- muat awal sekali, pola sama seperti KelolaUser
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => !q || r.kode.toLowerCase().includes(q) || r.nama.toLowerCase().includes(q))
      .filter((r) => !divisiFilter || String(r.divisiId ?? "") === divisiFilter)
      .filter((r) => !hanyaAktif || r.isActive)
      .sort((a, b) => a.nama.localeCompare(b.nama));
  }, [rows, search, divisiFilter, hanyaAktif]);

  const submit = async () => {
    const kode = modal.kode.trim().toUpperCase();
    const nama = modal.nama.trim();
    const unit = modal.unit.trim() || "pcs";
    if (!kode) return window.alert("Field 'kode' wajib diisi");
    if (!nama) return window.alert("Field 'nama' wajib diisi");
    setModal((m) => ({ ...m, busy: true }));
    try {
      const payload = {
        kode,
        nama,
        divisiId: modal.divisiId ? Number(modal.divisiId) : null,
        unit,
        isActive: modal.isActive,
      };
      if (modal.editing) await updateItem(modal.editing.id, payload);
      else await createItem(payload);
      flash(modal.editing ? "Item diperbarui." : "Item ditambahkan.");
      setModal(emptyModal);
      await load();
    } catch (e) {
      setModal((m) => ({ ...m, busy: false }));
      window.alert(e instanceof Error ? e.message : "Gagal menyimpan.");
    }
  };

  const remove = async (row: Item) => {
    if (!window.confirm(`Hapus item "${row.nama}"? Rincian permintaan lama tetap tersimpan.`)) return;
    try {
      await deleteItem(row.id);
      flash("Item dihapus.");
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Gagal hapus.");
    }
  };

  const openAdd = () => setModal({ ...emptyModal, open: true });
  const openEdit = (r: Item) => setModal({ open: true, editing: r, kode: r.kode, nama: r.nama, divisiId: r.divisiId ? String(r.divisiId) : "", unit: r.unit, isActive: r.isActive, busy: false });

  const handleExport = () => {
    const data = filtered.length > 0 ? filtered : rows;
    downloadCsv(`item-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["kode", "nama", "divisi", "unit", "stok", "aktif"],
      ...data.map((r) => [r.kode, r.nama, r.divisi?.nama ?? "", r.unit, saldo[r.id] ?? "—", r.isActive ? "aktif" : "nonaktif"]),
    ]);
    flash(`Export ${data.length} item ke CSV.`);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">Master</p>
          <h1 className="text-[26px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">Kelola Item</h1>
          <p className="mt-2 text-base text-[#6B7280]">Master item untuk pilihan permintaan barang.</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <button type="button" onClick={openAdd} className={primaryBtn}>
            <FontAwesomeIcon icon={faCirclePlus} className="h-4 w-4" /> Tambah Item
          </button>
          <button type="button" onClick={handleExport} disabled={loading || rows.length === 0} className={secondaryBtn} title="Unduh tampil/filter saat ini sebagai CSV">
            <FontAwesomeIcon icon={faFileExport} className="h-4 w-4" /> Export
          </button>
          <button type="button" onClick={() => setShowImport(true)} className={secondaryBtn}>
            <FontAwesomeIcon icon={faFileImport} className="h-4 w-4" /> Import
          </button>
        </div>
      </header>

      <div aria-live="polite" className="space-y-3">
        {loading && <p className="animate-pulse text-[15px] text-[#6B7280]">Memuat data item...</p>}
        {error && <p role="alert" className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-[#EF4444]">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-4 py-3 text-[#1F2937]">{notice}</p>}
      </div>

      {!loading && !error && (
        <main className="space-y-4">
          <section className="rounded-xl bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:p-6">
            <div className="grid gap-3 sm:grid-cols-[1fr_220px_auto] sm:items-end">
              <div>
                <label htmlFor="item-search" className="mb-1 block text-sm font-medium text-[#1F2937]">Cari item</label>
                <div className="relative">
                  <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                  <input id="item-search" type="search" className={`${inputCls} pl-9`} placeholder="ketik kode / nama..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
              <div>
                <label htmlFor="item-divisi" className="mb-1 block text-sm font-medium text-[#1F2937]">Divisi</label>
                <select id="item-divisi" className={inputCls} value={divisiFilter} onChange={(e) => setDivisiFilter(e.target.value)}>
                  <option value="">Semua divisi</option>
                  {divisi.map((d) => <option key={d.id} value={String(d.id)}>{d.nama}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 pb-3 text-sm font-medium text-[#1F2937]">
                <input type="checkbox" checked={hanyaAktif} onChange={(e) => setHanyaAktif(e.target.checked)} className="h-4 w-4 accent-[#00A8E8]" />
                Hanya aktif
              </label>
            </div>
            <p className="mt-3 text-[13px] text-[#6B7280]">{filtered.length}/{rows.length} tampil</p>
          </section>

          <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-[#F5F7FA] text-[#6B7280]">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Kode</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Nama</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Divisi</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">Stok</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Unit</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-8 text-center italic text-[#6B7280]">Belum ada item.</td></tr>
                  ) : filtered.map((r) => (
                    <tr key={r.id} className="text-[15px] hover:bg-[#F5F7FA]">
                      <td className="px-6 py-4 font-mono text-sm font-semibold text-[#1E3A5F]">{r.kode}</td>
                      <td className="px-6 py-4 font-medium text-[#1F2937]">{r.nama}</td>
                      <td className="px-6 py-4 text-[#6B7280]">{r.divisi?.nama ?? <span className="italic">—</span>}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-[#1F2937]">{saldoLoading ? "…" : (saldo[r.id]?.toLocaleString("id-ID") ?? "—")}</td>
                      <td className="px-6 py-4 text-[#6B7280]">{r.unit}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-md px-2 py-0.5 text-[13px] font-medium ${r.isActive ? "bg-[#10B981]/10 text-[#0E7A55]" : "bg-slate-100 text-slate-500"}`}>
                          {r.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <ItemActions nama={r.nama} onStok={() => setStokItem(r)} onEdit={() => openEdit(r)} onHapus={() => void remove(r)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: daftar card ringkas */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {filtered.length === 0 ? (
                <li className="px-4 py-8 text-center italic text-[#6B7280]">Belum ada item.</li>
              ) : filtered.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setStokItem(r)}
                    aria-label={`Lihat stok ${r.nama}`}
                    className={`block w-full px-4 py-3.5 text-left ${FOCUS}`}
                  >
                    <span className="block truncate text-sm font-bold text-[#1E3A5F]">
                      {r.nama}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-xs text-slate-500">
                      {r.kode} · {r.divisi?.nama ?? "—"}
                    </span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="tabular-nums text-sm font-bold text-[#1E3A5F]">
                        {saldoLoading ? "…" : (saldo[r.id]?.toLocaleString("id-ID") ?? "—")}{" "}
                        <span className="text-[11px] font-medium text-slate-400">{r.unit}</span>
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${r.isActive ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/25" : "bg-slate-100 text-slate-500"}`}
                      >
                        {r.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </span>
                  </button>
                  <div className="flex items-center justify-end border-t border-dashed border-slate-100 px-4 py-1.5">
                    <ItemActions nama={r.nama} onStok={() => setStokItem(r)} onEdit={() => openEdit(r)} onHapus={() => void remove(r)} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </main>
      )}

      {modal.open && (
        <Modal title={`${modal.editing ? "Edit" : "Tambah"} Item`} onClose={() => setModal(emptyModal)}>
          <div className="space-y-4">
            <label className={labelCls}><span>Kode *</span><input className={`${inputCls} font-mono`} placeholder="cth: BRG-001" value={modal.kode} onChange={(e) => setModal((m) => ({ ...m, kode: e.target.value }))} /></label>
            <label className={labelCls}><span>Nama *</span><input className={inputCls} placeholder="cth: Baut M8" value={modal.nama} onChange={(e) => setModal((m) => ({ ...m, nama: e.target.value }))} /></label>
            <label className={labelCls}><span>Divisi</span>
              <select className={inputCls} value={modal.divisiId} onChange={(e) => setModal((m) => ({ ...m, divisiId: e.target.value }))}>
                <option value="">— Tanpa divisi —</option>
                {divisi.map((d) => <option key={d.id} value={String(d.id)}>{d.nama}</option>)}
              </select>
            </label>
            <label className={labelCls}><span>Unit</span><input className={inputCls} placeholder="pcs" value={modal.unit} onChange={(e) => setModal((m) => ({ ...m, unit: e.target.value }))} /></label>
            <label className="flex items-center gap-2 text-sm font-medium text-[#1F2937]">
              <input type="checkbox" checked={modal.isActive} onChange={(e) => setModal((m) => ({ ...m, isActive: e.target.checked }))} className="h-4 w-4 accent-[#00A8E8]" />
              Aktif (tampil di pilihan permintaan)
            </label>
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setModal(emptyModal)} className={secondaryBtn}>Batal</button>
              <button type="button" disabled={modal.busy || !modal.kode.trim() || !modal.nama.trim()} onClick={() => void submit()} className={primaryBtn}>{modal.busy ? "Menyimpan..." : modal.editing ? "Simpan" : "Tambah"}</button>
            </div>
          </div>
        </Modal>
      )}

      {stokItem && <StokItemModal item={stokItem} onClose={() => { setStokItem(null); void refreshSaldo(rows.map((it) => it.id)); }} />}

      <ItemImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        divisiOptions={divisi}
        onImported={() => void load()}
      />
    </div>
  );
}
