import { useCallback, useEffect, useState } from "react";
import {
  getProductionOrders,
  getProductionOrderSummary,
  getProductionCapacities,
  type ProductionOrderListItem,
  type ProductionOrderSummary,
  type ProductionCapacity,
} from "../api/productionOrders";
import MasterTab from "../components/PlanProduction/MasterTab";
import CapacityTab from "../components/PlanProduction/CapacityTab";
import ScheduleTab from "../components/PlanProduction/ScheduleTab";
import SummaryTab from "../components/PlanProduction/SummaryTab";
import { TABS, fmt, type Tab } from "../components/PlanProduction/utils";

export default function PlanProduction() {
  const [tab, setTab] = useState<Tab>("master");
  const [orders, setOrders] = useState<ProductionOrderListItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ProductionOrderSummary | null>(null);
  const [capacities, setCapacities] = useState<ProductionCapacity[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingCapacities, setLoadingCapacities] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProductionOrders()
      .then((res) => {
        setOrders(res);
        setError(null);
        if (res.length > 0) setSelectedId(res[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat production order."))
      .finally(() => setLoadingList(false));
  }, []);

  // silent = sinkronisasi latar tanpa spinner (lepas edit cell).
  const reloadDetail = useCallback(
    (silent = false) => {
      if (selectedId === null) return;
      if (!silent) setLoadingDetail(true);
      getProductionOrderSummary(selectedId)
        .then((res) => {
          setDetail(res);
          setError(null);
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat detail order."))
        .finally(() => setLoadingDetail(false));
    },
    [selectedId],
  );

  useEffect(() => {
    reloadDetail(false);
  }, [reloadDetail]);

  const reloadCapacities = useCallback(
    (silent = false) => {
      if (tab !== "kapasitas" || selectedId === null) return;
      if (!silent) setLoadingCapacities(true);
      getProductionCapacities(selectedId)
        .then((res) => {
          setCapacities(res);
          setError(null);
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat kapasitas produksi."))
        .finally(() => setLoadingCapacities(false));
    },
    [tab, selectedId],
  );

  useEffect(() => {
    reloadCapacities(false);
  }, [reloadCapacities]);

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
        <label className="flex items-center gap-2 text-sm font-medium text-[#1F2937]">
          Periode
          <select
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(Number(e.target.value))}
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
      </header>

      <div aria-live="polite" className="space-y-3">
        {loadingList && <p className="animate-pulse text-[15px] text-[#6B7280]">Memuat plan production...</p>}
        {error && (
          <p role="alert" className="rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-3 text-[#EF4444]">
            {error}
          </p>
        )}
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Tab plan production">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-pressed={active}
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

      {tab === "jadwal" && <ScheduleTab orderId={selectedId} />}

      {tab === "ringkasan" && <SummaryTab orderId={selectedId} />}

      {tab === "manpower" && (
        <p className="rounded-xl bg-white p-6 text-center text-[#6B7280] shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          Halaman Man Power belum tersedia.
        </p>
      )}

      {tab === "kapasitas" && selectedId !== null && (
        <CapacityTab
          orderId={selectedId}
          detail={detail}
          capacities={capacities}
          loading={loadingCapacities}
          onChanged={() => reloadCapacities(true)}
        />
      )}

      {tab === "master" && !loadingList && !error && orders.length === 0 && (
        <p className="rounded-xl bg-white p-6 text-center text-[#6B7280] shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          Belum ada production order. Jalankan seed atau buat via <span className="font-mono text-sm">POST /api/production-orders</span>.
        </p>
      )}

      {tab === "master" && detail && selectedId !== null && (
        <MasterTab orderId={selectedId} detail={detail} loading={loadingDetail} onChanged={() => reloadDetail(true)} />
      )}
    </div>
  );
}
