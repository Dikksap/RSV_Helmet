import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChartPie,
  faClipboardCheck,
  faClipboardList,
  faInbox,
  faLocationDot,
  faMagnifyingGlass,
  faRightLeft,
  faRotate,
  faSpinner,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { getDivisi, type Divisi } from "../../api/divisi";
import { getGudangList, type Gudang } from "../../api/gudang";
import { getItems, type Item } from "../../api/item";
import {
  listErpBalances,
  listErpLocations,
  listErpMovements,
  listErpStockAdjustments,
  listUnmappedLegacyItems,
  mapErpDivision,
  mapErpWarehouse,
  postErpMovement,
  requestErpStockAdjustment,
  reverseInventoryMovement,
  reviewErpStockAdjustment,
  setErpItemDefaultLocation,
  type ErpBalance,
  type ErpLocation,
  type ErpMovement,
  type ErpStockAdjustment,
  type ErpUnmappedLegacyItem,
} from "../../api/erp";
import { getUser, getUserPermissions } from "../../api/auth";
import { inputCls, labelCls } from "../../components/admin/VariantProduk/constants";

const cardCls = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6";
const primaryBtn =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#00A8E8] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0088C0] disabled:cursor-not-allowed disabled:opacity-50";
const ghostBtn =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-[#D1D5DB] bg-white px-4 py-2.5 text-sm font-semibold text-[#1F2937] transition hover:bg-[#F5F7FA] disabled:cursor-not-allowed disabled:opacity-50";
const dangerBtn =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50";
const thCls = "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500";
const tdCls = "px-3 py-2.5 align-top text-sm text-[#1F2937]";
const inputSearchCls = `${inputCls} pl-9`;

type TabId = "ringkasan" | "mutasi" | "transaksi" | "persetujuan" | "pemetaan";

const MOVEMENT_TONE: Record<string, string> = {
  OPENING: "bg-slate-100 text-slate-600",
  PRODUCTION: "bg-violet-100 text-violet-700",
  TRANSFER: "bg-sky-100 text-sky-700",
  QC: "bg-cyan-100 text-cyan-700",
  REPAIR: "bg-orange-100 text-orange-700",
  SHIPMENT: "bg-indigo-100 text-indigo-700",
  RETURN: "bg-teal-100 text-teal-700",
  ADJUSTMENT: "bg-amber-100 text-amber-800",
  REVERSAL: "bg-red-100 text-red-700",
};

const MOVE_TAKE_STEP = 100;
const MOVE_TAKE_MAX = 500;

function formatWaktu(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatCard({ label, value, hint, accent = false }: { label: string; value: string | number; hint?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accent ? "text-amber-600" : "text-[#1E3A5F]"}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center">
      <FontAwesomeIcon icon={faInbox} className="h-5 w-5 text-slate-300" />
      <p className="max-w-md text-sm text-slate-500">{message}</p>
      {action}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-1 text-xs font-medium text-[#1F2937]">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function InventoryLedger() {
  const permissions = getUserPermissions();
  const currentUser = getUser();
  const currentUserId = currentUser?.id;
  const currentUserIsAdmin = currentUser?.role === "admin";
  const canMap = permissions.includes("INVENTORY_LOCATION_MANAGE");
  const canMove = permissions.includes("INVENTORY_MOVE");
  const canAdjust = permissions.includes("INVENTORY_ADJUST");
  const canApproveAdjustments = permissions.includes("INVENTORY_ADJUST_APPROVE");

  const [locations, setLocations] = useState<ErpLocation[]>([]);
  const [balances, setBalances] = useState<ErpBalance[]>([]);
  const [movements, setMovements] = useState<ErpMovement[]>([]);
  const [adjustments, setAdjustments] = useState<ErpStockAdjustment[]>([]);
  const [unmappedItems, setUnmappedItems] = useState<ErpUnmappedLegacyItem[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [warehouses, setWarehouses] = useState<Gudang[]>([]);
  const [divisions, setDivisions] = useState<Divisi[]>([]);

  const [tab, setTab] = useState<TabId>("ringkasan");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [movementTake, setMovementTake] = useState(MOVE_TAKE_STEP);

  const [balanceQuery, setBalanceQuery] = useState("");
  const [balanceLocationId, setBalanceLocationId] = useState("");
  const [movementQuery, setMovementQuery] = useState("");
  const [movementLocationId, setMovementLocationId] = useState("");
  const [movementType, setMovementType] = useState("");
  const [adjustmentStatus, setAdjustmentStatus] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");

  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [itemLocationIds, setItemLocationIds] = useState<Record<number, string>>({});
  const [reason, setReason] = useState("");
  const [adjustmentItemId, setAdjustmentItemId] = useState("");
  const [adjustmentLocationId, setAdjustmentLocationId] = useState("");
  const [physicalQuantity, setPhysicalQuantity] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reversalTarget, setReversalTarget] = useState<ErpMovement | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [reversalBusy, setReversalBusy] = useState(false);

  const loadAll = useCallback(
    async (take: number) => {
      const [
        nextLocations,
        nextBalances,
        nextMovements,
        nextItems,
        nextUnmappedItems,
        nextAdjustments,
        nextWarehouses,
        nextDivisions,
      ] = await Promise.all([
        listErpLocations(),
        listErpBalances(),
        listErpMovements({ take }),
        getItems(),
        canMap ? listUnmappedLegacyItems() : Promise.resolve([]),
        canAdjust || canApproveAdjustments
          ? listErpStockAdjustments()
          : Promise.resolve([]),
        getGudangList(),
        getDivisi(),
      ]);
      setLocations(nextLocations);
      setBalances(nextBalances);
      setMovements(nextMovements);
      setItems(nextItems);
      setUnmappedItems(nextUnmappedItems);
      setAdjustments(nextAdjustments);
      setWarehouses(nextWarehouses);
      setDivisions(nextDivisions);
    },
    [canAdjust, canApproveAdjustments, canMap],
  );

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- muat data ledger saat komponen dipasang
    loadAll(MOVE_TAKE_STEP)
      .then(() => {
        if (active) setError(null);
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : "Gagal memuat inventory.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadAll]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadAll(movementTake);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat ulang inventory.");
    } finally {
      setRefreshing(false);
    }
  };

  const loadMoreMovements = async () => {
    const next = Math.min(movementTake + MOVE_TAKE_STEP, MOVE_TAKE_MAX);
    if (next === movementTake) return;
    setMovementTake(next);
    setRefreshing(true);
    try {
      await loadAll(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat mutasi tambahan.");
    } finally {
      setRefreshing(false);
    }
  };

  const submitMovement = async (event: React.FormEvent) => {
    event.preventDefault();
    const item = Number(itemId);
    const amount = Number(quantity);
    const from = fromLocationId ? Number(fromLocationId) : undefined;
    const to = toLocationId ? Number(toLocationId) : undefined;
    if (!Number.isSafeInteger(item) || item <= 0 || !Number.isFinite(amount) || amount <= 0 || !reason.trim()) {
      setError("Pilih item, masukkan kuantitas positif, dan isi alasan mutasi.");
      return;
    }
    if (!from || !to || from === to) {
      setError("Pilih lokasi asal dan tujuan yang berbeda untuk transfer.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await postErpMovement({
        itemId: item,
        fromLocationId: from,
        toLocationId: to,
        quantity: amount,
        idempotencyKey: crypto.randomUUID(),
        reason: reason.trim(),
      });
      setNotice("Transfer tercatat: saldo asal berkurang dan saldo tujuan bertambah.");
      setQuantity("");
      setReason("");
      await loadAll(movementTake);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mencatat mutasi.");
    } finally {
      setBusy(false);
    }
  };

  const submitAdjustment = async (event: React.FormEvent) => {
    event.preventDefault();
    const item = Number(adjustmentItemId);
    const location = Number(adjustmentLocationId);
    const physical = Number(physicalQuantity);
    if (
      !Number.isSafeInteger(item) ||
      item <= 0 ||
      !Number.isSafeInteger(location) ||
      location <= 0 ||
      !Number.isFinite(physical) ||
      physical < 0 ||
      !adjustmentReason.trim()
    ) {
      setError("Pilih item dan lokasi, masukkan stok fisik >= 0, serta isi alasan.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestErpStockAdjustment({
        itemId: item,
        locationId: location,
        physicalQuantity: physical,
        reason: adjustmentReason.trim(),
      });
      setNotice("Pengajuan adjustment tersimpan dan menunggu persetujuan supervisor.");
      setPhysicalQuantity("");
      setAdjustmentReason("");
      await loadAll(movementTake);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengajukan adjustment.");
    } finally {
      setBusy(false);
    }
  };

  const reviewAdjustment = async (
    adjustmentId: number,
    decision: "approve" | "reject",
  ) => {
    const reviewNotes =
      decision === "reject"
        ? window.prompt("Tuliskan alasan penolakan (minimal 5 karakter):")?.trim()
        : undefined;
    if (decision === "reject" && (!reviewNotes || reviewNotes.length < 5)) {
      if (reviewNotes !== undefined) setError("Alasan penolakan minimal 5 karakter.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await reviewErpStockAdjustment(adjustmentId, decision, reviewNotes);
      setNotice(
        decision === "approve"
          ? "Adjustment disetujui dan mutasi stok sudah diposting."
          : "Adjustment ditolak.",
      );
      await loadAll(movementTake);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mereview adjustment.");
    } finally {
      setBusy(false);
    }
  };

  const mapLocation = async (kind: "warehouse" | "division", id: number) => {
    try {
      if (kind === "warehouse") await mapErpWarehouse(id);
      else await mapErpDivision(id);
      setNotice("Lokasi berhasil dipetakan.");
      setError(null);
      await loadAll(movementTake);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memetakan lokasi.");
    }
  };

  const mapLegacyItem = async (legacyItemId: number) => {
    const locationId = Number(itemLocationIds[legacyItemId]);
    if (!Number.isSafeInteger(locationId) || locationId <= 0) {
      setError("Pilih lokasi tujuan untuk item.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setErpItemDefaultLocation(legacyItemId, locationId);
      setNotice("Saldo legacy item dipetakan dan dicatat sebagai saldo pembuka.");
      await loadAll(movementTake);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memetakan saldo item.");
    } finally {
      setBusy(false);
    }
  };

  const reversedIds = new Set(
    movements
      .map((row) => row.reversalOfId)
      .filter((value) => value !== null && value !== undefined)
      .map(String),
  );

  const reverseBlockedReason = (row: ErpMovement): string | null => {
    if (!canAdjust) return "Butuh izin INVENTORY_ADJUST.";
    if (String(row.type).toUpperCase() === "REVERSAL" || row.reversalOfId) {
      return "Baris ini adalah movement pembalik.";
    }
    if (reversedIds.has(String(row.id))) return "Movement ini sudah dibalik.";
    const source = (row.sourceType ?? "").toUpperCase();
    if (source.startsWith("PRODUCTION") || source.startsWith("PEMAKAIAN_MATERIAL")) {
      return "Mutasi produksi dikoreksi lewat pembalik transaksi produksi, bukan reversal inventory.";
    }
    if (source === "STOCK_ADJUSTMENT") {
      return "Mutasi hasil adjustment tidak bisa dibalik langsung; ajukan adjustment koreksi.";
    }
    return null;
  };

  const submitReversal = async () => {
    if (!reversalTarget || reversalBusy) return;
    const reversalText = reversalReason.trim();
    if (reversalText.length < 5) {
      setError("Alasan reversal minimal 5 karakter.");
      return;
    }
    setReversalBusy(true);
    setError(null);
    try {
      await reverseInventoryMovement(reversalTarget.id, reversalText);
      setNotice(`Movement #${reversalTarget.id} dibalik dengan movement baru.`);
      setReversalTarget(null);
      setReversalReason("");
      await loadAll(movementTake);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membalik movement.");
    } finally {
      setReversalBusy(false);
    }
  };

  const activeLocations = useMemo(() => locations.filter((row) => row.isActive), [locations]);
  const activeLocationOptions = useMemo(
    () => activeLocations.map((row) => ({ id: row.id, label: `${row.code} · ${row.name}` })),
    [activeLocations],
  );
  const activeItems = useMemo(() => items.filter((item) => item.isActive), [items]);

  const balanceRows = useMemo(() => {
    const query = balanceQuery.trim().toLowerCase();
    return balances.filter((row) => {
      if (balanceLocationId && String(row.locationId) !== balanceLocationId) return false;
      if (!query) return true;
      const item = row.itemId === null ? null : items.find((candidate) => candidate.id === row.itemId);
      const location = locations.find((candidate) => candidate.id === row.locationId);
      const haystack = [item?.kode, item?.nama, location?.code, location?.name, row.itemId === null ? "barang individual" : ""]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [balances, balanceLocationId, balanceQuery, items, locations]);

  const distinctBalanceItems = useMemo(
    () => new Set(balances.map((row) => row.itemId).filter((value): value is number => value !== null)).size,
    [balances],
  );

  const movementTypeOptions = useMemo(
    () => Array.from(new Set(movements.map((row) => row.type))).sort(),
    [movements],
  );

  const movementRows = useMemo(() => {
    const query = movementQuery.trim().toLowerCase();
    return movements.filter((row) => {
      if (movementLocationId) {
        const from = row.fromLocation ? String(row.fromLocation.id) : "";
        const to = row.toLocation ? String(row.toLocation.id) : "";
        if (from !== movementLocationId && to !== movementLocationId) return false;
      }
      if (movementType && row.type !== movementType) return false;
      if (!query) return true;
      const haystack = [
        row.type,
        row.sourceType,
        row.sourceId,
        row.reason,
        row.item?.kode,
        row.item?.nama,
        row.item?.unit,
        row.barang?.kodeBarang,
        row.fromLocation?.code,
        row.fromLocation?.name,
        row.toLocation?.code,
        row.toLocation?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [movements, movementLocationId, movementQuery, movementType]);

  const filteredAdjustments = useMemo(
    () =>
      adjustmentStatus === "ALL"
        ? adjustments
        : adjustments.filter((row) => row.status === adjustmentStatus),
    [adjustmentStatus, adjustments],
  );
  const pendingAdjustments = adjustments.filter((row) => row.status === "PENDING").length;

  const unmappedWarehouses = warehouses.filter(
    (row) => !locations.some((location) => location.gudangId === row.id),
  );
  const unmappedDivisions = divisions.filter(
    (row) => !locations.some((location) => location.divisiId === row.id),
  );

  const tabs: { id: TabId; label: string; icon: IconDefinition; badge?: number }[] = [
    { id: "ringkasan", label: "Ringkasan", icon: faChartPie },
    { id: "mutasi", label: "Riwayat Mutasi", icon: faClipboardList },
    ...(canMove || canAdjust
      ? [{ id: "transaksi" as TabId, label: "Catat Transaksi", icon: faRightLeft }]
      : []),
    ...(canAdjust || canApproveAdjustments
      ? [{ id: "persetujuan" as TabId, label: "Persetujuan", icon: faClipboardCheck, badge: pendingAdjustments }]
      : []),
    ...(canMap ? [{ id: "pemetaan" as TabId, label: "Pemetaan Lokasi", icon: faLocationDot }] : []),
  ];

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-slate-500">
        <FontAwesomeIcon icon={faSpinner} spin className="h-6 w-6 text-[#00A8E8]" />
        <p className="text-sm">Memuat ledger lokasi…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#00A8E8] ring-1 ring-inset ring-sky-500/20">
              ERP · Inventory
            </span>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#1E3A5F] sm:text-3xl">Ledger Lokasi</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Satu sumber kebenaran stok per lokasi. Setiap saldo di halaman ini berasal dari mutasi
              (transfer, produksi, QC, adjustment) — bukan dari kolom stok lama. Data legacy tanpa
              lokasi tidak dianggap saldo ledger.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            title="Muat ulang data"
          >
            <FontAwesomeIcon icon={refreshing ? faSpinner : faRotate} spin={refreshing} className="text-slate-400" />
            <span>{refreshing ? "Memuat…" : "Muat ulang"}</span>
          </button>
        </div>

        <nav role="tablist" aria-label="Bagian ledger lokasi" className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200">
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              onClick={() => setTab(entry.id)}
              className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                tab === entry.id
                  ? "border-[#00A8E8] text-[#00A8E8]"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              <FontAwesomeIcon icon={entry.icon} className="h-3.5 w-3.5" />
              <span>{entry.label}</span>
              {entry.badge ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-amber-800">
                  {entry.badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Terjadi kesalahan</p>
            <p className="mt-0.5 break-words">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={refreshing}
            className="shrink-0 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
          >
            Coba lagi
          </button>
        </div>
      )}

      {notice && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </p>
      )}

      {tab === "ringkasan" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Lokasi aktif"
              value={activeLocations.length}
              hint={`${activeLocations.filter((row) => row.type === "WAREHOUSE").length} gudang · ${activeLocations.filter((row) => row.type === "DIVISION").length} divisi`}
            />
            <StatCard label="Baris saldo" value={balances.length} hint={`${distinctBalanceItems} item punya saldo`} />
            <StatCard label="Mutasi terakhir" value={movements.length} hint={`menampilkan ${movementTake} terakhir`} />
            {(canAdjust || canApproveAdjustments) && (
              <StatCard
                label="Menunggu persetujuan"
                value={pendingAdjustments}
                hint="pengajuan adjustment stok"
                accent={pendingAdjustments > 0}
              />
            )}
            {!(canAdjust || canApproveAdjustments) && (
              <StatCard label="Item aktif" value={activeItems.length} hint="dipakai pada transfer stok" />
            )}
          </div>

          <section className={cardCls}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#1E3A5F]">Saldo per lokasi</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Hasil pengurangan seluruh mutasi masuk dan keluar pada tiap lokasi.
                </p>
              </div>
              <p className="text-xs font-medium text-slate-500">{balanceRows.length} dari {balances.length} baris</p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,220px)_auto]">
              <FilterField label="Cari item atau lokasi">
                <div className="relative">
                  <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                  <input
                    className={inputSearchCls}
                    placeholder="cth: RAW001 atau Gudang Bahan"
                    value={balanceQuery}
                    onChange={(event) => setBalanceQuery(event.target.value)}
                  />
                </div>
              </FilterField>
              <FilterField label="Lokasi">
                <select className={inputCls} value={balanceLocationId} onChange={(event) => setBalanceLocationId(event.target.value)}>
                  <option value="">Semua lokasi</option>
                  {activeLocationOptions.map((location) => (
                    <option key={location.id} value={String(location.id)}>{location.label}</option>
                  ))}
                </select>
              </FilterField>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  className={ghostBtn}
                  onClick={() => {
                    setBalanceQuery("");
                    setBalanceLocationId("");
                  }}
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              {balanceRows.length === 0 ? (
                <EmptyState
                  message={
                    balances.length === 0
                      ? "Belum ada saldo pada ledger. Saldo muncul setelah ada mutasi atau pemetaan saldo legacy."
                      : "Tidak ada baris saldo yang cocok dengan filter. Coba ubah kata kunci atau lokasi."
                  }
                  action={
                    balances.length > 0 ? (
                      <button
                        type="button"
                        className={ghostBtn}
                        onClick={() => {
                          setBalanceQuery("");
                          setBalanceLocationId("");
                        }}
                      >
                        Reset filter
                      </button>
                    ) : undefined
                  }
                />
              ) : (
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className={thCls}>Item</th>
                      <th className={thCls}>Lokasi</th>
                      <th className={`${thCls} text-right`}>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balanceRows.map((row, index) => {
                      const item = row.itemId === null ? null : items.find((candidate) => candidate.id === row.itemId);
                      const location = locations.find((candidate) => candidate.id === row.locationId);
                      return (
                        <tr key={`${row.itemId}-${row.locationId}-${index}`} className="border-b border-slate-100 hover:bg-slate-50/70">
                          <td className={tdCls}>
                            {item ? (
                              <>
                                <span className="font-medium">{item.kode}</span>
                                <span className="text-slate-500"> · {item.nama}</span>
                              </>
                            ) : row.itemId !== null ? (
                              <span className="text-red-600">Item tidak ditemukan</span>
                            ) : (
                              <span className="italic text-slate-400">Barang individual (unit QR)</span>
                            )}
                          </td>
                          <td className={tdCls}>
                            {location ? (
                              <>
                                <span className="font-medium">{location.code}</span>
                                <span className="text-slate-500"> · {location.name}</span>
                              </>
                            ) : (
                              <span className="italic text-slate-400">Lokasi #{row.locationId}</span>
                            )}
                          </td>
                          <td className={`${tdCls} text-right font-semibold tabular-nums`}>
                            {row.quantity.toLocaleString("id-ID")}
                            {item && <span className="ml-1 text-xs font-normal text-slate-400">{item.unit}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      )}

      {tab === "mutasi" && (
        <div className="space-y-6">
          <section className={cardCls}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-[#1E3A5F]">Riwayat mutasi</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Setiap baris adalah satu gerakan stok. Kolom <span className="font-medium">Sumber</span>{" "}
                  menunjukkan transaksi asal, misalnya transfer, produksi, QC, atau adjustment.
                </p>
              </div>
              <p className="text-xs font-medium text-slate-500">menampilkan {movementRows.length} baris</p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,200px)_minmax(0,170px)_auto]">
              <FilterField label="Cari">
                <div className="relative">
                  <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                  <input
                    className={inputSearchCls}
                    placeholder="item, kode barang, alasan, sumber…"
                    value={movementQuery}
                    onChange={(event) => setMovementQuery(event.target.value)}
                  />
                </div>
              </FilterField>
              <FilterField label="Lokasi (asal/tujuan)">
                <select className={inputCls} value={movementLocationId} onChange={(event) => setMovementLocationId(event.target.value)}>
                  <option value="">Semua lokasi</option>
                  {activeLocationOptions.map((location) => (
                    <option key={location.id} value={String(location.id)}>{location.label}</option>
                  ))}
                </select>
              </FilterField>
              <FilterField label="Jenis mutasi">
                <select className={inputCls} value={movementType} onChange={(event) => setMovementType(event.target.value)}>
                  <option value="">Semua jenis</option>
                  {movementTypeOptions.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </FilterField>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  className={ghostBtn}
                  onClick={() => {
                    setMovementQuery("");
                    setMovementLocationId("");
                    setMovementType("");
                  }}
                >
                  Reset
                </button>
              </div>
            </div>

            {reversalTarget && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">
                  Balik movement #{reversalTarget.id} · {reversalTarget.type} ·{" "}
                  {Number(reversalTarget.quantity).toLocaleString("id-ID")}
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  Pembalikan membuat movement baru; movement asli tidak dihapus dan saldo diperbarui atomik.
                </p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    className={`${inputCls} sm:w-72`}
                    placeholder="Alasan reversal (minimal 5 karakter)"
                    value={reversalReason}
                    onChange={(event) => setReversalReason(event.target.value)}
                  />
                  <button
                    type="button"
                    className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-800 disabled:opacity-50"
                    disabled={reversalBusy || reversalReason.trim().length < 5}
                    onClick={() => void submitReversal()}
                  >
                    {reversalBusy ? "Membalik…" : "Balik movement"}
                  </button>
                  <button
                    type="button"
                    className={ghostBtn}
                    onClick={() => {
                      setReversalTarget(null);
                      setReversalReason("");
                    }}
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 overflow-x-auto">
              {movementRows.length === 0 ? (
                <EmptyState
                  message={
                    movements.length === 0
                      ? "Belum ada gerakan pada ledger. Mutasi akan muncul di sini setelah ada transfer, produksi, QC, atau adjustment."
                      : "Tidak ada mutasi yang cocok dengan filter."
                  }
                  action={
                    movements.length > 0 ? (
                      <button
                        type="button"
                        className={ghostBtn}
                        onClick={() => {
                          setMovementQuery("");
                          setMovementLocationId("");
                          setMovementType("");
                        }}
                      >
                        Reset filter
                      </button>
                    ) : undefined
                  }
                />
              ) : (
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className={thCls}>Waktu</th>
                      <th className={thCls}>Jenis</th>
                      <th className={thCls}>Item / Unit</th>
                      <th className={thCls}>Asal → Tujuan</th>
                      <th className={`${thCls} text-right`}>Jumlah</th>
                      <th className={thCls}>Sumber & alasan</th>
                      <th className={`${thCls} text-right`}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movementRows.map((row) => {
                      const item = row.item ?? items.find((candidate) => candidate.id === row.itemId);
                      const blocked = reverseBlockedReason(row);
                      const isReversal = String(row.type).toUpperCase() === "REVERSAL" || Boolean(row.reversalOfId);
                      return (
                        <tr key={row.id} className="border-b border-slate-100 align-top hover:bg-slate-50/70">
                          <td className={`${tdCls} whitespace-nowrap tabular-nums text-slate-600`}>
                            {formatWaktu(row.occurredAt)}
                          </td>
                          <td className={tdCls}>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${MOVEMENT_TONE[row.type] ?? "bg-slate-100 text-slate-600"}`}>
                              {row.type}
                            </span>
                            {isReversal && (
                              <span className="ml-1 inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                                pembalik
                              </span>
                            )}
                          </td>
                          <td className={tdCls}>
                            {item ? (
                              <>
                                <span className="font-medium">{item.kode}</span>
                                <span className="text-slate-500"> · {item.nama}</span>
                                <span className="block text-xs text-slate-400">{item.unit}</span>
                              </>
                            ) : row.barang ? (
                              <span className="font-mono text-xs">{row.barang.kodeBarang}</span>
                            ) : (
                              <span className="italic text-slate-400">Barang individual</span>
                            )}
                          </td>
                          <td className={tdCls}>
                            <span className="block">{row.fromLocation?.name ?? <span className="italic text-slate-400">—</span>}</span>
                            <span className="block text-xs text-slate-400">
                              {[row.fromLocation?.code, row.toLocation?.code].filter(Boolean).join(" → ") || "—"}
                            </span>
                            <span className="block">{row.toLocation?.name ?? <span className="italic text-slate-400">—</span>}</span>
                          </td>
                          <td className={`${tdCls} text-right font-semibold tabular-nums`}>
                            {Number(row.quantity).toLocaleString("id-ID")}
                          </td>
                          <td className={tdCls}>
                            <span className="block font-medium text-slate-600">{row.sourceType ?? "—"}</span>
                            {row.sourceId && <span className="block text-xs text-slate-400">#{row.sourceId}</span>}
                            {row.reason && (
                              <span className="mt-0.5 block max-w-[240px] truncate text-xs text-slate-500" title={row.reason}>
                                {row.reason}
                              </span>
                            )}
                          </td>
                          <td className={`${tdCls} text-right`}>
                            {blocked ? (
                              <span className="text-[11px] text-slate-400" title={blocked}>tidak dapat dibalik</span>
                            ) : (
                              <button
                                type="button"
                                className="rounded-lg border border-amber-300 px-2.5 py-1 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-50"
                                onClick={() => {
                                  setTab("mutasi");
                                  setReversalTarget(row);
                                  setReversalReason("");
                                }}
                              >
                                Balik
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {movementRows.length > 0 && movementTake < MOVE_TAKE_MAX && movements.length >= movementTake && (
              <div className="mt-4 flex justify-center">
                <button type="button" className={ghostBtn} disabled={refreshing} onClick={() => void loadMoreMovements()}>
                  <FontAwesomeIcon icon={faSpinner} spin={refreshing} className="text-slate-400" />
                  Muat lebih banyak ({movementTake} dari {MOVE_TAKE_MAX})
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {tab === "transaksi" && (
        <div className="grid gap-6 xl:grid-cols-2">
          {(canMove || canAdjust) && (
            <form onSubmit={submitMovement} className={cardCls}>
              <h2 className="text-base font-semibold text-[#1E3A5F]">Transfer antar lokasi</h2>
              <p className="mt-1 text-sm text-slate-600">
                Pindahkan satu item dari lokasi asal ke lokasi tujuan. Saldo sumber berkurang dan saldo
                tujuan bertambah dalam satu transaksi.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="ledger-transfer-item">
                    Item
                    <select id="ledger-transfer-item" className={inputCls} required value={itemId} onChange={(event) => setItemId(event.target.value)}>
                      <option value="">Pilih item</option>
                      {activeItems.map((item) => (
                        <option key={item.id} value={item.id}>{item.kode} · {item.nama} ({item.unit})</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className={labelCls} htmlFor="ledger-transfer-qty">
                  Kuantitas
                  <input
                    id="ledger-transfer-qty"
                    className={inputCls}
                    type="number"
                    min="0.000001"
                    step="0.000001"
                    placeholder="cth: 120"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                </label>
                <label className={labelCls} htmlFor="ledger-transfer-alasan">
                  Alasan
                  <input
                    id="ledger-transfer-alasan"
                    className={inputCls}
                    placeholder="cth: pindah bahan ke gudang jadi"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </label>
                <label className={labelCls} htmlFor="ledger-transfer-asal">
                  Lokasi asal
                  <select id="ledger-transfer-asal" className={inputCls} value={fromLocationId} onChange={(event) => setFromLocationId(event.target.value)}>
                    <option value="">— Pilih asal —</option>
                    {activeLocationOptions.map((location) => (
                      <option key={location.id} value={String(location.id)}>{location.label}</option>
                    ))}
                  </select>
                </label>
                <label className={labelCls} htmlFor="ledger-transfer-tujuan">
                  Lokasi tujuan
                  <select id="ledger-transfer-tujuan" className={inputCls} value={toLocationId} onChange={(event) => setToLocationId(event.target.value)}>
                    <option value="">— Pilih tujuan —</option>
                    {activeLocationOptions.map((location) => (
                      <option key={location.id} value={String(location.id)}>{location.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  className={primaryBtn}
                  disabled={busy || !canMove || !fromLocationId || !toLocationId}
                  title={!canMove ? "Butuh izin INVENTORY_MOVE" : undefined}
                >
                  {busy ? "Menyimpan…" : "Catat transfer"}
                </button>
                <p className="text-xs text-slate-500">Perlu koreksi saldo? Gunakan pengajuan adjustment di samping.</p>
              </div>
            </form>
          )}

          {canAdjust && (
            <form onSubmit={submitAdjustment} className={cardCls}>
              <h2 className="text-base font-semibold text-[#1E3A5F]">Ajukan penyesuaian stok</h2>
              <p className="mt-1 text-sm text-slate-600">
                Dipakai saat stok fisik berbeda dengan stok sistem. Saldo tidak berubah sebelum
                supervisor menyetujui pada tab <span className="font-medium">Persetujuan</span>.
              </p>
              <ol className="mt-3 list-inside list-decimal space-y-1 text-xs text-slate-500">
                <li>Pilih item dan lokasi yang dihitung ulang.</li>
                <li>Masukkan jumlah fisik hasil hitung (boleh 0).</li>
                <li>Tulis alasan, lalu ajukan untuk disetujui.</li>
              </ol>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="ledger-adjust-item">
                    Item
                    <select
                      id="ledger-adjust-item"
                      className={inputCls}
                      required
                      value={adjustmentItemId}
                      onChange={(event) => setAdjustmentItemId(event.target.value)}
                    >
                      <option value="">Pilih item</option>
                      {activeItems.map((item) => (
                        <option key={item.id} value={item.id}>{item.kode} · {item.nama}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="ledger-adjust-lokasi">
                    Lokasi
                    <select
                      id="ledger-adjust-lokasi"
                      className={inputCls}
                      required
                      value={adjustmentLocationId}
                      onChange={(event) => setAdjustmentLocationId(event.target.value)}
                    >
                      <option value="">Pilih lokasi</option>
                      {activeLocationOptions.map((location) => (
                        <option key={location.id} value={String(location.id)}>{location.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className={labelCls} htmlFor="ledger-adjust-fisik">
                  Jumlah fisik
                  <input
                    id="ledger-adjust-fisik"
                    className={inputCls}
                    type="number"
                    min="0"
                    step="0.000001"
                    required
                    placeholder="cth: 980"
                    value={physicalQuantity}
                    onChange={(event) => setPhysicalQuantity(event.target.value)}
                  />
                </label>
                <label className={labelCls} htmlFor="ledger-adjust-alasan">
                  Alasan
                  <input
                    id="ledger-adjust-alasan"
                    className={inputCls}
                    minLength={5}
                    required
                    placeholder="minimal 5 karakter"
                    value={adjustmentReason}
                    onChange={(event) => setAdjustmentReason(event.target.value)}
                  />
                </label>
              </div>
              <div className="mt-5">
                <button className={primaryBtn} disabled={busy}>
                  {busy ? "Mengirim…" : "Ajukan adjustment"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {tab === "persetujuan" && (canAdjust || canApproveAdjustments) && (
        <section className={cardCls}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-[#1E3A5F]">Persetujuan adjustment stok</h2>
              <p className="mt-1 text-sm text-slate-600">
                Adjustment yang disetujui langsung memposting mutasi ke ledger.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setAdjustmentStatus(status)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    adjustmentStatus === status
                      ? "bg-[#1E3A5F] text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {status === "ALL" ? "Semua" : status === "PENDING" ? "Menunggu" : status === "APPROVED" ? "Disetujui" : "Ditolak"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {filteredAdjustments.map((adjustment) => (
              <article key={adjustment.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-[#1F2937]">{adjustment.item.kode} · {adjustment.item.nama}</p>
                    <p className="text-sm text-slate-600">{adjustment.location.code} · {adjustment.location.name}</p>
                    <p className="mt-1 text-sm">
                      Sistem <span className="font-semibold tabular-nums">{Number(adjustment.systemQuantity).toLocaleString("id-ID")}</span>
                      {" → "}fisik <span className="font-semibold tabular-nums">{Number(adjustment.physicalQuantity).toLocaleString("id-ID")}</span>{" "}
                      {adjustment.item.unit}
                    </p>
                    <p className="text-sm text-slate-600">
                      Selisih <span className="font-semibold tabular-nums">{Number(adjustment.difference).toLocaleString("id-ID")}</span>
                      {" · "}{adjustment.reason}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Diajukan {adjustment.requester.name} · {new Date(adjustment.requestedAt).toLocaleString("id-ID")}
                    </p>
                    {adjustment.status === "PENDING" && adjustment.requester.id === currentUserId && !currentUserIsAdmin && (
                      <p className="mt-1 text-xs font-medium text-amber-800">Anda pengaju adjustment ini. Minta admin lain menyetujui.</p>
                    )}
                    {adjustment.reviewNotes && <p className="mt-1 text-sm text-red-700">Catatan review: {adjustment.reviewNotes}</p>}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                      adjustment.status === "PENDING"
                        ? "bg-amber-100 text-amber-800"
                        : adjustment.status === "APPROVED"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {adjustment.status === "PENDING" ? "MENUNGGU" : adjustment.status === "APPROVED" ? "DISETUJUI" : "DITOLAK"}
                  </span>
                </div>
                {adjustment.status === "PENDING" && canApproveAdjustments && (
                  <div className="mt-3 flex gap-2">
                    <button
                      className={primaryBtn}
                      type="button"
                      disabled={busy || (adjustment.requester.id === currentUserId && !currentUserIsAdmin)}
                      onClick={() => void reviewAdjustment(adjustment.id, "approve")}
                    >
                      Setujui & posting
                    </button>
                    <button
                      className={dangerBtn}
                      type="button"
                      disabled={busy || (adjustment.requester.id === currentUserId && !currentUserIsAdmin)}
                      onClick={() => void reviewAdjustment(adjustment.id, "reject")}
                    >
                      Tolak
                    </button>
                  </div>
                )}
              </article>
            ))}
            {filteredAdjustments.length === 0 && (
              <EmptyState
                message={
                  adjustments.length === 0
                    ? "Belum ada pengajuan adjustment. Pengajuan baru muncul di sini setelah diajukan pada tab Catat Transaksi."
                    : `Tidak ada adjustment berstatus ${adjustmentStatus}.`
                }
              />
            )}
          </div>
        </section>
      )}

      {tab === "pemetaan" && canMap && (
        <div className="space-y-6">
          <section className={cardCls}>
            <h2 className="text-base font-semibold text-[#1E3A5F]">Pemetaan lokasi</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Gudang dan divisi harus dipetakan menjadi lokasi ledger terlebih dahulu agar stok dapat
              dicatat. Lokasi legacy tidak dibuat otomatis.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#1F2937]">Gudang</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-slate-600">
                    {unmappedWarehouses.length} belum dipetakan
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {unmappedWarehouses.map((row) => (
                    <div key={row.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2">
                      <span className="text-sm">{row.kode} · {row.name}</span>
                      <button className={primaryBtn} type="button" onClick={() => void mapLocation("warehouse", row.id)}>Petakan</button>
                    </div>
                  ))}
                  {unmappedWarehouses.length === 0 && (
                    <p className="text-sm text-slate-500">Semua gudang sudah dipetakan.</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[#1F2937]">Divisi</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-slate-600">
                    {unmappedDivisions.length} belum dipetakan
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {unmappedDivisions.map((row) => (
                    <div key={row.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2">
                      <span className="text-sm">{row.nama}</span>
                      <button className={primaryBtn} type="button" onClick={() => void mapLocation("division", row.id)}>Petakan</button>
                    </div>
                  ))}
                  {unmappedDivisions.length === 0 && (
                    <p className="text-sm text-slate-500">Semua divisi sudah dipetakan.</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className={cardCls}>
            <h2 className="text-base font-semibold text-[#1E3A5F]">Pemetaan saldo item legacy</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Pilih lokasi yang benar untuk saldo lama. Saldo dicatat satu kali sebagai saldo pembuka;
              saldo negatif perlu direkonsiliasi terlebih dahulu.
            </p>
            <div className="mt-4 space-y-2">
              {unmappedItems.map((item) => (
                <div key={item.id} className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-[minmax(0,1fr)_14rem_auto] md:items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1F2937]">{item.kode} · {item.nama}</p>
                    <p className={`text-xs ${item.legacyBalance < 0 ? "font-semibold text-red-700" : "text-slate-500"}`}>
                      legacy: {item.legacyBalance.toLocaleString("id-ID")} {item.unit}
                      {item.jenis ? ` · ${item.jenis}` : ""}
                    </p>
                  </div>
                  <select
                    className={inputCls}
                    aria-label={`Lokasi untuk ${item.kode}`}
                    value={itemLocationIds[item.id] ?? ""}
                    onChange={(event) => setItemLocationIds((current) => ({ ...current, [item.id]: event.target.value }))}
                  >
                    <option value="">Pilih lokasi</option>
                    {activeLocationOptions.map((location) => (
                      <option key={location.id} value={location.id}>{location.label}</option>
                    ))}
                  </select>
                  <button
                    className={primaryBtn}
                    type="button"
                    disabled={busy || item.legacyBalance < 0}
                    title={item.legacyBalance < 0 ? "Saldo legacy negatif: rekonsiliasi dulu sebelum dipetakan" : undefined}
                    onClick={() => void mapLegacyItem(item.id)}
                  >
                    Petakan item
                  </button>
                </div>
              ))}
              {unmappedItems.length === 0 && (
                <EmptyState message="Tidak ada saldo legacy item yang menunggu pemetaan." />
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
