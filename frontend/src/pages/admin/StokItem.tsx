import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faCircleCheck,
  faCircleExclamation,
  faFileExport,
  faHistory,
  faMinus,
  faPlus,
  faRightLeft,
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
  getItemGudangBalances,
  transferItemGudang,
  type StokItemResponse,
  type StokItemGudangBalance,
  type StokMutasiRecord,
} from "../../api/stokItem";
import { listErpMovements, postErpMovement, type ErpMovement } from "../../api/erp";
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
    ringkasan: "Menambah saldo inventory pada gudang yang dipilih.",
  },
  KELUAR: {
    label: "Keluar",
    tombol: "Catat keluar",
    sukses: "Stok keluar berhasil dicatat.",
    placeholder: "cth: Pengeluaran untuk produksi",
    ringkasan: "Mengurangi saldo inventory pada gudang yang dipilih.",
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
  const [warehouseBalances, setWarehouseBalances] = useState<StokItemGudangBalance[]>([]);
  const [inventoryMovements, setInventoryMovements] = useState<ErpMovement[]>([]);
  const [warehouseLoading, setWarehouseLoading] = useState(true);
  const [inventoryMovementsLoading, setInventoryMovementsLoading] = useState(true);
  const [warehouseError, setWarehouseError] = useState<string | null>(null);
  const [entryLocationId, setEntryLocationId] = useState("");
  const [transferFrom, setTransferFrom] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [transferQuantity, setTransferQuantity] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferBusy, setTransferBusy] = useState(false);
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
  const canAdjust = hasPermission("INVENTORY_ADJUST");
  const canTransfer = hasPermission("INVENTORY_MOVE");
  const config = KONFIG_TRANSAKSI[tipe];
  const jumlahN = Number(jumlah);
  const selectedEntryLocation = warehouseBalances.find((location) => String(location.id) === entryLocationId);
  const entryBalance = selectedEntryLocation?.balance ?? 0;
  const jumlahUnits = jumlahN * 1_000_000;
  const jumlahValid = Number.isFinite(jumlahN) && jumlahN > 0 && Number.isSafeInteger(Math.round(jumlahUnits)) && Math.abs(jumlahUnits - Math.round(jumlahUnits)) <= 1e-7;
  const melebihiSaldo = tipe === "KELUAR" && selectedEntryLocation !== undefined && jumlahN > entryBalance;
  const totalRiwayat = data?.riwayat.meta.total ?? 0;
  const totalPages = data?.riwayat.meta.totalPages ?? 1;
  const filterAktif = filter.dari !== "" || filter.sampai !== "";
  const warehouseTotal = warehouseBalances.reduce((total, location) => total + location.balance, 0);
  const selectedSource = warehouseBalances.find((location) => String(location.id) === transferFrom);

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

  const loadWarehouseBalances = useCallback(async () => {
    if (!idValid) {
      setWarehouseLoading(false);
      return;
    }
    setWarehouseLoading(true);
    try {
      const balances = await getItemGudangBalances(itemId);
      setWarehouseBalances(balances);
      setEntryLocationId((current) => current && balances.some((location) => String(location.id) === current)
        ? current
        : String(balances[0]?.id ?? ""));
      setWarehouseError(null);
    } catch (e) {
      setWarehouseError(e instanceof Error ? e.message : "Gagal memuat stok per gudang.");
    } finally {
      setWarehouseLoading(false);
    }
  }, [idValid, itemId]);

  const loadInventoryMovements = useCallback(async () => {
    if (!idValid) {
      setInventoryMovementsLoading(false);
      return;
    }
    setInventoryMovementsLoading(true);
    try {
      setInventoryMovements(await listErpMovements({ itemId, take: 50 }));
    } catch (e) {
      setWarehouseError(e instanceof Error ? e.message : "Gagal memuat riwayat inventory.");
    } finally {
      setInventoryMovementsLoading(false);
    }
  }, [idValid, itemId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- muat saldo gudang saat item berubah
    void loadWarehouseBalances();
  }, [loadWarehouseBalances]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- muat gerakan inventory saat item berubah
    void loadInventoryMovements();
  }, [loadInventoryMovements]);

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
    if (!selectedEntryLocation) {
      setSimpanError("Pilih gudang untuk mencatat stok.");
      return;
    }
    if (!jumlahValid) {
      setSimpanError(
        jumlah.trim() === ""
          ? "Masukkan jumlah stok terlebih dahulu."
          : "Jumlah harus positif dengan maksimal 6 angka desimal.",
      );
      return;
    }
    if (melebihiSaldo) {
      setSimpanError(`Jumlah melebihi saldo di ${selectedEntryLocation.name} (${entryBalance.toLocaleString("id-ID")} ${item.unit}).`);
      return;
    }
    if (!keterangan.trim()) {
      setSimpanError("Alasan transaksi wajib diisi.");
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
      await postErpMovement({
        itemId: item.id,
        ...(tipe === "MASUK"
          ? { toLocationId: selectedEntryLocation.id }
          : { fromLocationId: selectedEntryLocation.id }),
        quantity: jumlahN,
        idempotencyKey: crypto.randomUUID(),
        reason: keterangan.trim(),
        occurredAt: tanggalTransaksi,
      });
      setJumlah("");
      setKeterangan("");
      setTanggalTransaksi(tanggalHariIni());
      tampilkanToast(config.sukses);
      await Promise.all([loadWarehouseBalances(), loadInventoryMovements()]);
    } catch (e) {
      setSimpanError(e instanceof Error ? e.message : "Gagal mencatat stok.");
    } finally {
      setBusy(false);
    }
  };

  const simpanTransfer = async (event: React.FormEvent) => {
    event.preventDefault();
    const fromLocationId = Number(transferFrom);
    const toLocationId = Number(transferTo);
    const quantity = Number(transferQuantity);
    const scaledQuantity = quantity * 1_000_000;
    if (
      !Number.isSafeInteger(fromLocationId) ||
      fromLocationId <= 0 ||
      !Number.isSafeInteger(toLocationId) ||
      toLocationId <= 0 ||
      fromLocationId === toLocationId
    ) {
      setTransferError("Pilih gudang asal dan tujuan yang berbeda.");
      return;
    }
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isSafeInteger(Math.round(scaledQuantity)) ||
      Math.abs(scaledQuantity - Math.round(scaledQuantity)) > 1e-7
    ) {
      setTransferError("Jumlah transfer harus positif dengan maksimal 6 angka desimal.");
      return;
    }
    if (transferReason.trim().length < 3) {
      setTransferError("Alasan transfer wajib diisi minimal 3 karakter.");
      return;
    }

    setTransferBusy(true);
    setTransferError(null);
    try {
      const result = await transferItemGudang(itemId, {
        fromLocationId,
        toLocationId,
        quantity,
        idempotencyKey: crypto.randomUUID(),
        reason: transferReason.trim(),
      });
      setTransferQuantity("");
      setTransferReason("");
      await Promise.all([loadWarehouseBalances(), loadInventoryMovements()]);
      tampilkanToast(
        result.repeated
          ? "Transfer sebelumnya sudah tercatat; saldo diperbarui."
          : `Transfer ${quantity.toLocaleString("id-ID")} ${item?.unit ?? ""} berhasil dicatat.`,
      );
    } catch (e) {
      setTransferError(e instanceof Error ? e.message : "Gagal mentransfer stok.");
    } finally {
      setTransferBusy(false);
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
          <section aria-labelledby="stok-gudang-judul" className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:p-6">
            <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 id="stok-gudang-judul" className="text-base font-bold text-[#1F2937]">Stok Inventory per Gudang</h2>
                <p className="mt-1 text-sm text-[#6B7280]">
                  Bersumber dari saldo <span className="font-semibold">StockBalance</span>, yang dibentuk oleh ledger mutasi inventory. Total ini sama dengan kolom Stok Gudang di daftar Master Item &amp; Material.
                </p>
              </div>
              <p className="shrink-0 text-lg font-bold tabular-nums text-[#1E3A5F]">
                {warehouseLoading ? "…" : warehouseTotal.toLocaleString("id-ID")} <span className="text-sm">{item.unit}</span>
              </p>
            </header>

            {warehouseError && <p role="alert" className="mt-3 rounded-xl border border-[#EF4444]/25 bg-[#EF4444]/5 px-3 py-2.5 text-sm text-[#B91C1C]">{warehouseError}</p>}
            {!warehouseError && warehouseLoading && <p role="status" className="mt-3 text-sm text-[#6B7280]">Memuat saldo per gudang…</p>}
            {!warehouseError && !warehouseLoading && warehouseBalances.length === 0 && (
              <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-[#6B7280]">Belum ada gudang aktif yang terhubung ke lokasi inventory.</p>
            )}
            {!warehouseLoading && warehouseBalances.length > 0 && (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {warehouseBalances.map((location) => (
                  <li key={location.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[#1F2937]">{location.name}</span>
                      <span className="block font-mono text-xs text-[#6B7280]">{location.code}</span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-[#1E3A5F]">{location.balance.toLocaleString("id-ID")} {item.unit}</span>
                  </li>
                ))}
              </ul>
            )}

            {canTransfer && (
              <form onSubmit={(event) => void simpanTransfer(event)} className="mt-5 space-y-3 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faRightLeft} className="h-4 w-4 text-[#0088C0]" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-[#1F2937]">Transfer gudang</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="transfer-gudang-asal" className={labelCls}>Gudang asal</label>
                    <select
                      id="transfer-gudang-asal"
                      className={`${inputCls} mt-1`}
                      value={transferFrom}
                      onChange={(event) => { setTransferFrom(event.target.value); setTransferError(null); }}
                      disabled={warehouseLoading || warehouseBalances.length < 2}
                      required
                    >
                      <option value="">Pilih gudang asal</option>
                      {warehouseBalances.filter((location) => location.balance > 0).map((location) => (
                        <option key={location.id} value={location.id}>{location.name} — {location.balance.toLocaleString("id-ID")} {item.unit}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="transfer-gudang-tujuan" className={labelCls}>Gudang tujuan</label>
                    <select
                      id="transfer-gudang-tujuan"
                      className={`${inputCls} mt-1`}
                      value={transferTo}
                      onChange={(event) => { setTransferTo(event.target.value); setTransferError(null); }}
                      disabled={warehouseLoading || warehouseBalances.length < 2}
                      required
                    >
                      <option value="">Pilih gudang tujuan</option>
                      {warehouseBalances.filter((location) => location.id !== Number(transferFrom)).map((location) => (
                        <option key={location.id} value={location.id}>{location.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="transfer-stok-jumlah" className={labelCls}>Jumlah ({item.unit})</label>
                    <input
                      id="transfer-stok-jumlah"
                      type="number"
                      min="0.000001"
                      step="0.000001"
                      max={selectedSource?.balance}
                      inputMode="decimal"
                      className={`${inputCls} mt-1`}
                      value={transferQuantity}
                      onChange={(event) => { setTransferQuantity(event.target.value); setTransferError(null); }}
                      disabled={warehouseLoading || warehouseBalances.length < 2}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="transfer-stok-alasan" className={labelCls}>Alasan transfer</label>
                    <input
                      id="transfer-stok-alasan"
                      className={`${inputCls} mt-1`}
                      value={transferReason}
                      onChange={(event) => { setTransferReason(event.target.value); setTransferError(null); }}
                      placeholder="Contoh: pemindahan stok ke gudang produksi"
                      maxLength={500}
                      disabled={warehouseLoading || warehouseBalances.length < 2}
                      required
                    />
                  </div>
                </div>
                {!warehouseLoading && warehouseBalances.length < 2 && (
                  <p className="text-sm text-[#6B7280]">Transfer membutuhkan minimal dua gudang aktif yang terhubung.</p>
                )}
                <PesanLapangan id="transfer-stok-error" pesan={transferError} />
                <button type="submit" disabled={transferBusy || warehouseLoading || warehouseBalances.length < 2} className={primaryBtn}>
                  <FontAwesomeIcon icon={transferBusy ? faSpinner : faRightLeft} className={transferBusy ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
                  {transferBusy ? "Memproses transfer…" : "Transfer stok"}
                </button>
              </form>
            )}
          </section>

          <section aria-labelledby="riwayat-inventory-judul" className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:p-6">
            <header className="flex items-center justify-between gap-3">
              <div>
                <h2 id="riwayat-inventory-judul" className="text-base font-bold text-[#1F2937]">Gerakan Inventory</h2>
                <p className="mt-1 text-[13px] text-[#6B7280]">Riwayat aktif yang membentuk saldo gudang.</p>
              </div>
              <button type="button" onClick={() => void loadInventoryMovements()} disabled={inventoryMovementsLoading} aria-label="Muat ulang gerakan inventory" title="Muat ulang" className={secondaryBtn}>
                <FontAwesomeIcon icon={faRotateRight} className={inventoryMovementsLoading ? "animate-spin" : ""} aria-hidden="true" />
              </button>
            </header>
            {inventoryMovementsLoading ? (
              <p role="status" className="mt-4 text-sm text-[#6B7280]">Memuat gerakan...</p>
            ) : inventoryMovements.length === 0 ? (
              <p className="mt-4 text-sm text-[#6B7280]">Belum ada gerakan inventory untuk item ini.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="border-b border-slate-100 text-xs uppercase text-slate-500">
                    <tr><th className="py-2 pr-3">Tanggal</th><th className="pr-3">Tipe</th><th className="pr-3">Asal</th><th className="pr-3">Tujuan</th><th className="pr-3 text-right">Jumlah</th><th>Alasan</th></tr>
                  </thead>
                  <tbody>
                    {inventoryMovements.map((movement) => (
                      <tr key={movement.id} className="border-b border-slate-100">
                        <td className="py-2 pr-3 whitespace-nowrap">{formatTanggal(movement.occurredAt)}</td>
                        <td className="pr-3">{movement.type}</td>
                        <td className="pr-3">{movement.fromLocation?.name ?? "—"}</td>
                        <td className="pr-3">{movement.toLocation?.name ?? "—"}</td>
                        <td className="pr-3 text-right tabular-nums">{Number(movement.quantity).toLocaleString("id-ID")} {item.unit}</td>
                        <td className="max-w-[260px] truncate">{movement.reason ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {!canAdjust && (
            <p role="note" className="rounded-2xl border border-[#E5E7EB] bg-slate-50 px-4 py-3 text-sm text-[#4B5563]">
              Pencatatan Masuk/Keluar inventory membutuhkan permission <span className="font-semibold">INVENTORY_ADJUST</span>. Transfer gudang membutuhkan permission <span className="font-semibold">INVENTORY_MOVE</span>.
            </p>
          )}

          {canAdjust && (
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

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_150px_170px_minmax(0,1fr)]">
                  <div>
                    <label htmlFor="stok-gudang" className={labelCls}>
                      <span className="text-sm font-semibold">Gudang</span>
                    </label>
                    <select
                      id="stok-gudang"
                      className={`${inputCls} mt-1 text-base`}
                      value={entryLocationId}
                      onChange={(event) => setEntryLocationId(event.target.value)}
                      disabled={warehouseLoading || warehouseBalances.length === 0}
                      required
                    >
                      <option value="">Pilih gudang</option>
                      {warehouseBalances.map((location) => (
                        <option key={location.id} value={location.id}>{location.name} · saldo {location.balance.toLocaleString("id-ID")} {item.unit}</option>
                      ))}
                    </select>
                  </div>
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
                      min="0.000001"
                      step="0.000001"
                      max={tipe === "KELUAR" ? entryBalance : undefined}
                      inputMode="decimal"
                      className={`${inputCls} mt-1 text-base tabular-nums`}
                      value={jumlah}
                      aria-describedby="stok-jumlah-bantuan stok-jumlah-error"
                      onChange={(e) => ubahJumlah(e.target.value)}
                    />
                    <p id="stok-jumlah-bantuan" className="mt-1.5 text-[13px] text-[#6B7280]">
                      {tipe === "KELUAR"
                        ? `Saldo di gudang: ${selectedEntryLocation ? `${entryBalance.toLocaleString("id-ID")} ${item.unit}` : "pilih gudang"}`
                        : "Jumlah positif, maksimal 6 angka desimal."}
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
                      <span className="text-sm font-semibold">Alasan transaksi</span>
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
                    Perubahan dicatat ke saldo Inventory gudang terpilih.
                  </p>
                  <button
                    type="button"
                    disabled={busy || !selectedEntryLocation || !jumlahValid || melebihiSaldo || !tanggalTransaksi || !keterangan.trim()}
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
                <h2 id="riwayat-judul" className="text-base font-bold text-[#1F2937]">Riwayat mutasi legacy</h2>
                <p className="mt-1 text-[13px] text-[#6B7280]">
                  {data
                    ? `${totalRiwayat.toLocaleString("id-ID")} catatan historis${filterAktif ? " sesuai filter tanggal" : ""}`
                    : "Riwayat transaksi sebelum pencatatan Inventory per gudang."}
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
