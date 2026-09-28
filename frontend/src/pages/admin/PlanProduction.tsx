import { useCallback, useEffect, useRef, useState } from "react";

import {
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  getProductionOrders,
  getProductionOrderSummary,
  getProductionCapacities,
  deleteOrder,
  type ProductionOrderListItem,
  type ProductionOrderSummary,
  type ProductionCapacity,
} from "../../api/productionOrders";

import MasterTab from "../../components/admin/PlanProduction/MasterTab";
import CapacityTab from "../../components/admin/PlanProduction/CapacityTab";
import ScheduleTab from "../../components/admin/PlanProduction/ScheduleTab";
import SummaryTab from "../../components/admin/PlanProduction/SummaryTab";
import CreateOrderModal from "../../components/admin/PlanProduction/CreateOrderModal";

import {
  TABS,
  fmt,
  STATUS_STYLE,
  type Tab,
} from "../../components/admin/PlanProduction/utils";

const PANEL_CARD =
  "rounded-2xl bg-white p-6 text-center text-[#6B7280] shadow-[0_2px_14px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/70";

interface OrdersPanelProps {
  orders: ProductionOrderListItem[];
  loadingList: boolean;
  selectedId: number | null;
  deleteTarget: number | null;
  openCreate: () => void;
  removeOrder: (id: number) => void;
  setDeleteTarget: (id: number | null) => void;
  pickOrder: (id: number) => void;
}

