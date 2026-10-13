import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCirclePlus, faMagnifyingGlass, faSpinner } from "@fortawesome/free-solid-svg-icons";
import { getItems, type Item } from "../../api/item";
import { getSaldoBulk } from "../../api/stokItem";
import {
  buatSesiOpname,
  getSesiOpname,
  listSesiOpname,
  type OpnameSesiDetail,
  type OpnameSesiRingkas,
} from "../../api/stokOpname";
import { getUser, hasPermission } from "../../api/auth";
import { inputCls } from "../../components/admin/VariantProduk/constants";

const primaryBtn = "inline-flex items-center justify-center gap-2 rounded-lg bg-[#00A8E8] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0088C0] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none";
const tabBtn = (aktif: boolean) =>
  `rounded-lg px-4 py-2 text-sm font-semibold transition ${aktif ? "bg-[#1E3A5F] text-white" : "text-[#6B7280] hover:bg-slate-100"}`;

type BarisHitung = { item: Item; sistem: number | null; fisik: string };

export default function StokOpname() {
  const canOpname = hasPermission("KELOLA_ITEM") || getUser()?.role === "admin";
  const [tab, setTab] = useState<"sesi" | "baru">("sesi");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── List sesi ──
  const [sesi, setSesi] = useState<OpnameSesiRingkas[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingSesi, setLoadingSesi] = useState(true);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<OpnameSesiDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ── Opname baru ──
  const [items, setItems] = useState<Item[]>([]);
  const [baris, setBaris] = useState<BarisHitung[]>([]);
  const [search, setSearch] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [loadingBaru, setLoadingBaru] = useState(false);
  const [saving, setSaving] = useState(false);

  const flash = (msg: string) => { setNotice(msg); window.setTimeout(() => setNotice(null), 3000); };

  const loadSesi = useCallback(async (p: number) => {
    setLoadingSesi(true);
    try {
      const r = await listSesiOpname(p, 20);
      setSesi(r.data);
      setTotalPages(r.meta.totalPages);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat sesi opname.");
    } finally {
      setLoadingSesi(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- muat awal sekali
    void loadSesi(page);
  }, [loadSesi, page]);

  const bukaDetail = async (id: number) => {
    if (detailId === id) {
      setDetailId(null);
      setDetail(null);
      return;
    }
    setDetailId(id);
    setLoadingDetail(true);
    try {
      setDetail(await getSesiOpname(id));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Gagal memuat detail sesi.");
      setDetailId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const muatItems = async () => {
    setLoadingBaru(true);
    try {
      const rows = await getItems({ aktif: true });
      setItems(rows);
      let map: Record<number, number> = {};
      try {
        map = (await getSaldoBulk(rows.map((r) => r.id))).saldo;
      } catch {
        map = {};
      }
      setBaris(rows.map((item) => ({ item, sistem: map[item.id] ?? null, fisik: "" })));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat item.");
    } finally {
      setLoadingBaru(false);
    }
  };

  const bukaTabBaru = () => {
    setTab("baru");
    if (items.length === 0) void muatItems();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return baris
      .filter((b) => !q || b.item.kode.toLowerCase().includes(q) || b.item.nama.toLowerCase().includes(q))
      .sort((a, b) => a.item.nama.localeCompare(b.item.nama));
  }, [baris, search]);

  const terisi = useMemo(
    () => baris.filter((b) => b.fisik.trim() !== "" && Number.isInteger(Number(b.fisik)) && Number(b.fisik) >= 0),
    [baris],
  );

  const simpan = async () => {
    if (terisi.length === 0) {
      window.alert("Isi dulu stok fisik minimal 1 item.");
      return;
    }
    setSaving(true);
    try {
      const sesiBaru = await buatSesiOpname({
        items: terisi.map((b) => ({ itemId: b.item.id, stokFisik: Number(b.fisik) })),
        ...(keterangan.trim() ? { keterangan: keterangan.trim() } : {}),
      });
      flash(`Sesi opname #${sesiBaru.id} tersimpan (${terisi.length} item).`);
      setBaris([]);
      setItems([]);
      setKeterangan("");
      setSearch("");
      setTab("sesi");
      setPage(1);
      await loadSesi(1);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Gagal menyimpan sesi opname.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">Warehouse</p>
          <h1 className="text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">Opname Stok</h1>
          <p className="mt-2 text-base text-[#6B7280]">Hitung fisik massal, selisih otomatis jadi penyeimbang ledger.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setTab("sesi")} className={tabBtn(tab === "sesi")}>Sesi</button>
          <button type="button" onClick={bukaTabBaru} disabled={!canOpname} title={canOpname ? "Mulai opname baru" : "Butuh permission KELOLA_ITEM"} className={primaryBtn}>
            <FontAwesomeIcon icon={faCirclePlus} className="h-4 w-4" /> Opname Baru
          </button>
        </div>
      </header>

      <div aria-live="polite" className="space-y-3">
        {error && <p role="alert" className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-[#EF4444]">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-[#10B981]/30 bg-[#10B981]/10 px-4 py-3 text-[#1F2937]">{notice}</p>}
      </div>

      {tab === "sesi" && (
        <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead className="bg-[#F5F7FA] text-[#6B7280]">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Sesi</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Tanggal</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">Item</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">Selisih +</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">Selisih −</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingSesi ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-[#6B7280]">Memuat...</td></tr>
                ) : sesi.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center italic text-[#6B7280]">Belum ada sesi opname.</td></tr>
                ) : sesi.map((s) => (
                  <Fragment key={s.id}>
                    <tr onClick={() => void bukaDetail(s.id)} className="cursor-pointer text-[15px] hover:bg-[#F5F7FA]">
                      <td className="px-6 py-4 font-mono text-sm font-semibold text-[#1E3A5F]">#{s.id}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-[#6B7280]">{new Date(s.tanggal).toLocaleString("id-ID")}</td>
                      <td className="px-6 py-4 text-right tabular-nums">{s.jumlahBaris}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-[#0E7A55]">+{s.totalPlus.toLocaleString("id-ID")}</td>
                      <td className="px-6 py-4 text-right tabular-nums text-[#B91C1C]">{s.totalMinus.toLocaleString("id-ID")}</td>
                      <td className="px-6 py-4 text-[#6B7280]">{s.keterangan ?? "—"}</td>
                    </tr>
                    {detailId === s.id && (
                      <tr>
                        <td colSpan={6} className="bg-slate-50 px-6 py-4">
                          {loadingDetail || !detail ? (
                            <p className="flex items-center gap-2 text-sm text-slate-500"><FontAwesomeIcon icon={faSpinner} spin /> Memuat detail...</p>
                          ) : (
                            <table className="w-full text-left text-sm">
                              <thead className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                <tr>
                                  <th className="py-1 pr-3">Item</th>
                                  <th className="py-1 pr-3 text-right">Sistem</th>
                                  <th className="py-1 pr-3 text-right">Fisik</th>
                                  <th className="py-1 text-right">Selisih</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {detail.baris.map((b) => (
                                  <tr key={b.id}>
                                    <td className="py-1 pr-3 font-medium text-slate-700">{b.item?.nama ?? `#${b.itemId}`}</td>
                                    <td className="py-1 pr-3 text-right tabular-nums">{b.stokSistem}</td>
                                    <td className="py-1 pr-3 text-right tabular-nums">{b.stokFisik}</td>
                                    <td className={`py-1 text-right font-semibold tabular-nums ${b.selisih > 0 ? "text-[#0E7A55]" : b.selisih < 0 ? "text-[#B91C1C]" : "text-slate-400"}`}>
                                      {b.selisih > 0 ? `+${b.selisih}` : b.selisih}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-3 text-sm">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-[#D1D5DB] px-3 py-1.5 disabled:opacity-40">Sebelumnya</button>
              <span className="text-[#6B7280]">{page} / {totalPages}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-[#D1D5DB] px-3 py-1.5 disabled:opacity-40">Berikutnya</button>
            </div>
          )}
        </section>
      )}

      {tab === "baru" && (
        <main className="space-y-4">
          <section className="rounded-xl bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr] sm:items-end">
              <div>
                <label htmlFor="opname-search" className="mb-1 block text-sm font-medium text-[#1F2937]">Cari item</label>
                <div className="relative">
                  <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                  <input id="opname-search" type="search" className={`${inputCls} pl-9`} placeholder="ketik kode / nama..." value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
              </div>
              <div>
                <label htmlFor="opname-ket" className="mb-1 block text-sm font-medium text-[#1F2937]">Keterangan sesi</label>
                <input id="opname-ket" className={inputCls} placeholder="cth: opname rutin Oktober" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} />
              </div>
            </div>
            <p className="mt-3 text-[13px] text-[#6B7280]">{terisi.length} item diisi · kosong = tidak ikut sesi</p>
          </section>

          <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <div className="max-h-[55vh] overflow-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead className="sticky top-0 bg-[#F5F7FA] text-[#6B7280]">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider">Item</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">Sistem</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">Fisik</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider">Selisih</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingBaru ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-[#6B7280]">Memuat item...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center italic text-[#6B7280]">Tidak ada item.</td></tr>
                  ) : filtered.map((b) => {
                    const fisik = b.fisik.trim() === "" ? null : Number(b.fisik);
                    const valid = fisik === null || (Number.isInteger(fisik) && fisik >= 0);
                    const selisih = fisik === null || !valid || b.sistem === null ? null : fisik - b.sistem;
                    return (
                      <tr key={b.item.id} className="text-[15px] hover:bg-[#F5F7FA]">
                        <td className="px-6 py-3">
                          <p className="font-medium text-[#1F2937]">{b.item.nama}</p>
                          <p className="font-mono text-xs text-[#6B7280]">{b.item.kode}</p>
                        </td>
                        <td className="px-6 py-3 text-right tabular-nums">{b.sistem === null ? "—" : b.sistem.toLocaleString("id-ID")}</td>
                        <td className="px-6 py-3 text-right">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            aria-label={`Stok fisik ${b.item.nama}`}
                            value={b.fisik}
                            onChange={(e) =>
                              setBaris((prev) => prev.map((x) => (x.item.id === b.item.id ? { ...x, fisik: e.target.value } : x)))
                            }
                            className={`w-28 rounded-lg border px-2 py-1 text-right tabular-nums focus:outline-none ${valid ? "border-slate-200 focus:border-[#00A8E8]" : "border-[#EF4444]"}`}
                          />
                          {!valid && <p className="mt-1 text-xs text-red-600">Bilangan bulat ≥ 0.</p>}
                        </td>
                        <td className={`px-6 py-3 text-right font-semibold tabular-nums ${selisih === null ? "text-slate-300" : selisih > 0 ? "text-[#0E7A55]" : selisih < 0 ? "text-[#B91C1C]" : "text-slate-400"}`}>
                          {selisih === null ? "—" : selisih > 0 ? `+${selisih}` : selisih}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <button type="button" onClick={() => setTab("sesi")} className="rounded-lg border border-[#D1D5DB] px-4 py-2 text-sm font-medium">Batal</button>
              <button type="button" disabled={saving || terisi.length === 0} onClick={() => void simpan()} className={primaryBtn}>
                {saving && <FontAwesomeIcon icon={faSpinner} spin />}
                {saving ? "Menyimpan..." : `Simpan sesi (${terisi.length} item)`}
              </button>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}
