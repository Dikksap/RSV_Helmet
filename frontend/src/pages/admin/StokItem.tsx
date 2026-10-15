import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faBoxesStacked,
  faCircleCheck,
  faCircleExclamation,
  faFileExport,
  faHistory,
  faMinus,
  faPlus,
  faRotateRight,
  faSpinner,
  faTriangleExclamation,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { inputCls, labelCls } from "../../components/admin/VariantProduk/constants";
import { getItem, type Item } from "../../api/item";
import {
  getStokItem,
  listSemuaRiwayatStokItem,
  tambahStokItem,
  catatKeluarItem,
  type StokItemResponse,
  type StokMutasiRecord,
} from "../../api/stokItem";
import { downloadCsv } from "../../lib/csv";
import { hasPermission } from "../../api/auth";

type TipeTransaksi = "MASUK" | "KELUAR";
type RiwayatFilter = { dari: string; sampai: string };

const btnBase =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/60 disabled:pointer-events-none disabled:opacity-50";
const primaryBtn = `${btnBase} bg-[#00A8E8] text-white hover:bg-[#0088C0] active:scale-[0.99]`;
const masukBtn = `${btnBase} w-full bg-[#10B981] text-white hover:bg-[#0E9A6E] active:scale-[0.99] sm:w-auto`;
const keluarBtn = `${btnBase} w-full bg-[#EF4444] text-white hover:bg-[#DC2626] active:scale-[0.99] sm:w-auto`;
const secondaryBtn = `${btnBase} border border-[#D1D5DB] bg-white text-[#1F2937] hover:bg-[#F5F7FA]`;
const badgeBase = "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold";

const KONFIG_TRANSAKSI: Record<
  TipeTransaksi,
  { label: string; tombol: string; sukses: string; placeholder: string; ringkasan: string }
> = {
  MASUK: {
    label: "Masuk",
    tombol: "Catat masuk",
    sukses: "Stok masuk berhasil dicatat.",
    placeholder: "cth: Pembelian PO-123",
    ringkasan: "Transaksi masuk menambah saldo stok item.",
  },
  KELUAR: {
    label: "Keluar",
    tombol: "Catat keluar",
    sukses: "Stok keluar berhasil dicatat.",
    placeholder: "cth: Pengeluaran untuk produksi",
    ringkasan: "Transaksi keluar mengurangi saldo dan tidak dapat melebihi saldo saat ini.",
  },
};

const tipeLabel = (tipe: TipeTransaksi) => KONFIG_TRANSAKSI[tipe].label;

const formatTanggal = (iso: string) => {
  const tanggal = new Date(iso);
  return Number.isNaN(tanggal.getTime()) ? iso : tanggal.toLocaleString("id-ID");
};

const tanggalHariIni = () => new Date().toLocaleDateString("en-CA");

