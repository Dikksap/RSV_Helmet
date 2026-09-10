import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen, faTrash, faCirclePlus, faPalette, faRuler, faShirt, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import {
  getStyles, createStyle, updateStyle, deleteStyle,
  getColors, createColor, updateColor, deleteColor,
  getSizes, createSize, updateSize, deleteSize,
  type MasterStyle, type MasterColor, type MasterSize,
} from "../api/masterData";
import { Modal } from "../components/VariantProduk/Modal";
import { inputCls, labelCls } from "../components/VariantProduk/constants";

type Tab = "style" | "color" | "size";

const TABS: { key: Tab; label: string; icon: typeof faShirt; hint: string }[] = [
  { key: "style", label: "Style", icon: faShirt, hint: "Motif / model helm" },
  { key: "color", label: "Warna", icon: faPalette, hint: "Varian warna" },
  { key: "size", label: "Ukuran", icon: faRuler, hint: "Size + urutan" },
];

const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#00A8E8] px-6 py-3 text-[15px] font-medium text-white transition duration-200 ease hover:bg-[#0088C0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/40 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none";
const secondaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-[#D1D5DB] bg-white px-4 py-3 text-[15px] font-medium text-[#1F2937] transition duration-200 ease hover:bg-[#F5F7FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/40";

export default function MasterData() {
  const [tab, setTab] = useState<Tab>("style");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [styles, setStyles] = useState<MasterStyle[]>([]);
  const [colors, setColors] = useState<MasterColor[]>([]);
  const [sizes, setSizes] = useState<MasterSize[]>([]);

  // modals
  const [styleModal, setStyleModal] = useState<{ open: boolean; editing: MasterStyle | null; nama: string; busy: boolean }>({ open: false, editing: null, nama: "", busy: false });
  const [colorModal, setColorModal] = useState<{ open: boolean; editing: MasterColor | null; nama: string; busy: boolean }>({ open: false, editing: null, nama: "", busy: false });
  const [sizeModal, setSizeModal] = useState<{ open: boolean; editing: MasterSize | null; nama: string; urutan: string; busy: boolean }>({ open: false, editing: null, nama: "", urutan: "", busy: false });

  const flash = (msg: string) => { setNotice(msg); window.setTimeout(() => setNotice(null), 3000); };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [s, c, z] = await Promise.all([getStyles(), getColors(), getSizes()]);
      setStyles(s); setColors(c); setSizes(z);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat master data.");
    } finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadAll(); }, []);

  const q = search.trim().toLowerCase();
  const filteredStyles = useMemo(() => styles.filter(x => !q || x.nama.toLowerCase().includes(q)).sort((a,b)=>a.nama.localeCompare(b.nama)), [styles,q]);
  const filteredColors = useMemo(() => colors.filter(x => !q || x.nama.toLowerCase().includes(q)).sort((a,b)=>a.nama.localeCompare(b.nama)), [colors,q]);
  const filteredSizes = useMemo(() => sizes.filter(x => !q || x.nama.toLowerCase().includes(q)).sort((a,b)=> a.urutan - b.urutan || a.nama.localeCompare(b.nama)), [sizes,q]);

  // ---- Style CRUD ----
  const submitStyle = async () => {
    const nama = styleModal.nama.trim();
    if (!nama) return window.alert("Field 'nama' wajib diisi (400)");
    setStyleModal(m => ({ ...m, busy: true }));
    try {
      if (styleModal.editing) await updateStyle(styleModal.editing.id, { nama });
      else await createStyle({ nama });
      flash(styleModal.editing ? "Style diperbarui." : "Style ditambahkan.");
      setStyleModal({ open: false, editing: null, nama: "", busy: false });
      await loadAll();
    } catch (e) {
      setStyleModal(m => ({ ...m, busy: false }));
      window.alert(e instanceof Error ? e.message : "Gagal menyimpan style.");
    }
  };
  const removeStyle = async (row: MasterStyle) => {
    if (!window.confirm(`Hapus style "${row.nama}"?`)) return;
    try { await deleteStyle(row.id); flash("Style dihapus."); await loadAll(); }
    catch (e) { window.alert(e instanceof Error ? e.message : "Gagal hapus. Mungkin masih dipakai variant (409)."); }
  };

  // ---- Color CRUD ----
  const submitColor = async () => {
    const nama = colorModal.nama.trim();
    if (!nama) return window.alert("Field 'nama' wajib diisi (400)");
    setColorModal(m => ({ ...m, busy: true }));
    try {
      if (colorModal.editing) await updateColor(colorModal.editing.id, { nama });
      else await createColor({ nama });
      flash(colorModal.editing ? "Warna diperbarui." : "Warna ditambahkan.");
      setColorModal({ open: false, editing: null, nama: "", busy: false });
      await loadAll();
    } catch (e) {
      setColorModal(m => ({ ...m, busy: false }));
      window.alert(e instanceof Error ? e.message : "Gagal menyimpan warna.");
    }
  };
  const removeColor = async (row: MasterColor) => {
    if (!window.confirm(`Hapus warna "${row.nama}"?`)) return;
    try { await deleteColor(row.id); flash("Warna dihapus."); await loadAll(); }
    catch (e) { window.alert(e instanceof Error ? e.message : "Gagal hapus. Mungkin masih dipakai variant (409)."); }
  };

  // ---- Size CRUD ----
  const submitSize = async () => {
    const nama = sizeModal.nama.trim();
    const urutan = sizeModal.urutan === "" ? undefined : Number(sizeModal.urutan);
    if (!nama) return window.alert("Field 'nama' wajib diisi (400)");
    if (urutan !== undefined && (!Number.isInteger(urutan) || urutan < 0)) return window.alert("Field 'urutan' harus angka >=0 (400)");
    setSizeModal(m => ({ ...m, busy: true }));
    try {
      if (sizeModal.editing) await updateSize(sizeModal.editing.id, { nama, urutan });
      else await createSize({ nama, urutan });
      flash(sizeModal.editing ? "Ukuran diperbarui." : "Ukuran ditambahkan.");
      setSizeModal({ open: false, editing: null, nama: "", urutan: "", busy: false });
      await loadAll();
    } catch (e) {
      setSizeModal(m => ({ ...m, busy: false }));
      window.alert(e instanceof Error ? e.message : "Gagal menyimpan ukuran.");
    }
  };
  const removeSize = async (row: MasterSize) => {
    if (!window.confirm(`Hapus ukuran "${row.nama}"?`)) return;
    try { await deleteSize(row.id); flash("Ukuran dihapus."); await loadAll(); }
    catch (e) { window.alert(e instanceof Error ? e.message : "Gagal hapus. Mungkin masih dipakai variant (409)."); }
  };

  const openAdd = () => {
    if (tab === "style") setStyleModal({ open: true, editing: null, nama: "", busy: false });
    else if (tab === "color") setColorModal({ open: true, editing: null, nama: "", busy: false });
    else setSizeModal({ open: true, editing: null, nama: "", urutan: "", busy: false });
  };

  const counts: Record<Tab, number> = { style: styles.length, color: colors.length, size: sizes.length };
  const shown = tab === "style" ? `${filteredStyles.length}/${styles.length}` : tab === "color" ? `${filteredColors.length}/${colors.length}` : `${filteredSizes.length}/${sizes.length}`;
  const tabLabel = tab === "style" ? "style" : tab === "color" ? "warna" : "ukuran";

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">Master Data</p>
          <h1 className="text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">Style · Warna · Ukuran</h1>
          <p className="mt-2 text-base leading-relaxed text-[#6B7280]">Kelola master data untuk variant produk. Dipakai di POST /api/products/:id/variants.</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button type="button" onClick={openAdd} className={primaryBtn}>
            <FontAwesomeIcon icon={faCirclePlus} className="h-4 w-4" aria-hidden="true" />
            Tambah {tab === "style" ? "Style" : tab === "color" ? "Warna" : "Ukuran"}
          </button>
        </div>
      </header>

      {/* Stat cards */}
      <section aria-label="Ringkasan master data" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => { setTab(t.key); setSearch(""); }}
              aria-pressed={active}
              className={`rounded-xl bg-white p-6 text-left shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition duration-200 ease hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/40 ${active ? "ring-2 ring-[#00A8E8]" : "ring-1 ring-slate-200/70"}`}
            >
              <span className={`inline-grid h-10 w-10 place-items-center rounded-lg ${active ? "bg-[#00A8E8] text-white" : "bg-[#F5F7FA] text-[#1E3A5F]"}`}>
                <FontAwesomeIcon icon={t.icon} className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="mt-3 block text-2xl font-bold tabular-nums text-[#1F2937]">{counts[t.key]}</span>
              <span className="block text-base font-semibold text-[#1E3A5F]">{t.label}</span>
              <span className="block text-sm text-[#6B7280]">{t.hint}</span>
            </button>
          );
        })}
      </section>

      {/* Alerts */}
      <div aria-live="polite" className="space-y-3">
        {loading && <p className="animate-pulse text-[15px] text-[#6B7280]">Memuat master data...</p>}
        {error && <p role="alert" className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-[15px] text-[#EF4444]">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-4 py-3 text-[15px] text-[#1F2937]">{notice}</p>}
      </div>

      {!loading && !error && (
        <main className="space-y-4">
          {/* Tabs + search */}
          <section aria-label="Filter master data" className="rounded-xl bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <nav aria-label="Kategori master" className="flex flex-wrap gap-2">
                {TABS.map((t) => {
                  const active = tab === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => { setTab(t.key); setSearch(""); }}
                      className={`inline-flex items-center gap-2 rounded-lg px-6 py-3 text-[15px] font-medium transition duration-200 ease focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/40 ${active ? "bg-[#1E3A5F] text-white" : "bg-[#F5F7FA] text-[#6B7280] hover:bg-slate-200/70 hover:text-[#1F2937]"}`}
                    >
                      <FontAwesomeIcon icon={t.icon} className="h-4 w-4" aria-hidden="true" />
                      {t.label}
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${active ? "bg-white/20 text-white" : "bg-white text-[#6B7280] ring-1 ring-slate-200"}`}>
                        {counts[t.key]}
                      </span>
                    </button>
                  );
                })}
              </nav>
              <div className="w-full lg:max-w-sm">
                <label htmlFor="master-search" className="mb-1 block text-sm font-medium text-[#1F2937]">
                  Cari {tabLabel}
                </label>
                <div className="relative">
                  <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" aria-hidden="true" />
                  <input
                    id="master-search"
                    type="search"
                    className={`${inputCls} pl-9`}
                    placeholder="ketik nama..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <p className="mt-3 text-[13px] text-[#6B7280]">{shown} tampil</p>
          </section>

          {/* Table */}
          <section aria-label={`Daftar ${tabLabel}`} className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <div className="overflow-x-auto">
              {tab === "style" && (
                <table className="w-full min-w-[520px] text-left">
                  <thead className="bg-[#F5F7FA] text-[#6B7280]">
                    <tr>
                      <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">ID</th>
                      <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Nama Style</th>
                      <th scope="col" className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStyles.length === 0 ? (
                      <tr><td colSpan={3} className="px-6 py-8 text-center text-[15px] italic text-[#6B7280]">Belum ada style. Klik Tambah Style.</td></tr>
                    ) : filteredStyles.map(s => (
                      <tr key={s.id} className="text-[15px] transition duration-200 ease hover:bg-[#F5F7FA]">
                        <td className="px-6 py-4 font-mono text-sm text-[#6B7280]">{s.id}</td>
                        <td className="px-6 py-4 font-medium text-[#1F2937]">{s.nama}</td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-1">
                            <button type="button" title={`Edit ${s.nama}`} aria-label={`Edit ${s.nama}`} onClick={() => setStyleModal({ open: true, editing: s, nama: s.nama, busy: false })} className="rounded-lg p-2 text-[#1E3A5F] transition duration-200 ease hover:bg-[#1E3A5F]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/40"><FontAwesomeIcon icon={faPen} className="h-4 w-4" /></button>
                            <button type="button" title={`Hapus ${s.nama}`} aria-label={`Hapus ${s.nama}`} onClick={() => void removeStyle(s)} className="rounded-lg p-2 text-[#6B7280] transition duration-200 ease hover:bg-[#EF4444]/10 hover:text-[#EF4444] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF4444]/40"><FontAwesomeIcon icon={faTrash} className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === "color" && (
                <table className="w-full min-w-[520px] text-left">
                  <thead className="bg-[#F5F7FA] text-[#6B7280]">
                    <tr>
                      <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">ID</th>
                      <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Nama Warna</th>
                      <th scope="col" className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredColors.length === 0 ? (
                      <tr><td colSpan={3} className="px-6 py-8 text-center text-[15px] italic text-[#6B7280]">Belum ada warna.</td></tr>
                    ) : filteredColors.map(c => (
                      <tr key={c.id} className="text-[15px] transition duration-200 ease hover:bg-[#F5F7FA]">
                        <td className="px-6 py-4 font-mono text-sm text-[#6B7280]">{c.id}</td>
                        <td className="px-6 py-4 font-medium text-[#1F2937]">{c.nama}</td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-1">
                            <button type="button" title={`Edit ${c.nama}`} aria-label={`Edit ${c.nama}`} onClick={() => setColorModal({ open: true, editing: c, nama: c.nama, busy: false })} className="rounded-lg p-2 text-[#1E3A5F] transition duration-200 ease hover:bg-[#1E3A5F]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/40"><FontAwesomeIcon icon={faPen} className="h-4 w-4" /></button>
                            <button type="button" title={`Hapus ${c.nama}`} aria-label={`Hapus ${c.nama}`} onClick={() => void removeColor(c)} className="rounded-lg p-2 text-[#6B7280] transition duration-200 ease hover:bg-[#EF4444]/10 hover:text-[#EF4444] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF4444]/40"><FontAwesomeIcon icon={faTrash} className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {tab === "size" && (
                <table className="w-full min-w-[560px] text-left">
                  <thead className="bg-[#F5F7FA] text-[#6B7280]">
                    <tr>
                      <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">ID</th>
                      <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Nama Ukuran</th>
                      <th scope="col" className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Urutan</th>
                      <th scope="col" className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSizes.length === 0 ? (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-[15px] italic text-[#6B7280]">Belum ada ukuran.</td></tr>
                    ) : filteredSizes.map(z => (
                      <tr key={z.id} className="text-[15px] transition duration-200 ease hover:bg-[#F5F7FA]">
                        <td className="px-6 py-4 font-mono text-sm text-[#6B7280]">{z.id}</td>
                        <td className="px-6 py-4 font-medium text-[#1F2937]">{z.nama}</td>
                        <td className="px-6 py-4 tabular-nums text-[#6B7280]">{z.urutan}</td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-1">
                            <button type="button" title={`Edit ${z.nama}`} aria-label={`Edit ${z.nama}`} onClick={() => setSizeModal({ open: true, editing: z, nama: z.nama, urutan: String(z.urutan), busy: false })} className="rounded-lg p-2 text-[#1E3A5F] transition duration-200 ease hover:bg-[#1E3A5F]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/40"><FontAwesomeIcon icon={faPen} className="h-4 w-4" /></button>
                            <button type="button" title={`Hapus ${z.nama}`} aria-label={`Hapus ${z.nama}`} onClick={() => void removeSize(z)} className="rounded-lg p-2 text-[#6B7280] transition duration-200 ease hover:bg-[#EF4444]/10 hover:text-[#EF4444] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF4444]/40"><FontAwesomeIcon icon={faTrash} className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </main>
      )}

      {/* Modals */}
      {styleModal.open && (
        <Modal title={styleModal.editing ? "Edit Style" : "Tambah Style"} onClose={() => setStyleModal({ open: false, editing: null, nama: "", busy: false })}>
          <div className="space-y-4">
            <label className={labelCls}><span>Nama Style</span><input className={inputCls} placeholder="cth: Motif" value={styleModal.nama} onChange={e => setStyleModal(m => ({ ...m, nama: e.target.value }))} /></label>
            <p className="text-[13px] text-[#6B7280]">POST /api/styles {"{nama}"} · PUT /api/styles/:id · 409 jika duplikat</p>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setStyleModal({ open: false, editing: null, nama: "", busy: false })} className={secondaryBtn}>Batal</button>
              <button type="button" disabled={styleModal.busy || !styleModal.nama.trim()} onClick={() => void submitStyle()} className={primaryBtn}>{styleModal.busy ? "Menyimpan..." : styleModal.editing ? "Simpan" : "Tambah"}</button>
            </div>
          </div>
        </Modal>
      )}
      {colorModal.open && (
        <Modal title={colorModal.editing ? "Edit Warna" : "Tambah Warna"} onClose={() => setColorModal({ open: false, editing: null, nama: "", busy: false })}>
          <div className="space-y-4">
            <label className={labelCls}><span>Nama Warna</span><input className={inputCls} placeholder="cth: BOB" value={colorModal.nama} onChange={e => setColorModal(m => ({ ...m, nama: e.target.value }))} /></label>
            <p className="text-[13px] text-[#6B7280]">POST /api/colors {"{nama}"} · PUT /api/colors/:id · 409 jika duplikat</p>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setColorModal({ open: false, editing: null, nama: "", busy: false })} className={secondaryBtn}>Batal</button>
              <button type="button" disabled={colorModal.busy || !colorModal.nama.trim()} onClick={() => void submitColor()} className={primaryBtn}>{colorModal.busy ? "Menyimpan..." : colorModal.editing ? "Simpan" : "Tambah"}</button>
            </div>
          </div>
        </Modal>
      )}
      {sizeModal.open && (
        <Modal title={sizeModal.editing ? "Edit Ukuran" : "Tambah Ukuran"} onClose={() => setSizeModal({ open: false, editing: null, nama: "", urutan: "", busy: false })}>
          <div className="space-y-4">
            <label className={labelCls}><span>Nama Ukuran</span><input className={inputCls} placeholder="cth: LG" value={sizeModal.nama} onChange={e => setSizeModal(m => ({ ...m, nama: e.target.value }))} /></label>
            <label className={labelCls}><span>Urutan (sorting)</span><input type="number" min={0} className={inputCls} placeholder="cth: 1" value={sizeModal.urutan} onChange={e => setSizeModal(m => ({ ...m, urutan: e.target.value }))} /></label>
            <p className="text-[13px] text-[#6B7280]">POST /api/sizes {"{nama, urutan?}"} · PUT /api/sizes/:id · 409 duplicate, 400 validasi urutan</p>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setSizeModal({ open: false, editing: null, nama: "", urutan: "", busy: false })} className={secondaryBtn}>Batal</button>
              <button type="button" disabled={sizeModal.busy || !sizeModal.nama.trim()} onClick={() => void submitSize()} className={primaryBtn}>{sizeModal.busy ? "Menyimpan..." : sizeModal.editing ? "Simpan" : "Tambah"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