function OrdersPanel({
  orders,
  loadingList,
  selectedId,
  deleteTarget,
  openCreate,
  removeOrder,
  setDeleteTarget,
  pickOrder,
}: OrdersPanelProps) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_16px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/70">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[16px] font-bold text-[#1E3A5F]">
            Daftar Production Order
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Kelola order produksi yang tersedia
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#00A8E8] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0088C0] active:scale-[0.98]"
        >
          <span className="text-lg leading-none">+</span>
          Buat Order
        </button>
      </div>

      {loadingList ? (
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-[190px] animate-pulse rounded-xl bg-slate-100"
            />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
            📋
          </div>

          <h4 className="font-semibold text-[#1E3A5F]">
            Belum ada Production Order
          </h4>

          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Buat production order baru untuk mulai menyusun rencana produksi.
          </p>

          <button
            type="button"
            onClick={openCreate}
            className="mt-5 rounded-xl bg-[#00A8E8] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0088C0]"
          >
            + Buat Order
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {orders.map((o) => {
            const isSelected = o.id === selectedId;

            return (
              <article
                key={o.id}
                className={[
                  "group flex min-h-[205px] flex-col overflow-hidden rounded-2xl border bg-white transition-all duration-200",
                  isSelected
                    ? "border-[#00A8E8] shadow-[0_6px_24px_rgba(0,168,232,0.12)]"
                    : "border-slate-200/80 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_6px_20px_rgba(15,23,42,0.07)]",
                ].join(" ")}
              >
                {/* Selected indicator */}
                {isSelected && <div className="h-1 w-full bg-[#00A8E8]" />}

                <div className="flex flex-1 flex-col p-4">
                  {/* Top */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Production Order
                      </p>

                      <h4 className="truncate font-mono text-[15px] font-bold text-[#1E3A5F]">
                        {o.nomor}
                      </h4>

                      <p className="mt-1 truncate text-xs text-slate-500">
                        {o.periode}
                        {o.label ? ` · ${o.label}` : ""}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                        STATUS_STYLE[o.status] ?? STATUS_STYLE.DRAFT
                      }`}
                    >
                      {o.status}
                    </span>
                  </div>

                  {/* Quantity */}
                  <div className="mt-5 flex items-end justify-between rounded-xl bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        Total Produksi
                      </p>

                      <p className="mt-1 text-2xl font-bold tabular-nums text-[#1E3A5F]">
                        {fmt(o.totalQty)}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-bold text-[#00A8E8]">
                        {o._count.items}
                      </p>

                      <p className="text-[10px] uppercase tracking-wide text-slate-400">
                        Item
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-auto flex gap-2 pt-4">
                    {deleteTarget === o.id ? (
                      <>
                        <div className="flex flex-1 items-center rounded-xl bg-red-50 px-3 text-xs font-semibold text-red-600">
                          Hapus order ini?
                        </div>

                        <button
                          type="button"
                          onClick={() => void removeOrder(o.id)}
                          className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600"
                        >
                          Ya
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteTarget(null)}
                          className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
                        >
                          Batal
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => pickOrder(o.id)}
                          className="flex-1 rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#162942] active:scale-[0.98]"
                        >
                          Buka Order
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteTarget(o.id)}
                          aria-label={`Hapus ${o.nomor}`}
                          className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                        >
                          🗑
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function PlanProduction() {
  const location = useLocation();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<ProductionOrderListItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [detailOf, setDetailOf] = useState<{
    id: number;
    data: ProductionOrderSummary;
  } | null>(null);

  const [capOf, setCapOf] = useState<{
    id: number;
    data: ProductionCapacity[];
  } | null>(null);

  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingCapacities, setLoadingCapacities] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const listReq = useRef(0);
  const detailReq = useRef(0);
  const capReq = useRef(0);

  const detail = detailOf && detailOf.id === selectedId ? detailOf.data : null;

  const capacities = capOf && capOf.id === selectedId ? capOf.data : [];

  const seg = location.pathname.split("/").filter(Boolean).pop() ?? "";

  const tab = (TABS.some((t) => t.key === seg) ? seg : "orders") as Tab;

  const loadList = useCallback((selectId?: number) => {
    const req = ++listReq.current;

    setError(null);
    setLoadingList(true);

    getProductionOrders()
      .then((res) => {
        if (req !== listReq.current) return;

        setOrders(res);

        if (res.length === 0) {
          setSelectedId(null);
        } else if (selectId !== undefined) {
          setSelectedId(selectId);
        } else {
          setSelectedId((prev) => (prev === null ? res[0].id : prev));
        }
      })
      .catch((e) => {
        if (req !== listReq.current) return;

        setError(
          e instanceof Error ? e.message : "Gagal memuat production order.",
        );
      })
      .finally(() => {
        if (req === listReq.current) {
          setLoadingList(false);
        }
      });
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const reloadDetail = useCallback(
    (silent = false) => {
      if (tab !== "master" && tab !== "kapasitas") return;
      if (selectedId === null) return;

      const id = selectedId;
      const req = ++detailReq.current;

      setError(null);

      if (!silent) {
        setLoadingDetail(true);
      }

      getProductionOrderSummary(id)
        .then((res) => {
          if (req !== detailReq.current) return;

          setDetailOf({
            id,
            data: res,
          });
        })
        .catch((e) => {
          if (req !== detailReq.current) return;

          setError(
            e instanceof Error ? e.message : "Gagal memuat detail order.",
          );
        })
        .finally(() => {
          if (req === detailReq.current) {
            setLoadingDetail(false);
          }
        });
    },
    [tab, selectedId],
  );

  useEffect(() => {
    reloadDetail(false);
  }, [reloadDetail]);

  const reloadCapacities = useCallback(
    (silent = false) => {
      if (tab !== "kapasitas" || selectedId === null) return;

      const id = selectedId;
      const req = ++capReq.current;

      setError(null);

      if (!silent) {
        setLoadingCapacities(true);
      }

      getProductionCapacities(id)
        .then((res) => {
          if (req !== capReq.current) return;

          setCapOf({
            id,
            data: res,
          });
        })
        .catch((e) => {
          if (req !== capReq.current) return;

          setError(
            e instanceof Error ? e.message : "Gagal memuat kapasitas produksi.",
          );
        })
        .finally(() => {
          if (req === capReq.current) {
            setLoadingCapacities(false);
          }
        });
    },
    [tab, selectedId],
  );

  useEffect(() => {
    reloadCapacities(false);
  }, [reloadCapacities]);

  useEffect(() => {
    setDeleteTarget(null);
  }, [selectedId]);

  const openCreate = () => setCreateOpen(true);

  const removeOrder = async (id: number) => {
    try {
      await deleteOrder(id);

      setDeleteTarget(null);

      if (id === selectedId) {
        setSelectedId(null);
      }

      loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus order");
    }
  };

  const pickOrder = (id: number) => {
    setSelectedId(id);
    navigate("/admin/plan-production/master");
  };

  const ordersPanelProps: OrdersPanelProps = {
    orders,
    loadingList,
    selectedId,
    deleteTarget,
    openCreate,
    removeOrder,
    setDeleteTarget,
    pickOrder,
  };

  const selectedOrder = orders.find((order) => order.id === selectedId);

  return (
    <div className="min-h-full space-y-5">
      {/* ================= HEADER ================= */}
      <header className="rounded-2xl bg-white px-5 py-5 shadow-[0_2px_14px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/70 sm:px-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          {/* Title */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#00A8E8]" />

              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#00A8E8]">
                Perencanaan Produksi
              </p>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-[#1E3A5F] sm:text-[30px]">
              Plan Production
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Kelola order, kapasitas, master produksi, dan jadwal produksi.
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 sm:min-w-[300px]">
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Production Order Aktif
              </label>

              <select
                value={selectedId ?? ""}
                onChange={(e) => {
                  const id = Number(e.target.value);

                  if (Number.isFinite(id)) {
                    setSelectedId(id);
                  }
                }}
                disabled={loadingList || orders.length === 0}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-10 text-sm font-medium text-[#1E3A5F] outline-none transition focus:border-[#00A8E8] focus:bg-white focus:ring-2 focus:ring-[#00A8E8]/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nomor} · {o.periode} ({fmt(o.totalQty)} pcs)
                  </option>
                ))}
              </select>

              <span className="pointer-events-none absolute bottom-2.5 right-3 text-slate-400">
                ▾
              </span>
            </div>

            <button
              type="button"
              onClick={openCreate}
              className="mt-auto inline-flex h-[42px] items-center justify-center gap-2 rounded-xl bg-[#00A8E8] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0088C0] active:scale-[0.98]"
            >
              <span className="text-lg leading-none">+</span>
              Buat Order
            </button>
          </div>
        </div>

        {/* Active order info */}
        {selectedOrder && (
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-4">
            <div>
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                Order
              </span>

              <p className="font-mono text-sm font-bold text-[#1E3A5F]">
                {selectedOrder.nomor}
              </p>
            </div>

            <div className="h-7 w-px bg-slate-200" />

            <div>
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                Periode
              </span>

              <p className="text-sm font-semibold text-slate-700">
                {selectedOrder.periode}
              </p>
            </div>

            <div className="h-7 w-px bg-slate-200" />

            <div>
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                Total
              </span>

              <p className="text-sm font-semibold text-slate-700">
                {fmt(selectedOrder.totalQty)} pcs
              </p>
            </div>

            <div className="h-7 w-px bg-slate-200" />

            <div>
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                Item
              </span>

              <p className="text-sm font-semibold text-slate-700">
                {selectedOrder._count.items} item
              </p>
            </div>

            <span
              className={`ml-auto rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${
                STATUS_STYLE[selectedOrder.status] ?? STATUS_STYLE.DRAFT
              }`}
            >
              {selectedOrder.status}
            </span>
          </div>
        )}
      </header>

      {/* ================= ERROR ================= */}
      <div aria-live="polite">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <span className="mt-0.5">⚠</span>

            <div>
              <p className="font-semibold">Terjadi kesalahan</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* ================= NAVIGATION ================= */}
      <nav
        className="overflow-x-auto rounded-2xl bg-white p-1.5 shadow-[0_2px_14px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/70"
        aria-label="Tab plan production"
      >
        <div className="flex min-w-max gap-1">
          {TABS.map((t) => (
            <NavLink
              key={t.key}
              to={`/admin/plan-production/${t.key}`}
              className={({ isActive }) =>
                [
                  "rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/30",
                  isActive
                    ? "bg-[#1E3A5F] text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-50 hover:text-[#1E3A5F]",
                ].join(" ")
              }
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* ================= CONTENT ================= */}
      <Routes>
        <Route index element={<OrdersPanel {...ordersPanelProps} />} />

        <Route path="orders" element={<OrdersPanel {...ordersPanelProps} />} />

        <Route path="jadwal" element={<ScheduleTab orderId={selectedId} />} />

        <Route path="ringkasan" element={<SummaryTab orderId={selectedId} />} />

        <Route
          path="manpower"
          element={
            <div className={PANEL_CARD}>
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xl">
                👥
              </div>

              <h3 className="font-semibold text-[#1E3A5F]">Man Power</h3>

              <p className="mt-1 text-sm">Halaman Man Power belum tersedia.</p>
            </div>
          }
        />

        <Route
          path="kapasitas"
          element={
            selectedId === null ? (
              <div className={PANEL_CARD}>
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xl">
                  ⚙️
                </div>

                <h3 className="font-semibold text-[#1E3A5F]">
                  Kapasitas Produksi
                </h3>

                <p className="mt-1 text-sm">
                  Pilih order terlebih dahulu untuk mengatur kapasitas produksi.
                </p>
              </div>
            ) : (
              <CapacityTab
                orderId={selectedId}
                detail={detail}
                capacities={capacities}
                loading={loadingCapacities}
                onChanged={() => {
                  reloadCapacities(true);
                  reloadDetail(true);
                }}
              />
            )
          }
        />

        <Route
          path="master"
          element={
            selectedId === null ? (
              <div className={PANEL_CARD}>
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xl">
                  📦
                </div>

                <h3 className="font-semibold text-[#1E3A5F]">
                  Master Produksi
                </h3>

                <p className="mt-1 text-sm">
                  Pilih order terlebih dahulu untuk mengelola Master Produksi.
                </p>
              </div>
            ) : detail ? (
              <MasterTab
                orderId={selectedId}
                detail={detail}
                loading={loadingDetail}
                onChanged={() => reloadDetail(true)}
              />
            ) : (
              <div className={`${PANEL_CARD} animate-pulse`}>
                Memuat detail order...
              </div>
            )
          }
        />

        <Route path="*" element={<OrdersPanel {...ordersPanelProps} />} />
      </Routes>

      {/* ================= CREATE MODAL ================= */}
      {createOpen && (
        <CreateOrderModal
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false);
            loadList(id);
          }}
        />
      )}
    </div>
  );
}