function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-slate-200/80 ${className}`} />;
}

function PesanLapangan({
  id,
  pesan,
}: {
  id: string;
  pesan: string | null;
}) {
  if (!pesan) return null;
  return (
    <p id={id} role="alert" className="flex items-start gap-2 rounded-xl border border-[#EF4444]/25 bg-[#EF4444]/5 px-3 py-2.5 text-sm text-[#B91C1C]">
      <FontAwesomeIcon icon={faCircleExclamation} className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0">{pesan}</span>
    </p>
  );
}

function LencanaTipe({ tipe }: { tipe: TipeTransaksi }) {
  const masuk = tipe === "MASUK";
  return (
    <span
      className={`${badgeBase} ${masuk ? "bg-[#10B981]/12 text-[#0E7A55]" : "bg-[#EF4444]/10 text-[#B91C1C]"}`}
    >
      <FontAwesomeIcon icon={masuk ? faPlus : faMinus} className="h-3 w-3" aria-hidden="true" />
      {tipeLabel(tipe)}
    </span>
  );
}

function KartuMutasi({ mutasi, unit }: { mutasi: StokMutasiRecord; unit: string }) {
  const masuk = mutasi.tipe === "MASUK";
  return (
    <article className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <LencanaTipe tipe={mutasi.tipe} />
        <p className={`text-right text-lg font-bold tabular-nums ${masuk ? "text-[#0E7A55]" : "text-[#B91C1C]"}`}>
          {masuk ? "+" : "−"}{mutasi.jumlah.toLocaleString("id-ID")}{" "}
          <span className="text-xs font-semibold text-[#6B7280]">{unit}</span>
        </p>
      </div>
      <p className="mt-2 text-[13px] text-[#6B7280]">{formatTanggal(mutasi.tanggal)}</p>
      <p className="mt-1 min-w-0 break-words text-sm text-[#1F2937]">{mutasi.keterangan ?? "—"}</p>
    </article>
  );
}

function SkeletonRiwayat() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-[76px] rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
}

export default function StokItem() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const kembali = pathname.startsWith("/gudang/") ? "/gudang/item" : "/admin/item";
  const konteks = pathname.startsWith("/gudang/") ? "Gudang" : "Master";
  const itemId = Number(id);
  const idValid = Number.isInteger(itemId) && itemId > 0;

  const [itemState, setItemState] = useState<{ key: number; item: Item | null; error: string | null } | null>(null);
  const [data, setData] = useState<StokItemResponse | null>(null);
  const [page, setPage] = useState(1);
  const [stokLoading, setStokLoading] = useState(true);
  const [riwayatError, setRiwayatError] = useState<string | null>(null);
  const [simpanError, setSimpanError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; pesan: string } | null>(null);
  const [tipe, setTipe] = useState<TipeTransaksi>("MASUK");
  const [jumlah, setJumlah] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [tanggalTransaksi, setTanggalTransaksi] = useState(tanggalHariIni);
  const [busy, setBusy] = useState(false);
  const [dariInput, setDariInput] = useState("");
  const [sampaiInput, setSampaiInput] = useState("");
  const [filter, setFilter] = useState<RiwayatFilter>({ dari: "", sampai: "" });
  const [exporting, setExporting] = useState(false);
  const [itemKey, setItemKey] = useState(0);
  const [riwayatKey, setRiwayatKey] = useState(0);

  const toastId = useRef(0);
  const toastTimer = useRef<number | undefined>(undefined);
  const stokRequest = useRef(0);
  const canKelola = hasPermission("KELOLA_ITEM");
  const config = KONFIG_TRANSAKSI[tipe];
  const saldo = data?.saldo ?? 0;
  const saldoSiap = data !== null;
  const jumlahN = Number(jumlah);
  const melebihiSaldo = tipe === "KELUAR" && saldoSiap && Number.isInteger(jumlahN) && jumlahN > saldo;
  const jumlahValid = Number.isInteger(jumlahN) && jumlahN > 0;
  const totalRiwayat = data?.riwayat.meta.total ?? 0;
  const totalPages = data?.riwayat.meta.totalPages ?? 1;
  const filterAktif = filter.dari !== "" || filter.sampai !== "";

  useEffect(() => () => {
    window.clearTimeout(toastTimer.current);
  }, []);

  const tampilkanToast = (pesan: string) => {
    window.clearTimeout(toastTimer.current);
    toastId.current += 1;
    const aktif = toastId.current;
    setToast({ id: aktif, pesan });
    toastTimer.current = window.setTimeout(() => {
      setToast((sekarang) => (sekarang?.id === aktif ? null : sekarang));
    }, 4000);
  };

  useEffect(() => {
    if (!idValid) return;
    let aktif = true;
    getItem(itemId)
      .then((row) => {
        if (aktif) setItemState({ key: itemId, item: row, error: null });
      })
      .catch((e: unknown) => {
        if (aktif) {
          setItemState({
            key: itemId,
            item: null,
            error: e instanceof Error ? e.message : "Gagal memuat item.",
          });
        }
      });
    return () => {
      aktif = false;
    };
  }, [idValid, itemId, itemKey]);

  const item = idValid && itemState?.key === itemId ? itemState.item : null;
  const itemError = !idValid
    ? "ID item tidak valid."
    : itemState?.key === itemId
      ? itemState.error
      : null;
  const itemLoading = idValid && !item && !itemError;

  const loadStok = useCallback(async (p: number, f: RiwayatFilter) => {
    if (!idValid) {
      setStokLoading(false);
      return;
    }
    stokRequest.current += 1;
    const permintaan = stokRequest.current;
    setStokLoading(true);
    try {
      const hasil = await getStokItem(itemId, p, 20, {
        ...(f.dari ? { dari: f.dari } : {}),
        ...(f.sampai ? { sampai: f.sampai } : {}),
      });
      if (stokRequest.current !== permintaan) return;
      setData(hasil);
      setRiwayatError(null);
    } catch (e) {
      if (stokRequest.current !== permintaan) return;
      setRiwayatError(e instanceof Error ? e.message : "Gagal memuat stok item.");
    } finally {
      if (stokRequest.current === permintaan) setStokLoading(false);
    }
  }, [idValid, itemId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- muat stok saat halaman/filter berubah
    void loadStok(page, filter);
  }, [loadStok, page, filter, riwayatKey]);

  const muatUlangSemua = () => {
    setRiwayatError(null);
    setPage(1);
    setItemKey((n) => n + 1);
    setRiwayatKey((n) => n + 1);
  };

  const pilihTipe = (nilai: TipeTransaksi) => {
    setTipe(nilai);
    setSimpanError(null);
  };

  const ubahJumlah = (nilai: string) => {
    setJumlah(nilai);
    setSimpanError(null);
  };

  const ubahTanggalTransaksi = (nilai: string) => {
    setTanggalTransaksi(nilai);
    setSimpanError(null);
  };

  const simpanStok = async () => {
    if (!item || busy) return;
    if (!saldoSiap) {
      setSimpanError("Saldo belum dimuat. Tunggu sebentar, lalu coba lagi.");
      return;
    }
    if (!jumlahValid) {
      setSimpanError(
        jumlah.trim() === ""
          ? "Masukkan jumlah stok terlebih dahulu."
          : "Jumlah harus berupa bilangan bulat lebih dari 0.",
      );
      return;
    }
    if (melebihiSaldo) {
      setSimpanError(`Jumlah melebihi saldo saat ini (${saldo.toLocaleString("id-ID")} ${item.unit}).`);
      return;
    }
    if (!tanggalTransaksi) {
      setSimpanError("Pilih tanggal transaksi.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalTransaksi) || Number.isNaN(new Date(`${tanggalTransaksi}T00:00:00`).getTime())) {
      setSimpanError("Tanggal transaksi harus tanggal valid (YYYY-MM-DD).");
      return;
    }
    if (tanggalTransaksi > tanggalHariIni()) {
      setSimpanError("Tanggal transaksi tidak boleh melebihi hari ini.");
      return;
    }
    setBusy(true);
    setSimpanError(null);
    try {
      const body = { jumlah: jumlahN, keterangan: keterangan.trim() || undefined, tanggal: tanggalTransaksi };
      if (tipe === "MASUK") await tambahStokItem(item.id, body);
      else await catatKeluarItem(item.id, body);
      setJumlah("");
      setKeterangan("");
      setTanggalTransaksi(tanggalHariIni());
      tampilkanToast(config.sukses);
      setDariInput("");
      setSampaiInput("");
      setFilterError(null);
      setExportError(null);
      setFilter({ dari: "", sampai: "" });
      setPage(1);
      if (page === 1) await loadStok(1, { dari: "", sampai: "" });
    } catch (e) {
      setSimpanError(e instanceof Error ? e.message : "Gagal mencatat stok.");
    } finally {
      setBusy(false);
    }
  };

  const terapkanFilter = () => {
    if (dariInput && sampaiInput && dariInput > sampaiInput) {
      setFilterError("Tanggal 'Dari' tidak boleh lebih besar dari 'Sampai'.");
      return;
    }
    setFilterError(null);
    setExportError(null);
    setPage(1);
    setFilter({ dari: dariInput, sampai: sampaiInput });
  };

  const resetFilter = () => {
    setDariInput("");
    setSampaiInput("");
    setFilterError(null);
    setExportError(null);
    setPage(1);
    setFilter({ dari: "", sampai: "" });
  };

  const exportCsv = async () => {
    if (!item || exporting) return;
    if (filter.dari && filter.sampai && filter.dari > filter.sampai) {
      setExportError("Tanggal 'Dari' tidak boleh lebih besar dari 'Sampai'.");
      return;
    }
    setExporting(true);
    setExportError(null);
    try {
      const semua = await listSemuaRiwayatStokItem(item.id, {
        ...(filter.dari ? { dari: filter.dari } : {}),
        ...(filter.sampai ? { sampai: filter.sampai } : {}),
      });
      if (semua.length === 0) {
        setExportError("Tidak ada riwayat pada rentang tanggal tersebut.");
        return;
      }
      const kodeFile = item.kode.trim().replace(/[^A-Za-z0-9_.-]+/g, "-") || "item";
      const rentangFile = filterAktif
        ? `${(filter.dari || "awal").replace(/-/g, "")}-${(filter.sampai || "akhir").replace(/-/g, "")}`
        : "semua-tanggal";
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      downloadCsv(`stok-${kodeFile}-${rentangFile}-${stamp}.csv`, [
        ["Kode", "Nama", "Unit", "Tanggal", "Tipe", "Jumlah", "Keterangan"],
        ...semua.map((m: StokMutasiRecord) => [
          item.kode,
          item.nama,
          item.unit,
          formatTanggal(m.tanggal),
          tipeLabel(m.tipe),
          m.jumlah,
          m.keterangan ?? "",
        ]),
      ]);
      tampilkanToast(`Laporan CSV berhasil diunduh (${semua.length.toLocaleString("id-ID")} catatan).`);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Gagal mengekspor CSV.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 sm:space-y-6 sm:px-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#6B7280]">
              <li>{konteks}</li>
              <li aria-hidden="true">/</li>
              <li>Kelola Item</li>
              <li aria-hidden="true">/</li>
              <li className="text-[#00A8E8]">Stok</li>
            </ol>
          </nav>
          {itemLoading ? (
            <div className="mt-3 space-y-3">
              <Skeleton className="h-9 w-3/4 sm:h-10" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-32" />
              </div>
            </div>
          ) : (
            <>
              <h1 className="mt-2 min-w-0 break-words text-[26px] font-bold leading-[1.15] tracking-tight text-[#1E3A5F] sm:text-4xl">
                {item?.nama ?? "Stok item"}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex min-w-0 max-w-full items-center rounded-full bg-[#1E3A5F] px-3 py-1 font-mono text-xs font-semibold text-white">
                  <span className="truncate">{item?.kode ?? "—"}</span>
                </span>
                <span className={`${badgeBase} bg-[#00A8E8]/10 text-[#0088C0]`}>
                  Satuan: {item?.unit ?? "—"}
                </span>
                {item?.jenis ? (
                  <span className={`${badgeBase} bg-slate-100 text-[#1F2937]`}>
                    <span className="max-w-[220px] truncate">{item.jenis}</span>
                  </span>
                ) : (
                  <span className={`${badgeBase} bg-slate-100 text-[#6B7280]`}>Tanpa jenis</span>
                )}
              </div>
            </>
          )}
        </div>
        <button type="button" onClick={() => navigate(kembali)} className={`${secondaryBtn} w-full shrink-0 sm:w-auto lg:mt-7`}>
          <FontAwesomeIcon icon={faArrowLeft} className="h-4 w-4" aria-hidden="true" />
          Kembali ke daftar
        </button>
      </header>

      {itemError && (
        <section role="alert" className="rounded-2xl border border-[#EF4444]/25 bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EF4444]/10 text-[#EF4444]">
              <FontAwesomeIcon icon={faTriangleExclamation} className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-[#1F2937]">Item tidak dapat dimuat</h2>
              <p className="mt-1 break-words text-sm text-[#6B7280]">{itemError}</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {idValid && (
                  <button type="button" onClick={muatUlangSemua} className={`${secondaryBtn} w-full sm:w-auto`}>
                    <FontAwesomeIcon icon={faRotateRight} className="h-4 w-4" aria-hidden="true" />
                    Coba lagi
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {!itemLoading && !itemError && item && (
        <main className="space-y-4 sm:space-y-5">
          <section aria-label="Saldo stok saat ini" className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:p-6">
            <div className="flex items-start gap-3 sm:items-center sm:gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#00A8E8]/12 text-[#00A8E8] sm:h-14 sm:w-14">
                <FontAwesomeIcon icon={faBoxesStacked} className="h-6 w-6" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6B7280]">Saldo saat ini</p>
                {stokLoading && !data ? (
                  <div className="mt-2 space-y-2">
                    <Skeleton className="h-10 w-44 sm:h-12" />
                    <span role="status" className="sr-only">Memuat saldo stok…</span>
                  </div>
                ) : (
                  <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-4xl font-bold tabular-nums tracking-tight text-[#1E3A5F] sm:text-5xl">
                      {data ? data.saldo.toLocaleString("id-ID") : "—"}
                    </span>
                    <span className="rounded-full bg-[#00A8E8]/10 px-2.5 py-1 text-xs font-bold text-[#0088C0]">{item.unit}</span>
                  </p>
                )}
                <p className="mt-1 truncate text-sm text-[#6B7280]">
                  {item.kode} · Stok gudang yang tersedia untuk item ini
                </p>
              </div>
            </div>
          </section>

          {!canKelola && (
            <p role="note" className="rounded-2xl border border-[#E5E7EB] bg-slate-50 px-4 py-3 text-sm text-[#4B5563]">
              Mode lihat saja. Pencatatan stok membutuhkan permission <span className="font-semibold">KELOLA_ITEM</span>.
            </p>
          )}

          {canKelola && (
            <section aria-labelledby="catat-stok-judul" className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:p-6">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 id="catat-stok-judul" className="text-base font-bold text-[#1F2937]">Catat stok</h2>
                  <div role="group" aria-label="Tipe transaksi stok" className="grid grid-cols-2 gap-1 rounded-xl border border-[#E5E7EB] bg-slate-50 p-1 sm:inline-flex sm:w-auto">
                    {(Object.keys(KONFIG_TRANSAKSI) as TipeTransaksi[]).map((nilai) => {
                      const aktif = tipe === nilai;
                      return (
                        <button
                          key={nilai}
                          type="button"
                          aria-pressed={aktif}
                          onClick={() => pilihTipe(nilai)}
                          className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/60 ${
                            aktif
                              ? nilai === "MASUK"
                                ? "bg-[#10B981] text-white shadow-sm"
                                : "bg-[#EF4444] text-white shadow-sm"
                              : "text-[#6B7280] hover:bg-white hover:text-[#1F2937]"
                          }`}
                        >
                          <FontAwesomeIcon icon={nilai === "MASUK" ? faPlus : faMinus} className="h-3.5 w-3.5" aria-hidden="true" />
                          {KONFIG_TRANSAKSI[nilai].label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[150px_170px_minmax(0,1fr)]">
                  <div>
                    <label htmlFor="stok-jumlah" className={labelCls}>
                      <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        Jumlah
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-[#4B5563]">{item.unit}</span>
                      </span>
                    </label>
                    <input
                      id="stok-jumlah"
                      type="number"
                      min={1}
                      step={1}
                      max={tipe === "KELUAR" && saldoSiap ? saldo : undefined}
                      inputMode="numeric"
                      className={`${inputCls} mt-1 text-base tabular-nums`}
                      value={jumlah}
                      aria-describedby="stok-jumlah-bantuan stok-jumlah-error"
                      onChange={(e) => ubahJumlah(e.target.value)}
                    />
                    <p id="stok-jumlah-bantuan" className="mt-1.5 text-[13px] text-[#6B7280]">
                      {tipe === "KELUAR"
                        ? `Saldo saat ini: ${saldoSiap ? `${saldo.toLocaleString("id-ID")} ${item.unit}` : "memuat…"}`
                        : "Masukkan bilangan bulat, misalnya 12."}
                    </p>
                  </div>
                  <div>
                    <label htmlFor="stok-tanggal" className={labelCls}>
                      <span className="text-sm font-semibold">Tanggal</span>
                    </label>
                    <input
                      id="stok-tanggal"
                      type="date"
                      className={`${inputCls} mt-1 text-base`}
                      value={tanggalTransaksi}
                      max={tanggalHariIni()}
                      onChange={(e) => ubahTanggalTransaksi(e.target.value)}
                    />
                    <p className="mt-1.5 text-[13px] text-[#6B7280]">Tanggal transaksi, bukan hari pencatatan.</p>
                  </div>
                  <div>
                    <label htmlFor="stok-keterangan" className={labelCls}>
                      <span className="text-sm font-semibold">Keterangan <span className="font-normal text-[#6B7280]">(opsional)</span></span>
                    </label>
                    <input
                      id="stok-keterangan"
                      className={`${inputCls} mt-1 text-base`}
                      placeholder={config.placeholder}
                      value={keterangan}
                      onChange={(e) => setKeterangan(e.target.value)}
                    />
                    <p className="mt-1.5 text-[13px] text-[#6B7280]">{config.ringkasan}</p>
                  </div>
                </div>

                <PesanLapangan id="stok-jumlah-error" pesan={simpanError} />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[13px] text-[#6B7280]">
                    Batas akhir saldo tetap ditentukan oleh server agar stok tidak minus.
                  </p>
                  <button
                    type="button"
                    disabled={busy || !jumlahValid || melebihiSaldo || !saldoSiap || !tanggalTransaksi}
                    onClick={() => void simpanStok()}
                    className={tipe === "MASUK" ? masukBtn : keluarBtn}
                  >
                    {busy && <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" />}
                    {busy ? "Menyimpan..." : config.tombol}
                  </button>
                </div>
              </div>
            </section>
          )}

          <section aria-labelledby="riwayat-judul" className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h2 id="riwayat-judul" className="text-base font-bold text-[#1F2937]">Riwayat mutasi</h2>
                <p className="mt-1 text-[13px] text-[#6B7280]">
                  {data
                    ? `${totalRiwayat.toLocaleString("id-ID")} catatan${filterAktif ? " sesuai filter tanggal" : ""}`
                    : "Saldo di atas selalu menunjukkan saldo saat ini."}
                </p>
              </div>
              <button
                type="button"
                disabled={exporting || !data || totalRiwayat === 0}
                onClick={() => void exportCsv()}
                title="Unduh seluruh riwayat sesuai filter tanggal sebagai CSV"
                className={`${secondaryBtn} w-full sm:w-auto`}
              >
                <FontAwesomeIcon icon={exporting ? faSpinner : faFileExport} spin={exporting} aria-hidden="true" />
                {exporting ? "Mengekspor..." : "Export CSV"}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[180px_180px_auto]">
              <div>
                <label htmlFor="riwayat-dari" className={labelCls}>
                  <span className="text-sm font-semibold">Dari</span>
                </label>
                <input
                  id="riwayat-dari"
                  type="date"
                  className={`${inputCls} mt-1`}
                  value={dariInput}
                  max={sampaiInput || undefined}
                  onChange={(e) => {
                    setDariInput(e.target.value);
                    setFilterError(null);
                  }}
                />
              </div>
              <div>
                <label htmlFor="riwayat-sampai" className={labelCls}>
                  <span className="text-sm font-semibold">Sampai</span>
                </label>
                <input
                  id="riwayat-sampai"
                  type="date"
                  className={`${inputCls} mt-1`}
                  value={sampaiInput}
                  min={dariInput || undefined}
                  onChange={(e) => {
                    setSampaiInput(e.target.value);
                    setFilterError(null);
                  }}
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-end xl:col-span-1">
                <button type="button" onClick={terapkanFilter} className={`${primaryBtn} w-full sm:w-auto`}>Terapkan</button>
                <button type="button" onClick={resetFilter} className={`${secondaryBtn} w-full sm:w-auto`}>Reset</button>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              <PesanLapangan id="riwayat-filter-error" pesan={filterError} />
              <PesanLapangan id="riwayat-export-error" pesan={exportError} />
            </div>

            {riwayatError && !data ? (
              <div role="alert" className="mt-3 rounded-2xl border border-[#EF4444]/25 bg-[#EF4444]/5 p-4">
                <div className="flex items-start gap-3">
                  <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 h-5 w-5 shrink-0 text-[#EF4444]" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-[#1F2937]">Riwayat tidak dapat dimuat</p>
                    <p className="mt-1 break-words text-sm text-[#6B7280]">{riwayatError}</p>
                    <button type="button" onClick={() => void loadStok(page, filter)} className={`${secondaryBtn} mt-3 w-full sm:w-auto`}>
                      <FontAwesomeIcon icon={faRotateRight} className="h-4 w-4" aria-hidden="true" />
                      Coba lagi
                    </button>
                  </div>
                </div>
              </div>
            ) : stokLoading && !data ? (
              <>
                <span role="status" className="sr-only">Memuat riwayat mutasi…</span>
                <SkeletonRiwayat />
              </>
            ) : data && data.riwayat.data.length > 0 ? (
              <>
                {stokLoading && (
                  <p role="status" className="inline-flex items-center gap-2 text-[13px] text-[#6B7280]">
                    <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" />
                    Memperbarui riwayat…
                  </p>
                )}
                {riwayatError && (
                  <p role="alert" className="rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-3 py-2.5 text-sm text-[#92400E]">
                    Riwayat gagal diperbarui: {riwayatError} Data di bawah mungkin belum terbaru.
                  </p>
                )}

                <div className="hidden overflow-x-auto rounded-xl border border-slate-100 md:block">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="bg-[#F8FAFC] text-[#6B7280]">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wider">Tanggal</th>
                        <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wider">Tipe</th>
                        <th scope="col" className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider">Jumlah</th>
                        <th scope="col" className="px-4 py-3 text-xs font-bold uppercase tracking-wider">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.riwayat.data.map((m) => (
                        <tr key={m.id} className="transition hover:bg-[#F8FAFC]">
                          <td className="whitespace-nowrap px-4 py-3 text-[#4B5563]">{formatTanggal(m.tanggal)}</td>
                          <td className="px-4 py-3"><LencanaTipe tipe={m.tipe} /></td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-[#1F2937]">
                            {m.jumlah.toLocaleString("id-ID")}
                          </td>
                          <td className="max-w-[360px] break-words px-4 py-3 text-[#4B5563]">{m.keterangan ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-3 md:hidden">
                  {data.riwayat.data.map((m) => (
                    <KartuMutasi key={m.id} mutasi={m} unit={item.unit} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-[#6B7280]" aria-live="polite">
                      Halaman <span className="font-bold text-[#1F2937]">{page}</span> dari{" "}
                      <span className="font-bold text-[#1F2937]">{totalPages}</span>
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:flex">
                      <button
                        type="button"
                        disabled={page <= 1 || stokLoading}
                        onClick={() => setPage((p) => p - 1)}
                        className={`${secondaryBtn} w-full sm:w-auto`}
                      >
                        Sebelumnya
                      </button>
                      <button
                        type="button"
                        disabled={page >= totalPages || stokLoading}
                        onClick={() => setPage((p) => p + 1)}
                        className={`${secondaryBtn} w-full sm:w-auto`}
                      >
                        Berikutnya
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="mt-3 rounded-2xl border border-dashed border-[#D1D5DB] bg-slate-50/60 px-4 py-10 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#6B7280] shadow-sm">
                  <FontAwesomeIcon icon={faHistory} className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-3 text-sm font-bold text-[#1F2937]">Belum ada mutasi stok</h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-[#6B7280]">
                  {filterAktif
                    ? "Tidak ada transaksi pada rentang tanggal yang dipilih. Ubah filter atau reset untuk melihat seluruh riwayat."
                    : "Transaksi masuk dan keluar yang dicatat akan muncul di sini sebagai riwayat permanen."}
                </p>
                {filterAktif && (
                  <button type="button" onClick={resetFilter} className={`${secondaryBtn} mt-4 w-full sm:w-auto`}>
                    Reset filter tanggal
                  </button>
                )}
              </div>
            )}
          </section>
        </main>
      )}

      {toast && (
        <div className="fixed inset-x-4 bottom-4 z-50 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[360px]">
          <div role="status" className="flex items-start gap-3 rounded-2xl border border-[#10B981]/25 bg-white p-4 shadow-[0_12px_32px_rgba(16,24,40,0.16)]">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#10B981]/12 text-[#0E7A55]">
              <FontAwesomeIcon icon={faCircleCheck} className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="min-w-0 flex-1 pt-1 text-sm font-medium text-[#1F2937]">{toast.pesan}</p>
            <button
              type="button"
              aria-label="Tutup notifikasi"
              onClick={() => setToast(null)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#6B7280] transition hover:bg-slate-100 hover:text-[#1F2937] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/60"
            >
              <FontAwesomeIcon icon={faXmark} className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
