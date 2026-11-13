import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRotateRight,
  faBoxesStacked,
  faChartLine,
  faClipboardCheck,
  faIndustry,
  faSitemap,
  faSpinner,
  faTriangleExclamation,
  faWarehouse,
} from "@fortawesome/free-solid-svg-icons";
import { getUser } from "../../api/auth";
import { getDivisi, type Divisi } from "../../api/divisi";
import { getItems, type Item } from "../../api/item";
import { getVariantProduk, type VariantProdukRow } from "../../api/products";
import { listProductionRoutings, type ProductionRouting } from "../../api/erp";
import { getStokDivisi, type StokDivisiRecord } from "../../api/pemakaianMaterial";
import { getStokGudang, type StokGudang } from "../../api/produksiHarian";
import {
  listHasilProduksi,
  type HasilProduksiList,
  type HasilProduksiRecord,
} from "../../api/hasilProduksiHarian";
import HasilProduksiForm from "../../components/produksi/HasilProduksiForm";
import LaporanProduksiContent from "../../components/admin/LaporanProduksi/LaporanProduksiContent";

const TABS = [
  { id: "produksi", label: "Catat Hasil Produksi", icon: faIndustry },
  { id: "riwayat", label: "Riwayat Produksi", icon: faClipboardCheck },
  { id: "routing", label: "Routing & BOM", icon: faSitemap },
  { id: "stok", label: "Stok WIP & Gudang", icon: faBoxesStacked },
  { id: "laporan", label: "Laporan", icon: faChartLine },
] as const;

type TabId = (typeof TABS)[number]["id"];

const n = (value: number | string | null | undefined) => Number(value ?? 0);
const fmt = (value: number | string | null | undefined) =>
  n(value).toLocaleString("id-ID", { maximumFractionDigits: 6 });

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20";
const cardCls = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";

function pesan(error: unknown) {
  return error instanceof Error ? error.message : "Terjadi kesalahan.";
}

