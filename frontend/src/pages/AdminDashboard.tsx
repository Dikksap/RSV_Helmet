import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveSocketContext } from "../lib/LiveSocketContext";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxesStacked,
  faCartShopping,
  faChartPie,
  faEye,
  faUserCheck,
  faWallet,
} from "@fortawesome/free-solid-svg-icons";
import {
  getBarang,
  getBarangPage,
  getBarangStats,
  getFinishgoodPerBulan,
  type Barang,
  type FinishgoodPerBulan,
} from "../api/barang";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
);

const STATUS_LABEL: Record<string, string> = {
  REGISTER: "Register",
  FINISHGOOD: "Finish Good",
  RETUR: "Retur",
  OUT: "Out",
  BAD: "Bad",
};

const STATUS_COLOR: Record<string, string> = {
  REGISTER: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  FINISHGOOD: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  RETUR: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  OUT: "bg-brand-gold/10 text-brand-gold border-brand-gold/20",
  BAD: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

const STATUS_BAR: Record<string, string> = {
  REGISTER: "bg-amber-300",
  FINISHGOOD: "bg-emerald-400",
  RETUR: "bg-blue-400",
  OUT: "bg-brand-gold",
  BAD: "bg-rose-400",
};

const CHART_TOOLTIP = {
  backgroundColor: "#141416",
  titleColor: "#FFFFFF",
  bodyColor: "#9B9B9C",
  borderColor: "#232326",
  borderWidth: 1,
  padding: 10,
};

function isToday(dateString: string | null | undefined): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function AdminDashboard() {
  const [stats, setStats] = useState<{
    total: number;
    perStatus: Record<string, number>;
    perBatch: Array<{ nomorBatch: string | number; total: number }>;
  } | null>(null);
  const [recent, setRecent] = useState<Barang[]>([]);
  const [perBulan, setPerBulan] = useState<FinishgoodPerBulan[]>([]);
  const [bulanTerpilih, setBulanTerpilih] = useState("");
  const [showToday, setShowToday] = useState(false);
  const [todayStats, setTodayStats] = useState<{
    total: number;
    finishGood: number;
    proses: number;
    batch: number;
  }>({ total: 0, finishGood: 0, proses: 0, batch: 0 });

  const tahunSekarang = new Date().getFullYear();
  const bulanTerpilihNum = bulanTerpilih ? Number(bulanTerpilih) : 0;
  const tanggalAwalBulan = bulanTerpilihNum
    ? `${tahunSekarang}-${String(bulanTerpilihNum).padStart(2, "0")}-01`
    : undefined;
  const tanggalAkhirBulan = bulanTerpilihNum
    ? `${tahunSekarang}-${String(bulanTerpilihNum).padStart(2, "0")}-${new Date(tahunSekarang, bulanTerpilihNum, 0).getDate()}`
    : undefined;

  const fetchData = useCallback(async () => {
    getBarangStats()
      .then((s) => {
        setStats({
          total: s.total,
          perStatus: s.perStatus,
          perBatch: s.perBatch.slice(0, 5),
        });
      })
      .catch(() => undefined);

    getBarangPage({ page: 1, limit: 6 })
      .then((res) => setRecent(res.data))
      .catch(() => undefined);

    getFinishgoodPerBulan({
      tanggalAwal: tanggalAwalBulan,
      tanggalAkhir: tanggalAkhirBulan,
    })
      .then((res) => setPerBulan(res.data))
      .catch(() => undefined);

    getBarang()
      .then((res) => {
        const today = res.data.filter((item) => isToday(item.tanggal));
        const finishGood = today.filter(
          (item) => item.status === "FINISHGOOD",
        ).length;
        const proses = today.filter(
          (item) => item.status === "REGISTER",
        ).length;
        const batches = new Set(today.map((item) => item.batch?.id).filter((v): v is number => typeof v === "number")).size;
        setTodayStats({
          total: today.length,
          finishGood,
          proses,
          batch: batches,
        });
      })
      .catch(() => undefined);
  }, [bulanTerpilih, tanggalAwalBulan, tanggalAkhirBulan]);

  const { subscribe } = useLiveSocketContext();

  useEffect(() => {
    return subscribe(() => {
      fetchData();
    });
  }, [subscribe, fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statusEntries = Object.entries(stats?.perStatus ?? {});

  const NAMA_BULAN = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

  const jumlahPerBulan = Array.from({ length: 12 }, (_, i) => {
    const bulan = i + 1;
    return perBulan
      .filter((b) => b.bulanAngka === bulan)
      .reduce((sum, b) => sum + b.jumlah, 0);
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Ringkasan Eksekutif
          </h2>
          <p className="mt-1 text-sm text-brand-grey-light">
            Performa inventaris dan data analitik terkini.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowToday((v) => !v)}
          className={`inline-flex items-center gap-2 self-start rounded-xl border px-3 py-1.5 text-xs font-medium transition sm:self-auto ${
            showToday
              ? "border-brand-gold/40 bg-brand-gold/10 text-brand-gold"
              : "border-brand-border bg-brand-surface-card text-brand-grey"
          }`}
        >
          <span
            className={`relative inline-flex h-4 w-7 items-center rounded-full transition ${
              showToday ? "bg-brand-gold" : "bg-brand-border"
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition ${
                showToday ? "translate-x-3.5" : "translate-x-0.5"
              }`}
            ></span>
          </span>
          Hari Ini
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={showToday ? "Total Barang Hari Ini" : "Total Barang"}
          value={
            showToday
              ? String(todayStats.total)
              : stats
                ? String(stats.total)
                : "—"
          }
          icon={faBoxesStacked}
          accent="gold"
        />
        <KpiCard
          label={showToday ? "Finish Good Hari Ini" : "Finish Good"}
          value={
            showToday
              ? String(todayStats.finishGood)
              : stats
                ? String(stats.perStatus.FINISHGOOD ?? 0)
                : "—"
          }
          icon={faCartShopping}
          accent="grey"
        />
        <KpiCard
          label={showToday ? "Dalam Proses Hari Ini" : "Dalam Proses"}
          value={
            showToday
              ? String(todayStats.proses)
              : stats
                ? String(stats.perStatus.REGISTER ?? 0)
                : "—"
          }
          icon={faUserCheck}
          accent="gold"
        />
        <KpiCard
          label={showToday ? "Total Batch Hari Ini" : "Total Batch"}
          value={
            showToday
              ? String(todayStats.batch)
              : stats
                ? String(stats.perBatch.length)
                : "—"
          }
          icon={faWallet}
          accent="grey"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col justify-between rounded-2xl border border-brand-border bg-brand-surface-card p-6 lg:col-span-2">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-lg font-bold text-white">
                Finishgood per Bulan
              </h3>
              <p className="text-xs text-brand-grey">
                Jumlah barang berstatus Finish Good tiap bulan
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="flex items-center gap-1.5 text-brand-grey-light">
                <span>Bulan</span>
                <select
                  value={bulanTerpilih}
                  onChange={(e) => setBulanTerpilih(e.target.value)}
                  className="rounded-lg border border-brand-border bg-brand-surface px-2.5 py-1.5 text-brand-grey-light outline-none transition focus:border-brand-gold"
                >
                  <option value="">Semua Bulan</option>
                  {NAMA_BULAN.map((nama, i) => (
                    <option key={i + 1} value={i + 1}>
                      {nama}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="relative h-72 w-full">
            <Bar
              data={{
                labels: NAMA_BULAN,
                datasets: [
                  {
                    label: "Finishgood",
                    data: jumlahPerBulan,
                    backgroundColor: "rgba(230, 170, 90, 0.75)",
                    hoverBackgroundColor: "#F2C889",
                    borderColor: "#E6AA5A",
                    borderWidth: 1,
                    borderRadius: 6,
                    maxBarThickness: 42,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: CHART_TOOLTIP,
                },
                scales: {
                  x: {
                    grid: { color: "rgba(35, 35, 38, 0.5)" },
                    ticks: { color: "#9B9B9C", font: { family: "Inter" } },
                  },
                  y: {
                    beginAtZero: true,
                    grid: { color: "rgba(35, 35, 38, 0.5)" },
                    ticks: { color: "#9B9B9C", font: { family: "Inter" } },
                  },
                },
              }}
            />
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-brand-border bg-brand-surface-card p-6">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                Distribusi Status
              </h3>
            </div>
            <p className="mb-4 text-xs text-brand-grey">
              Distribusi stok per status produksi
            </p>
          </div>

          <div className="relative h-52 w-full">
            <Doughnut
              data={{
                labels: statusEntries.map(([s]) => STATUS_LABEL[s] ?? s),
                datasets: [
                  {
                    data: statusEntries.map(([, v]) => v),
                    backgroundColor: [
                      "#E6AA5A",
                      "#9B9B9C",
                      "#3A3A3D",
                      "#F2C889",
                      "#5A5A5C",
                    ],
                    borderColor: "#141416",
                    borderWidth: 3,
                    hoverOffset: 6,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                cutout: "75%",
                plugins: {
                  legend: { display: false },
                  tooltip: CHART_TOOLTIP,
                },
              }}
            />
          </div>

          <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-brand-grey">
            {statusEntries.map(([s]) => (
              <span key={s} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-brand-gold/60"></span>
                {STATUS_LABEL[s] ?? s}
              </span>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-brand-border pt-4 text-center text-xs">
            <div>
              <p className="text-brand-grey">Total</p>
              <p className="mt-0.5 font-bold text-brand-gold">
                {stats?.total ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-brand-grey">Batch</p>
              <p className="mt-0.5 font-bold text-white">
                {stats?.perBatch.length ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-brand-grey">Varian</p>
              <p className="mt-0.5 font-bold text-brand-grey-light">
                {stats ? Object.keys(stats.perStatus).length : "-"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface-card lg:col-span-2">
          <div className="flex flex-col justify-between gap-4 border-b border-brand-border p-6 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-lg font-bold text-white">
                Transaksi Terbaru
              </h3>
              <p className="text-xs text-brand-grey">
                Daftar riwayat barang masuk real-time
              </p>
            </div>
            <Link
              to="/admin/barang"
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-xs text-brand-grey-light transition hover:border-brand-gold hover:text-white"
            >
              <span>Lihat semua</span>
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-brand-border bg-brand-surface/40 text-xs uppercase tracking-wider text-brand-grey">
                  <th className="px-6 py-3.5 font-semibold">Kode</th>
                  <th className="px-6 py-3.5 font-semibold">Produk</th>
                  <th className="px-6 py-3.5 font-semibold">Batch</th>
                  <th className="px-6 py-3.5 font-semibold">Status</th>
                  <th className="px-6 py-3.5 font-semibold text-right">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border font-normal text-brand-grey-light">
                {recent.map((item) => (
                  <tr key={item.id} className="transition group hover:bg-brand-surface/60">
                    <td className="px-6 py-4 font-mono text-xs text-brand-gold">
                      {item.kodeBarang}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">
                        {item.variant.product.nama}
                      </div>
                      <div className="text-xs text-brand-grey">
                        {item.variant.style.nama} / {item.variant.color.nama} /{" "}
                        {item.variant.size.nama}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {item.batch ? `BC${String(item.batch.nomorBatch).padStart(3, "0")}` : "-"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_COLOR[item.status] ?? "text-brand-grey"}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${STATUS_BAR[item.status] ?? "bg-brand-grey"}`}
                        ></span>
                        {STATUS_LABEL[item.status] ?? item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-brand-grey transition hover:bg-brand-surface hover:text-brand-gold"
                        aria-label="Lihat detail"
                      >
                        <FontAwesomeIcon icon={faEye} className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-10 text-center text-sm text-brand-grey"
                    >
                      Belum ada transaksi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-brand-border bg-brand-surface-card p-6">
            <h3 className="mb-4 text-lg font-bold text-white">
              Akses Cepat
            </h3>
            <div className="space-y-3">
              <QuickAction
                to="/admin/barang"
                label="Kelola Daftar Barang"
                icon={faBoxesStacked}
              />
              <QuickAction
                to="/admin/barang/statistik"
                label="Lihat Statistik"
                icon={faChartPie}
              />
            </div>
          </div>

          
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof FontAwesomeIcon>["icon"];
  accent: "gold" | "grey";
}) {
  const iconCls =
    accent === "gold"
      ? "border-brand-gold/20 bg-brand-gold/10 text-brand-gold"
      : "border-brand-grey/20 bg-brand-grey/10 text-brand-grey-light";
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-brand-border bg-brand-surface-card p-5 transition duration-300 hover:border-brand-gold/50">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-brand-grey">
          {label}
        </span>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl border transition duration-300 group-hover:scale-110 ${iconCls}`}
        >
          <FontAwesomeIcon icon={icon} className="h-5 w-5" />
        </div>
      </div>
      <div className="space-y-1">
        <h3 className="text-2xl font-bold tracking-tight text-white">
          {value}
        </h3>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-brand-gold to-transparent opacity-0 transition group-hover:opacity-100"></div>
    </div>
  );
}

function QuickAction({
  to,
  label,
  icon,
}: {
  to: string;
  label: string;
  icon: React.ComponentProps<typeof FontAwesomeIcon>["icon"];
}) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between rounded-xl border border-brand-border bg-brand-surface p-3.5 text-sm font-medium text-brand-grey-light transition hover:border-brand-gold hover:text-white"
    >
      <span className="flex items-center gap-3">
        <FontAwesomeIcon icon={icon} className="h-4 w-4 text-brand-gold" />
        {label}
      </span>
      <span className="text-brand-gold">→</span>
    </Link>
  );
}

export default AdminDashboard;
