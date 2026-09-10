import { useCallback, useEffect, useMemo, useState } from "react";
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
  getBarangPage,
  getBarangStats,
  getBarangTodayStats,
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
  REGISTER: "bg-amber-50 text-amber-700 border-amber-200",
  FINISHGOOD: "bg-emerald-50 text-emerald-700 border-emerald-200",
  RETUR: "bg-sky-50 text-[#0088C0] border-sky-200",
  OUT: "bg-[#1E3A5F]/5 text-[#1E3A5F] border-[#1E3A5F]/15",
  BAD: "bg-red-50 text-[#EF4444] border-red-200",
};

const STATUS_BAR: Record<string, string> = {
  REGISTER: "bg-amber-500",
  FINISHGOOD: "bg-[#10B981]",
  RETUR: "bg-[#00A8E8]",
  OUT: "bg-[#1E3A5F]",
  BAD: "bg-[#EF4444]",
};

const CHART_TOOLTIP = {
  backgroundColor: "#FFFFFF",
  titleColor: "#1F2937",
  bodyColor: "#6B7280",
  borderColor: "#D1D5DB",
  borderWidth: 1,
  padding: 10,
};

function AdminDashboard() {
  const [stats, setStats] = useState<{
    total: number;
    perStatus: Record<string, number>;
    perVariant: Array<{ variantId: number; nama: string; total: number }>;
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
  const { tanggalAwalBulan, tanggalAkhirBulan } = useMemo(() => {
    if (!bulanTerpilihNum) return { tanggalAwalBulan: undefined, tanggalAkhirBulan: undefined };
    const mm = String(bulanTerpilihNum).padStart(2, "0");
    return {
      tanggalAwalBulan: `${tahunSekarang}-${mm}-01`,
      tanggalAkhirBulan: `${tahunSekarang}-${mm}-${new Date(tahunSekarang, bulanTerpilihNum, 0).getDate()}`,
    };
  }, [tahunSekarang, bulanTerpilihNum]);

  // Overview ringan: stats (cache Redis 30 dtk) + 6 terbaru (cache list 15 dtk)
  // + KPI hari ini via filter tanggal (bukan full getBarang() seluruh histori).
  const fetchOverview = useCallback(async () => {
    getBarangStats()
      .then((s) => {
        setStats({
          total: s.total,
          perStatus: s.perStatus,
          perVariant: s.perVariant,
          perBatch: s.perBatch.slice(0, 5),
        });
      })
      .catch(() => undefined);

    getBarangPage({ page: 1, limit: 6 })
      .then((res) => setRecent(res.data))
      .catch(() => undefined);

    getBarangTodayStats()
      .then(setTodayStats)
      .catch(() => undefined);
  }, []);

  // Chart per bulan: hanya refetch saat filter bulan berubah (debounce 300ms).
  useEffect(() => {
    const t = window.setTimeout(() => {
      getFinishgoodPerBulan({
        tanggalAwal: tanggalAwalBulan,
        tanggalAkhir: tanggalAkhirBulan,
      })
        .then((res) => setPerBulan(res.data))
        .catch(() => undefined);
    }, 300);
    return () => window.clearTimeout(t);
  }, [tanggalAwalBulan, tanggalAkhirBulan]);

  const { subscribe, isConnected } = useLiveSocketContext();

  useEffect(() => {
    void fetchOverview();
    // Polling fallback 30 dtk: KPI tetap live meski WebSocket putus.
    // Murah karena stats/list/today ikut cache Redis backend.
    const pollId = window.setInterval(() => {
      void fetchOverview();
    }, 30000);
    return () => window.clearInterval(pollId);
  }, [fetchOverview]);

  useEffect(() => {
    return subscribe((payload) => {
      // Sama seperti DaftarBarang: refetch langsung tiap event barang.*.
      // Aman untuk DB karena stats/list/today ikut cache Redis backend.
      if (payload.type && !payload.type.startsWith("barang.")) return;
      void fetchOverview();
    });
  }, [subscribe, fetchOverview]);

  const variantEntries = useMemo(() => {
    const groups = new Map<string, number>();
    for (const v of stats?.perVariant ?? []) {
      const parts = v.nama.split(" - ").map((s) => s.trim());
      const key = parts.length > 1 ? parts.slice(0, -1).join(" - ") : v.nama;
      groups.set(key, (groups.get(key) ?? 0) + v.total);
    }
    return [...groups.entries()]
      .map(([nama, total]) => ({ nama, total }))
      .sort((a, b) => b.total - a.total);
  }, [stats?.perVariant]);

  const VARIANT_COLORS = [
    "#1E3A5F",
    "#00A8E8",
    "#10B981",
    "#F59E0B",
    "#8B5CF6",
    "#EC4899",
    "#6B7280",
    "#EF4444",
    "#14B8A6",
    "#84CC16",
  ];

  const variantColors = variantEntries.map(
    (_, i) => VARIANT_COLORS[i % VARIANT_COLORS.length],
  );

  const pct = (part: number, total: number) =>
    total > 0 ? `${Math.round((part / total) * 100)}%` : "—";
  const totalValue = showToday ? todayStats.total : (stats?.total ?? 0);
  const finishGoodValue = showToday ? todayStats.finishGood : (stats?.perStatus.FINISHGOOD ?? 0);
  const prosesValue = showToday ? todayStats.proses : (stats?.perStatus.REGISTER ?? 0);
  const batchValue = showToday ? todayStats.batch : (stats?.perBatch.length ?? 0);

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
    <div className="space-y-6 sm:space-y-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex flex-wrap items-center gap-2.5 text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">
            Ringkasan Eksekutif
            <span
              title={isConnected ? "WebSocket terhubung — KPI update otomatis" : "WebSocket terputus — refresh tiap 30 detik"}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                isConnected
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-[#F5F7FA] text-[#6B7280]"
              }`}
            >
              <span className="relative flex h-1.5 w-1.5">
                {isConnected && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#10B981] opacity-75"></span>
                )}
                <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${isConnected ? "bg-[#10B981]" : "bg-[#6B7280]"}`}></span>
              </span>
              {isConnected ? "Live" : "Offline"}
            </span>
          </h2>
          <p className="mt-1 text-[15px] leading-[1.6] text-[#6B7280] sm:text-base">
            Performa inventaris dan data analitik terkini.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowToday((v) => !v);
            void fetchOverview();
          }}
          aria-pressed={showToday}
          className={`inline-flex items-center gap-2 self-start rounded-lg border px-3 py-2 text-[15px] font-medium transition duration-200 focus-visible:outline-2 focus-visible:outline-[#00A8E8] sm:self-auto ${
            showToday
              ? "border-[#1E3A5F] bg-[#1E3A5F]/5 text-[#1E3A5F]"
              : "border-[#D1D5DB] bg-white text-[#6B7280] hover:border-[#00A8E8] hover:text-[#1F2937]"
          }`}
        >
          <span
            aria-hidden="true"
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition duration-200 ${
              showToday ? "bg-[#00A8E8]" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                showToday ? "translate-x-4" : "translate-x-0.5"
              }`}
            ></span>
          </span>
          Hari Ini
        </button>
      </header>

      <section aria-label="Indikator utama" className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
        <KpiCard
          label={showToday ? "Total Barang Hari Ini" : "Total Barang"}
          value={
            showToday
              ? String(todayStats.total)
              : stats
                ? String(stats.total)
                : "—"
          }
          sub={`${batchValue} batch`}
          icon={faBoxesStacked}
          accent="primary"
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
          sub={`${pct(finishGoodValue, totalValue)} dari total`}
          icon={faCartShopping}
          accent="accent"
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
          sub={`${pct(prosesValue, totalValue)} dari total`}
          icon={faUserCheck}
          accent="success"
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
          sub={showToday ? "batch hari ini" : "batch keseluruhan"}
          icon={faWallet}
          accent="neutral"
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section aria-label="Finishgood per bulan" className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition duration-200 hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)] lg:col-span-2">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-xl font-semibold leading-[1.4] text-[#1E3A5F]">
                Finishgood per Bulan
              </h3>
              <p className="text-[13px] leading-[1.5] text-[#6B7280]">
                Jumlah barang berstatus Finish Good tiap bulan
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label htmlFor="filter-bulan" className="flex items-center gap-1.5 text-[#6B7280]">
                <span className="text-sm font-medium">Bulan</span>
                <select
                  id="filter-bulan"
                  value={bulanTerpilih}
                  onChange={(e) => setBulanTerpilih(e.target.value)}
                  className="h-12 rounded-lg border border-[#D1D5DB] bg-white px-2.5 text-[15px] text-[#1F2937] outline-none transition duration-200 focus:border-[#00A8E8] focus:ring-2 focus:ring-[#00A8E8]/20"
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
                    backgroundColor: "rgba(0, 168, 232, 0.8)",
                    hoverBackgroundColor: "#0088C0",
                    borderColor: "#0088C0",
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
                    grid: { color: "rgba(209, 213, 219, 0.4)" },
                    ticks: { color: "#6B7280", font: { family: "Inter" } },
                  },
                  y: {
                    beginAtZero: true,
                    grid: { color: "rgba(209, 213, 219, 0.4)" },
                    ticks: { color: "#6B7280", font: { family: "Inter" } },
                  },
                },
              }}
            />
          </div>
        </section>

        <section aria-label="Distribusi varian" className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition duration-200 hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)]">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xl font-semibold leading-[1.4] text-[#1E3A5F]">
                Distribusi Varian
              </h3>
            </div>
            <p className="mb-4 text-[13px] leading-[1.5] text-[#6B7280]">
              Jumlah disatukan per style + color (tanpa ukuran)
            </p>
          </div>

          <div className="relative h-52 w-full">
            <Doughnut
              data={{
                labels: variantEntries.map((v) => v.nama),
                datasets: [
                  {
                    data: variantEntries.map((v) => v.total),
                    backgroundColor:
                      variantColors.length > 0 ? variantColors : ["#D1D5DB"],
                    borderColor: "#FFFFFF",
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

          <div className="mt-2 flex max-h-20 flex-wrap justify-center gap-x-3 gap-y-1 overflow-y-auto text-[13px] text-[#6B7280]">
            {variantEntries.map((v, i) => (
              <span
                key={v.nama}
                title={`${v.nama}: ${v.total}`}
                className="inline-flex max-w-full items-center gap-1.5"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: VARIANT_COLORS[i % VARIANT_COLORS.length],
                  }}
                ></span>
                <span className="truncate">
                  {v.nama} ({v.total})
                </span>
              </span>
            ))}
            {variantEntries.length === 0 && <span>Belum ada data.</span>}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-200 pt-4 text-center text-sm">
            <div>
              <p className="text-[#6B7280]">Total</p>
              <p className="mt-0.5 font-bold text-[#1E3A5F]">
                {stats?.total ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-[#6B7280]">Batch</p>
              <p className="mt-0.5 font-bold text-[#1F2937]">
                {stats?.perBatch.length ?? "-"}
              </p>
            </div>
            <div>
              <p className="text-[#6B7280]">Varian</p>
              <p className="mt-0.5 font-bold text-[#0088C0]">
                {stats ? variantEntries.length : "-"}
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section aria-label="Transaksi terbaru" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] lg:col-span-2">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 p-6 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-xl font-semibold leading-[1.4] text-[#1E3A5F]">
                Transaksi Terbaru
              </h3>
              <p className="text-[13px] leading-[1.5] text-[#6B7280]">
                Daftar riwayat barang masuk real-time
              </p>
            </div>
            <Link
              to="/admin/barang"
              className="inline-flex items-center gap-1.5 rounded-lg border-2 border-[#1E3A5F] bg-transparent px-6 py-3 text-[15px] font-medium text-[#1E3A5F] transition duration-200 hover:bg-[#1E3A5F]/5 focus-visible:outline-2 focus-visible:outline-[#00A8E8]"
            >
              <span>Lihat semua</span>
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[15px]">
              <thead>
                <tr className="border-b border-slate-200 bg-[#F5F7FA] text-[13px] uppercase tracking-wider text-[#6B7280]">
                  <th className="px-6 py-3.5 font-semibold">Kode</th>
                  <th className="px-6 py-3.5 font-semibold">Produk</th>
                  <th className="px-6 py-3.5 font-semibold">Batch</th>
                  <th className="px-6 py-3.5 font-semibold">Status</th>
                  <th className="px-6 py-3.5 font-semibold text-right">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal text-[#1F2937]">
                {recent.map((item) => (
                  <tr key={item.id} className="transition duration-200 hover:bg-[#F5F7FA]">
                    <td className="px-6 py-4 font-mono text-[13px] font-medium text-[#1E3A5F]">
                      {item.kodeBarang}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-[#1F2937]">
                        {item.variant.product.nama}
                      </div>
                      <div className="text-[13px] text-[#6B7280]">
                        {item.variant.style.nama} / {item.variant.color.nama} /{" "}
                        {item.variant.size.nama}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[13px] text-[#6B7280]">
                      {item.batch ? `BC${String(item.batch.nomorBatch).padStart(3, "0")}` : "-"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-medium ${STATUS_COLOR[item.status] ?? "text-[#6B7280]"}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${STATUS_BAR[item.status] ?? "bg-[#6B7280]"}`}
                        ></span>
                        {STATUS_LABEL[item.status] ?? item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        className="rounded-lg p-2 text-[#6B7280] transition duration-200 hover:bg-[#F5F7FA] hover:text-[#00A8E8] focus-visible:outline-2 focus-visible:outline-[#00A8E8]"
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
                      className="px-6 py-10 text-center text-[15px] text-[#6B7280]"
                    >
                      Belum ada transaksi.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6">
          <section aria-label="Akses cepat" className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <h3 className="mb-4 text-xl font-semibold leading-[1.4] text-[#1E3A5F]">
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
          </section>

        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentProps<typeof FontAwesomeIcon>["icon"];
  accent: "primary" | "accent" | "success" | "neutral";
}) {
  const iconCls =
    accent === "primary"
      ? "bg-[#1E3A5F]/5 text-[#1E3A5F]"
      : accent === "accent"
        ? "bg-[#00A8E8]/10 text-[#0088C0]"
        : accent === "success"
          ? "bg-emerald-50 text-emerald-600"
          : "bg-[#F5F7FA] text-[#6B7280]";
  return (
    <div className="group rounded-xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.10)]">
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold uppercase leading-tight tracking-wider text-[#6B7280]">
          {label}
        </span>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition duration-200 group-hover:scale-105 ${iconCls}`}
        >
          <FontAwesomeIcon icon={icon} className="h-5 w-5" />
        </div>
      </div>
      <div className="space-y-1">
        <h3 className="text-2xl font-bold tabular-nums tracking-tight text-[#1E3A5F] sm:text-3xl">
          {value}
        </h3>
        {sub && (
          <p className="truncate text-[13px] text-[#6B7280]">
            {sub}
          </p>
        )}
      </div>
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
      className="flex items-center justify-between rounded-lg bg-[#00A8E8] px-6 py-3 text-[15px] font-medium text-white transition duration-200 hover:bg-[#0088C0] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00A8E8]"
    >
      <span className="flex items-center gap-3">
        <FontAwesomeIcon icon={icon} className="h-4 w-4" />
        {label}
      </span>
      <span aria-hidden="true">→</span>
    </Link>
  );
}

export default AdminDashboard;
