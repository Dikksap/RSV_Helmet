import { useCallback, useEffect, useRef, useState } from "react";
import {
  getProductionOrders,
  getProductionOrderSummary,
  getProductionCapacities,
  deleteOrder,
  type ProductionOrderListItem,
  type ProductionOrderSummary,
  type ProductionCapacity,
} from "../api/productionOrders";
import MasterTab from "../components/PlanProduction/MasterTab";
import CapacityTab from "../components/PlanProduction/CapacityTab";
import ScheduleTab from "../components/PlanProduction/ScheduleTab";
import SummaryTab from "../components/PlanProduction/SummaryTab";
import SpkTab from "../components/PlanProduction/SpkTab";
import CreateOrderModal from "../components/PlanProduction/CreateOrderModal";
import { TABS, fmt, STATUS_STYLE, type Tab } from "../components/PlanProduction/utils";

const PANEL_CARD = "rounded-xl bg-white p-6 text-center text-[#6B7280] shadow-[0_4px_20px_rgba(0,0,0,0.06)]";

export default function PlanProduction() {
  const [tab, setTab] = useState<Tab>("orders");
  const [orders, setOrders] = useState<ProductionOrderListItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailOf, setDetailOf] = useState<{ id: number; data: ProductionOrderSummary } | null>(null);
  const [capOf, setCapOf] = useState<{ id: number; data: ProductionCapacity[] } | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingCapacities, setLoadingCapacities] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  // Nomor urut per loader — respons telat / dari order lama dibuang.
  const listReq = useRef(0);
  const detailReq = useRef(0);
  const capReq = useRef(0);

  // Data detail melekat pada order yang men-fetch-nya; hasil order lama tak
  // boleh nongol di order baru (kunci anti-kedip, bukan efek reset).
  const detail = detailOf && detailOf.id === selectedId ? detailOf.data : null;
  const capacities = capOf && capOf.id === selectedId ? capOf.data : [];

  const loadList = useCallback((selectId?: number) => {
    const req = ++listReq.current;
    setError(null);
    setLoadingList(true);
    getProductionOrders()
      .then((res) => {
        if (req !== listReq.current) return;
        setOrders(res);
        if (res.length === 0) setSelectedId(null);
        else if (selectId !== undefined) setSelectedId(selectId);
        else setSelectedId((prev) => (prev === null ? res[0].id : prev));
      })
      .catch((e) => {
        if (req !== listReq.current) return;
        setError(e instanceof Error ? e.message : "Gagal memuat production order.");
      })
      .finally(() => {
        if (req === listReq.current) setLoadingList(false);
      });
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  // silent = sinkronisasi latar tanpa spinner (lepas edit cell).
  // Tab lain sudah fetch summary sendiri → jangan dobel.
  const reloadDetail = useCallback(
    (silent = false) => {
      if (tab !== "master" && tab !== "kapasitas") return;
      if (selectedId === null) return;
      const id = selectedId;
      const req = ++detailReq.current;
      setError(null);
      if (!silent) setLoadingDetail(true);
      getProductionOrderSummary(id)
        .then((res) => {
          if (req !== detailReq.current) return;
          setDetailOf({ id, data: res });
        })
        .catch((e) => {
          if (req !== detailReq.current) return;
          setError(e instanceof Error ? e.message : "Gagal memuat detail order.");
        })
        .finally(() => {
          if (req === detailReq.current) setLoadingDetail(false);
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
      if (!silent) setLoadingCapacities(true);
      getProductionCapacities(id)
        .then((res) => {
          if (req !== capReq.current) return;
          setCapOf({ id, data: res });
        })
        .catch((e) => {
          if (req !== capReq.current) return;
          setError(e instanceof Error ? e.message : "Gagal memuat kapasitas produksi.");
        })
        .finally(() => {
          if (req === capReq.current) setLoadingCapacities(false);
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
      if (id === selectedId) setSelectedId(null);
      loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus order");
    }
  };

  const pickOrder = (id: number) => {
    setSelectedId(id);
    setTab("master");
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">
            Barang Produksi
          </p>
          <h1 className="text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">
            Plan Production
          </h1>
          <p className="mt-2 text-base text-[#6B7280]">
            Rencana produksi per periode dari <span className="font-mono text-sm">GET /api/production-orders</span>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-[#00A8E8] px-4 py-2.5 text-[15px] font-medium text-white transition hover:bg-[#0088C0]"
          >
            + Buat Order
          </button>
          <label className="flex items-center gap-2 text-sm font-medium text-[#1F2937]">
            Periode
            <select
              value={selectedId ?? ""}
              onChange={(e) => {
                const id = Number(e.target.value);
                if (Number.isFinite(id)) setSelectedId(id);
              }}
              disabled={loadingList || orders.length === 0}
              className="rounded-lg border border-[#D1D5DB] bg-white px-3 py-2.5 text-[15px] focus:outline-2 focus:outline-[#00A8E8] disabled:opacity-40"
            >
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nomor} · {o.periode} ({fmt(o.totalQty)} pcs)
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div aria-live="polite" className="space-y-3">
        {error && (
          <p role="alert" className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-[#EF4444]">
            {error}
          </p>
        )}
      </div>

      <nav className="flex flex-wrap gap-2" role="tablist" aria-label="Tab plan production">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              id={`plan-${t.key}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="plan-panel"
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-4 py-2.5 text-[15px] font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-[#00A8E8] ${
                active
                  ? "bg-[#1E3A5F] text-white"
                  : "bg-white text-[#6B7280] ring-1 ring-slate-200/70 hover:bg-[#F5F7FA] hover:text-[#1F2937]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      <div id="plan-panel" role="tabpanel" aria-labelledby={`plan-${tab}`}>
        {tab === "orders" && (
          <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <h3 className="font-semibold text-[#1E3A5F]">Daftar Orders ({orders.length})</h3>
              <button
                type="button"
                onClick={openCreate}
                className="rounded-lg bg-[#00A8E8] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#0088C0]"
              >
                + Buat Order
              </button>
            </div>
            {loadingList ? (
              <p className="animate-pulse p-6 text-[15px] text-[#6B7280]">Memuat orders...</p>
            ) : orders.length === 0 ? (
              <p className="p-6 text-center text-[#6B7280]">Belum ada production order.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {orders.map((o) => (
                  <article
                    key={o.id}
                    className={`flex flex-col rounded-xl ring-1 transition hover:shadow-[0_4px_20px_rgba(0,0,0,0.1)] ${
                      o.id === selectedId ? "bg-[#00A8E8]/5 ring-2 ring-[#00A8E8]" : "bg-white ring-slate-200/70"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 p-4 pb-0">
                      <div className="min-w-0">
                        <h4 className="truncate font-mono font-bold text-[#1E3A5F]">{o.nomor}</h4>
                        <p className="truncate text-sm text-[#6B7280]">
                          {o.periode}{o.label ? ` · ${o.label}` : ""}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${STATUS_STYLE[o.status] ?? STATUS_STYLE.DRAFT}`}>
                        {o.status}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-4 px-4 pt-3">
                      <p className="text-2xl font-bold tabular-nums text-[#1E3A5F]">{fmt(o.totalQty)}</p>
                      <p className="text-xs uppercase tracking-wide text-[#6B7280]">pcs · {o._count.items} items</p>
                    </div>
                    <div className="mt-auto flex gap-2 p-4 pt-3">
                      {deleteTarget === o.id ? (
                        <>
                          <span className="flex-1 self-center text-sm font-medium text-[#EF4444]">Hapus order ini?</span>
                          <button
                            type="button"
                            onClick={() => void removeOrder(o.id)}
                            className="rounded-lg bg-[#EF4444] px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600"
                          >
                            Ya
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(null)}
                            className="rounded-lg bg-slate-200 px-3 py-1.5 text-sm font-medium text-[#1F2937] hover:bg-slate-300"
                          >
                            Batal
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => pickOrder(o.id)}
                            className="flex-1 rounded-lg bg-[#1E3A5F] px-3 py-2 text-sm font-medium text-white hover:bg-[#162942]"
                          >
                            Buka
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(o.id)}
                            className="rounded-lg px-3 py-2 text-sm font-medium text-[#6B7280] ring-1 ring-slate-200/70 hover:bg-red-50 hover:text-[#EF4444]"
                          >
                            Hapus
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "jadwal" && <ScheduleTab orderId={selectedId} />}

        {tab === "spk" && <SpkTab orderId={selectedId} />}

        {tab === "ringkasan" && <SummaryTab orderId={selectedId} />}

        {tab === "manpower" && (
          <p className={PANEL_CARD}>Halaman Man Power belum tersedia.</p>
        )}

        {tab === "kapasitas" &&
          (selectedId === null ? (
            <p className={PANEL_CARD}>Pilih order dulu untuk mengatur kapasitas produksi.</p>
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
          ))}

        {tab === "master" &&
          (selectedId === null ? (
            <p className={PANEL_CARD}>Pilih order dulu untuk mengelola Master Produksi.</p>
          ) : detail ? (
            <MasterTab
              orderId={selectedId}
              detail={detail}
              loading={loadingDetail}
              onChanged={() => reloadDetail(true)}
            />
          ) : (
            <p className={`${PANEL_CARD} animate-pulse`}>Memuat detail order...</p>
          ))}
      </div>

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
