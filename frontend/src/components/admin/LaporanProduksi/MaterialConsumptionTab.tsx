import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import {
  getMaterialConsumption,
  pesanLaporan,
  type MaterialConsumptionReport,
  type ReportBasis,
  type ReportFilters,
} from "../../../api/reports";
import { formatQty } from "./types";
import WarningsBanner from "./WarningsBanner";

const cardCls = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";

const BASIS_INFO: Record<ReportBasis, string> = {
  FINISHGOOD:
    "Basis FINISHGOOD: material yang dialokasikan ke unit yang pertama kali FINISHGOOD pada periode (tanggal acuan finishGoodAt).",
  PRODUKSI:
    "Basis PRODUKSI: seluruh konsumsi aktual dari output produksi pada periode, termasuk output yang belum menjadi Finished Goods.",
};

function ValidationBadge({
  status,
  unknown,
}: {
  status: "MATCH" | "TEORITIS_ONLY" | "AKTUAL_ONLY";
  unknown?: boolean;
}) {
  if (unknown) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
        BOM belum lengkap
      </span>
    );
  }
  const map = {
    MATCH: { label: "BOM & aktual", cls: "bg-emerald-100 text-emerald-800" },
    TEORITIS_ONLY: { label: "Hanya BOM", cls: "bg-amber-100 text-amber-800" },
    AKTUAL_ONLY: { label: "Hanya aktual", cls: "bg-slate-200 text-slate-700" },
  } as const;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${map[status].cls}`}>
      {map[status].label}
    </span>
  );
}

function Stat({
  label,
  value,
  suffix,
  tone = "slate",
}: {
  label: string;
  value: string;
  suffix?: string;
  tone?: "slate" | "emerald" | "amber" | "red";
}) {
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
      <p className={`mt-1 text-lg font-extrabold tabular-nums ${toneCls}`}>
        {value}
        {suffix ? <span className="ml-1 text-[11px] font-semibold text-slate-500">{suffix}</span> : null}
      </p>
    </div>
  );
}

function perUnit(value: number, denominator: number): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return value / denominator;
}

export default function MaterialConsumptionTab({ filters }: { filters: ReportFilters }) {
  const [basis, setBasis] = useState<ReportBasis>("FINISHGOOD");
  const [data, setData] = useState<MaterialConsumptionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetUnits, setTargetUnits] = useState("1000");
  const key = JSON.stringify(filters);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getMaterialConsumption(JSON.parse(key) as ReportFilters, basis)
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(null);
      })
      .catch((reason) => {
        if (active) {
          setData(null);
          setError(pesanLaporan(reason, "Gagal memuat laporan konsumsi material."));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [key, basis]);

  // Backend lama belum mengirim field cakupan; anggap semua unit tertaut agar
  // angka tidak tiba-tiba terlihat 0%.
  const linkedUnits = data
    ? (data.summary.linkedFinishGoodUnits ?? data.summary.finishGoodUnits)
    : 0;
  const unlinkedUnits = data
    ? (data.summary.unlinkedFinishGoodUnits ??
      Math.max(data.summary.finishGoodUnits - linkedUnits, 0))
    : 0;
  const coveragePct =
    data && data.summary.finishGoodUnits > 0
      ? (linkedUnits / data.summary.finishGoodUnits) * 100
      : null;

  // Teoretis dihitung per unit tertaut (basis FINISHGOOD) atau per output
  // (basis PRODUKSI). Aktual memakai basis yang sama agar perbandingan adil.
  const denominator =
    data?.basis === "FINISHGOOD" ? linkedUnits : (data?.summary.productionOutput ?? 0);

  const projectionRows = useMemo(() => {
    if (!data || denominator <= 0) return [];
    return data.rows
      .map((row) => ({
        ...row,
        unitRate: perUnit(row.theoreticalQty, denominator) ?? 0,
      }))
      .filter((row) => row.unitRate > 0);
  }, [data, denominator]);

  const target = Number(targetUnits);
  const targetValid = Number.isFinite(target) && target > 0;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Basis laporan</span>
          {(["FINISHGOOD", "PRODUKSI"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setBasis(value)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                basis === value ? "bg-[#1E3A5F] text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">{BASIS_INFO[basis]}</p>
      </section>

      {loading ? (
        <p className="grid place-items-center rounded-2xl border border-slate-200 bg-white py-12 text-sm text-slate-500">
          <FontAwesomeIcon icon={faSpinner} spin />
        </p>
      ) : error ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : data ? (
        <>
          <WarningsBanner warnings={data.warnings} />

          <section className={cardCls}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-extrabold text-[#1E3A5F]">Konsumsi Material</h2>
              <p className="text-[11px] text-slate-500">
                {data.period.from} s/d {data.period.to} · basis {data.basis}
              </p>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Output produksi" value={formatQty(data.summary.productionOutput)} />
              <Stat label="Unit FINISHGOOD" value={formatQty(data.summary.finishGoodUnits)} tone="emerald" />
              <Stat
                label="Unit tertaut produksi"
                value={formatQty(linkedUnits)}
                suffix={coveragePct === null ? undefined : `(${formatQty(coveragePct)}%)`}
                tone="emerald"
              />
              <Stat
                label="Tanpa tautan"
                value={formatQty(unlinkedUnits)}
                tone={unlinkedUnits > 0 ? "amber" : "slate"}
              />
            </div>

            {data.summary.finishGoodUnits === 0 ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Tidak ada unit FINISHGOOD pada periode ini. Ganti periode, atau gunakan basis PRODUKSI
                untuk melihat konsumsi dari output yang belum menjadi Finished Goods.
              </p>
            ) : unlinkedUnits > 0 ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <span className="font-bold">{formatQty(unlinkedUnits)} unit FINISHGOOD tidak tertaut dokumen produksi/QC.</span>{" "}
                Unit ini tetap dihitung sebagai helm yang selesai, tetapi materialnya tidak dapat
                diatribusikan. Angka aktual dan kolom “per unit” di bawah hanya dihitung dari{" "}
                <span className="font-bold">{formatQty(linkedUnits)} unit tertaut</span>. Agar seluruh
                unit terhitung, hasil produksi harus dicatat lewat Input Hasil Produksi (tahap akhir
                + ProductVariant) sebelum QR dipindai FINISHGOOD.
              </p>
            ) : (
              <p className="mt-3 text-[11px] text-slate-500">
                Seluruh unit FINISHGOOD pada periode ini punya tautan produksi, sehingga angka aktual
                mencakup semua helm.
              </p>
            )}

            <p className="mt-2 text-[11px] text-slate-500">
              Variance = actual − theoretical. Persentase kosong bila kebutuhan teoretis 0 (tidak
              dilakukan pembagian nol).
            </p>
          </section>

          <section className={cardCls}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-extrabold text-[#1E3A5F]">Rincian per item</h2>
              <p className="text-[11px] text-slate-500">
                {denominator > 0
                  ? `Per unit dihitung terhadap ${formatQty(denominator)} ${
                      data.basis === "FINISHGOOD" ? "unit tertaut" : "unit output"
                    }`
                  : "Per unit belum dapat dihitung (basis 0 unit)"}
              </p>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Kode</th>
                    <th className="px-3 py-2">Nama</th>
                    <th className="px-3 py-2">Jenis</th>
                    <th className="px-3 py-2 text-right">Teoretis</th>
                    <th className="px-3 py-2 text-right">Aktual</th>
                    <th className="px-3 py-2">Satuan</th>
                    <th className="px-3 py-2 text-right">Teoretis / unit</th>
                    <th className="px-3 py-2 text-right">Aktual / unit</th>
                    <th className="px-3 py-2 text-right">Variance</th>
                    <th className="px-3 py-2 text-right">%</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.rows.map((row) => {
                    const varianceUnknown =
                      row.theoreticalQty === 0 && data.summary.theoreticalIncomplete;
                    const theoRate = perUnit(row.theoreticalQty, denominator);
                    const actRate = perUnit(row.actualQty, denominator);
                    return (
                      <tr key={row.itemId}>
                        <td className="px-3 py-2 font-mono text-xs font-bold text-[#1E3A5F]">{row.kode}</td>
                        <td className="px-3 py-2 text-xs text-slate-700">{row.nama}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{row.jenis ?? "—"}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums">{formatQty(row.theoreticalQty)}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums">{formatQty(row.actualQty)}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{row.unit ?? "—"}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-700">
                          {theoRate === null ? "—" : formatQty(theoRate)}
                        </td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-700">
                          {actRate === null ? "—" : formatQty(actRate)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right text-xs font-bold tabular-nums ${
                            varianceUnknown
                              ? "text-slate-400"
                              : Math.abs(row.variance) < 0.000001
                                ? "text-slate-500"
                                : "text-amber-700"
                          }`}
                        >
                          {varianceUnknown ? "—" : `${row.variance > 0 ? "+" : ""}${formatQty(row.variance)}`}
                        </td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-600">
                          {varianceUnknown || row.variancePercentage === null
                            ? "—"
                            : `${formatQty(row.variancePercentage)}%`}
                        </td>
                        <td className="px-3 py-2">
                          <ValidationBadge status={row.comparisonStatus} unknown={varianceUnknown} />
                        </td>
                      </tr>
                    );
                  })}
                  {data.rows.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-3 py-8 text-center text-sm text-slate-400">
                        Belum ada konsumsi material yang dapat dihitung pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Satuan mengikuti master item. Material setengah jadi yang diproduksi tidak dihitung
              sebagai daun, sehingga tidak terjadi penghitungan ganda.
            </p>
          </section>

          <section className={cardCls}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold text-[#1E3A5F]">Proyeksi kebutuhan BOM</h2>
                <p className="mt-1 text-[11px] text-slate-500">
                  Kebutuhan teoretis untuk sejumlah helm, dihitung dari BOM efektif per unit tertaut.
                  Angka ini proyeksi, bukan konsumsi aktual.
                </p>
              </div>
              <label className="flex items-end gap-2">
                <span className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  Jumlah helm
                </span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={targetUnits}
                  onChange={(event) => setTargetUnits(event.target.value)}
                  className="w-32 rounded-xl border border-slate-200 px-3 py-2 text-sm tabular-nums text-slate-700 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20"
                />
              </label>
            </div>

            {denominator <= 0 ? (
              <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Proyeksi belum dapat dihitung: belum ada unit tertaut/output pada periode ini.
              </p>
            ) : data.summary.theoreticalIncomplete ? (
              <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                BOM belum lengkap. Proyeksi hanya memuat komponen yang berhasil diekspansi; komponen
                yang belum punya BOM anak tidak muncul di sini.
              </p>
            ) : projectionRows.length === 0 ? (
              <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Tidak ada komponen BOM yang dapat diproyeksikan pada periode ini.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Kode</th>
                      <th className="px-3 py-2">Nama</th>
                      <th className="px-3 py-2">Satuan</th>
                      <th className="px-3 py-2 text-right">Per helm</th>
                      <th className="px-3 py-2 text-right">
                        Untuk {targetValid ? `${formatQty(target)} helm` : "—"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {projectionRows.map((row) => (
                      <tr key={row.itemId}>
                        <td className="px-3 py-2 font-mono text-xs font-bold text-[#1E3A5F]">{row.kode}</td>
                        <td className="px-3 py-2 text-xs text-slate-700">{row.nama}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{row.unit ?? "—"}</td>
                        <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-600">
                          {formatQty(row.unitRate)}
                        </td>
                        <td className="px-3 py-2 text-right text-xs font-bold tabular-nums text-[#1E3A5F]">
                          {targetValid ? formatQty(row.unitRate * target) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
