import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import {
  getReconciliation,
  pesanLaporan,
  type ReconciliationReport,
  type ReportFilters,
} from "../../../api/reports";
import { formatQty } from "./types";
import WarningsBanner from "./WarningsBanner";

const cardCls = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";

export default function ReconciliationTab({ filters }: { filters: ReportFilters }) {
  const [data, setData] = useState<ReconciliationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(filters);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getReconciliation(JSON.parse(key) as ReportFilters)
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(null);
      })
      .catch((reason) => {
        if (active) {
          setData(null);
          setError(pesanLaporan(reason, "Gagal memuat rekonsiliasi."));
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
          <h2 className="text-sm font-extrabold text-[#1E3A5F]">Rekonsiliasi Produksi → Finished Goods</h2>
          <p className="text-[11px] text-slate-500">
            {data.period.from} s/d {data.period.to}
          </p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Varian</th>
                <th className="px-3 py-2">Produk</th>
                <th className="px-3 py-2 text-right">Diproduksi</th>
                <th className="px-3 py-2 text-right">Barang dibuat</th>
                <th className="px-3 py-2 text-right">FINISHGOOD</th>
                <th className="px-3 py-2 text-right">REGISTER</th>
                <th className="px-3 py-2 text-right">RETUR</th>
                <th className="px-3 py-2 text-right">OUT</th>
                <th className="px-3 py-2 text-right">BAD</th>
                <th className="px-3 py-2 text-right">Selisih prod−buat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.perVariant.map((row) => (
                <tr key={row.variantId}>
                  <td className="px-3 py-2 font-mono text-xs font-bold text-[#1E3A5F]">{row.kodeVariant}</td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    {row.product} · {row.color} · {row.size}
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{formatQty(row.producedQty)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{formatQty(row.barangGenerated)}</td>
                  <td className="px-3 py-2 text-right text-xs font-bold tabular-nums text-emerald-700">
                    {formatQty(row.finishGoodQty)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{formatQty(row.registerNotFinishGood)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{formatQty(row.retur)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{formatQty(row.out)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{formatQty(row.bad)}</td>
                  <td className={`px-3 py-2 text-right text-xs tabular-nums ${row.gapProducedVsGenerated < 0 ? "text-red-700" : "text-slate-600"}`}>
                    {formatQty(row.gapProducedVsGenerated)}
                  </td>
                </tr>
              ))}
              {data.perVariant.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-sm text-slate-400">
                    Tidak ada output produksi pada periode ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">{data.bucketRule}</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={cardCls}>
          <h2 className="text-sm font-extrabold text-[#1E3A5F]">WIP tersisa (periode)</h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-2">Item</th>
                <th className="px-2 py-2 text-right">Sisa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.wip.map((row) => (
                <tr key={`${row.itemId}-${row.kode}`}>
                  <td className="px-2 py-2 text-xs text-slate-700">{row.kode} · {row.nama}</td>
                  <td className="px-2 py-2 text-right text-xs font-bold tabular-nums">
                    {formatQty(row.quantity)} {row.unit}
                  </td>
                </tr>
              ))}
              {data.wip.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-2 py-6 text-center text-xs text-slate-400">
                    Tidak ada sisa WIP pada periode ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className={cardCls}>
          <h2 className="text-sm font-extrabold text-[#1E3A5F]">Legacy / tidak tertaut</h2>
          <ul className="mt-3 space-y-2 text-xs text-slate-700">
            <li className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
              <span>Barang tanpa tautan produksi/QC</span>
              <span className="font-bold tabular-nums">{formatQty(data.legacy.unlinkedBarang)}</span>
            </li>
            <li className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
              <span>Transaksi ProduksiHarian (legacy)</span>
              <span className="font-bold tabular-nums">{formatQty(data.legacy.produksiHarianTransaksi)}</span>
            </li>
          </ul>
          <p className="mt-3 text-[11px] text-slate-500">
            Data legacy dipertahankan dan tidak dihitung ganda pada laporan kanonik.
          </p>
        </section>
      </div>
    </div>
  );
}