export default function ProduksiHome() {
  const navigate = useNavigate();
  const user = getUser();
  const lockedDivisiId = user?.role === "admin" ? null : user?.divisiId ?? null;
  const [tab, setTab] = useState<TabId>("produksi");

  const [divisions, setDivisions] = useState<Divisi[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [routings, setRoutings] = useState<ProductionRouting[]>([]);
  const [variants, setVariants] = useState<VariantProdukRow[]>([]);
  const [stokDivisi, setStokDivisi] = useState<StokDivisiRecord[]>([]);
  const [stokGudang, setStokGudang] = useState<StokGudang[]>([]);
  const [riwayat, setRiwayat] = useState<HasilProduksiList | null>(null);
  const [divisiId, setDivisiId] = useState(String(lockedDivisiId ?? ""));
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cariStok, setCariStok] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const muatMaster = useCallback(async () => {
    const [divisiRows, itemRows, routingRows, variantRows, gudangRows] = await Promise.all([
      getDivisi(),
      getItems({ aktif: true }),
      listProductionRoutings(),
      getVariantProduk(),
      getStokGudang(),
    ]);
    setDivisions(divisiRows);
    setItems(itemRows);
    setRoutings(routingRows);
    setVariants(variantRows);
    setStokGudang(gudangRows);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    muatMaster()
      .then(() => {
        if (!active) return;
        setLoadError(null);
      })
      .catch((error) => {
        if (active) setLoadError(pesan(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [muatMaster, reloadKey]);

  // Divisi default setelah master termuat (admin tanpa pilihan → divisi pertama).
  useEffect(() => {
    if (divisiId || divisions.length === 0) return;
    setDivisiId(String(divisions[0].id));
  }, [divisiId, divisions]);

  useEffect(() => {
    if (!divisiId) return;
    let active = true;
    const divisiNum = Number(divisiId);
    setRefreshing(true);
    Promise.all([
      getStokDivisi(),
      listHasilProduksi({ page, limit: 10, divisiId: divisiNum }),
    ])
      .then(([stokRows, riwayatRows]) => {
        if (!active) return;
        setStokDivisi(stokRows);
        setRiwayat(riwayatRows);
        setLoadError(null);
      })
      .catch((error) => {
        if (active) setLoadError(pesan(error));
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [divisiId, page, reloadKey]);

  const refresh = () => {
    setReloadKey((value) => value + 1);
  };

  const divisiTerpilih = useMemo(
    () => divisions.find((row) => String(row.id) === divisiId) ?? null,
    [divisions, divisiId],
  );

  const wipByItem = useMemo(() => {
    const record = stokDivisi.find((row) => row.divisiId === Number(divisiId));
    const map: Record<number, number> = {};
    for (const material of record?.materials ?? []) {
      if (material.itemId !== null) map[material.itemId] = material.sisa;
    }
    return map;
  }, [stokDivisi, divisiId]);

  const wipDivisi = useMemo(() => {
    const record = stokDivisi.find((row) => row.divisiId === Number(divisiId));
    return (record?.materials ?? []).filter((row) => row.sisa !== 0 || row.dipakai !== 0);
  }, [stokDivisi, divisiId]);

  const stokGudangTotal = useMemo(() => {
    const totals: Record<number, number> = {};
    for (const location of stokGudang) {
      for (const item of location.items) {
        totals[item.itemId] = (totals[item.itemId] ?? 0) + item.quantity;
      }
    }
    return totals;
  }, [stokGudang]);

  const itemsStok = useMemo(() => {
    const q = cariStok.trim().toLowerCase();
    return items
      .filter(
        (item) =>
          !q ||
          item.kode.toLowerCase().includes(q) ||
          item.nama.toLowerCase().includes(q) ||
          (item.jenis ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => (stokGudangTotal[b.id] ?? 0) - (stokGudangTotal[a.id] ?? 0));
  }, [items, cariStok, stokGudangTotal]);

  const onSaved = (_record: HasilProduksiRecord) => {
    setPage(1);
    refresh();
  };

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-slate-500">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <FontAwesomeIcon icon={faSpinner} spin /> Memuat produksi...
        </p>
      </div>
    );
  }

  if (lockedDivisiId === null && user && user.divisiId === null && user.role !== "admin") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Akun ini belum terhubung ke divisi. Hubungi admin untuk menetapkan divisi sebelum mencatat
          hasil produksi.
        </div>
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
              <h1 className="mt-1 text-xl font-extrabold text-[#1E3A5F] sm:text-2xl">Hasil Produksi Harian</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                Catat konsumsi WIP dan output proses sesuai routing. Output tahap akhir membuat unit
                Barang + QR yang siap dipindai FINISHGOOD.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Divisi
                <select
                  value={divisiId}
                  onChange={(event) => {
                    setDivisiId(event.target.value);
                    setPage(1);
                  }}
                  disabled={lockedDivisiId !== null}
                  className={`${inputCls} mt-1 min-w-[150px]`}
                >
                  <option value="">Pilih divisi</option>
                  {divisions.map((row) => (
                    <option key={row.id} value={row.id}>{row.nama}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={refresh}
                disabled={refreshing}
                className="mt-5 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <FontAwesomeIcon icon={faArrowRotateRight} spin={refreshing} /> Refresh
              </button>
            </div>
          </div>
        </header>

        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <FontAwesomeIcon icon={faTriangleExclamation} className="mr-2" /> {loadError}
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
          <HasilProduksiForm
            key={divisiId}
            divisiId={divisiId}
            canChangeDivisi={lockedDivisiId === null}
            onDivisiChange={(value) => {
              setDivisiId(value);
              setPage(1);
            }}
            divisions={divisions}
            items={items}
            routings={routings}
            variants={variants}
            wipByItem={wipByItem}
            onWipUpdated={refresh}
            onSaved={onSaved}
            onScan={() => navigate("/scan-qr?status=FINISHGOOD")}
          />
        )}

        {tab === "riwayat" && (
          <section className={cardCls}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-extrabold text-[#1E3A5F]">Riwayat Hasil Produksi</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {divisiTerpilih ? `Divisi ${divisiTerpilih.nama}` : "Semua divisi"} ·{" "}
                  {riwayat?.meta.total ?? 0} dokumen
                </p>
              </div>
              {riwayat && riwayat.meta.totalPages > 1 && (
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    className="rounded-lg border border-slate-200 px-2 py-1 font-bold text-slate-600 disabled:opacity-40"
                  >
                    Sebelumnya
                  </button>
                  <span className="tabular-nums text-slate-500">
                    {page}/{riwayat.meta.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= riwayat.meta.totalPages}
                    onClick={() => setPage((value) => value + 1)}
                    className="rounded-lg border border-slate-200 px-2 py-1 font-bold text-slate-600 disabled:opacity-40"
                  >
                    Berikutnya
                  </button>
                </div>
              )}
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Nomor</th>
                    <th className="px-3 py-2">Tanggal</th>
                    <th className="px-3 py-2">Divisi</th>
                    <th className="px-3 py-2">Tahap</th>
                    <th className="px-3 py-2">BOM</th>
                    <th className="px-3 py-2">Output</th>
                    <th className="px-3 py-2 text-right">Unit QR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {riwayat?.data.map((row) => {
                    const hasil = row.items.filter((item) => item.tipe === "HASIL");
                    const unitCount = hasil.reduce(
                      (total, item) => total + item.barangDihasilkan.length,
                      0,
                    );
                    return (
                      <tr key={row.id}>
                        <td className="px-3 py-3 font-mono text-xs font-bold text-[#1E3A5F]">{row.nomor}</td>
                        <td className="px-3 py-3 text-xs text-slate-600">
                          {new Date(row.tanggalProduksi).toLocaleDateString("id-ID")}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-600">{row.divisi?.nama ?? "-"}</td>
                        <td className="px-3 py-3 text-xs text-slate-600">{row.routingStage?.stage ?? "-"}</td>
                        <td className="px-3 py-3 text-xs text-slate-600">
                          {row.bom ? `v${row.bom.version}` : "—"}
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-700">
                          {hasil.map((item) => (
                            <span key={item.id} className="block">
                              {item.item.kode} · {fmt(item.jumlah)} {item.item.unit}
                              {item.productVariant ? ` · ${item.productVariant.kodeVariant}` : ""}
                            </span>
                          ))}
                        </td>
                        <td className="px-3 py-3 text-right text-xs tabular-nums text-slate-600">
                          {unitCount > 0 ? unitCount.toLocaleString("id-ID") : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {(!riwayat || riwayat.data.length === 0) && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">
                        Belum ada hasil produksi tercatat untuk divisi ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "routing" && (
          <section className={cardCls}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-extrabold text-[#1E3A5F]">Routing Produksi Aktif</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Posting HP divalidasi terhadap tahap routing: input, output, divisi, dan urutan proses.
                </p>
              </div>
              {user?.role === "admin" && (
                <a
                  href="/admin/routing-produksi"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-[#1E3A5F] hover:bg-slate-50"
                >
                  Kelola routing
                </a>
              )}
            </div>
            <div className="mt-4 space-y-4">
              {routings.map((routing) => (
                <div key={routing.id} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-xs font-bold text-slate-700">
                    Routing v{routing.version} · {routing.stages.length} tahap
                  </p>
                  <ol className="mt-2 space-y-2">
                    {[...routing.stages]
                      .sort((a, b) => a.sequence - b.sequence)
                      .map((stage) => (
                        <li key={stage.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-white px-2 py-0.5 font-bold text-[#1E3A5F]">
                              {stage.sequence + 1}. {stage.stage}
                            </span>
                            <span className="text-slate-500">Divisi {stage.divisi.nama}</span>
                          </div>
                          <p className="mt-1 text-slate-600">
                            <span className="font-semibold">Input:</span>{" "}
                            {stage.inputItems.map((row) => row.item.kode).join(", ") || "—"}
                          </p>
                          <p className="text-slate-600">
                            <span className="font-semibold">Output:</span>{" "}
                            {stage.outputItems.map((row) => row.item.kode).join(", ") || "—"}
                          </p>
                        </li>
                      ))}
                  </ol>
                </div>
              ))}
              {routings.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
                  Belum ada routing aktif. Admin perlu mengatur Routing Produksi sebelum posting HP.
                </p>
              )}
            </div>
          </section>
        )}

        {tab === "stok" && (
          <div className="space-y-4">
            <section className={cardCls}>
              <h2 className="text-sm font-extrabold text-[#1E3A5F]">
                Stok WIP — {divisiTerpilih?.nama ?? "divisi"}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Sisa lot WIP yang tersedia untuk baris MASUK pada divisi ini.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2">Jenis</th>
                      <th className="px-3 py-2 text-right">Diterima</th>
                      <th className="px-3 py-2 text-right">Dipakai</th>
                      <th className="px-3 py-2 text-right">Sisa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {wipDivisi.map((row) => (
                      <tr key={row.key}>
                        <td className="px-3 py-2 text-xs font-semibold text-slate-700">{row.nama}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{row.jenis ?? "—"}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums">{fmt(row.diterima)}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums">{fmt(row.dipakai)}</td>
                        <td className="px-3 py-2 text-right text-xs font-bold tabular-nums text-[#1E3A5F]">
                          {fmt(row.sisa)} {row.satuan ?? ""}
                        </td>
                      </tr>
                    ))}
                    {wipDivisi.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-400">
                          Belum ada saldo WIP pada divisi ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={cardCls}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-extrabold text-[#1E3A5F]">Stok Total di Gudang</h2>
                <input
                  value={cariStok}
                  onChange={(event) => setCariStok(event.target.value)}
                  placeholder="Cari item..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm sm:w-64"
                />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {itemsStok.slice(0, 60).map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <p className="truncate text-xs font-bold text-slate-700">{item.kode} — {item.nama}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{item.jenis ?? "Tanpa jenis"} · {item.unit}</p>
                    <p className="mt-1 text-sm font-extrabold tabular-nums text-[#1E3A5F]">
                      {fmt(stokGudangTotal[item.id] ?? 0)}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === "laporan" && <LaporanProduksiContent />}

        <footer className="flex flex-wrap items-center gap-2 pb-4 text-[11px] text-slate-400">
          <FontAwesomeIcon icon={faWarehouse} />
          <span>Output tahap akhir masuk sebagai unit Barang + QR di lokasi divisi.</span>
          <FontAwesomeIcon icon={faBoxesStacked} className="ml-2" />
          <span>{items.length} item master aktif.</span>
        </footer>
      </div>
    </div>
  );
}
