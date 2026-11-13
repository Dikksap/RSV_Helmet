import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faSpinner } from "@fortawesome/free-solid-svg-icons";
import {
  getTraceability,
  pesanLaporan,
  type ReportFilters,
  type TraceabilityReport,
} from "../../../api/reports";
import { formatDateTime, formatQty } from "./types";
import WarningsBanner from "./WarningsBanner";

const cardCls = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";
const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20";

function FlagBadge({ flag }: { flag: string }) {
  const tone =
    flag === "LOT_TIDAK_LENGKAP"
      ? "bg-amber-100 text-amber-800"
      : flag === "LEGACY_UNLINKED"
        ? "bg-slate-200 text-slate-700"
        : "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}>{flag}</span>;
}

export default function TraceabilityTab({ filters }: { filters: ReportFilters }) {
  const [kode, setKode] = useState("");
  const [appliedKode, setAppliedKode] = useState("");
  const [data, setData] = useState<TraceabilityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(filters);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const baseFilters = JSON.parse(key) as ReportFilters;
    const request = appliedKode
      ? getTraceability({ ...baseFilters, kodeBarang: appliedKode })
      : getTraceability(baseFilters);
    request
      .then((result) => {
        if (!active) return;
        setData(result);
        setError(null);
      })
      .catch((reason) => {
        if (active) {
          setData(null);
          setError(pesanLaporan(reason, "Gagal memuat traceability."));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [key, appliedKode]);

  const submit = () => {
    setAppliedKode(kode.trim().toUpperCase());
  };

  return (
    <div className="space-y-4">
      <section className={cardCls}>
        <h2 className="text-sm font-extrabold text-[#1E3A5F]">Telusuri Unit / QR Code</h2>
        <p className="mt-1 text-xs text-slate-500">
          Masukkan kode QR untuk menelusuri unit → dokumen produksi → lot → material. Kosongkan untuk
          melihat daftar unit FINISHGOOD pada periode terpilih.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={kode}
            onChange={(event) => setKode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
            placeholder="Contoh: BC001-WB001-091126-0001"
            className={`${inputCls} font-mono`}
          />
          <button
            type="button"
            onClick={submit}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E3A5F] px-4 py-2 text-sm font-bold text-white hover:bg-[#152c49]"
          >
            <FontAwesomeIcon icon={faMagnifyingGlass} /> Telusuri
          </button>
          {appliedKode && (
            <button
              type="button"
              onClick={() => {
                setAppliedKode("");
                setKode("");
              }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              Tampilkan daftar periode
            </button>
          )}
        </div>
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
              <h2 className="text-sm font-extrabold text-[#1E3A5F]">Hasil Traceability</h2>
              <p className="text-[11px] text-slate-500">
                {data.rows.length.toLocaleString("id-ID")} unit · periode {data.period.from} s/d {data.period.to}
              </p>
            </div>
            <div className="mt-3 space-y-3">
              {data.rows.map((row) => (
                <details key={row.kodeBarang} className="rounded-xl border border-slate-200">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2 text-xs">
                    <span className="font-mono font-bold text-[#1E3A5F]">{row.kodeBarang}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                      {row.status}
                    </span>
                    <span className="text-slate-500">
                      {row.variant.kodeVariant} · {row.variant.product} {row.variant.color} {row.variant.size}
                    </span>
                    <span className="text-slate-500">FG: {formatDateTime(row.finishGoodAt)}</span>
                    {row.flags.map((flag) => (
                      <FlagBadge key={flag} flag={flag} />
                    ))}
                  </summary>
                  <div className="border-t border-slate-100 px-3 py-3 text-xs">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Dokumen produksi</p>
                        {row.production ? (
                          <p className="mt-1 text-slate-700">
                            <span className="font-mono font-bold">{row.production.nomor}</span>
                            <br />
                            {formatDateTime(row.production.tanggalProduksi)} · Divisi {row.production.divisi.nama}
                            <br />
                            Stage {row.production.stage?.stage ?? "—"} · BOM versi {row.production.bomVersion ?? "—"}
                            <br />
                            Output baris: {formatQty(row.production.outputQuantity)}
                          </p>
                        ) : (
                          <p className="mt-1 text-amber-700">Tidak ada tautan dokumen produksi.</p>
                        )}
                        <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Lot asal</p>
                        <p className="mt-1 text-slate-700">
                          {row.lotId ?? "—"} · sumber {row.genealogySource ?? "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Material per unit
                        </p>
                        {row.materialsPerUnit.length > 0 ? (
                          <table className="mt-1 w-full text-left">
                            <thead className="text-[10px] text-slate-500">
                              <tr>
                                <th className="py-0.5">Kode</th>
                                <th className="py-0.5 text-right">Jumlah</th>
                                <th className="py-0.5 pl-2">Satuan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {row.materialsPerUnit.map((material) => (
                                <tr key={material.itemId}>
                                  <td className="py-0.5 font-mono">{material.kode}</td>
                                  <td className="py-0.5 text-right tabular-nums">{formatQty(material.quantity)}</td>
                                  <td className="py-0.5 pl-2">{material.unit ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="mt-1 text-amber-700">Genealogi material tidak tersedia.</p>
                        )}
                      </div>
                    </div>
                    <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">Riwayat status</p>
                    <ol className="mt-1 space-y-0.5">
                      {row.statusHistory.map((history, index) => (
                        <li key={`${history.status}-${index}`} className="text-slate-600">
                          <span className="font-semibold">{history.status}</span> · {formatDateTime(history.tanggal)}
                          {history.keterangan ? ` — ${history.keterangan}` : ""}
                        </li>
                      ))}
                    </ol>
                  </div>
                </details>
              ))}
              {data.rows.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-400">
                  Tidak ada unit yang cocok dengan pencarian/filter.
                </p>
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
