import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxesStacked,
  faClipboardList,
  faGear,
  faTrash,
  faUsers,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";

import {
  deleteOrder,
  getProductionCapacities,
  getProductionOrders,
  getProductionOrderSummary,
  type ProductionCapacity,
  type ProductionOrderListItem,
  type ProductionOrderSummary,
} from "../../api/productionOrders";
import MasterTab from "../../components/admin/PlanProduction/MasterTab";
import CapacityTab from "../../components/admin/PlanProduction/CapacityTab";
import ScheduleTab from "../../components/admin/PlanProduction/ScheduleTab";
import SummaryTab from "../../components/admin/PlanProduction/SummaryTab";
import ProductionDashboardTab from "../../components/admin/PlanProduction/ProductionDashboardTab";
import CreateOrderModal from "../../components/admin/PlanProduction/CreateOrderModal";
import {
  TABS,
  fmt,
  STATUS_STYLE,
  type Tab,
} from "../../components/admin/PlanProduction/utils";

const BASE = "/admin/plan-production";
const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/50";
const CARD = "rounded-2xl border border-slate-200 bg-white";
const BTN = `inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
const BTN_PRIMARY = `${BTN} bg-[#1E3A5F] text-white hover:bg-[#162C48]`;
const BTN_GHOST = `${BTN} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;

const errMsg = (e: unknown, fallback: string) =>
  e instanceof Error ? e.message : fallback;

function StatusBadge({
  status,
}: {
  status: ProductionOrderListItem["status"];
}) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[status] ?? STATUS_STYLE.DRAFT}`}
    >
      {status}
    </span>
  );
}

