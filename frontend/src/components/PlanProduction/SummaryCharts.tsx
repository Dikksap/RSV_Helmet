import { useMemo } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { fmtLong } from "./utils";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
);

const TOOLTIP = {
  backgroundColor: "#FFFFFF",
  titleColor: "#1F2937",
  bodyColor: "#6B7280",
  borderColor: "#D1D5DB",
  borderWidth: 1,
  padding: 10,
};

const PALETTE = ["#1E3A5F", "#00A8E8", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"];

const AXIS_TICKS = { color: "#6B7280", font: { family: "Inter", size: 11 } };
const GRID = { color: "rgba(209, 213, 219, 0.4)" };

export interface RingkasanDatum {
  item: string;
  total: number;
  persentase: number;
}

export interface GapDatum {
  stage: string;
  kapHari: number;
  butuhHari: number;
}

export interface CurvePoint {
  tanggal: string; // DD/MM
  kumulatif: number;
}

export interface GanttRange {
  stage: string;
  mulai: string;
  selesai: string;
}

interface Props {
  ringkasan: RingkasanDatum[];
  gaps: GapDatum[];
  ranges: GanttRange[];
  curve: CurvePoint[];
  targetQty: number;
}

const card = "rounded-xl bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)]";
const titleCls = "mb-1 text-sm font-bold text-[#1E3A5F]";
const subCls = "mb-3 text-xs text-[#6B7280]";

function dayIdx(iso: string, base: number): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - base) / 86400000);
}

