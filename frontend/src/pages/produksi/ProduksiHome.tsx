import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRotateRight,
  faBoxesStacked,
  faBoxOpen,
  faCalendarDays,
  faCheck,
  faFlask,
  faIndustry,
  faSpinner,
  faTriangleExclamation,
  faWarehouse,
} from "@fortawesome/free-solid-svg-icons";
import { getUser } from "../../api/auth";
import { getItems, type Item } from "../../api/item";
import {
  createProduksiHarian,
  getBomPreview,
  getLokasiProduksi,
  getOpsiProduksi,
  getStokGudang,
  listProduksiHarian,
  type BomPreview,
  type Lokasi,
  type OpsiProduksi,
  type ProduksiList,
  type ProduksiRecord,
} from "../../api/produksiHarian";

const TABS = [
  { id: "produksi", label: "Catat Hasil Produksi", icon: faIndustry },
  { id: "bom", label: "Formula BOM", icon: faFlask },
  { id: "stok", label: "Stok & Riwayat Data", icon: faBoxesStacked },
] as const;

type TabId = (typeof TABS)[number]["id"];

const todayISO = () => new Date().toLocaleDateString("en-CA");
const n = (value: number | string | null | undefined) => Number(value ?? 0);
const fmt = (value: number | string | null | undefined) =>
  n(value).toLocaleString("id-ID", { maximumFractionDigits: 6 });
const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20 disabled:bg-slate-100";
const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500";
const cardCls = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";

function namaLokasi(lokasi: Lokasi) {
  if (lokasi.type === "DIVISION") return lokasi.divisi?.nama ?? lokasi.name;
  return lokasi.gudang?.name ?? lokasi.name;
}

function jenisLokasi(lokasi: Lokasi) {
  return lokasi.type === "DIVISION" ? "Divisi" : "Gudang";
}

function pesan(error: unknown) {
  return error instanceof Error ? error.message : "Terjadi kesalahan.";
}

