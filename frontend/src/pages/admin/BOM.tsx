import { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCirclePlus, faMagnifyingGlass, faPen, faTrash } from "@fortawesome/free-solid-svg-icons";
import { getItems, type Item } from "../../api/item";
import { getVariantProduk, type VariantProdukRow } from "../../api/products";
import {
  getSubassemblies, createSubassembly, updateSubassembly, deleteSubassembly, syncSubassemblies,
  type Subassembly,
} from "../../api/subassembly";
import {
  getBoms, createBom, updateBom, deleteBom,
  type Bom, type BomParams,
} from "../../api/bom";
import { getUser, hasPermission } from "../../api/auth";
import { Modal } from "../../components/admin/VariantProduk/Modal";
import { inputCls, labelCls } from "../../components/admin/VariantProduk/constants";

const primaryBtn = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#00A8E8] px-6 py-3 text-[15px] font-medium text-white transition hover:bg-[#0088C0] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none";
const secondaryBtn = "inline-flex items-center justify-center gap-2 rounded-lg border border-[#D1D5DB] bg-white px-4 py-3 text-[15px] font-medium text-[#1F2937] hover:bg-[#F5F7FA]";

type Tab = "subassembly" | "bom";

interface DraftItem {
  id: string;
  kind: "item" | "subassembly";
  quantity: string;
  unit: string;
  scrap: string;
  urutan: string;
  isNew: boolean;
}

function numText(v: number | string | null | undefined) { return v == null ? "" : String(v); }

function newRow(items: Item[], subs: Subassembly[], first = true): DraftItem {
  const source = items.length ? "item" : "subassembly";
  const id = items.length ? String(items[0].id) : (subs.length ? String(subs[0].id) : "");
  return { id, kind: source, quantity: first ? "1" : "", unit: "", scrap: "", urutan: "", isNew: true };
}

