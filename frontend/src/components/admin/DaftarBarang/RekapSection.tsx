import { useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChartPie, faCheck, faRotate, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import type { BarangStatusSummary } from "../../../api/barang";
import type { StatusOption } from "../../../lib/useStatusOptions";
import { DEFAULT_STATUS_ORDER, statusVisual } from "./statusVisuals";

type RekapSectionProps = {
  summary: BarangStatusSummary | null;
  loading: boolean;
  error: string | null;
  statusOptions: StatusOption[];
  activeStatus: string;
  onStatusSelect: (status: string) => void;
  onRetry: () => void;
};

const n = (value: number) => value.toLocaleString("id-ID");
const pct = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0);
const pctLabel = (value: number, total: number) => {
  const percent = pct(value, total);
  if (value > 0 && percent < 0.1) return "<0,1%";
  return `${percent.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
};

function RekapSkeleton() {
  return (
    <div className="grid animate-pulse gap-3 p-4 lg:grid-cols-[minmax(230px,0.8fr)_minmax(0,2fr)]" aria-hidden="true">
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4">
        <div className="h-2.5 w-20 rounded bg-slate-200" />
        <div className="mt-3 h-7 w-28 rounded bg-slate-200" />
        <div className="mt-4 h-2 w-full rounded-full bg-slate-200" />
        <div className="mt-3 flex gap-4">
          <div className="h-2.5 w-20 rounded bg-slate-200" />
          <div className="h-2.5 w-16 rounded bg-slate-200" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 p-3">
            <div className="h-2.5 w-16 rounded bg-slate-200" />
            <div className="mt-3 h-5 w-14 rounded bg-slate-200" />
            <div className="mt-3 h-1 w-full rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function RekapSection({
  summary,
  loading,
  error,
  statusOptions,
  activeStatus,
  onStatusSelect,
  onRetry,
}: RekapSectionProps) {
  const total = summary?.total ?? 0;
  const counts = useMemo(() => summary?.perStatus ?? {}, [summary]);

  const codes = useMemo(() => {
    const present = Object.keys(counts);
    if (present.length === 0) return [...DEFAULT_STATUS_ORDER];
    const known = DEFAULT_STATUS_ORDER.filter((code) => present.includes(code));
    const extra = present.filter((code) => !DEFAULT_STATUS_ORDER.includes(code)).sort((a, b) => a.localeCompare(b));
    return [...known, ...extra];
  }, [counts]);

  const labelOf = (code: string) => statusOptions.find((option) => option.value.toUpperCase() === code.toUpperCase())?.label ?? code;

  const segments = codes
    .map((code) => ({ code, value: Number(counts[code] ?? 0), visual: statusVisual(code) }))
    .filter((segment) => segment.value > 0);

  const finishGood = Number(counts.FINISHGOOD ?? 0);
  const returBad = Number(counts.RETUR ?? 0) + Number(counts.BAD ?? 0);
  const distributionLabel = segments.length
    ? `Komposisi status: ${segments.map((s) => `${labelOf(s.code)} ${n(s.value)} barang (${pctLabel(s.value, total)})`).join(", ")}`
    : "Belum ada barang";

  const distributionBar = (
    <div
      className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-slate-200/70"
      role="img"
      aria-label={distributionLabel}
    >
      {segments.map((segment) => (
        <span
          key={segment.code}
          className="h-full first:rounded-l-full last:rounded-r-full"
          style={{ width: `${pct(segment.value, total)}%`, backgroundColor: segment.visual.hex }}
          title={`${labelOf(segment.code)}: ${n(segment.value)} (${pctLabel(segment.value, total)})`}
        />
      ))}
    </div>
  );

  const content = summary ? (
    <div className="grid gap-3 p-3 sm:p-4 xl:grid-cols-[minmax(240px,0.85fr)_minmax(0,2fr)]">
      <div className="hidden flex-col justify-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 xl:flex">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Total barang</p>
            <p className="mt-0.5 text-[26px] font-bold leading-none tracking-tight tabular-nums text-slate-900">{n(total)}</p>
          </div>
          <dl className="shrink-0 space-y-0.5 pb-0.5 text-right text-[11px] leading-snug">
            <div className="flex items-center justify-end gap-1.5">
              <dt className="text-slate-500">Finish good</dt>
              <dd className="font-bold tabular-nums text-slate-900">{pctLabel(finishGood, total)}</dd>
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <dt className="text-slate-500">Retur &amp; BAD</dt>
              <dd className="font-bold tabular-nums text-slate-900">{n(returBad)}</dd>
            </div>
          </dl>
        </div>
        {distributionBar}
      </div>

      <div className="flex flex-col gap-2 xl:hidden">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
          <span className="text-slate-500">
            Total <b className="font-bold tabular-nums text-slate-900">{n(total)}</b>
          </span>
          <span className="text-slate-500">
            Finish good <b className="font-bold tabular-nums text-slate-900">{pctLabel(finishGood, total)}</b>
          </span>
          <span className="text-slate-500">
            Retur &amp; BAD <b className="font-bold tabular-nums text-slate-900">{n(returBad)}</b>
          </span>
        </div>
        {distributionBar}
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:grid lg:grid-cols-5 lg:overflow-visible lg:px-0 lg:pb-0">
        {codes.map((code) => {
          const value = Number(counts[code] ?? 0);
          const visual = statusVisual(code);
          const active = activeStatus.toUpperCase() === code.toUpperCase();
          const share = pct(value, total);
          return (
            <button
              key={code}
              type="button"
              aria-pressed={active}
              onClick={() => onStatusSelect(code)}
              aria-label={`${active ? "Hapus filter" : "Filter"} status ${labelOf(code)}: ${n(value)} barang (${pctLabel(value, total)})`}
              className={`group relative flex min-w-[138px] shrink-0 snap-start flex-col gap-1.5 rounded-xl border p-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/50 lg:min-w-0 lg:shrink lg:p-3 ${
                active
                  ? "border-[#1E3A5F] bg-[#1E3A5F]/[0.04] shadow-sm ring-1 ring-[#1E3A5F]/10"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
              }`}
            >
              <span
                className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500 ${
                  active ? "pr-4" : ""
                }`}
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${visual.dot}`} aria-hidden="true" />
                <span className="truncate" title={labelOf(code)}>
                  {code}
                </span>
                {active && (
                  <FontAwesomeIcon icon={faCheck} className="absolute right-2.5 top-2.5 text-[10px] text-[#1E3A5F]" aria-hidden="true" />
                )}
              </span>
              <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                <span className="text-[19px] font-bold leading-none tabular-nums text-slate-900">{n(value)}</span>
                <span className="text-[11px] font-medium text-slate-500">{pctLabel(value, total)}</span>
              </span>
              <span className="mt-auto block h-1 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                <span
                  className={`block h-full rounded-full transition-[width] duration-300 ${visual.bar}`}
                  style={{ width: `${value > 0 ? Math.max(share, 2) : 0}%` }}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <section aria-labelledby="rekap-inventori-heading" className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#00A8E8]/10 text-[#0088C0]">
            <FontAwesomeIcon icon={faChartPie} className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="rekap-inventori-heading" className="text-sm font-semibold text-slate-900">
              Ringkasan inventori
            </h2>
            <p className="truncate text-[11px] text-slate-500">
              <span className="hidden sm:inline">Komposisi status seluruh barang · </span>klik status untuk memfilter
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
            Live
          </span>
          <button
            type="button"
            onClick={onRetry}
            aria-label="Muat ulang ringkasan inventori"
            title="Muat ulang ringkasan"
            className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-[#1E3A5F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/50 disabled:cursor-wait disabled:opacity-60"
            disabled={loading}
          >
            <FontAwesomeIcon icon={faRotate} spin={loading} className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      </div>

      {error && !summary ? (
        <div className="flex flex-col items-center gap-2 px-4 py-9 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-500" aria-hidden="true">
            <FontAwesomeIcon icon={faTriangleExclamation} className="h-4 w-4" />
          </span>
          <p className="text-sm font-semibold text-slate-800">Ringkasan gagal dimuat</p>
          <p className="max-w-md text-xs text-slate-500">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-1 inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/50"
          >
            Coba lagi
          </button>
        </div>
      ) : summary ? (
        content
      ) : (
        <RekapSkeleton />
      )}
    </section>
  );
}
