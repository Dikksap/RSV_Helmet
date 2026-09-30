import { useEffect, useState } from "react";
import {
  getProductionOrderSummary,
  getProductionSchedule,
  getRealisasi,
  type ProductionOrderListItem,
  type ProductionOrderSummary,
  type ProductionSchedule,
  type RealisasiRow,
  type RealisasiStageRow,
} from "../../../api/productionOrders";
import DashboardTab from "../RealisasiProduksi/DashboardTab";

interface Props {
  orderId: number | null;
  orders: ProductionOrderListItem[];
}

export default function ProductionDashboardTab({ orderId, orders }: Props) {
  const [orderData, setOrderData] = useState<{ summary: ProductionOrderSummary; schedule: ProductionSchedule } | null>(null);
  const [dashRows, setDashRows] = useState<RealisasiRow[]>([]);
  const [dashTahap, setDashTahap] = useState<RealisasiStageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState("");

  useEffect(() => {
    if (orderId === null) return;
    setLoading(true);
    Promise.all([getProductionOrderSummary(orderId), getProductionSchedule(orderId), getRealisasi(orderId)])
      .then(([summary, schedule, real]) => {
        setOrderData({ summary, schedule });
        setDashRows(real.realisasi);
        setDashTahap(real.tahapan ?? []);
        setLastUpdate(new Date().toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " WIB");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orderId]);

  if (orderId === null) return <p className="rounded-2xl bg-white p-6 text-center text-sm text-[#6B7280] ring-1 ring-slate-200/70">Pilih order terlebih dahulu.</p>;

  return (
    <DashboardTab
      orderData={orderData}
      orders={orders}
      orderId={orderId}
      dashRows={dashRows}
      dashTahap={dashTahap}
      dashLoading={loading}
      loadingOrder={loading}
      lastUpdate={lastUpdate}
    />
  );
}