export default function SummaryCharts({ ringkasan, gaps, ranges, curve, targetQty }: Props) {
  const gantt = useMemo(() => {
    const valid = ranges.filter((r) => r.mulai && r.selesai);
    if (valid.length === 0) return null;
    const base = Math.min(...valid.map((r) => new Date(r.mulai).getTime()));
    const isoOf = (idx: number) => {
      const d = new Date(base + idx * 86400000);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const labelOf = (idx: number) => {
      const d = new Date(base + idx * 86400000);
      return `${d.getDate()} ${d.toLocaleDateString("id-ID", { month: "short" })}`;
    };
    return {
      labels: valid.map((r) => r.stage),
      datasets: [
        {
          data: valid.map((r) => [dayIdx(r.mulai, base), dayIdx(r.selesai, base)]),
          backgroundColor: valid.map((_, i) => PALETTE[i % PALETTE.length]),
          borderWidth: 0,
          borderSkipped: false,
          barThickness: 18,
        },
      ],
      labelOf,
      tip: (s: number, e: number) => `${fmtLong(isoOf(s))} → ${fmtLong(isoOf(e))} (${e - s + 1} hari)`,
      max: Math.max(...valid.map((r) => dayIdx(r.selesai, base))),
    };
  }, [ranges]);

  const defisit = useMemo(() => gaps.filter((g) => g.kapHari < g.butuhHari), [gaps]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <section className={card}>
        <h4 className={titleCls}>Komposisi Item</h4>
        <p className={subCls}>Porsi tiap item dari total {targetQty.toLocaleString("id-ID")} pcs · arahkan kursor untuk angka</p>
        <div className="relative h-56 w-full">
          <Doughnut
            data={{
              labels: ringkasan.map((r) => `${r.item} — ${r.total.toLocaleString("id-ID")} pcs (${r.persentase.toLocaleString("id-ID")}%)`),
              datasets: [
                {
                  data: ringkasan.map((r) => r.total),
                  backgroundColor: ringkasan.map((_, i) => PALETTE[i % PALETTE.length]),
                  borderColor: "#FFFFFF",
                  borderWidth: 2,
                  hoverOffset: 4,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              cutout: "72%",
              plugins: { legend: { display: false }, tooltip: TOOLTIP },
            }}
          />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="text-center">
              <p className="text-2xl font-bold tabular-nums text-[#1E3A5F]">{targetQty.toLocaleString("id-ID")}</p>
              <p className="text-xs text-[#6B7280]">pcs total</p>
            </div>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-[#6B7280]">
          {ringkasan.map((r, i) => (
            <span key={r.item} className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
              {r.item} ({r.persentase.toLocaleString("id-ID")}%)
            </span>
          ))}
        </div>
      </section>

      <section className={card}>
        <h4 className={titleCls}>Kapasitas vs Kebutuhan Harian</h4>
        <p className={subCls}>Butuh/hari = target ÷ hari kerja · merah = defisit</p>
        <div className="relative h-56 w-full">
          <Bar
            data={{
              labels: gaps.map((g) => g.stage),
              datasets: [
                { label: "Kap/hari", data: gaps.map((g) => g.kapHari), backgroundColor: "#1E3A5F" },
                {
                  label: "Butuh/hari",
                  data: gaps.map((g) => g.butuhHari),
                  backgroundColor: gaps.map((g) => (g.kapHari < g.butuhHari ? "#EF4444" : "#10B981")),
                },
              ],
            }}
            options={{
              indexAxis: "y",
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } }, tooltip: TOOLTIP },
              scales: {
                x: { beginAtZero: true, grid: GRID, ticks: AXIS_TICKS, title: { display: true, text: "pcs/hari", ...AXIS_TICKS } },
                y: { grid: { display: false }, ticks: { ...AXIS_TICKS, font: { family: "Inter", size: 10 } } },
              },
            }}
          />
        </div>
        {defisit.length > 0 ? (
          <p className="mt-2 rounded-lg bg-[#EF4444]/10 px-3 py-2 text-xs font-medium text-[#EF4444]">
            Defisit: {defisit.map((g) => `${g.stage} kurang ${(g.butuhHari - g.kapHari).toLocaleString("id-ID")}/hari`).join(" · ")}
          </p>
        ) : (
          <p className="mt-2 rounded-lg bg-[#10B981]/10 px-3 py-2 text-xs font-medium text-emerald-700">
            Semua tahap aman — kapasitas mencukupi kebutuhan harian.
          </p>
        )}
      </section>

      {gantt && (
        <section className={card}>
          <h4 className={titleCls}>Timeline Tahap</h4>
          <p className={subCls}>Window mulai–selesai tiap tahap · arahkan kursor ke bar untuk tanggal pasti</p>
          <div className="relative h-56 w-full">
            <Bar
              data={{ labels: gantt.labels, datasets: gantt.datasets }}
              options={{
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    ...TOOLTIP,
                    callbacks: {
                      title: (items) => items.map((it) => String(it.dataset.label ?? it.label)),
                      label: (ctx) => {
                        const v = ctx.parsed.x as unknown as [number, number];
                        return Array.isArray(v) ? ` ${gantt.tip(v[0], v[1])}` : "";
                      },
                    },
                  },
                },
                scales: {
                  x: {
                    min: 0,
                    max: gantt.max,
                    grid: GRID,
                    ticks: {
                      ...AXIS_TICKS,
                      font: { family: "Inter", size: 9 },
                      autoSkip: false,
                      stepSize: 1,
                      maxRotation: 45,
                      minRotation: 45,
                      callback: (v) => gantt.labelOf(Number(v)),
                    },
                  },
                  y: { grid: { display: false }, ticks: { ...AXIS_TICKS, font: { family: "Inter", size: 10 } } },
                },
              }}
            />
          </div>
        </section>
      )}

      <section className={card}>
        <h4 className={titleCls}>Kurva-S Rencana</h4>
        <p className={subCls}>
          Kumulatif output harian vs target
          {curve.length > 0 && (
            <> · berakhir {curve[curve.length - 1].tanggal}: {curve[curve.length - 1].kumulatif.toLocaleString("id-ID")} pcs</>
          )}
        </p>
        <div className="relative h-56 w-full">
          <Line
            data={{
              labels: curve.map((p) => p.tanggal),
              datasets: [
                {
                  label: "Kumulatif",
                  data: curve.map((p) => p.kumulatif),
                  borderColor: "#00A8E8",
                  backgroundColor: "rgba(0,168,232,0.12)",
                  fill: true,
                  tension: 0.25,
                  pointRadius: 0,
                },
                {
                  label: "Target",
                  data: curve.map(() => targetQty),
                  borderColor: "#EF4444",
                  borderDash: [6, 4],
                  pointRadius: 0,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } }, tooltip: TOOLTIP },
              scales: {
                x: {
                  grid: { display: false },
                  ticks: {
                    ...AXIS_TICKS,
                    font: { family: "Inter", size: 9 },
                    autoSkip: false,
                    maxRotation: 45,
                    minRotation: 45,
                  },
                },
                y: { beginAtZero: true, grid: GRID, ticks: AXIS_TICKS },
              },
            }}
          />
        </div>
      </section>
    </div>
  );
}