export default function ProduksiHome() {
  const user = getUser();
  const [tab, setTab] = useState<TabId>("produksi");
  const [opsi, setOpsi] = useState<OpsiProduksi | null>(null);
  const [lokasi, setLokasi] = useState<Lokasi[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [stokGudang, setStokGudang] = useState<Record<number, number>>({});
  const [riwayat, setRiwayat] = useState<ProduksiList | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [tanggal, setTanggal] = useState(todayISO());
  const [divisiId, setDivisiId] = useState(String(user?.divisiId ?? ""));
  const [outputItemId, setOutputItemId] = useState("");
  const [jumlah, setJumlah] = useState("");
  const [tujuanLocationId, setTujuanLocationId] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [preview, setPreview] = useState<BomPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sumber, setSumber] = useState<Record<number, string>>({});
  const [savingProduksi, setSavingProduksi] = useState(false);

  const [cariStok, setCariStok] = useState("");

  const muatData = async (quiet = false) => {
    if (!quiet) setLoading(true);
    setRefreshing(quiet);
    try {
      const [opsiData, lokasiData, itemData, history, gudangData] = await Promise.all([
        getOpsiProduksi(),
        getLokasiProduksi(),
        getItems({ aktif: true }),
        listProduksiHarian({ page: 1, limit: 20 }),
        getStokGudang(),
      ]);
      setOpsi(opsiData);
      setLokasi(lokasiData);
      setItems(itemData);
      setRiwayat(history);
      const totals: Record<number, number> = {};
      for (const location of gudangData) {
        for (const stock of location.items) {
          totals[stock.itemId] = (totals[stock.itemId] ?? 0) + stock.quantity;
        }
      }
      setStokGudang(totals);
      setLoadError(null);
      if (!divisiId) {
        const awal = user?.divisiId ? String(user.divisiId) : String(opsiData.divisions[0]?.id ?? "");
        setDivisiId(awal);
      }
      if (!tujuanLocationId) setTujuanLocationId(String(opsiData.warehouses[0]?.id ?? ""));
    } catch (error) {
      setLoadError(pesan(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void muatData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- muat sekali saat mount
  }, []);

  useEffect(() => {
    if (!outputItemId || !jumlah || n(jumlah) <= 0 || !divisiId) {
      setPreview(null);
      return;
    }
    let aktif = true;
    const timer = window.setTimeout(() => {
      setPreviewLoading(true);
      getBomPreview(Number(outputItemId), n(jumlah), Number(divisiId))
        .then((data) => {
          if (!aktif) return;
          setPreview(data);
          const defaults: Record<number, string> = {};
          for (const line of data.lines) {
            const div = line.stok.find((row) => row.locationId === data.divisionLocationId && row.quantity >= line.jumlah);
            const pilihan = div ?? line.stok[0];
            if (pilihan) defaults[line.itemId] = String(pilihan.locationId);
          }
          setSumber(defaults);
        })
        .catch((error) => {
          if (aktif) {
            setPreview(null);
            setNotice({ tone: "error", text: pesan(error) });
          }
        })
        .finally(() => {
          if (aktif) setPreviewLoading(false);
        });
    }, 300);
    return () => {
      aktif = false;
      window.clearTimeout(timer);
    };
  }, [outputItemId, jumlah, divisiId]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const outputTerpilih = useMemo(
    () => opsi?.outputs.find((row) => String(row.item.id) === outputItemId) ?? null,
    [opsi, outputItemId],
  );

  const lokasiBahan = useMemo(() => {
    const cari = (locationId: number) => lokasi.find((row) => row.id === locationId);
    return (lineItemId: number) => {
      const line = preview?.lines.find((row) => row.itemId === lineItemId);
      const ids = new Set((line?.stok ?? []).filter((row) => row.quantity > 0).map((row) => row.locationId));
      if (preview?.divisionLocationId) ids.add(preview.divisionLocationId);
      return [...ids]
        .map(cari)
        .filter((row): row is Lokasi => Boolean(row))
        .sort((a, b) => {
          const qa = line?.stok.find((row) => row.locationId === a.id)?.quantity ?? 0;
          const qb = line?.stok.find((row) => row.locationId === b.id)?.quantity ?? 0;
          return qb - qa;
        });
    };
  }, [lokasi, preview]);

  const bisaSimpanProduksi =
    Boolean(divisiId && outputItemId && n(jumlah) > 0 && tujuanLocationId) &&
    Boolean(preview && preview.lines.length > 0) &&
    (preview?.lines.every((line) => Boolean(sumber[line.itemId])) ?? false) &&
    !savingProduksi;

  const simpanProduksi = async () => {
    if (!bisaSimpanProduksi || !preview) return;
    setSavingProduksi(true);
    setNotice(null);
    try {
      const hasil = await createProduksiHarian({
        tanggalProduksi: tanggal,
        divisiId: Number(divisiId),
        outputItemId: Number(outputItemId),
        jumlah: n(jumlah),
        tujuanLocationId: Number(tujuanLocationId),
        keterangan: keterangan.trim() || undefined,
        bahan: preview.lines.map((line) => ({
          itemId: line.itemId,
          sumberLocationId: Number(sumber[line.itemId]),
        })),
      });
      setNotice({ tone: "ok", text: `Produksi ${hasil.nomor} tersimpan. Bahan otomatis dikonsumsi dari lokasi sumber dan hasil masuk gudang.` });
      setJumlah("");
      setKeterangan("");
      setPreview(null);
      setSumber({});
      await muatData(true);
    } catch (error) {
      setNotice({ tone: "error", text: pesan(error) });
    } finally {
      setSavingProduksi(false);
    }
  };

  const itemsStok = useMemo(() => {
    const q = cariStok.trim().toLowerCase();
    return items
      .filter((item) => !q || item.kode.toLowerCase().includes(q) || item.nama.toLowerCase().includes(q) || (item.jenis ?? "").toLowerCase().includes(q))
      .sort((a, b) => (stokGudang[b.id] ?? 0) - (stokGudang[a.id] ?? 0));
  }, [items, cariStok, stokGudang]);

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-slate-500">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <FontAwesomeIcon icon={faSpinner} spin /> Memuat produksi harian...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#00A8E8]">Produksi</p>
              <h1 className="mt-1 text-xl font-extrabold text-[#1E3A5F] sm:text-2xl">Produksi Harian</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Catat hasil produksi; konsumsi bahan otomatis mengurangi stok lokasi sumber yang dipilih.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void muatData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faArrowRotateRight} spin={refreshing} /> Refresh
            </button>
          </div>
        </header>

        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <FontAwesomeIcon icon={faTriangleExclamation} className="mr-2" /> {loadError}
          </div>
        )}
        {notice && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              notice.tone === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            <FontAwesomeIcon icon={notice.tone === "ok" ? faCheck : faTriangleExclamation} className="mr-2" />
            {notice.text}
          </div>
        )}

        <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
          {TABS.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setTab(row.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition sm:px-4 ${
                tab === row.id ? "bg-[#1E3A5F] text-white shadow" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <FontAwesomeIcon icon={row.icon} /> {row.label}
            </button>
          ))}
        </nav>

        {tab === "produksi" && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <section className={cardCls}>
              <h2 className="text-sm font-extrabold text-[#1E3A5F]">Data Produksi</h2>
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className={labelCls}>Tanggal</span>
                    <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className={inputCls} />
                  </label>
                  <label>
                    <span className={labelCls}>Divisi Produksi</span>
                    <select
                      value={divisiId}
                      onChange={(e) => setDivisiId(e.target.value)}
                      disabled={user?.role !== "admin"}
                      className={inputCls}
                    >
                      <option value="">Pilih divisi</option>
                      {opsi?.divisions.map((row) => (
                        <option key={row.id} value={row.id}>{row.nama}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label>
                  <span className={labelCls}>Item Hasil Produksi</span>
                  <select value={outputItemId} onChange={(e) => setOutputItemId(e.target.value)} className={inputCls}>
                    <option value="">Pilih item hasil (harus punya subassembly/BOM)</option>
                    {opsi?.outputs.map((row) => (
                      <option key={row.item.id} value={row.item.id}>
                        {row.item.kode} — {row.item.nama} (BOM {row.bom?.version ?? "-"})
                      </option>
                    ))}
                  </select>
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className={labelCls}>Jumlah Hasil</span>
                    <input
                      type="number"
                      min="0"
                      step="0.000001"
                      value={jumlah}
                      onChange={(e) => setJumlah(e.target.value)}
                      placeholder="0"
                      className={inputCls}
                    />
                  </label>
                  <label>
                    <span className={labelCls}>Gudang Tujuan Hasil</span>
                    <select value={tujuanLocationId} onChange={(e) => setTujuanLocationId(e.target.value)} className={inputCls}>
                      <option value="">Pilih gudang</option>
                      {opsi?.warehouses.map((row) => (
                        <option key={row.id} value={row.id}>{row.gudang?.name ?? row.name} ({row.code})</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label>
                  <span className={labelCls}>Keterangan</span>
                  <textarea
                    value={keterangan}
                    onChange={(e) => setKeterangan(e.target.value)}
                    rows={2}
                    placeholder="Opsional"
                    className={inputCls}
                  />
                </label>

                {outputTerpilih && (
                  <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    BOM <span className="font-bold text-slate-700">{outputTerpilih.bom?.nama ?? "-"}</span> versi{" "}
                    <span className="font-bold text-slate-700">{outputTerpilih.bom?.version ?? "-"}</span>.
                  </p>
                )}
              </div>
            </section>

            <section className={cardCls}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-extrabold text-[#1E3A5F]">Bahan Dibutuhkan</h2>
                {previewLoading && <FontAwesomeIcon icon={faSpinner} spin className="text-slate-400" />}
              </div>
              {!outputItemId || n(jumlah) <= 0 ? (
                <p className="mt-6 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                  Pilih item hasil dan isi jumlah untuk menghitung BOM.
                </p>
              ) : preview && preview.lines.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {preview?.lines.map((line) => {
                    const pilihan = lokasiBahan(line.itemId);
                    const stokSumber = line.stok.find((row) => String(row.locationId) === sumber[line.itemId]);
                    return (
                      <div key={line.itemId} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-slate-700">{line.kode} — {line.nama}</p>
                            <p className="text-xs text-slate-500">
                              Butuh {fmt(line.jumlah)} {line.unit ?? ""} · Total stok gudang {fmt(stokGudang[line.itemId] ?? 0)}
                            </p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${stokSumber && stokSumber.quantity >= line.jumlah ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                            {stokSumber ? `${fmt(stokSumber.quantity)} di sumber` : "Pilih sumber"}
                          </span>
                        </div>
                        <select
                          value={sumber[line.itemId] ?? ""}
                          onChange={(e) => setSumber((prev) => ({ ...prev, [line.itemId]: e.target.value }))}
                          className={`${inputCls} mt-2`}
                        >
                          <option value="">Pilih lokasi sumber</option>
                          {pilihan.map((lok) => {
                            const qty = line.stok.find((row) => row.locationId === lok.id)?.quantity ?? 0;
                            return (
                              <option key={lok.id} value={lok.id}>
                                {jenisLokasi(lok)} · {namaLokasi(lok)} — stok {fmt(qty)}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => void simpanProduksi()}
                    disabled={!bisaSimpanProduksi}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1E3A5F] px-4 py-3 text-sm font-bold text-white hover:bg-[#152c49] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {savingProduksi ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faIndustry} />}
                    {savingProduksi ? "Menyimpan..." : "Simpan Produksi"}
                  </button>
                </div>
              ) : (
                <p className="mt-6 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                  BOM tidak ditemukan. Pastikan item hasil punya subassembly dengan BOM aktif.
                </p>
              )}
            </section>
          </div>
        )}

        {tab === "bom" && (
          <section className={cardCls}>
            <h2 className="text-sm font-extrabold text-[#1E3A5F]">Formula BOM Subassembly</h2>
            <p className="mt-1 text-xs text-slate-500">
              Hanya BOM subassembly yang dipakai produksi harian. BOM product variant tidak dipakai.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Item Hasil</th>
                    <th className="px-3 py-2">Subassembly</th>
                    <th className="px-3 py-2">BOM</th>
                    <th className="px-3 py-2 text-right">Stok</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {opsi?.outputs.map((row) => (
                    <tr key={row.subassemblyId}>
                      <td className="px-3 py-3">
                        <p className="font-bold text-slate-700">{row.item.kode} — {row.item.nama}</p>
                        <p className="text-xs text-slate-400">{row.item.jenis ?? "Tanpa jenis"} · {row.item.unit}</p>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">{row.subassemblyKode} — {row.subassemblyNama}</td>
                      <td className="px-3 py-3 text-xs text-slate-600">{row.bom?.nama ?? "-"} · v{row.bom?.version ?? "-"}</td>
                      <td className="px-3 py-3 text-right text-xs font-bold tabular-nums text-slate-700">{fmt(stokGudang[row.item.id] ?? 0)}</td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setOutputItemId(String(row.item.id));
                            setTab("produksi");
                          }}
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-bold text-[#1E3A5F] hover:bg-slate-50"
                        >
                          Pakai
                        </button>
                      </td>
                    </tr>
                  ))}
                  {opsi?.outputs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-400">
                        Belum ada item dengan subassembly dan BOM aktif.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "stok" && (
          <div className="space-y-4">
            <section className={cardCls}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-extrabold text-[#1E3A5F]">Stok Total Item</h2>
                <input
                  value={cariStok}
                  onChange={(e) => setCariStok(e.target.value)}
                  placeholder="Cari item..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm sm:w-64"
                />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {itemsStok.slice(0, 60).map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <p className="truncate text-xs font-bold text-slate-700">{item.kode} — {item.nama}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{item.jenis ?? "Tanpa jenis"} · {item.unit}</p>
                    <p className="mt-1 text-sm font-extrabold tabular-nums text-[#1E3A5F]">{fmt(stokGudang[item.id] ?? 0)}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className={cardCls}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-extrabold text-[#1E3A5F]">Riwayat Produksi</h2>
                <span className="text-xs text-slate-400">{riwayat?.meta.total ?? 0} catatan</span>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Nomor</th>
                      <th className="px-3 py-2">Tanggal</th>
                      <th className="px-3 py-2">Divisi</th>
                      <th className="px-3 py-2">Hasil</th>
                      <th className="px-3 py-2">Tujuan</th>
                      <th className="px-3 py-2 text-right">Bahan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {riwayat?.data.map((row: ProduksiRecord) => {
                      const hasil = row.items.filter((item) => item.tipe === "HASIL");
                      return (
                        <tr key={row.id}>
                          <td className="px-3 py-3 font-mono text-xs font-bold text-[#1E3A5F]">{row.nomor}</td>
                          <td className="px-3 py-3 text-xs text-slate-600">
                            {new Date(row.tanggalProduksi).toLocaleDateString("id-ID")}
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-600">{row.divisi?.nama ?? "-"}</td>
                          <td className="px-3 py-3 text-xs text-slate-700">
                            {hasil.map((item) => (
                              <span key={item.id} className="block">
                                {item.item.kode} · {fmt(item.jumlah)} {item.item.unit}
                              </span>
                            ))}
                          </td>
                          <td className="px-3 py-3 text-xs text-slate-600">
                            {row.tujuanLocation ? namaLokasi(row.tujuanLocation) : "-"}
                          </td>
                          <td className="px-3 py-3 text-right text-xs tabular-nums text-slate-600">
                            {row.items.filter((item) => item.tipe === "BAHAN").length}
                          </td>
                        </tr>
                      );
                    })}
                    {(!riwayat || riwayat.data.length === 0) && (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-400">
                          Belum ada produksi tercatat.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        <footer className="flex flex-wrap items-center gap-2 pb-4 text-[11px] text-slate-400">
          <FontAwesomeIcon icon={faWarehouse} />
          <span>Output produksi selalu masuk gudang. Stok divisi hanya sumber bahan.</span>
          <FontAwesomeIcon icon={faBoxOpen} className="ml-2" />
          <span>{items.length} item master aktif.</span>
          <FontAwesomeIcon icon={faCalendarDays} className="ml-2" />
          <span>{tanggal}</span>
        </footer>
      </div>
    </div>
  );
}