export default function BOM() {
  const user = getUser();
  const canKelola = user?.role === "admin" || hasPermission("BOM_KELOLA");
  const [tab, setTab] = useState<Tab>("subassembly");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subs, setSubs] = useState<Subassembly[]>([]);
  const [boms, setBoms] = useState<Bom[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [variants, setVariants] = useState<VariantProdukRow[]>([]);
  const [search, setSearch] = useState("");
  const [bomFilterType, setBomFilterType] = useState<"all" | "product" | "subassembly">("all");
  const [saSearch, setSaSearch] = useState("");
  const [saActiveOnly, setSaActiveOnly] = useState(false);
  const [bomActiveOnly, setBomActiveOnly] = useState(false);

  const [saModal, setSaModal] = useState<{ open: boolean; editing: Subassembly | null; kode: string; nama: string; variantId: string; active: boolean; busy: boolean; err: string | null }>({
    open: false, editing: null, kode: "", nama: "", variantId: "", active: true, busy: false, err: null,
  });
  const [bomModal, setBomModal] = useState<{ open: boolean; editing: Bom | null; kode: string; nama: string; version: string; outType: "product" | "subassembly"; outId: string; active: boolean; start: string; end: string; items: DraftItem[]; busy: boolean; err: string | null }>({
    open: false, editing: null, kode: "", nama: "", version: "1.0", outType: "product", outId: "", active: true, start: "", end: "", items: [newRow([], [])], busy: false, err: null,
  });

  const flash = (msg: string) => { setNotice(msg); window.setTimeout(() => setNotice(null), 2800); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: BomParams = {};
      if (bomFilterType !== "all") params.outputType = bomFilterType;
      if (bomActiveOnly) params.aktif = true;
      const [s, b, its, vs] = await Promise.all([
        getSubassemblies(saSearch.trim() || saActiveOnly ? { q: saSearch.trim() || undefined, aktif: saActiveOnly ? true : undefined } : {}),
        getBoms({ ...(search.trim() ? { q: search.trim() } : {}), ...params }),
        getItems(),
        getVariantProduk(),
      ]);
      setSubs(s); setBoms(b); setItems(its); setVariants(vs); setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data BOM.");
    } finally {
      setLoading(false);
    }
  }, [saSearch, saActiveOnly, search, bomFilterType, bomActiveOnly]);
  useEffect(() => { void load(); }, [load]);

  const activeVariants = useMemo(() => variants.filter((v) => v.id), [variants]);

  const openSaAdd = () => setSaModal({ open: true, editing: null, kode: "", nama: "", variantId: "", active: true, busy: false, err: null });
  const openSaEdit = (row: Subassembly) => setSaModal({ open: true, editing: row, kode: row.kode, nama: row.nama, variantId: row.productVariantId ? String(row.productVariantId) : "", active: row.isActive, busy: false, err: null });

  const saveSa = async () => {
    if (!saModal.kode.trim() || !saModal.nama.trim()) { setSaModal((m) => ({ ...m, err: "Kode dan nama wajib diisi." })); return; }
    setSaModal((m) => ({ ...m, busy: true, err: null }));
    try {
      const body = {
        kode: saModal.kode.toUpperCase().trim(),
        nama: saModal.nama.trim(),
        productVariantId: saModal.variantId ? Number(saModal.variantId) : null,
        isActive: saModal.active,
      };
      if (saModal.editing) { await updateSubassembly(saModal.editing.id, body); flash("Subassembly diperbarui."); }
      else { const created = await createSubassembly(body); flash(`Subassembly ${created.kode} ditambahkan.`); }
      setSaModal({ open: false, editing: null, kode: "", nama: "", variantId: "", active: true, busy: false, err: null });
      await load();
    } catch (e) {
      setSaModal((m) => ({ ...m, busy: false, err: e instanceof Error ? e.message : "Gagal menyimpan." }));
    }
  };

  const removeSa = async (row: Subassembly) => {
    if (!window.confirm(`Hapus subassembly ${row.kode}?`)) return;
    try { await deleteSubassembly(row.id); flash("Subassembly dihapus."); await load(); }
    catch (e) { window.alert(e instanceof Error ? e.message : "Gagal hapus."); }
  };

  const variantLabel = (v: VariantProdukRow) =>
    `${v.namaProduk ?? "-"} - ${v.namaStyle} / ${v.namaColor} / ${v.namaSize}`;
  const openBomAdd = () => setBomModal({ open: true, editing: null, kode: "", nama: "", version: "1.0", outType: "product", outId: activeVariants[0] ? String(activeVariants[0].id) : "", active: true, start: "", end: "", items: [newRow(items, subs)], busy: false, err: null });
  const syncNow = async () => {
    try { const r = await syncSubassemblies(); flash(`${r.message} (${r.count} item SM)`); await load(); }
    catch (e) { window.alert(e instanceof Error ? e.message : "Gagal sinkronisasi."); }
  };
  const mapRow = (bomItem: Bom["items"][number]) => ({
    id: String(bomItem.subassemblyId ?? bomItem.itemId ?? ""),
    kind: (bomItem.subassemblyId ? "subassembly" : "item") as "item" | "subassembly",
    quantity: numText(bomItem.quantity),
    unit: bomItem.unit ?? "",
    scrap: numText(bomItem.scrapPercent),
    urutan: numText(bomItem.urutan),
    isNew: false,
  });
  const openBomEdit = (row: Bom) => setBomModal({
    open: true,
    editing: row,
    kode: row.kode ?? "",
    nama: row.nama,
    version: row.version,
    outType: row.subassemblyId ? "subassembly" : "product",
    outId: String(row.subassemblyId ?? row.productVariantId ?? ""),
    active: row.isActive,
    start: row.berlakuMulai ? row.berlakuMulai.slice(0, 10) : "",
    end: row.berlakuSelesai ? row.berlakuSelesai.slice(0, 10) : "",
    items: row.items.length ? row.items.map(mapRow) : [newRow(items, subs)],
    busy: false,
    err: null,
  });

  const updateDraft = (index: number, patch: Partial<DraftItem>) => {
    setBomModal((m) => ({ ...m, items: m.items.map((it, i) => i === index ? { ...it, ...patch } : it) }));
  };
  const addDraft = () => setBomModal((m) => ({ ...m, items: [...m.items, newRow(items, subs, false)] }));
  const removeDraft = (index: number) => setBomModal((m) => ({ ...m, items: m.items.length > 1 ? m.items.filter((_, i) => i !== index) : m.items }));

  const saveBom = async () => {
    const bom = bomModal;
    if (!bom.nama.trim() || !bom.version.trim()) { setBomModal((m) => ({ ...m, err: "Nama dan version wajib diisi." })); return; }
    if (!bom.outId) { setBomModal((m) => ({ ...m, err: "Output BOM wajib dipilih." })); return; }
    const payloadItems: { urutan: number | null; itemId: number | null; subassemblyId: number | null; quantity: number; unit: string | null; scrapPercent: number | null }[] = [];
    let idx = 0;
    for (const row of bom.items) {
      idx += 1;
      if (!row.id) { setBomModal((m) => ({ ...m, err: `Komponen baris ${idx} belum dipilih.` })); return; }
      const quantity = Number(row.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) { setBomModal((m) => ({ ...m, err: `Quantity baris ${idx} harus lebih dari 0.` })); return; }
      const scrap = row.scrap.trim() ? Number(row.scrap) : null;
      if (scrap !== null && (!Number.isFinite(scrap) || scrap < 0 || scrap > 100)) { setBomModal((m) => ({ ...m, err: `Scrap baris ${idx} harus 0-100.` })); return; }
      const urutan = row.urutan.trim() ? Number(row.urutan) : null;
      if (urutan !== null && (!Number.isInteger(urutan) || urutan <= 0)) { setBomModal((m) => ({ ...m, err: `Urutan baris ${idx} harus angka positif.` })); return; }
      const itemId = row.kind === "item" ? Number(row.id) : null;
      const subassemblyId = row.kind === "subassembly" ? Number(row.id) : null;
      if (row.kind === "item" && (!Number.isInteger(itemId!) || itemId! <= 0)) return;
      if (row.kind === "subassembly" && (!Number.isInteger(subassemblyId!) || subassemblyId! <= 0)) return;
      payloadItems.push({
        urutan,
        itemId,
        subassemblyId,
        quantity,
        unit: row.unit.trim() || null,
        scrapPercent: scrap,
      });
    }
    setBomModal((m) => ({ ...m, busy: true, err: null }));
    try {
      const body = {
        kode: bom.kode.trim() || null,
        nama: bom.nama.trim(),
        version: bom.version.trim(),
        isActive: bom.active,
        berlakuMulai: bom.start || null,
        berlakuSelesai: bom.end || null,
        productVariantId: bom.outType === "product" ? Number(bom.outId) : null,
        subassemblyId: bom.outType === "subassembly" ? Number(bom.outId) : null,
        items: payloadItems,
      };
      if (bom.editing) { await updateBom(bom.editing.id, body); flash("BOM diperbarui."); }
      else { const created = await createBom(body); flash(`BOM ${created.nama} v${created.version} ditambahkan.`); }
      setBomModal({ open: false, editing: null, kode: "", nama: "", version: "1.0", outType: "product", outId: "", active: true, start: "", end: "", items: [newRow(items, subs)], busy: false, err: null });
      await load();
    } catch (e) {
      setBomModal((m) => ({ ...m, busy: false, err: e instanceof Error ? e.message : "Gagal menyimpan BOM." }));
    }
  };

  const removeBom = async (row: Bom) => {
    if (!window.confirm(`Hapus BOM ${row.nama} v${row.version}?`)) return;
    try { await deleteBom(row.id); flash("BOM dihapus."); await load(); }
    catch (e) { window.alert(e instanceof Error ? e.message : "Gagal hapus BOM."); }
  };

  const outputLabel = (row: Bom) => row.productVariant ? `${row.productVariant.kodeVariant}${row.productVariant.product?.nama ? ` (${row.productVariant.product.nama})` : ""}` : (row.subassembly ? `${row.subassembly.kode} (${row.subassembly.nama})` : "-");
    const itemLabel = (row: Bom["items"][number]) => row.item ? `${row.item.kode} - ${row.item.nama}` : (row.subassembly ? `${row.subassembly.kode} - ${row.subassembly.nama}` : `#${row.itemId ?? row.subassemblyId}`);

  const filteredSubs = useMemo(() => {
    const q = saSearch.trim().toLowerCase();
    return subs.filter((r) => (!q || r.kode.toLowerCase().includes(q) || r.nama.toLowerCase().includes(q)) && (!saActiveOnly || r.isActive));
  }, [subs, saSearch, saActiveOnly]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-3xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">Bill of Materials</p>
          <h1 className="text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">Subassembly & BOM</h1>
          <p className="mt-2 text-base text-[#6B7280]">Kelola semi-finished subassembly dan daftar material/subassembly yang dipakai per BOM, baik output produk maupun subassembly.</p>
        </div>
        <button
          type="button"
          onClick={() => (tab === "subassembly" ? openSaAdd() : openBomAdd())}
          disabled={!canKelola}
          className={primaryBtn}
        >
          <FontAwesomeIcon icon={faCirclePlus} className="h-4 w-4" /> Tambah {tab === "subassembly" ? "Subassembly" : "BOM"}
        </button>
      </header>

      <div aria-live="polite" className="space-y-3">
        {loading && <p className="animate-pulse text-[15px] text-[#6B7280]">Memuat data BOM...</p>}
        {error && <p role="alert" className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-[#EF4444]">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-4 py-3 text-[#1F2937]">{notice}</p>}
      </div>

      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm" aria-label="Tab BOM">
        {(["subassembly", "bom"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${tab === t ? "bg-[#1E3A5F] text-white" : "text-[#6B7280] hover:bg-[#F5F7FA] hover:text-[#1F2937]"}`}
          >
            {t === "subassembly" ? "Subassembly" : "BOM"}
          </button>
        ))}
      </nav>

      {tab === "subassembly" && (
        <main className="space-y-4">
          <section className="rounded-xl bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label htmlFor="sa-search" className="mb-1 block text-sm font-medium text-[#1F2937]">Cari subassembly</label>
                <div className="relative">
                  <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                  <input id="sa-search" type="search" className={`${inputCls} pl-9`} value={saSearch} onChange={(e) => setSaSearch(e.target.value)} placeholder="cth: SA-BATOK / nama..." />
                </div>
              </div>
              <label className={labelCls}>
                <span>&nbsp;</span>
                <label className="flex h-9 items-center gap-2 text-[14px] text-[#1F2937]">
                  <input type="checkbox" checked={saActiveOnly} onChange={(e) => setSaActiveOnly(e.target.checked)} />
                  Aktif saja
                </label>
              </label>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-[13px] text-[#6B7280]">{filteredSubs.length}/{subs.length} tampil</p>
              {canKelola && <button type="button" onClick={() => void syncNow()} className={secondaryBtn}>Sinkron Item (SM)</button>}
            </div>
          </section>
          <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead className="bg-[#F5F7FA] text-[#6B7280]">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Kode</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Nama</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Output Product Variant</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSubs.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-8 text-center italic text-[#6B7280]">Belum ada subassembly.</td></tr>
                  ) : filteredSubs.map((row) => (
                    <tr key={row.id} className="text-[15px] hover:bg-[#F5F7FA]">
                      <td className="px-6 py-4 font-mono font-semibold text-[#1E3A5F]">{row.kode}</td>
                      <td className="px-6 py-4 text-[#1F2937]">{row.nama}</td>
                      <td className="px-6 py-4 text-[#6B7280]">
                        {row.item?.kode ? `${row.item.kode} - ${row.item.nama}` : (row.productVariant?.kodeVariant ? `${row.productVariant.kodeVariant}${row.productVariant.product?.nama ? ` (${row.productVariant.product.nama})` : ""}` : "-")}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${row.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                          {row.isActive ? "AKTIF" : "NONAKTIF"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-1">
                          <button type="button" disabled={!canKelola} aria-label={`Edit ${row.kode}`} onClick={() => openSaEdit(row)} className="rounded-lg p-2 text-[#1E3A5F] hover:bg-[#1E3A5F]/5 disabled:opacity-40">
                            <FontAwesomeIcon icon={faPen} className="h-4 w-4" />
                          </button>
                          <button type="button" disabled={!canKelola} aria-label={`Hapus ${row.kode}`} onClick={() => void removeSa(row)} className="rounded-lg p-2 text-[#6B7280] hover:bg-[#EF4444]/10 hover:text-[#EF4444] disabled:opacity-40">
                            <FontAwesomeIcon icon={faTrash} className="h-4 w-4" />
                          </button>
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

      {tab === "bom" && (
        <main className="space-y-4">
          <section className="rounded-xl bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="md:col-span-2">
                <label htmlFor="bom-search" className="mb-1 block text-sm font-medium text-[#1F2937]">Cari BOM</label>
                <div className="relative">
                  <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                  <input id="bom-search" type="search" className={`${inputCls} pl-9`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="cth: Batok / 1.0..." />
                </div>
              </div>
              <label className={labelCls}>
                <span>Output type</span>
                <select className={inputCls} value={bomFilterType} onChange={(e) => setBomFilterType(e.target.value as "all" | "product" | "subassembly")}>
                  <option value="all">Semua</option>
                  <option value="product">Product</option>
                  <option value="subassembly">Subassembly</option>
                </select>
              </label>
              <label className={labelCls}>
                <span>Aktif saja</span>
                <label className="flex h-9 items-center gap-2 text-[14px] text-[#1F2937]">
                  <input type="checkbox" checked={bomActiveOnly} onChange={(e) => setBomActiveOnly(e.target.checked)} />
                  Aktif saja
                </label>
              </label>
            </div>
            <p className="mt-3 text-[13px] text-[#6B7280]">{boms.length} tampil</p>
          </section>
          <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left">
                <thead className="bg-[#F5F7FA] text-[#6B7280]">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">BOM</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Version</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Output</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Komponen</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {boms.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center italic text-[#6B7280]">Belum ada BOM.</td></tr>
                  ) : boms.map((row) => (
                    <tr key={row.id} className="text-[15px] hover:bg-[#F5F7FA]">
                      <td className="px-6 py-4 text-[#1F2937]">
                        <span className="font-semibold text-[#1E3A5F]">{row.nama}</span>
                        {row.kode && <span className="ml-2 font-mono text-xs text-[#6B7280]">{row.kode}</span>}
                      </td>
                      <td className="px-6 py-4 text-[#6B7280]">{row.version}</td>
                      <td className="px-6 py-4 text-[#6B7280]">{outputLabel(row)}</td>
                      <td className="px-6 py-4 text-[#6B7280]">
                        <span className="line-clamp-2 max-w-md block">{row.items.map(itemLabel).join(", ")}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${row.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                          {row.isActive ? "AKTIF" : "NONAKTIF"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-1">
                          <button type="button" disabled={!canKelola} aria-label={`Edit ${row.nama}`} onClick={() => openBomEdit(row)} className="rounded-lg p-2 text-[#1E3A5F] hover:bg-[#1E3A5F]/5 disabled:opacity-40">
                            <FontAwesomeIcon icon={faPen} className="h-4 w-4" />
                          </button>
                          <button type="button" disabled={!canKelola} aria-label={`Hapus ${row.nama}`} onClick={() => void removeBom(row)} className="rounded-lg p-2 text-[#6B7280] hover:bg-[#EF4444]/10 hover:text-[#EF4444] disabled:opacity-40">
                            <FontAwesomeIcon icon={faTrash} className="h-4 w-4" />
                          </button>
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

      {saModal.open && (
        <Modal title={`${saModal.editing ? "Edit" : "Tambah"} Subassembly`} onClose={() => setSaModal((m) => ({ ...m, open: false }))}>
          <div className="space-y-4">
            {saModal.err && <p role="alert" className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-[#EF4444]">{saModal.err}</p>}
            <label className={labelCls}><span>Kode</span><input className={inputCls} value={saModal.kode} onChange={(e) => setSaModal((m) => ({ ...m, kode: e.target.value }))} placeholder="cth: SA-BATOK" /></label>
            <label className={labelCls}><span>Nama</span><input className={inputCls} value={saModal.nama} onChange={(e) => setSaModal((m) => ({ ...m, nama: e.target.value }))} placeholder="Nama subassembly" /></label>
            <label className={labelCls}>
              <span>Product Variant output (opsional)</span>
              <select className={inputCls} value={saModal.variantId} onChange={(e) => setSaModal((m) => ({ ...m, variantId: e.target.value }))}>
                <option value="">Tanpa product variant</option>
                {activeVariants.map((v) => <option key={v.id} title={v.kodeVariant} value={v.id}>{variantLabel(v)}</option>)}
              </select>
            </label>
            {saModal.editing && (
              <label className={labelCls}>
                <span>Status</span>
                <select className={inputCls} value={saModal.active ? "aktif" : "nonaktif"} onChange={(e) => setSaModal((m) => ({ ...m, active: e.target.value === "aktif" }))}>
                  <option value="aktif">AKTIF</option>
                  <option value="nonaktif">NONAKTIF</option>
                </select>
              </label>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setSaModal((m) => ({ ...m, open: false }))} className={secondaryBtn}>Batal</button>
              <button type="button" disabled={saModal.busy} onClick={() => void saveSa()} className={primaryBtn}>{saModal.busy ? "Menyimpan..." : "Simpan"}</button>
            </div>
          </div>
        </Modal>
      )}

      {bomModal.open && (
        <Modal title={`${bomModal.editing ? "Edit" : "Tambah"} BOM`} size="lg" onClose={() => setBomModal((m) => ({ ...m, open: false }))}>
          <div className="space-y-4">
            {bomModal.err && <p role="alert" className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-[#EF4444]">{bomModal.err}</p>}
            <div className="grid gap-3 md:grid-cols-3">
              <label className={labelCls}><span>Kode (opsional)</span><input className={inputCls} value={bomModal.kode} onChange={(e) => setBomModal((m) => ({ ...m, kode: e.target.value }))} placeholder="KODE" /></label>
              <label className={labelCls}><span>Nama</span><input className={inputCls} value={bomModal.nama} onChange={(e) => setBomModal((m) => ({ ...m, nama: e.target.value }))} placeholder="Nama BOM" /></label>
              <label className={labelCls}><span>Version</span><input className={inputCls} value={bomModal.version} onChange={(e) => setBomModal((m) => ({ ...m, version: e.target.value }))} placeholder="1.0" /></label>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <label className={labelCls}>
                <span>Output type</span>
                <select className={inputCls} value={bomModal.outType} onChange={(e) => setBomModal((m) => ({ ...m, outType: e.target.value as "product" | "subassembly", outId: "" }))}>
                  <option value="product">Product Variant</option>
                  <option value="subassembly">Subassembly</option>
                </select>
              </label>
              <label className={labelCls}>
                <span>Output</span>
                <select className={inputCls} value={bomModal.outId} onChange={(e) => setBomModal((m) => ({ ...m, outId: e.target.value }))}>
                  <option value="">Pilih output</option>
                  {bomModal.outType === "product"
                    ? activeVariants.map((v) => <option key={v.id} title={v.kodeVariant} value={v.id}>{variantLabel(v)}</option>)                    : subs.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.kode} - {s.nama}</option>)}
                </select>
              </label>
              <label className={labelCls}>
                <span>Status</span>
                <select className={inputCls} value={bomModal.active ? "aktif" : "nonaktif"} onChange={(e) => setBomModal((m) => ({ ...m, active: e.target.value === "aktif" }))}>
                  <option value="aktif">AKTIF</option>
                  <option value="nonaktif">NONAKTIF</option>
                </select>
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className={labelCls}><span>Berlaku mulai (opsional)</span><input type="date" className={inputCls} value={bomModal.start} onChange={(e) => setBomModal((m) => ({ ...m, start: e.target.value }))} /></label>
              <label className={labelCls}><span>Berlaku selesai (opsional)</span><input type="date" className={inputCls} value={bomModal.end} onChange={(e) => setBomModal((m) => ({ ...m, end: e.target.value }))} /></label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#1E3A5F]">Komponen BOM</h3>
                <button type="button" onClick={addDraft} disabled={!canKelola} className={secondaryBtn}>Tambah baris</button>
              </div>
              {bomModal.items.map((row, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 rounded-lg border border-slate-200 p-3">
                  <label className="col-span-2 grid gap-1 text-xs font-medium text-[#1F2937]">
                    <span>Tipe</span>
                    <select className={inputCls} value={row.kind} onChange={(e) => updateDraft(index, { kind: e.target.value as "item" | "subassembly", id: "" })}>
                      <option value="item">Item</option>
                      <option value="subassembly">Subassembly</option>
                    </select>
                  </label>
                  <label className="col-span-3 grid gap-1 text-xs font-medium text-[#1F2937]">
                    <span>Komponen</span>
                    <select className={inputCls} value={row.id} onChange={(e) => updateDraft(index, { id: e.target.value })}>
                      <option value="">Pilih komponen</option>
                      {row.kind === "item"
                        ? items.map((it) => <option key={it.id} value={it.id}>{it.kode} - {it.nama}</option>)
                        : subs.map((s) => <option key={s.id} value={s.id}>{s.kode} - {s.nama}</option>)}
                    </select>
                  </label>
                  <label className="col-span-2 grid gap-1 text-xs font-medium text-[#1F2937]">
                    <span>Qty</span>
                    <input className={inputCls} value={row.quantity} onChange={(e) => updateDraft(index, { quantity: e.target.value })} placeholder="1" />
                  </label>
                  <label className="col-span-1 grid gap-1 text-xs font-medium text-[#1F2937]">
                    <span>Unit</span>
                    <input className={inputCls} value={row.unit} onChange={(e) => updateDraft(index, { unit: e.target.value })} placeholder="pcs" />
                  </label>
                  <label className="col-span-2 grid gap-1 text-xs font-medium text-[#1F2937]">
                    <span>Scrap %</span>
                    <input className={inputCls} value={row.scrap} onChange={(e) => updateDraft(index, { scrap: e.target.value })} placeholder="0" />
                  </label>
                  <label className="col-span-1 grid gap-1 text-xs font-medium text-[#1F2937]">
                    <span>Urutan</span>
                    <input className={inputCls} value={row.urutan} onChange={(e) => updateDraft(index, { urutan: e.target.value })} placeholder="1" />
                  </label>
                  <div className="col-span-1 flex items-end justify-end">
                    <button type="button" onClick={() => removeDraft(index)} className="rounded-lg p-2 text-[#6B7280] hover:bg-[#EF4444]/10 hover:text-[#EF4444]" aria-label={`Hapus baris ${index + 1}`}>
                      <FontAwesomeIcon icon={faTrash} className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setBomModal((m) => ({ ...m, open: false }))} className={secondaryBtn}>Batal</button>
              <button type="button" disabled={bomModal.busy} onClick={() => void saveBom()} className={primaryBtn}>{bomModal.busy ? "Menyimpan..." : "Simpan"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
