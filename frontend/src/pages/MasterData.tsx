import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen, faTrash, faCirclePlus, faPalette, faRuler, faShirt, faMagnifyingGlass, faTag } from "@fortawesome/free-solid-svg-icons";
import {
  getStyles, createStyle, updateStyle, deleteStyle,
  getColors, createColor, updateColor, deleteColor,
  getSizes, createSize, updateSize, deleteSize,
  getStatusBarangs, createStatusBarang, updateStatusBarang, deleteStatusBarang,
  type MasterStyle, type MasterColor, type MasterSize, type MasterStatusBarang,
} from "../api/masterData";
import { Modal } from "../components/VariantProduk/Modal";
import { inputCls, labelCls } from "../components/VariantProduk/constants";

type Tab = "style" | "color" | "size" | "status";
type Row = MasterStyle | MasterColor | MasterSize | MasterStatusBarang;

const TABS: { key: Tab; label: string; icon: typeof faShirt; hint: string }[] = [
  { key: "style", label: "Style", icon: faShirt, hint: "Motif / model helm" },
  { key: "color", label: "Warna", icon: faPalette, hint: "Varian warna" },
  { key: "size", label: "Ukuran", icon: faRuler, hint: "Size + urutan" },
  { key: "status", label: "Status", icon: faTag, hint: "Status barang" },
];

const API = {
  style: { get: getStyles, create: createStyle, update: updateStyle, del: deleteStyle, label: "Style" },
  color: { get: getColors, create: createColor, update: updateColor, del: deleteColor, label: "Warna" },
  size: { get: getSizes, create: createSize, update: updateSize, del: deleteSize, label: "Ukuran" },
  status: { get: getStatusBarangs, create: createStatusBarang, update: updateStatusBarang, del: deleteStatusBarang, label: "Status Barang" },
} as const;

const primaryBtn = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#00A8E8] px-6 py-3 text-[15px] font-medium text-white transition hover:bg-[#0088C0] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none";
const secondaryBtn = "inline-flex items-center justify-center gap-2 rounded-lg border border-[#D1D5DB] bg-white px-4 py-3 text-[15px] font-medium text-[#1F2937] hover:bg-[#F5F7FA]";

