import { useEffect, useMemo, useState } from "react";
import { getProductionSchedule, type ScheduleRow } from "../../api/productionOrders";
import KpiStrip from "./KpiStrip";

interface Props {
  orderId: number | null;
}

const HEADERS = [
  "Tanggal", "Hari", "Size", "Jam",
  "Target_Persiapan", "Target_Decal_Solid", "Target_Decal_Motif",
  "Target_TopCoat", "Target_Perakitan", "Target_QC",
  "Item", "Jumlah",
];

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

function toCsv(rows: ScheduleRow[]): string {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const line = (r: ScheduleRow) =>
    [fmtDate(r.tanggal), r.hari, r.size, r.jam, r.persiapan, r.decalSolid, r.decalMotif, r.topCoat, r.perakitan, r.qc, r.item, r.jumlah]
      .map(cell)
      .join(",");
  return [HEADERS.join(","), ...rows.map(line)].join("\n");
}

export default function ScheduleTab({ orderId }: Props) {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [meta, setMeta] = useState<{ dialokasikan: number; sisa: number; hariProduksi: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orderId === null) return;
    setLoading(true);
    getProductionSchedule(orderId)
      .then((res) => {
        setRows(res.rows);
        setMeta(res.meta);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Gagal memuat jadwal."))
      .finally(() => setLoading(false));
  }, [orderId]);

  const download = () => {
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "jadwal-produksi.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const kpis = meta
    ? [
        { label: "Hari produksi", value: `${meta.hariProduksi} hari`, tone: "navy" as const },
        { label: "Dialokasikan", value: `${meta.dialokasikan.toLocaleString("id-ID")} pcs`, tone: "green" as const },
        { label: "Sisa", value: `${meta.sisa.toLocaleString("id-ID")} pcs`, tone: meta.sisa > 0 ? ("red" as const) : ("muted" as const) },
      ]
    : [];

  const days = useMemo(() => {
    const groups = new Map<string, ScheduleRow[]>();
    for (const r of rows) {
      const g = groups.get(r.tanggal) ?? [];
      g.push(r);
      groups.set(r.tanggal, g);
    }
    return [...groups.entries()].map(([tanggal, items]) => ({
      tanggal,
      hari: items[0].hari,
      jam: items[0].jam,
      items,
      total: items.reduce((n, r) => n + r.jumlah, 0),
    }));
  }, [rows]);

  const phaseTone = (item: string) => {
    if (item === "LIBUR") return "bg-slate-50";
    if (item === "QC & Packing") return "bg-amber-50/60";
    if (item === "Selesai") return "";
    if (item.startsWith("Persiapan")) return "bg-sky-50/60";
    return "";
  };

  return (
    <div className="space-y-4">
    <KpiStrip items={kpis} />
    <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
        <h3 className="font-semibold text-[#1E3A5F]">
          Jadwal Produksi Otomatis{" "}
          <span className="font-normal text-xs text-[#6B7280]">· {days.length} hari kalender</span>
        </h3>
        <button
          type="button"
          onClick={download}
          disabled={rows.length === 0}
          className="rounded-lg bg-[#1E3A5F] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#16294a] active:scale-[0.98] disabled:opacity-40"
        >
          Export CSV
        </button>
      </div>
      {loading ? (
        <p className="animate-pulse p-6 text-[15px] text-[#6B7280]">Menyusun jadwal...</p>
      ) : error ? (
        <p role="alert" className="p-6 text-center text-[#EF4444]">{error}</p>
      ) : rows.length === 0 ? (
        <p className="p-6 text-center text-[#6B7280]">Belum ada jadwal untuk periode ini.</p>
      ) : (
        <div>
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]">
                {HEADERS.map((h) => (
                  <th key={h} className="sticky top-16 z-10 whitespace-nowrap bg-white px-3 py-3 font-semibold shadow-[0_1px_0_0_#E5E7EB] md:top-[72px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.flatMap((d) => [
                <tr key={`day-${d.tanggal}`} className="border-y-2 border-slate-200 bg-[#1E3A5F]/5">
                  <td colSpan={12} className="px-3 py-1.5 text-xs font-bold text-[#1E3A5F]">
                    {fmtDate(d.tanggal)} · {d.hari} · {d.jam} jam
                    <span className="ml-2 font-semibold tabular-nums text-[#0088C0]">
                      total {d.total.toLocaleString("id-ID")} pcs
                    </span>
                  </td>
                </tr>,
                ...d.items.map((r, i) => {
                  const dim = r.jumlah === 0;
                  return (
                    <tr key={`${r.tanggal}-${r.size}-${i}`} className={`border-b border-slate-50 last:border-0 ${phaseTone(r.item)} hover:bg-[#F5F7FA]`}>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-[#6B7280]">{fmtDate(r.tanggal)}</td>
                      <td className="px-3 py-2 text-[#6B7280]">{r.hari}</td>
                      <td className="px-3 py-2 font-medium text-[#1F2937]">{r.size}</td>
                      <td className="px-3 py-2 tabular-nums text-[#6B7280]">{r.jam}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[#1F2937]">{r.persiapan.toLocaleString("id-ID")}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[#1F2937]">{r.decalSolid.toLocaleString("id-ID")}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[#1F2937]">{r.decalMotif.toLocaleString("id-ID")}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[#1F2937]">{r.topCoat.toLocaleString("id-ID")}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[#1F2937]">{r.perakitan.toLocaleString("id-ID")}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[#1F2937]">{r.qc.toLocaleString("id-ID")}</td>
                      <td className={`px-3 py-2 font-medium ${dim ? "text-[#6B7280]" : "text-[#1F2937]"}`}>{r.item}</td>
                      <td className={`px-3 py-2 text-right font-semibold tabular-nums ${dim ? "text-[#6B7280]" : "text-[#1E3A5F]"}`}>{r.jumlah.toLocaleString("id-ID")}</td>
                    </tr>
                  );
                }),
              ])}
            </tbody>
          </table>
        </div>
      )}
    </section>
    </div>
  );
}