function EmptyPanel({
  icon,
  title,
  desc,
  action,
}: {
  icon: IconDefinition;
  title: string;
  desc: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={`${CARD} flex flex-col items-center px-6 py-14 text-center`}
    >
      <span className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">
        <FontAwesomeIcon icon={icon} className="h-5 w-5" />
      </span>
      <h3 className="font-semibold text-[#1E3A5F]">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{desc}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function ErrorBanner({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      <span className="flex-1">{msg}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Tutup pesan"
        className={`shrink-0 rounded px-1 text-red-400 hover:text-red-600 ${FOCUS}`}
      >
        ✕
      </button>
    </div>
  );
}

type OrdersPanelProps = {
  orders: ProductionOrderListItem[];
  loading: boolean;
  selectedId: number | null;
  deleteTarget: number | null;
  deletingId: number | null;
  onCreate: () => void;
  onOpen: (id: number) => void;
  onAskDelete: (id: number | null) => void;
  onDelete: (id: number) => void;
};

function OrdersPanel({
  orders,
  loading,
  selectedId,
  deleteTarget,
  deletingId,
  onCreate,
  onOpen,
  onAskDelete,
  onDelete,
}: OrdersPanelProps) {
  if (loading && orders.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`${CARD} h-44 animate-pulse`} />
        ))}
      </div>
    );
  }
  if (orders.length === 0) {
    return (
      <EmptyPanel
        icon={faClipboardList}
        title="Belum ada Production Order"
        desc="Buat production order baru untuk mulai menyusun rencana produksi."
        action={
          <button type="button" onClick={onCreate} className={BTN_PRIMARY}>
            + Buat Order
          </button>
        }
      />
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {orders.map((o) => {
        const isActive = o.id === selectedId;
        const confirming = deleteTarget === o.id;
        const deleting = deletingId === o.id;
        return (
          <article
            key={o.id}
            className={`flex flex-col rounded-2xl border bg-white p-4 transition ${
              isActive
                ? "border-[#00A8E8] ring-2 ring-[#00A8E8]/20"
                : "border-slate-200 hover:border-[#00A8E8]/40 hover:shadow-[0_8px_24px_rgba(15,28,46,0.08)]"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-mono text-[15px] font-bold text-[#1E3A5F]">
                  {o.nomor}
                </h3>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {o.periode}
                  {o.label ? ` · ${o.label}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {isActive && (
                  <span className="rounded-full bg-[#00A8E8]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#0088C0]">
                    Aktif
                  </span>
                )}
                <StatusBadge status={o.status} />
              </div>
            </div>

            <div className="mt-4 flex items-end justify-between rounded-xl bg-slate-50 px-4 py-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Total produksi
                </p>
                <p className="mt-0.5 text-xl font-bold tabular-nums text-[#1E3A5F]">
                  {fmt(o.totalQty)}{" "}
                  <span className="text-sm font-medium text-slate-400">
                    pcs
                  </span>
                </p>
              </div>
              <p className="text-right text-sm text-slate-500">
                <span className="block text-lg font-bold text-[#0088C0]">
                  {o._count.items}
                </span>
                item
              </p>
            </div>

            <div className="mt-4 flex gap-2">
              {confirming ? (
                <>
                  <span className="flex flex-1 items-center text-sm font-medium text-red-600">
                    Hapus order ini?
                  </span>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => onDelete(o.id)}
                    className={`${BTN} h-9 bg-[#EF4444] text-white hover:bg-red-600`}
                  >
                    {deleting ? "Menghapus…" : "Ya"}
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => onAskDelete(null)}
                    className={`${BTN_GHOST} h-9`}
                  >
                    Batal
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onOpen(o.id)}
                    className={`${BTN_PRIMARY} h-9 flex-1`}
                  >
                    Buka order
                  </button>
                  <button
                    type="button"
                    onClick={() => onAskDelete(o.id)}
                    aria-label={`Hapus ${o.nomor}`}
                    title="Hapus order"
                    className={`${BTN_GHOST} h-9 w-10 px-0 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-[#EF4444]`}
                  >
                    <FontAwesomeIcon icon={faTrash} className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default function PlanProduction() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [orders, setOrders] = useState<ProductionOrderListItem[]>([]);
  const [detailOf, setDetailOf] = useState<{
    id: number;
    data: ProductionOrderSummary;
  } | null>(null);
  const [capOf, setCapOf] = useState<{
    id: number;
    data: ProductionCapacity[];
  } | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [capError, setCapError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const listReq = useRef(0);
  const detailReq = useRef(0);
  const capReq = useRef(0);

  const paramId = Number(searchParams.get("order")) || null;
  const selectedId =
    orders.length === 0
      ? loadingList
        ? paramId
        : null
      : orders.some((o) => o.id === paramId)
        ? paramId
        : orders[0].id;
  const selectedOrder = orders.find((o) => o.id === selectedId);
  const detail = detailOf && detailOf.id === selectedId ? detailOf.data : null;
  const capacities = capOf && capOf.id === selectedId ? capOf.data : [];
  const loadingDetail =
    selectedId !== null && !detailError && detailOf?.id !== selectedId;
  const loadingCapacities =
    selectedId !== null && !capError && capOf?.id !== selectedId;

  const seg = location.pathname.split("/").filter(Boolean).pop() ?? "";
  const tab = (TABS.some((t) => t.key === seg) ? seg : "orders") as Tab;

  const writeOrderParam = useCallback(
    (id: number | null, replace = false) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id === null) next.delete("order");
          else next.set("order", String(id));
          return next;
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  const selectOrder = (id: number | null, replace = false) => {
    setDeleteTarget(null);
    writeOrderParam(id, replace);
  };

  const loadList = useCallback(() => {
    const req = ++listReq.current;
    return getProductionOrders()
      .then((res) => {
        if (req !== listReq.current) return;
        setOrders(res);
        setListError(null);
      })
      .catch((e) => {
        if (req === listReq.current)
          setListError(errMsg(e, "Gagal memuat production order."));
      })
      .finally(() => {
        if (req === listReq.current) setLoadingList(false);
      });
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!loadingList && orders.length > 0 && selectedId !== paramId)
      writeOrderParam(selectedId, true);
  }, [loadingList, orders.length, selectedId, paramId, writeOrderParam]);

  const reloadDetail = useCallback(() => {
    if ((tab !== "master" && tab !== "kapasitas") || selectedId === null)
      return;
    const id = selectedId;
    const req = ++detailReq.current;
    getProductionOrderSummary(id)
      .then((res) => {
        if (req !== detailReq.current) return;
        setDetailOf({ id, data: res });
        setDetailError(null);
      })
      .catch((e) => {
        if (req === detailReq.current)
          setDetailError(errMsg(e, "Gagal memuat detail order."));
      });
  }, [tab, selectedId]);

  useEffect(() => {
    reloadDetail();
  }, [reloadDetail]);

  const reloadCapacities = useCallback(() => {
    if (tab !== "kapasitas" || selectedId === null) return;
    const id = selectedId;
    const req = ++capReq.current;
    getProductionCapacities(id)
      .then((res) => {
        if (req !== capReq.current) return;
        setCapOf({ id, data: res });
        setCapError(null);
      })
      .catch((e) => {
        if (req === capReq.current)
          setCapError(errMsg(e, "Gagal memuat kapasitas produksi."));
      });
  }, [tab, selectedId]);

  useEffect(() => {
    reloadCapacities();
  }, [reloadCapacities]);

  const removeOrder = async (id: number) => {
    if (deletingId !== null) return;
    setDeletingId(id);
    try {
      await deleteOrder(id);
      setDeleteTarget(null);
      if (id === selectedId) selectOrder(null, true);
      await loadList();
    } catch (e) {
      setListError(errMsg(e, "Gagal menghapus order"));
    } finally {
      setDeletingId(null);
    }
  };

  const openOrder = (id: number) => {
    setDeleteTarget(null);
    navigate({ pathname: `${BASE}/master`, search: `?order=${id}` });
  };

  const needOrder = (icon: IconDefinition, title: string) => (
    <EmptyPanel
      icon={icon}
      title={title}
      desc={`Pilih order terlebih dahulu untuk membuka ${title}.`}
    />
  );

  const ordersPanel = (
    <OrdersPanel
      orders={orders}
      loading={loadingList}
      selectedId={selectedId}
      deleteTarget={deleteTarget}
      deletingId={deletingId}
      onCreate={() => setCreateOpen(true)}
      onOpen={openOrder}
      onAskDelete={setDeleteTarget}
      onDelete={(id) => void removeOrder(id)}
    />
  );

  const toOrders = (
    <Navigate
      to={{ pathname: `${BASE}/orders`, search: location.search }}
      replace
    />
  );

  return (
    <div className="min-h-full space-y-4">
      <header className={`${CARD} px-5 py-4 sm:px-6`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0088C0]">
              Perencanaan Produksi
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1E3A5F]">
              Plan Production
            </h1>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="sr-only" htmlFor="order-select">
              Production order aktif
            </label>
            <select
              id="order-select"
              value={selectedId ?? ""}
              onChange={(e) => selectOrder(Number(e.target.value))}
              disabled={orders.length === 0}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-[#1E3A5F] focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20 disabled:opacity-50 sm:w-80"
            >
              {orders.length === 0 && <option value="">Belum ada order</option>}
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nomor} · {o.periode}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className={BTN_PRIMARY}
            >
              + Buat Order
            </button>
          </div>
        </div>

        {selectedOrder && (
          <dl className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-100 pt-3 text-sm">
            {[
              [
                "Order",
                <span className="font-mono font-bold text-[#1E3A5F]">
                  {selectedOrder.nomor}
                </span>,
              ],
              ["Periode", selectedOrder.periode],
              ["Total", `${fmt(selectedOrder.totalQty)} pcs`],
              ["Item", `${selectedOrder._count.items} item`],
            ].map(([k, v]) => (
              <div key={k as string} className="flex items-baseline gap-2">
                <dt className="text-[11px] uppercase tracking-wide text-slate-400">
                  {k}
                </dt>
                <dd className="font-semibold text-slate-700">{v}</dd>
              </div>
            ))}
            <div className="ml-auto">
              <StatusBadge status={selectedOrder.status} />
            </div>
          </dl>
        )}
      </header>

      {(listError || detailError || capError) && (
        <div className="space-y-2" aria-live="polite">
          {listError && (
            <ErrorBanner msg={listError} onClose={() => setListError(null)} />
          )}
          {detailError && (
            <ErrorBanner
              msg={detailError}
              onClose={() => setDetailError(null)}
            />
          )}
          {capError && (
            <ErrorBanner msg={capError} onClose={() => setCapError(null)} />
          )}
        </div>
      )}

      <nav
        aria-label="Tab plan production"
        className={`${CARD} overflow-x-auto p-1.5`}
      >
        <div className="flex min-w-max gap-1">
          {TABS.map((t) => (
            <NavLink
              key={t.key}
              to={{ pathname: `${BASE}/${t.key}`, search: location.search }}
              className={({ isActive }) =>
                `rounded-xl px-4 py-2 text-sm font-semibold transition ${FOCUS} ${
                  isActive
                    ? "bg-[#1E3A5F] text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-[#1E3A5F]"
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <Routes>
        <Route index element={toOrders} />
        <Route path="orders" element={ordersPanel} />
        <Route
          path="dashboard"
          element={
            <ProductionDashboardTab orderId={selectedId} orders={orders} />
          }
        />
        <Route path="jadwal" element={<ScheduleTab orderId={selectedId} />} />
        <Route path="ringkasan" element={<SummaryTab orderId={selectedId} />} />
        <Route
          path="manpower"
          element={
            <EmptyPanel
              icon={faUsers}
              title="Man Power"
              desc="Halaman Man Power belum tersedia."
            />
          }
        />
        <Route
          path="kapasitas"
          element={
            selectedId === null ? (
              needOrder(faGear, "Kapasitas Produksi")
            ) : (
              <CapacityTab
                orderId={selectedId}
                detail={detail}
                capacities={capacities}
                loading={loadingCapacities}
                onChanged={() => {
                  reloadCapacities();
                  reloadDetail();
                  void loadList();
                }}
              />
            )
          }
        />
        <Route
          path="master"
          element={
            selectedId === null ? (
              needOrder(faBoxesStacked, "Master Produksi")
            ) : detail ? (
              <MasterTab
                orderId={selectedId}
                detail={detail}
                loading={loadingDetail}
                onChanged={() => {
                  reloadDetail();
                  void loadList();
                }}
              />
            ) : (
              <div
                className={`${CARD} h-64 animate-pulse`}
                aria-label="Memuat detail order"
              />
            )
          }
        />
        <Route path="*" element={toOrders} />
      </Routes>

      {createOpen && (
        <CreateOrderModal
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false);
            void loadList().then(() => selectOrder(id));
          }}
        />
      )}
    </div>
  );
}
