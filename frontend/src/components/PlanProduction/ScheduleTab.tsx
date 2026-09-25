import { useEffect, useMemo, useState } from "react";
import { getProductionSchedule, type ScheduleRow } from "../../api/productionOrders";
import { PCS_PER_DUS, fmtDus, fmtPcsDus } from "./utils";
import KpiStrip from "./KpiStrip";

interface Props {
  orderId: number | null;
}

// Header disesuaikan dengan kolom yang BENAR-BENAR dirender di <tbody>
const HEADERS = [
  "Tanggal",
  "Hari",
  "Jam",
  "Buffing",
  "Base Coat",
  "Decal Solid",
  "Decal Motif",
  "Top Coat",
  "Perakitan",
  "QC",
  "Item",
  "Jumlah (pcs · dus)",
  "Status",
] as const;

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

function toCsv(rows: ScheduleRow[]): string {
  const csvHeaders = [
    "Tanggal", "Hari", "Size", "Jam",
    "Buffing", "Base Coat", "Decal Solid", "Decal Motif",
    "Top Coat", "Perakitan", "QC",
    "Item", "Jumlah", "Jumlah_Dus",
  ];
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const line = (r: ScheduleRow) =>
    [fmtDate(r.tanggal), r.hari, r.size, r.jam, r.buffing, r.baseCoat, r.decalSolid, r.decalMotif, r.topCoat, r.perakitan, r.qc, r.item, r.jumlah, r.jumlah / PCS_PER_DUS]
      .map(cell)
      .join(",");
  return [csvHeaders.join(","), ...rows.map(line)].join("\n");
}

const STATUS_BADGE: Record<string, string> = {
  Produksi: "bg-[#1E3A5F] text-white",
  Persiapan: "bg-sky-100 text-sky-800",
  Penyesuaian: "bg-violet-100 text-violet-800",
  "QC & Packing": "bg-amber-100 text-amber-800",
  LIBUR: "bg-slate-100 text-slate-500",
  Selesai: "bg-slate-100 text-slate-600",
};

const badgeOf = (status: string) =>
  STATUS_BADGE[status] ?? "bg-slate-100 text-slate-600";

const rowTone = (status: string) => {
  if (status === "LIBUR") return "bg-slate-50";
  if (status === "Penyesuaian") return "bg-violet-50/60";
  if (status === "QC & Packing") return "bg-amber-50/60";
  if (status === "Persiapan") return "bg-sky-50/60";
  return "";
};

export default function ScheduleTab({ orderId }: Props) {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [meta, setMeta] = useState<{ dialokasikan: number; sisa: number; hariProduksi: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
        { label: "Dialokasikan", value: fmtPcsDus(meta.dialokasikan), tone: "green" as const },
        { label: "Sisa", value: fmtPcsDus(meta.sisa), tone: meta.sisa > 0 ? ("red" as const) : ("muted" as const) },
      ]
    : [];

  const days = useMemo(() => {
    const groups = new Map<string, ScheduleRow[]>();
    for (const r of rows) {
      const g = groups.get(r.tanggal) ?? [];
      g.push(r);
      groups.set(r.tanggal, g);
    }
    return [...groups.entries()].map(([tanggal, items]) => {
      const head = items[0];
      const total = items.reduce((n, r) => n + r.jumlah, 0);
      const status = items.every((r) => r.item === "LIBUR")
        ? "LIBUR"
        : total > 0
          ? "Produksi"
          : head.item.startsWith("Persiapan")
            ? "Persiapan"
            : head.item;
      const list = items.filter((r) => r.jumlah > 0);
      const rincian = list
        .map((r) => `${r.item} ${r.size} ${r.jumlah.toLocaleString("id-ID")} pcs (${fmtDus(r.jumlah)} dus)`)
        .join(" · ");
      return { tanggal, hari: head.hari, jam: head.jam, head, items, list, total, status, rincian };
    });
  }, [rows]);

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
            <div className="flex flex-wrap gap-2 border-b border-slate-100 bg-[#F5F7FA] px-4 py-2.5 text-xs text-[#6B7280]">
              {["Produksi", "Persiapan", "Penyesuaian", "QC & Packing", "LIBUR", "Selesai"].map((s) => (
                <span key={s} className={`rounded-full px-2.5 py-0.5 font-semibold ${badgeOf(s)}`}>{s}</span>
              ))}
              <span className="ml-auto">
                Penyesuaian = cadangan bila realisasi meleset / hutang produksi · rincian size di Export CSV
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-[#6B7280]">
                    {HEADERS.map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="whitespace-nowrap bg-white px-3 py-3 font-semibold"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => (
                    <tr
                      key={d.tanggal}
                      className={`border-b border-slate-50 last:border-0 ${rowTone(d.status)} hover:bg-[#F5F7FA]`}
                    >
                      <td className="whitespace-nowrap px-3 py-2.5 font-semibold tabular-nums text-[#1E3A5F]">
                        {fmtDate(d.tanggal)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[#6B7280]">{d.hari}</td>
                      <td className="px-3 py-2.5 tabular-nums text-[#6B7280]">{d.jam}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#1F2937]">{d.head.buffing.toLocaleString("id-ID")}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#1F2937]">{d.head.baseCoat.toLocaleString("id-ID")}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#1F2937]">{d.head.decalSolid.toLocaleString("id-ID")}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#1F2937]">{d.head.decalMotif.toLocaleString("id-ID")}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#1F2937]">{d.head.topCoat.toLocaleString("id-ID")}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#1F2937]">{d.head.perakitan.toLocaleString("id-ID")}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[#1F2937]">{d.head.qc.toLocaleString("id-ID")}</td>
                      <td
                        className="min-w-[220px] max-w-[420px] px-3 py-2.5 font-medium text-[#1F2937]"
                        title={d.rincian || d.status}
                      >
                        {d.list.length === 0 ? (
                          "—"
                        ) : (
                          <>
                            <ul className="space-y-1">
                              {(expanded[d.tanggal] ? d.list : d.list.slice(0, 3)).map((r, i) => (
                                <li key={`${r.item}-${r.size}-${i}`} className="flex justify-between gap-2 whitespace-nowrap text-[13px]">
                                  <span className="truncate">{r.item} <span className="text-[#6B7280]">{r.size}</span></span>
                                  <span className="shrink-0 text-right tabular-nums">
                                    <span className="block text-[#1E3A5F]">{r.jumlah.toLocaleString("id-ID")} pcs</span>
                                    <span className="block text-[11px] font-normal text-[#6B7280]">{fmtDus(r.jumlah)} dus</span>
                                  </span>
                                </li>
                              ))}
                            </ul>
                            {d.list.length > 3 && (
                              <button
                                type="button"
                                onClick={() => setExpanded((p) => ({ ...p, [d.tanggal]: !p[d.tanggal] }))}
                                className="mt-1 text-xs font-semibold text-[#00A8E8] hover:underline"
                              >
                                {expanded[d.tanggal] ? "Tutup" : `+ ${d.list.length - 3} item lagi`}
                              </button>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        <span className="block font-bold text-[#1E3A5F]">{d.total.toLocaleString("id-ID")} pcs</span>
                        <span className="block text-[11px] font-normal text-[#6B7280]">{fmtDus(d.total)} dus</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeOf(d.status)}`}>
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}