import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen, faTrash, faCirclePlus, faMagnifyingGlass, faFileExport, faFileImport } from "@fortawesome/free-solid-svg-icons";
import {
  getItems, createItem, updateItem, deleteItem, bulkUpdateItems,
  type Item,
} from "../../api/item";
import { getDivisi, type Divisi } from "../../api/divisi";
import { getSaldoBulk, getRingkasanBulkStok, type RingkasanStokItem } from "../../api/stokItem";
import { Modal } from "../../components/admin/VariantProduk/Modal";
import { inputCls, labelCls } from "../../components/admin/VariantProduk/constants";
import { ItemImportModal } from "../../components/admin/KelolaItem/ItemImportModal";
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

const emptyModal = { open: false, editing: null as Item | null, kode: "", nama: "", divisiId: "", unit: "pcs", jenis: "", isActive: true, busy: false };

// Saran jenis: nilai baku + nilai yang sudah ada di data (bebas isi).
const JENIS_SARAN = ["RAW MATERIAL", "SM", "HABIS PAKAI"];
// Sentinel filter: hanya item tanpa jenis (tak mungkin jadi nilai asli).
const JENIS_TANPA = "__TANPA__";

export default function KelolaItem() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [search, setSearch] = useState("");
  const [divisiFilter, setDivisiFilter] = useState("");
  const [jenisFilter, setJenisFilter] = useState("");
  const [hanyaAktif, setHanyaAktif] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Item[]>([]);
  const [divisi, setDivisi] = useState<Divisi[]>([]);
  const [modal, setModal] = useState(emptyModal);
  const [showImport, setShowImport] = useState(false);
  const [saldo, setSaldo] = useState<Record<number, number>>({});
  const [saldoLoading, setSaldoLoading] = useState(false);
  const [ringkasan, setRingkasan] = useState<Record<number, RingkasanStokItem>>({});
  const [ringkasanLoading, setRingkasanLoading] = useState(false);
  const [dari, setDari] = useState("");
  const [sampai, setSampai] = useState("");
  const [periode, setPeriode] = useState({ dari: "", sampai: "" });
  const [periodeError, setPeriodeError] = useState<string | null>(null);
  const periodeRef = useRef(periode);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkUbahJenis, setBulkUbahJenis] = useState(false);
  const [bulkJenis, setBulkJenis] = useState("");
  const [bulkUbahDivisi, setBulkUbahDivisi] = useState(false);
  const [bulkDivisi, setBulkDivisi] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const refreshAngka = useCallback(async (ids: number[], f: { dari: string; sampai: string }) => {
    if (ids.length === 0) {
      setSaldo({});
      setRingkasan({});
      return;
    }
    setSaldoLoading(true);
    setRingkasanLoading(true);
    try {
      const [hasilSaldo, hasilRingkasan] = await Promise.allSettled([
        getSaldoBulk(ids),
        getRingkasanBulkStok(ids, {
          ...(f.dari ? { dari: f.dari } : {}),
          ...(f.sampai ? { sampai: f.sampai } : {}),
        }),
      ]);
      // Saldo/ringkasan pelengkap: yang gagal dikosongkan tanpa menggagalkan halaman.
      setSaldo(hasilSaldo.status === "fulfilled" ? hasilSaldo.value.saldo : {});
      setRingkasan(hasilRingkasan.status === "fulfilled" ? hasilRingkasan.value : {});
    } finally {
      setSaldoLoading(false);
      setRingkasanLoading(false);
    }
  }, []);

  const flash = (msg: string) => { setNotice(msg); window.setTimeout(() => setNotice(null), 3000); };
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [items, div] = await Promise.all([getItems(), getDivisi()]);
      setRows(items);
      setDivisi(div);
      setSelected(new Set());
      setError(null);
      await refreshAngka(items.map((it) => it.id), periodeRef.current);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data item.");
    } finally {
      setLoading(false);
    }
  }, [refreshAngka]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- muat awal sekali, pola sama seperti KelolaUser
    void load();
  }, [load]);

  const bukaStok = (id: number) => navigate(`${pathname}/stok/${id}`);

  const ubahDari = (nilai: string) => {
    setDari(nilai);
    if (nilai && sampai && nilai > sampai) {
      setPeriodeError("Tanggal 'Dari' tidak boleh lebih besar dari 'Sampai'.");
      setRingkasan({});
      return;
    }
    setPeriodeError(null);
    const berikutnya = { dari: nilai, sampai };
    setPeriode(berikutnya);
    periodeRef.current = berikutnya;
    void refreshAngka(rows.map((it) => it.id), berikutnya);
  };

  const ubahSampai = (nilai: string) => {
    setSampai(nilai);
    if (dari && nilai && dari > nilai) {
      setPeriodeError("Tanggal 'Dari' tidak boleh lebih besar dari 'Sampai'.");
      setRingkasan({});
      return;
    }
    setPeriodeError(null);
    const berikutnya = { dari, sampai: nilai };
    setPeriode(berikutnya);
    periodeRef.current = berikutnya;
    void refreshAngka(rows.map((it) => it.id), berikutnya);
  };

  const resetPeriode = () => {
    setDari("");
    setSampai("");
    setPeriodeError(null);
    const berikutnya = { dari: "", sampai: "" };
    setPeriode(berikutnya);
    periodeRef.current = berikutnya;
    void refreshAngka(rows.map((it) => it.id), berikutnya);
  };

  const labelPeriode = periode.dari || periode.sampai
    ? `Periode ${periode.dari || "awal"}–${periode.sampai || "akhir"}`
    : "Semua tanggal";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const jf = jenisFilter.trim().toLowerCase();
    return rows
      .filter((r) => !q || r.kode.toLowerCase().includes(q) || r.nama.toLowerCase().includes(q))
      .filter((r) => !divisiFilter || String(r.divisiId ?? "") === divisiFilter)
      .filter((r) => !jf || (jf === JENIS_TANPA.toLowerCase() ? !r.jenis : (r.jenis ?? "").toLowerCase() === jf))
      .filter((r) => !hanyaAktif || r.isActive)
      .sort((a, b) => a.nama.localeCompare(b.nama));
  }, [rows, search, divisiFilter, jenisFilter, hanyaAktif]);

  const jenisOptions = useMemo(() => {
    const ada = new Set(rows.map((r) => (r.jenis ?? "").trim()).filter(Boolean));
    return [...JENIS_SARAN, ...[...ada].filter((j) => !JENIS_SARAN.includes(j))];
  }, [rows]);

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
        jenis: modal.jenis.trim() || null,
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

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectFiltered = () => {
    const ids = filtered.map((r) => r.id);
    setSelected((prev) => {
      const semuaKena = ids.length > 0 && ids.every((id) => prev.has(id));
      if (semuaKena) {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...ids]);
    });
  };

  const applyBulkJenis = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!bulkUbahJenis && !bulkUbahDivisi) return window.alert("Centang field yang mau diubah (jenis / divisi).");
    const body: { ids: number[]; jenis?: string | null; divisiId?: number | null } = { ids };
    const ringkas: string[] = [];
    if (bulkUbahJenis) {
      const jenis = bulkJenis.trim() || null;
      if (jenis && jenis.length > 50) return window.alert("Field 'jenis' maksimal 50 karakter");
      body.jenis = jenis;
      ringkas.push(jenis ? `jenis "${jenis}"` : "hapus jenis");
    }
    if (bulkUbahDivisi) {
      if (!bulkDivisi) {
        body.divisiId = null;
        ringkas.push("lepas divisi");
      } else {
        const d = divisi.find((x) => String(x.id) === bulkDivisi);
        if (!d) return window.alert("Divisi tidak dikenal");
        body.divisiId = d.id;
        ringkas.push(`divisi "${d.nama}"`);
      }
    }
    if (!window.confirm(`Set ${ringkas.join(" + ")} untuk ${ids.length} item?`)) return;
    setBulkBusy(true);
    try {
      const { updated } = await bulkUpdateItems(body);
      flash(updated === ids.length ? `${updated} item diperbarui.` : `${updated} dari ${ids.length} item diperbarui.`);
      setSelected(new Set());
      setBulkUbahJenis(false);
      setBulkJenis("");
      setBulkUbahDivisi(false);
      setBulkDivisi("");
      await load();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Gagal edit massal.");
    } finally {
      setBulkBusy(false);
    }
  };

  const openAdd = () => setModal({ ...emptyModal, open: true });
  const openEdit = (r: Item) => setModal({ open: true, editing: r, kode: r.kode, nama: r.nama, divisiId: r.divisiId ? String(r.divisiId) : "", unit: r.unit, jenis: r.jenis ?? "", isActive: r.isActive, busy: false });

  const handleExport = () => {
    const data = filtered.length > 0 ? filtered : rows;
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rentang = periode.dari || periode.sampai
      ? `${(periode.dari || "awal").replace(/-/g, "")}-${(periode.sampai || "akhir").replace(/-/g, "")}`
      : "semua-tanggal";
    downloadCsv(`item-${stamp}-${rentang}.csv`, [
      ["kode", "nama", "divisi", "unit", "jenis", "masuk", "keluar", "net_periode", "stok", "aktif"],
      ...data.map((r) => [r.kode, r.nama, r.divisi?.nama ?? "", r.unit, r.jenis ?? "", ringkasan[r.id]?.masuk ?? "—", ringkasan[r.id]?.keluar ?? "—", ringkasan[r.id]?.net ?? "—", saldo[r.id] ?? "—", r.isActive ? "aktif" : "nonaktif"]),
    ]);
    flash(`Export ${data.length} item ke CSV.`);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">Master</p>
          <h1 className="text-[26px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">Stock Material</h1>
          <p className="mt-2 text-base text-[#6B7280]">Master item untuk pilihan permintaan barang.</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <button type="button" onClick={openAdd} className={primaryBtn}>
            <FontAwesomeIcon icon={faCirclePlus} className="h-4 w-4" /> Tambah Item
          </button>
          <button type="button" onClick={handleExport} disabled={loading || saldoLoading || ringkasanLoading || rows.length === 0} className={secondaryBtn} title="Unduh tampil/filter saat ini sebagai CSV">
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
            <div className="grid gap-3 sm:grid-cols-[1fr_200px_200px_auto] sm:items-end">
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
              <div>
                <label htmlFor="item-jenis" className="mb-1 block text-sm font-medium text-[#1F2937]">Jenis</label>
                <select id="item-jenis" className={inputCls} value={jenisFilter} onChange={(e) => setJenisFilter(e.target.value)}>
                  <option value="">Semua jenis</option>
                  <option value={JENIS_TANPA}>— Tanpa jenis —</option>
                  {jenisOptions.map((j) => <option key={j} value={j}>{j}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 pb-3 text-sm font-medium text-[#1F2937]">
                <input type="checkbox" checked={hanyaAktif} onChange={(e) => setHanyaAktif(e.target.checked)} className="h-4 w-4 accent-[#00A8E8]" />
                Hanya aktif
              </label>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-[200px_200px_auto_1fr] sm:items-end">
              <div>
                <label htmlFor="item-dari" className="mb-1 block text-sm font-medium text-[#1F2937]">Dari periode</label>
                <input id="item-dari" type="date" className={inputCls} value={dari} max={sampai || undefined} onChange={(e) => ubahDari(e.target.value)} />
              </div>
              <div>
                <label htmlFor="item-sampai" className="mb-1 block text-sm font-medium text-[#1F2937]">Sampai periode</label>
                <input id="item-sampai" type="date" className={inputCls} value={sampai} min={dari || undefined} onChange={(e) => ubahSampai(e.target.value)} />
              </div>
              <div>
                {(dari || sampai) && (
                  <button type="button" onClick={resetPeriode} className={secondaryBtn}>Reset periode</button>
                )}
              </div>
              <p className="text-[13px] text-[#6B7280] sm:pb-3 sm:text-right">Masuk/Keluar/Net: {labelPeriode}. Stok: saldo aktual.</p>
            </div>
            {periodeError && <p role="alert" className="mt-3 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-[#EF4444]">{periodeError}</p>}
            <p className="mt-3 text-[13px] text-[#6B7280]">{filtered.length}/{rows.length} tampil{selected.size > 0 ? ` · ${selected.size} dipilih` : ""}</p>
          </section>

          {selected.size > 0 && (
            <section aria-live="polite" className="space-y-3 rounded-xl border border-[#00A8E8]/30 bg-[#00A8E8]/5 p-4">
              <p className="text-sm font-semibold text-[#1E3A5F]">{selected.size} item dipilih — edit massal:</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-white p-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#1F2937]">
                    <input type="checkbox" checked={bulkUbahJenis} onChange={(e) => setBulkUbahJenis(e.target.checked)} className="h-4 w-4 accent-[#00A8E8]" />
                    Ubah jenis {bulkUbahJenis && <span className="font-normal text-[#6B7280]">(kosong = hapus)</span>}
                  </label>
                  <input type="text" list="bulk-jenis-options" disabled={!bulkUbahJenis} className={`${inputCls} mt-2`} placeholder="cth: RAW MATERIAL" value={bulkJenis} onChange={(e) => setBulkJenis(e.target.value)} />
                  <datalist id="bulk-jenis-options">
                    {jenisOptions.map((j) => <option key={j} value={j} />)}
                  </datalist>
                </div>
                <div className="rounded-lg bg-white p-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-[#1F2937]">
                    <input type="checkbox" checked={bulkUbahDivisi} onChange={(e) => setBulkUbahDivisi(e.target.checked)} className="h-4 w-4 accent-[#00A8E8]" />
                    Ubah divisi
                  </label>
                  <select disabled={!bulkUbahDivisi} className={`${inputCls} mt-2`} value={bulkDivisi} onChange={(e) => setBulkDivisi(e.target.value)}>
                    <option value="">— Tanpa divisi (lepas) —</option>
                    {divisi.map((d) => <option key={d.id} value={String(d.id)}>{d.nama}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={bulkBusy || (!bulkUbahJenis && !bulkUbahDivisi)} onClick={() => void applyBulkJenis()} className={primaryBtn}>{bulkBusy ? "Menyimpan..." : "Terapkan"}</button>
                <button type="button" disabled={bulkBusy} onClick={() => { setSelected(new Set()); setBulkUbahJenis(false); setBulkJenis(""); setBulkUbahDivisi(false); setBulkDivisi(""); }} className={secondaryBtn}>Batal</button>
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1020px] text-left">
                <thead className="bg-[#F5F7FA] text-[#6B7280]">
                  <tr>
                    <th className="px-4 py-4">
                      <input
                        type="checkbox"
                        aria-label="Pilih semua yang tampil"
                        checked={filtered.length > 0 && filtered.every((r) => selected.has(r.id))}
                        onChange={toggleSelectFiltered}
                        className="h-4 w-4 accent-[#00A8E8]"
                      />
                    </th>
                    <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider">No</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Kode</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Nama</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Jenis</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Divisi</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider" title="Total masuk pada periode terpilih">Masuk</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider" title="Total keluar pada periode terpilih">Keluar</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider" title="Masuk dikurangi keluar pada periode terpilih">Net</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider" title="Saldo aktual saat ini">Stok</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Unit</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={13} className="px-6 py-8 text-center italic text-[#6B7280]">Belum ada item.</td></tr>
                  ) : filtered.map((r, i) => (
                    <tr key={r.id} className="text-[15px] hover:bg-[#F5F7FA]">
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          aria-label={`Pilih ${r.nama}`}
                          checked={selected.has(r.id)}
                          onChange={() => toggleSelect(r.id)}
                          className="h-4 w-4 accent-[#00A8E8]"
                        />
                      </td>
                      <td className="px-4 py-4 tabular-nums text-[#6B7280]">{i + 1}</td>
                      <td className="px-6 py-4 font-mono text-sm font-semibold text-[#1E3A5F]">{r.kode}</td>
                      <td className="px-6 py-4 font-medium text-[#1F2937]">{r.nama}</td>
                      <td className="px-6 py-4 text-[#6B7280]">{r.jenis ?? <span className="italic">—</span>}</td>
                      <td className="px-6 py-4 text-[#6B7280]">{r.divisi?.nama ?? <span className="italic">—</span>}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-[#0E7A55]">{ringkasanLoading ? "…" : (ringkasan[r.id]?.masuk.toLocaleString("id-ID") ?? "—")}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-[#B91C1C]">{ringkasanLoading ? "…" : (ringkasan[r.id]?.keluar.toLocaleString("id-ID") ?? "—")}</td>
                      <td className="px-6 py-4 text-right font-semibold tabular-nums text-[#1F2937]">{ringkasanLoading ? "…" : (ringkasan[r.id]?.net.toLocaleString("id-ID") ?? "—")}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-[#1F2937]">{saldoLoading ? "…" : (saldo[r.id]?.toLocaleString("id-ID") ?? "—")}</td>
                      <td className="px-6 py-4 text-[#6B7280]">{r.unit}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-md px-2 py-0.5 text-[13px] font-medium ${r.isActive ? "bg-[#10B981]/10 text-[#0E7A55]" : "bg-slate-100 text-slate-500"}`}>
                          {r.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <ItemActions nama={r.nama} onStok={() => bukaStok(r.id)} onEdit={() => openEdit(r)} onHapus={() => void remove(r)} />
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
              ) : filtered.map((r, i) => (
                <li key={r.id}>
                  <div className="flex items-start gap-2 px-4 pt-3.5">
                    <input
                      type="checkbox"
                      aria-label={`Pilih ${r.nama}`}
                      checked={selected.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      className="mt-1 h-4 w-4 shrink-0 accent-[#00A8E8]"
                    />
                    <button
                      type="button"
                      onClick={() => bukaStok(r.id)}
                      aria-label={`Lihat stok ${r.nama}`}
                      className={`block w-full text-left ${FOCUS}`}
                    >
                    <span className="block truncate text-sm font-bold text-[#1E3A5F]">
                      {i + 1}. {r.nama}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-xs text-slate-500">
                      {r.kode} · {r.divisi?.nama ?? "—"}{r.jenis ? ` · ${r.jenis}` : ""}
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
                    <span className="mt-1 block text-xs tabular-nums text-slate-500">
                      {ringkasanLoading ? "Memuat ringkasan…" : `Masuk ${ringkasan[r.id]?.masuk.toLocaleString("id-ID") ?? "—"} · Keluar ${ringkasan[r.id]?.keluar.toLocaleString("id-ID") ?? "—"} · Net ${ringkasan[r.id]?.net.toLocaleString("id-ID") ?? "—"}`}
                    </span>
                  </button>
                  </div>
                  <div className="flex items-center justify-end border-t border-dashed border-slate-100 px-4 py-1.5">
                    <ItemActions nama={r.nama} onStok={() => bukaStok(r.id)} onEdit={() => openEdit(r)} onHapus={() => void remove(r)} />
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
            <label className={labelCls}><span>Jenis</span>
              <input className={inputCls} list="item-modal-jenis-options" placeholder="cth: RAW MATERIAL" value={modal.jenis} onChange={(e) => setModal((m) => ({ ...m, jenis: e.target.value }))} />
              <datalist id="item-modal-jenis-options">
                {jenisOptions.map((j) => <option key={j} value={j} />)}
              </datalist>
            </label>
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

      <ItemImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        divisiOptions={divisi}
        onImported={() => void load()}
      />
    </div>
  );
}
