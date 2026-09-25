import { useEffect, useMemo, useState } from "react";
import {
  getProductionCapacities,
  getProductionSchedule,
  type ScheduleRow,
} from "../../api/productionOrders";
import { fmtCap, fmtLong, fmtPcsDus, recomputeRingkasan, summarizeSchedule } from "./utils";
import { requiredDaily } from "./capacityCalc";
import KpiStrip from "./KpiStrip";
import SummaryCharts from "./SummaryCharts";

interface Props {
  orderId: number | null;
}

function toCsv(
  stages: { key: string; label: string; mulai: string; selesai: string; hariKerja: number; kapW: number; kapS: number }[],
  demands: Map<string, number>,
  notes: Map<string, string>,
): string {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = "Proses,Mulai,Selesai,Total Hari,Kap/hari,Kap/Sabtu,Target,Catatan";
  const lines = stages.map((s) =>
    [s.label, s.mulai, s.selesai, s.hariKerja, s.kapW, s.kapS, demands.get(s.key) ?? "", notes.get(s.key) ?? ""]
      .map(cell)
      .join(","),
  );
  return [head, ...lines].join("\n");
}

export default function SummaryTab({ orderId }: Props) {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [totalQty, setTotalQty] = useState(0);
  const [meta, setMeta] = useState<{ dialokasikan: number; sisa: number; hariProduksi: number } | null>(null);
  const [notes, setNotes] = useState<Map<string, string>>(new Map());
  const [windows, setWindows] = useState<Map<string, { mulai: string; selesai: string }>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orderId === null) return;
    setLoading(true);
    Promise.all([getProductionSchedule(orderId), getProductionCapacities(orderId)])
      .then(([sched, caps]) => {
        setRows(sched.rows);
        setTotalQty(sched.order.totalQty);
        setMeta(sched.meta);
        setNotes(new Map(caps.filter((c) => c.catatan).map((c) => [c.stage, c.catatan as string])));
        setWindows(
          new Map(
            caps
              .filter((c) => c.mulai && c.selesai)
              .map((c) => [c.stage, { mulai: (c.mulai as string).slice(0, 10), selesai: (c.selesai as string).slice(0, 10) }]),
          ),
        );
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat ringkasan."))
      .finally(() => setLoading(false));
  }, [orderId]);

  // Semua angka di bawah diturunkan dari baris jadwal.
  const { stages, allocation } = useMemo(() => summarizeSchedule(rows), [rows]);

  const noteOf = (label: string) =>
    [...notes.entries()].find(([stage]) => stage.toUpperCase().startsWith(label.split(" ")[0]))?.[1] ?? null;

  const ringkasan = useMemo(
    () =>
      recomputeRingkasan(
        allocation.map((a) => ({ qty: a.total, priority: 0, label: a.item })),
        totalQty,
      ),
    [allocation, totalQty],
  );

  const demands = useMemo(() => {
    const byKw = (kw: string) =>
      allocation.filter((a) => a.item.toUpperCase().includes(kw)).reduce((n, a) => n + a.total, 0);
    return new Map([
      ["buffing", totalQty],
      ["baseCoat", totalQty],
      ["decalSolid", byKw("SOLID")],
      ["decalMotif", byKw("MOTIF")],
      ["topCoat", totalQty],
      ["perakitan", totalQty],
      ["qc", totalQty],
    ]);
  }, [allocation, totalQty]);

  // Butuh/hari dari demand + window kapasitas (agar tepat waktu), bukan hariKerja manual.
  const gaps = useMemo(
    () =>
      stages.map((s) => {
        const w = [...windows.entries()].find(([stage]) =>
          stage.toUpperCase().startsWith(s.label.split(" ")[0]),
        )?.[1];
        const need = w ? requiredDaily(w.mulai, w.selesai, demands.get(s.key) ?? 0) : null;
        return { stage: s.label, kapHari: s.kapW, butuhHari: need?.kapW ?? 0 };
      }),
    [stages, demands, windows],
  );

  const curve = useMemo(() => {
    let acc = 0;
    let last = "";
    const pts: { tanggal: string; kumulatif: number }[] = [];
    for (const r of rows) {
      acc += r.jumlah;
      const label = `${r.tanggal.slice(8, 10)}/${r.tanggal.slice(5, 7)}`;
      if (label === last && pts.length > 0) pts[pts.length - 1].kumulatif = acc;
      else pts.push({ tanggal: label, kumulatif: acc });
      last = label;
    }
    return pts;
  }, [rows]);

  const download = () => {
    const blob = new Blob([toCsv(stages, demands, new Map(stages.map((s) => [s.key, noteOf(s.label) ?? ""])))], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ringkasan-produksi.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const hasData = stages.some((s) => s.hariKerja > 0);

  const kpis = meta
    ? [
        { label: "Target", value: fmtPcsDus(totalQty), tone: "navy" as const },
        { label: "Terjadwal", value: fmtPcsDus(meta.dialokasikan), tone: "green" as const },
        { label: "Sisa", value: fmtPcsDus(meta.sisa), tone: meta.sisa > 0 ? ("red" as const) : ("muted" as const) },
        { label: "Hari produksi", value: `${meta.hariProduksi} hari`, tone: "navy" as const },
      ]
    : [];

  return (
    <div className="space-y-4">
      <KpiStrip items={kpis} />
      <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
          <h3 className="font-semibold text-[#1E3A5F]">
            Ringkasan Waktu Pengerjaan{" "}
            <span className="font-normal text-xs text-[#6B7280]">· dari jadwal</span>
          </h3>
          <span className="inline-flex gap-2">
            <button
              type="button"
              onClick={download}
              disabled={!hasData}
              className="rounded-lg border border-[#D1D5DB] bg-white px-3 py-1.5 text-sm font-medium text-[#1F2937] hover:bg-[#F5F7FA] disabled:opacity-40"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg bg-[#1E3A5F] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#16294a]"
            >
              Cetak
            </button>
          </span>
        </div>
        {loading ? (
          <p className="animate-pulse p-6 text-[15px] text-[#6B7280]">Memuat ringkasan...</p>
        ) : error ? (
          <p role="alert" className="p-6 text-center text-[#EF4444]">{error}</p>
        ) : !hasData ? (
          <p className="p-6 text-center text-[#6B7280]">Belum ada jadwal untuk periode ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]">
                  <th className="px-4 py-3 font-semibold">Proses</th>
                  <th className="px-4 py-3 font-semibold">Mulai</th>
                  <th className="px-4 py-3 font-semibold">Selesai</th>
                  <th className="px-4 py-3 text-right font-semibold">Total Hari</th>
                  <th className="px-4 py-3 font-semibold">Kapasitas</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((s) => (
                  <tr key={s.key} className="border-b border-slate-50 last:border-0 hover:bg-[#F5F7FA]">
                    <td className="px-4 py-2.5 font-medium text-[#1F2937]">{s.label}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-[#1F2937]">{fmtLong(s.mulai || null)}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-[#1F2937]">{fmtLong(s.selesai || null)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-[#1F2937]">
                      {s.hariKerja.toLocaleString("id-ID")} hari
                    </td>
                    <td className="px-4 py-2.5 text-[#1F2937]">{fmtCap(s.kapW, s.kapS, noteOf(s.label))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {!loading && !error && hasData && (
        <SummaryCharts
          ringkasan={ringkasan}
          gaps={gaps}
          ranges={stages.map((s) => ({ stage: s.label, mulai: s.mulai, selesai: s.selesai }))}
          curve={curve}
          targetQty={totalQty}
        />
      )}
    </div>
  );
}
