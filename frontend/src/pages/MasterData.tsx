import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen, faTrash, faCirclePlus, faPalette, faRuler, faShirt } from "@fortawesome/free-solid-svg-icons";
import {
  getStyles, createStyle, updateStyle, deleteStyle,
  getColors, createColor, updateColor, deleteColor,
  getSizes, createSize, updateSize, deleteSize,
  type MasterStyle, type MasterColor, type MasterSize,
} from "../api/masterData";
import { Modal } from "../components/VariantProduk/Modal";
import { inputCls, labelCls } from "../components/VariantProduk/constants";

type Tab = "style" | "color" | "size";

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-brand-gold">Master Data</p>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Style · Warna · Ukuran</h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-grey">Kelola master data untuk variant produk. Dipakai di POST /api/products/:id/variants.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {tab === "style" && <button onClick={() => setStyleModal({ open: true, editing: null, nama: "", busy: false })} className="inline-flex items-center gap-2 rounded-lg border border-brand-gold/30 bg-brand-gold/10 px-4 py-2.5 text-sm font-bold text-brand-gold hover:bg-brand-gold hover:text-brand-black"><FontAwesomeIcon icon={faCirclePlus} className="h-4 w-4" /> Style</button>}
          {tab === "color" && <button onClick={() => setColorModal({ open: true, editing: null, nama: "", busy: false })} className="inline-flex items-center gap-2 rounded-lg border border-brand-gold/30 bg-brand-gold/10 px-4 py-2.5 text-sm font-bold text-brand-gold hover:bg-brand-gold hover:text-brand-black"><FontAwesomeIcon icon={faCirclePlus} className="h-4 w-4" /> Warna</button>}
          {tab === "size" && <button onClick={() => setSizeModal({ open: true, editing: null, nama: "", urutan: "", busy: false })} className="inline-flex items-center gap-2 rounded-lg border border-brand-gold/30 bg-brand-gold/10 px-4 py-2.5 text-sm font-bold text-brand-gold hover:bg-brand-gold hover:text-brand-black"><FontAwesomeIcon icon={faCirclePlus} className="h-4 w-4" /> Ukuran</button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-brand-border bg-brand-surface-card p-1">
          {(["style","color","size"] as Tab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); setSearch(""); }} className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold transition ${tab===t ? "bg-brand-gold text-brand-black" : "text-brand-grey hover:text-white"}`}>
              <FontAwesomeIcon icon={t==="style"?faShirt:t==="color"?faPalette:faRuler} className="h-4 w-4" />
              {t==="style"?"Style":t==="color"?"Warna":"Ukuran"}
            </button>
          ))}
        </div>
        <span className="rounded-full border border-brand-gold/20 bg-brand-gold/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-gold">
          {tab==="style"?`${styles.length} style`:tab==="color"?`${colors.length} warna`:`${sizes.length} ukuran`}
        </span>
      </div>

      {loading && <p className="text-sm text-brand-grey">Memuat master data...</p>}
      {error && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</p>}
      {notice && <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{notice}</p>}

      {!loading && !error && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-brand-border bg-brand-surface-card p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <label className="grid flex-1 gap-1 text-xs font-bold text-brand-grey">
                <span>Cari {tab==="style"?"style":tab==="color"?"warna":"ukuran"}</span>
                <input className={inputCls} placeholder="ketik nama..." value={search} onChange={e=>setSearch(e.target.value)} />
              </label>
              <span className="text-xs text-brand-grey">
                {tab==="style"?`${filteredStyles.length}/${styles.length}`:tab==="color"?`${filteredColors.length}/${colors.length}`:`${filteredSizes.length}/${sizes.length}`} tampil
              </span>
            </div>
          </div>

          {/* Table */}
          {tab==="style" && (
            <div className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface-card">
              <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left">
                <thead className="bg-brand-surface/40 text-brand-grey"><tr>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">ID</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">Nama Style</th>
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider">Aksi</th>
                </tr></thead>
                <tbody className="divide-y divide-brand-border">
                  {filteredStyles.length===0 ? <tr><td colSpan={3} className="px-5 py-8 text-center text-sm italic text-brand-grey">Belum ada style. Klik + Style.</td></tr> :
                  filteredStyles.map(s=>(
                    <tr key={s.id} className="text-sm hover:bg-brand-surface/60">
                      <td className="px-5 py-4 font-mono text-brand-grey-light">{s.id}</td>
                      <td className="px-5 py-4 font-semibold text-white">{s.nama}</td>
                      <td className="px-5 py-4"><div className="flex justify-end gap-1">
                        <button onClick={()=>setStyleModal({open:true,editing:s,nama:s.nama,busy:false})} className="rounded-lg p-2 text-brand-grey hover:bg-brand-gold/10 hover:text-brand-gold"><FontAwesomeIcon icon={faPen} className="h-4 w-4" /></button>
                        <button onClick={()=>void removeStyle(s)} className="rounded-lg p-2 text-brand-grey hover:bg-rose-500/10 hover:text-rose-400"><FontAwesomeIcon icon={faTrash} className="h-4 w-4" /></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}

          {tab==="color" && (
            <div className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface-card">
              <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left">
                <thead className="bg-brand-surface/40 text-brand-grey"><tr>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">ID</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">Nama Warna</th>
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider">Aksi</th>
                </tr></thead>
                <tbody className="divide-y divide-brand-border">
                  {filteredColors.length===0 ? <tr><td colSpan={3} className="px-5 py-8 text-center text-sm italic text-brand-grey">Belum ada warna.</td></tr> :
                  filteredColors.map(c=>(
                    <tr key={c.id} className="text-sm hover:bg-brand-surface/60">
                      <td className="px-5 py-4 font-mono text-brand-grey-light">{c.id}</td>
                      <td className="px-5 py-4 font-semibold text-white">{c.nama}</td>
                      <td className="px-5 py-4"><div className="flex justify-end gap-1">
                        <button onClick={()=>setColorModal({open:true,editing:c,nama:c.nama,busy:false})} className="rounded-lg p-2 text-brand-grey hover:bg-brand-gold/10 hover:text-brand-gold"><FontAwesomeIcon icon={faPen} className="h-4 w-4" /></button>
                        <button onClick={()=>void removeColor(c)} className="rounded-lg p-2 text-brand-grey hover:bg-rose-500/10 hover:text-rose-400"><FontAwesomeIcon icon={faTrash} className="h-4 w-4" /></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}

          {tab==="size" && (
            <div className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface-card">
              <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left">
                <thead className="bg-brand-surface/40 text-brand-grey"><tr>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">ID</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">Nama Ukuran</th>
                  <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider">Urutan</th>
                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider">Aksi</th>
                </tr></thead>
                <tbody className="divide-y divide-brand-border">
                  {filteredSizes.length===0 ? <tr><td colSpan={4} className="px-5 py-8 text-center text-sm italic text-brand-grey">Belum ada ukuran.</td></tr> :
                  filteredSizes.map(z=>(
                    <tr key={z.id} className="text-sm hover:bg-brand-surface/60">
                      <td className="px-5 py-4 font-mono text-brand-grey-light">{z.id}</td>
                      <td className="px-5 py-4 font-semibold text-white">{z.nama}</td>
                      <td className="px-5 py-4 tabular-nums text-brand-grey-light">{z.urutan}</td>
                      <td className="px-5 py-4"><div className="flex justify-end gap-1">
                        <button onClick={()=>setSizeModal({open:true,editing:z,nama:z.nama,urutan:String(z.urutan),busy:false})} className="rounded-lg p-2 text-brand-grey hover:bg-brand-gold/10 hover:text-brand-gold"><FontAwesomeIcon icon={faPen} className="h-4 w-4" /></button>
                        <button onClick={()=>void removeSize(z)} className="rounded-lg p-2 text-brand-grey hover:bg-rose-500/10 hover:text-rose-400"><FontAwesomeIcon icon={faTrash} className="h-4 w-4" /></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}
        </section>
      )}

      {/* Modals */}
      {styleModal.open && (
        <Modal title={styleModal.editing ? "Edit Style" : "Tambah Style"} onClose={()=>setStyleModal({open:false,editing:null,nama:"",busy:false})}>
          <div className="space-y-4">
            <label className={labelCls}><span>Nama Style</span><input className={inputCls} placeholder="cth: Motif" value={styleModal.nama} onChange={e=>setStyleModal(m=>({...m,nama:e.target.value}))} /></label>
            <p className="text-xs text-brand-grey">POST /api/styles {"{nama}"} · PUT /api/styles/:id · 409 jika duplikat</p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={()=>setStyleModal({open:false,editing:null,nama:"",busy:false})} className="rounded-lg border border-brand-border bg-brand-surface px-4 py-2.5 text-sm font-bold text-brand-grey-light hover:text-white">Batal</button>
              <button disabled={styleModal.busy || !styleModal.nama.trim()} onClick={()=>void submitStyle()} className="rounded-lg border border-brand-gold/30 bg-brand-gold/10 px-4 py-2.5 text-sm font-bold text-brand-gold hover:bg-brand-gold hover:text-brand-black disabled:opacity-40">{styleModal.busy?"Menyimpan...":styleModal.editing?"Simpan":"Tambah"}</button>
            </div>
          </div>
        </Modal>
      )}
      {colorModal.open && (
        <Modal title={colorModal.editing ? "Edit Warna" : "Tambah Warna"} onClose={()=>setColorModal({open:false,editing:null,nama:"",busy:false})}>
          <div className="space-y-4">
            <label className={labelCls}><span>Nama Warna</span><input className={inputCls} placeholder="cth: BOB" value={colorModal.nama} onChange={e=>setColorModal(m=>({...m,nama:e.target.value}))} /></label>
            <p className="text-xs text-brand-grey">POST /api/colors {"{nama}"} · PUT /api/colors/:id · 409 jika duplikat</p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={()=>setColorModal({open:false,editing:null,nama:"",busy:false})} className="rounded-lg border border-brand-border bg-brand-surface px-4 py-2.5 text-sm font-bold text-brand-grey-light hover:text-white">Batal</button>
              <button disabled={colorModal.busy || !colorModal.nama.trim()} onClick={()=>void submitColor()} className="rounded-lg border border-brand-gold/30 bg-brand-gold/10 px-4 py-2.5 text-sm font-bold text-brand-gold hover:bg-brand-gold hover:text-brand-black disabled:opacity-40">{colorModal.busy?"Menyimpan...":colorModal.editing?"Simpan":"Tambah"}</button>
            </div>
          </div>
        </Modal>
      )}
      {sizeModal.open && (
        <Modal title={sizeModal.editing ? "Edit Ukuran" : "Tambah Ukuran"} onClose={()=>setSizeModal({open:false,editing:null,nama:"",urutan:"",busy:false})}>
          <div className="space-y-4">
            <label className={labelCls}><span>Nama Ukuran</span><input className={inputCls} placeholder="cth: LG" value={sizeModal.nama} onChange={e=>setSizeModal(m=>({...m,nama:e.target.value}))} /></label>
            <label className={labelCls}><span>Urutan (sorting)</span><input type="number" min={0} className={inputCls} placeholder="cth: 1" value={sizeModal.urutan} onChange={e=>setSizeModal(m=>({...m,urutan:e.target.value}))} /></label>
            <p className="text-xs text-brand-grey">POST /api/sizes {"{nama, urutan?}"} · PUT /api/sizes/:id · 409 duplicate, 400 validasi urutan</p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={()=>setSizeModal({open:false,editing:null,nama:"",urutan:"",busy:false})} className="rounded-lg border border-brand-border bg-brand-surface px-4 py-2.5 text-sm font-bold text-brand-grey-light hover:text-white">Batal</button>
              <button disabled={sizeModal.busy || !sizeModal.nama.trim()} onClick={()=>void submitSize()} className="rounded-lg border border-brand-gold/30 bg-brand-gold/10 px-4 py-2.5 text-sm font-bold text-brand-gold hover:bg-brand-gold hover:text-brand-black disabled:opacity-40">{sizeModal.busy?"Menyimpan...":sizeModal.editing?"Simpan":"Tambah"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