export default function MasterData() {
  const [tab, setTab] = useState<Tab>("style");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [styles, setStyles] = useState<MasterStyle[]>([]);
  const [colors, setColors] = useState<MasterColor[]>([]);
  const [sizes, setSizes] = useState<MasterSize[]>([]);
  const [statusList, setStatusList] = useState<MasterStatusBarang[]>([]);
  const [modal, setModal] = useState<{ open: boolean; editing: Row | null; nama: string; kode: string; warna: string; urutan: string; isActive: boolean; busy: boolean }>({
    open: false, editing: null, nama: "", kode: "", warna: "#6B7280", urutan: "", isActive: true, busy: false,
  });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const flash = (msg: string) => { setNotice(msg); window.setTimeout(() => setNotice(null), 3000); };
  const switchTab = (t: Tab) => { setTab(t); setSearch(""); setSelected(new Set()); };
  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, c, z, st] = await Promise.all([getStyles(), getColors(), getSizes(), getStatusBarangs()]);
      setStyles(s); setColors(c); setSizes(z); setStatusList(st); setError(null);
    }
    catch (e) { setError(e instanceof Error ? e.message : "Gagal memuat master data."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadAll(); }, []);

  const raw = tab === "style" ? styles : tab === "color" ? colors : tab === "size" ? sizes : statusList;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const f = (raw as Row[]).filter(x => {
      if (!q) return true;
      if (tab === "status") {
        const r = x as MasterStatusBarang;
        return r.nama.toLowerCase().includes(q) || r.kode.toLowerCase().includes(q);
      }
      return x.nama.toLowerCase().includes(q);
    });
    if (tab === "size") return [...f].sort((a, b) => (a as MasterSize).urutan - (b as MasterSize).urutan || a.nama.localeCompare(b.nama));
    if (tab === "status") return [...f].sort((a, b) => (a as MasterStatusBarang).urutan - (b as MasterStatusBarang).urutan || (a as MasterStatusBarang).kode.localeCompare((b as MasterStatusBarang).kode));
    return [...f].sort((a, b) => a.nama.localeCompare(b.nama));
  }, [raw, search, tab]);

  const submit = async () => {
    if (tab === "status") {
      const kode = modal.kode.trim().toUpperCase();
      const nama = modal.nama.trim();
      if (!kode) return window.alert("Field 'kode' wajib diisi (400)");
      if (!nama) return window.alert("Field 'nama' wajib diisi (400)");
      const urutan = modal.urutan === "" ? undefined : Number(modal.urutan);
      if (urutan !== undefined && (!Number.isInteger(urutan) || urutan < 0)) return window.alert("Field 'urutan' harus angka >=0");
      setModal(m => ({ ...m, busy: true }));
      try {
        const api = API[tab];
        const body: Record<string, unknown> = { kode, nama, warna: modal.warna || null, isActive: modal.isActive };
        if (urutan !== undefined) body.urutan = urutan;
        if (modal.editing) await (api.update as unknown as (id: number, b: Record<string, unknown>) => Promise<unknown>)(modal.editing.id, body);
        else await (api.create as unknown as (b: Record<string, unknown>) => Promise<unknown>)(body);
        flash(modal.editing ? `${api.label} diperbarui.` : `${api.label} ditambahkan.`);
        setModal({ open: false, editing: null, nama: "", kode: "", warna: "#6B7280", urutan: "", isActive: true, busy: false });
        await loadAll();
      } catch (e) {
        setModal(m => ({ ...m, busy: false }));
        window.alert(e instanceof Error ? e.message : "Gagal menyimpan.");
      }
      return;
    }
    const nama = modal.nama.trim();
    if (!nama) return window.alert("Field 'nama' wajib diisi (400)");
    const urutan = modal.urutan === "" ? undefined : Number(modal.urutan);
    if (tab === "size" && urutan !== undefined && (!Number.isInteger(urutan) || urutan < 0)) return window.alert("Field 'urutan' harus angka >=0 (400)");
    setModal(m => ({ ...m, busy: true }));
    try {
      const api = API[tab];
      if (modal.editing) await (api.update as unknown as (id: number, b: Record<string, unknown>) => Promise<unknown>)(modal.editing.id, tab === "size" ? { nama, urutan } : { nama });
      else await (api.create as unknown as (b: Record<string, unknown>) => Promise<unknown>)(tab === "size" ? { nama, urutan } : { nama });
      flash(modal.editing ? `${api.label} diperbarui.` : `${api.label} ditambahkan.`);
      setModal({ open: false, editing: null, nama: "", kode: "", warna: "#6B7280", urutan: "", isActive: true, busy: false });
      await loadAll();
    } catch (e) {
      setModal(m => ({ ...m, busy: false }));
      window.alert(e instanceof Error ? e.message : "Gagal menyimpan.");
    }
  };

  const remove = async (row: Row) => {
    const label = tab === "status" ? (row as MasterStatusBarang).kode : row.nama;
    if (!window.confirm(`Hapus ${API[tab].label.toLowerCase()} "${label}"?`)) return;
    try { await API[tab].del(row.id); flash(`${API[tab].label} dihapus.`); await loadAll(); }
    catch (e) { window.alert(e instanceof Error ? e.message : "Gagal hapus. Mungkin masih dipakai (409)."); }
  };

  const toggle = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(prev => (prev.size === filtered.length ? new Set() : new Set(filtered.map(r => r.id))));
  };

  const removeMany = async () => {
    if (selected.size === 0 || bulkBusy) return;
    const rows = filtered.filter(r => selected.has(r.id));
    if (!window.confirm(`Hapus ${rows.length} ${API[tab].label.toLowerCase()} yang dipilih?`)) return;
    setBulkBusy(true);
    let ok = 0;
    const fails: string[] = [];
    for (const r of rows) {
      try { await API[tab].del(r.id); ok++; }
      catch { fails.push(tab === "status" ? (r as MasterStatusBarang).kode : r.nama); }
    }
    setBulkBusy(false);
    setSelected(new Set());
    await loadAll();
    flash(fails.length === 0 ? `${ok} ${API[tab].label.toLowerCase()} dihapus.` : `${ok} dihapus, ${fails.length} gagal (masih dipakai): ${fails.join(", ")}`);
  };

  const counts: Record<Tab, number> = { style: styles.length, color: colors.length, size: sizes.length, status: statusList.length };
  const tabLabel = tab === "style" ? "style" : tab === "color" ? "warna" : tab === "size" ? "ukuran" : "status";

  const openAdd = () => {
    if (tab === "status") setModal({ open: true, editing: null, nama: "", kode: "", warna: "#6B7280", urutan: "", isActive: true, busy: false });
    else setModal({ open: true, editing: null, nama: "", kode: "", warna: "#6B7280", urutan: "", isActive: true, busy: false });
  };
  const openEdit = (r: Row) => {
    if (tab === "status") {
      const s = r as MasterStatusBarang;
      setModal({ open: true, editing: r, nama: s.nama, kode: s.kode, warna: s.warna ?? "#6B7280", urutan: String(s.urutan), isActive: s.isActive, busy: false });
    } else {
      setModal({ open: true, editing: r, nama: r.nama, kode: "", warna: "#6B7280", urutan: tab === "size" ? String((r as MasterSize).urutan) : "", isActive: true, busy: false });
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">Master Data</p>
          <h1 className="text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">Style · Warna · Ukuran · Status</h1>
          <p className="mt-2 text-base text-[#6B7280]">Kelola master data untuk variant produk dan status barang. Dipakai di POST /api/products/:id/variants dan /api/status-barang.</p>
        </div>
        <button type="button" onClick={openAdd} className={primaryBtn}>
          <FontAwesomeIcon icon={faCirclePlus} className="h-4 w-4" /> Tambah {API[tab].label}
        </button>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key} type="button" onClick={() => switchTab(t.key)} aria-pressed={active}
              className={`rounded-xl bg-white p-6 text-left shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] ${active ? "ring-2 ring-[#00A8E8]" : "ring-1 ring-slate-200/70"}`}>
              <span className={`inline-grid h-10 w-10 place-items-center rounded-lg ${active ? "bg-[#00A8E8] text-white" : "bg-[#F5F7FA] text-[#1E3A5F]"}`}><FontAwesomeIcon icon={t.icon} className="h-5 w-5" /></span>
              <span className="mt-3 block text-2xl font-bold tabular-nums text-[#1F2937]">{counts[t.key]}</span>
              <span className="block font-semibold text-[#1E3A5F]">{t.label}</span>
              <span className="block text-sm text-[#6B7280]">{t.hint}</span>
            </button>
          );
        })}
      </section>

      <div aria-live="polite" className="space-y-3">
        {loading && <p className="animate-pulse text-[15px] text-[#6B7280]">Memuat master data...</p>}
        {error && <p role="alert" className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-[#EF4444]">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-4 py-3 text-[#1F2937]">{notice}</p>}
      </div>

      {!loading && !error && (
        <main className="space-y-4">
          <section className="rounded-xl bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <nav className="flex flex-wrap gap-2">
                {TABS.map(t => {
                  const active = tab === t.key;
                  return (
                    <button key={t.key} type="button" aria-selected={active} onClick={() => switchTab(t.key)}
                      className={`inline-flex items-center gap-2 rounded-lg px-6 py-3 text-[15px] font-medium ${active ? "bg-[#1E3A5F] text-white" : "bg-[#F5F7FA] text-[#6B7280] hover:bg-slate-200/70"}`}>
                      <FontAwesomeIcon icon={t.icon} className="h-4 w-4" />{t.label}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${active ? "bg-white/20 text-white" : "bg-white text-[#6B7280] ring-1 ring-slate-200"}`}>{counts[t.key]}</span>
                    </button>
                  );
                })}
              </nav>
              <div className="w-full lg:max-w-sm">
                <label htmlFor="master-search" className="mb-1 block text-sm font-medium text-[#1F2937]">Cari {tabLabel}</label>
                <div className="relative">
                  <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                  <input id="master-search" type="search" className={`${inputCls} pl-9`} placeholder={tab === "status" ? "ketik kode / nama..." : "ketik nama..."} value={search} onChange={e => setSearch(e.target.value)} />
                </div>
              </div>
            </div>
            <p className="mt-3 text-[13px] text-[#6B7280]">{filtered.length}/{raw.length} tampil</p>
            {selected.size > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#00A8E8]/30 bg-sky-50 px-3 py-2.5">
                <span className="text-sm font-semibold text-[#1E3A5F]">{selected.size} dipilih</span>
                <span className="hidden text-slate-300 sm:inline">|</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => void removeMany()}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#EF4444] px-3 text-xs font-medium text-white hover:brightness-95 disabled:opacity-50"
                  >
                    <FontAwesomeIcon icon={faTrash} className="h-3 w-3" /> {bulkBusy ? "Menghapus..." : `Hapus (${selected.size})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="inline-flex h-8 items-center rounded-lg px-2 text-xs font-medium text-[#6B7280] hover:text-[#1F2937]"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead className="bg-[#F5F7FA] text-[#6B7280]">
                  <tr>
                    <th className="w-12 px-6 py-4">
                      <input
                        type="checkbox"
                        aria-label="Pilih semua"
                        checked={filtered.length > 0 && selected.size === filtered.length}
                        ref={(el) => { if (el) el.indeterminate = selected.size > 0 && selected.size < filtered.length; }}
                        onChange={toggleAll}
                        className="h-4 w-4 accent-[#00A8E8]"
                      />
                    </th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">ID</th>
                    {tab === "status" ? (
                      <>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Kode</th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Nama</th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Warna</th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Urutan</th>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Aktif</th>
                      </>
                    ) : (
                      <>
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Nama {tab === "style" ? "Style" : tab === "color" ? "Warna" : "Ukuran"}</th>
                        {tab === "size" && <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Urutan</th>}
                      </>
                    )}
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={tab === "status" ? 8 : tab === "size" ? 5 : 4} className="px-6 py-8 text-center italic text-[#6B7280]">Belum ada {tabLabel}.</td></tr>
                  ) : filtered.map(r => {
                    const isStatus = tab === "status";
                    const s = isStatus ? r as MasterStatusBarang : null;
                    return (
                      <tr key={r.id} className={`text-[15px] hover:bg-[#F5F7FA] ${selected.has(r.id) ? "bg-[#00A8E8]/5" : ""}`}>
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            aria-label={`Pilih ${isStatus ? s!.kode : r.nama}`}
                            checked={selected.has(r.id)}
                            onChange={() => toggle(r.id)}
                            className="h-4 w-4 accent-[#00A8E8]"
                          />
                        </td>
                        <td className="px-6 py-4 font-mono text-sm text-[#6B7280]">{r.id}</td>
                        {isStatus ? (
                          <>
                            <td className="px-6 py-4 font-mono text-sm font-bold text-[#1F2937]">{s!.kode}</td>
                            <td className="px-6 py-4 font-medium text-[#1F2937]">{s!.nama}</td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-2">
                                <span className="h-4 w-4 rounded border border-slate-200" style={{ backgroundColor: s!.warna ?? "#fff" }} />
                                <span className="font-mono text-xs text-[#6B7280]">{s!.warna ?? "-"}</span>
                              </span>
                            </td>
                            <td className="px-6 py-4 tabular-nums text-[#6B7280]">{s!.urutan}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${s!.isActive ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"}`}>
                                {s!.isActive ? "Aktif" : "Nonaktif"}
                              </span>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-6 py-4 font-medium text-[#1F2937]">{r.nama}</td>
                            {tab === "size" && <td className="px-6 py-4 tabular-nums text-[#6B7280]">{(r as MasterSize).urutan}</td>}
                          </>
                        )}
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-1">
                            <button type="button" aria-label={`Edit ${isStatus ? s!.kode : r.nama}`} onClick={() => openEdit(r)} className="rounded-lg p-2 text-[#1E3A5F] hover:bg-[#1E3A5F]/5"><FontAwesomeIcon icon={faPen} className="h-4 w-4" /></button>
                            <button type="button" aria-label={`Hapus ${isStatus ? s!.kode : r.nama}`} onClick={() => void remove(r)} className="rounded-lg p-2 text-[#6B7280] hover:bg-[#EF4444]/10 hover:text-[#EF4444]"><FontAwesomeIcon icon={faTrash} className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}

      {modal.open && (
        <Modal title={`${modal.editing ? "Edit" : "Tambah"} ${API[tab].label}`} onClose={() => setModal({ open: false, editing: null, nama: "", kode: "", warna: "#6B7280", urutan: "", isActive: true, busy: false })}>
          <div className="space-y-4">
            {tab === "status" ? (
              <>
                <label className={labelCls}><span>Kode *</span><input className={`${inputCls} font-mono`} placeholder="cth: QC_HOLD" value={modal.kode} onChange={e => setModal(m => ({ ...m, kode: e.target.value.toUpperCase() }))} /></label>
                <label className={labelCls}><span>Nama *</span><input className={inputCls} placeholder="cth: QC Hold" value={modal.nama} onChange={e => setModal(m => ({ ...m, nama: e.target.value }))} /></label>
                <div className="grid grid-cols-2 gap-4">
                  <label className={labelCls}><span>Warna</span><div className="flex gap-2"><input type="color" value={modal.warna} onChange={e => setModal(m => ({ ...m, warna: e.target.value }))} className="h-9 w-12 rounded border border-[#D1D5DB] p-1" /><input className={`${inputCls} flex-1 font-mono`} placeholder="#6B7280" value={modal.warna} onChange={e => setModal(m => ({ ...m, warna: e.target.value }))} /></div></label>
                  <label className={labelCls}><span>Urutan</span><input type="number" min={0} className={inputCls} placeholder="cth: 1" value={modal.urutan} onChange={e => setModal(m => ({ ...m, urutan: e.target.value }))} /></label>
                </div>
                <label className="flex items-center gap-2 text-sm font-medium text-[#1F2937]"><input type="checkbox" checked={modal.isActive} onChange={e => setModal(m => ({ ...m, isActive: e.target.checked }))} className="h-4 w-4 accent-[#00A8E8]" /> Aktif</label>
              </>
            ) : (
              <>
                <label className={labelCls}><span>Nama {API[tab].label}</span><input className={inputCls} placeholder={tab === "size" ? "cth: LG" : tab === "color" ? "cth: BOB" : "cth: Motif"} value={modal.nama} onChange={e => setModal(m => ({ ...m, nama: e.target.value }))} /></label>
                {tab === "size" && <label className={labelCls}><span>Urutan (sorting)</span><input type="number" min={0} className={inputCls} placeholder="cth: 1" value={modal.urutan} onChange={e => setModal(m => ({ ...m, urutan: e.target.value }))} /></label>}
              </>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setModal({ open: false, editing: null, nama: "", kode: "", warna: "#6B7280", urutan: "", isActive: true, busy: false })} className={secondaryBtn}>Batal</button>
              <button type="button" disabled={modal.busy || (tab === "status" ? !modal.kode.trim() || !modal.nama.trim() : !modal.nama.trim())} onClick={() => void submit()} className={primaryBtn}>{modal.busy ? "Menyimpan..." : modal.editing ? "Simpan" : "Tambah"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
