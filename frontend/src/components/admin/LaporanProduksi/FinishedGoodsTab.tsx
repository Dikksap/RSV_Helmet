import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import {
  getFinishedGoodsSummary,
  pesanLaporan,
  type FinishedGoodsSummary,
  type ReportFilters,
} from "../../../api/reports";
import { formatQty } from "./types";
import WarningsBanner from "./WarningsBanner";

const cardCls = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";

function Stat({ label, value, tone = "slate" }: { label: string; value: number; tone?: string }) {
  const toneCls =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "amber"
        ? "text-amber-700"
        : tone === "red"
          ? "text-red-700"
          : "text-[#1E3A5F]";
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-extrabold tabular-nums ${toneCls}`}>{formatQty(value)}</p>
    </div>
  );
}

export default function FinishedGoodsTab({ filters }: { filters: ReportFilters }) {
  const [data, setData] = useState<FinishedGoodsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(filters);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getFinishedGoodsSummary(JSON.parse(key) as ReportFilters)
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(null);
      })
      .catch((reason) => {
        if (active) {
          setData(null);
          setError(pesanLaporan(reason, "Gagal memuat ringkasan Finished Goods."));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [key]);

  if (loading) {
    return (
      <p className="grid place-items-center rounded-2xl border border-slate-200 bg-white py-12 text-sm text-slate-500">
        <FontAwesomeIcon icon={faSpinner} spin />
      </p>
    );
  }
  if (error) {
    return <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      <WarningsBanner warnings={data.warnings} />

      <section className={cardCls}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-extrabold text-[#1E3A5F]">Finished Goods Summary</h2>
          <p className="text-[11px] text-slate-500">
            Periode {data.period.from} s/d {data.period.to} · basis waktu FINISHGOOD pertama
          </p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Output produksi" value={data.totals.productionOutput} />
          <Stat label="Unit FINISHGOOD (periode)" value={data.totals.fgFirstCount} tone="emerald" />
          <Stat label="REGISTER belum FG" value={data.totals.registerNotFinishGood} tone="amber" />
          <Stat
            label="Selisih output vs FG"
            value={data.totals.gapProductionVsFinishGood}
            tone={data.totals.gapProductionVsFinishGood < 0 ? "red" : "slate"}
          />
          <Stat label="Barang dibuat" value={data.totals.barangGenerated} />
          <Stat label="Retur" value={data.totals.retur} />
          <Stat label="OUT" value={data.totals.out} />
          <Stat label="BAD" value={data.totals.bad} />
          <Stat label="Reject (lot)" value={data.totals.reject} />
          <Stat label="Repair (disetujui)" value={data.totals.repair} />
          <Stat label="Perubahan status" value={data.totals.statusChanges} />
          <Stat label="Legacy/unlinked" value={data.totals.legacyUnlinked} tone="amber" />
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          Unit yang FINISHGOOD lalu OUT/RETUR tetap dihitung pada periode FINISHGOOD-nya, dan
          ditampilkan terpisah pada kategori status.
        </p>
      </section>

      <section className={cardCls}>
        <h2 className="text-sm font-extrabold text-[#1E3A5F]">Rincian per varian</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Varian</th>
                <th className="px-3 py-2">Produk</th>
                <th className="px-3 py-2">Warna</th>
                <th className="px-3 py-2">Ukuran</th>
                <th className="px-3 py-2 text-right">Output</th>
                <th className="px-3 py-2 text-right">FG pertama</th>
                <th className="px-3 py-2 text-right">Selisih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.perVariant.map((row) => (
                <tr key={row.variantId}>
                  <td className="px-3 py-2 font-mono text-xs font-bold text-[#1E3A5F]">{row.kodeVariant}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{row.product}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{row.color}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">{row.size}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{formatQty(row.outputQty)}</td>
                  <td className="px-3 py-2 text-right text-xs font-bold tabular-nums text-emerald-700">
                    {formatQty(row.fgFirstCount)}
                  </td>
                  <td className={`px-3 py-2 text-right text-xs tabular-nums ${row.gap < 0 ? "text-red-700" : "text-slate-600"}`}>
                    {formatQty(row.gap)}
                  </td>
                </tr>
              ))}
              {data.perVariant.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">
                    Tidak ada data pada periode/filter ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
