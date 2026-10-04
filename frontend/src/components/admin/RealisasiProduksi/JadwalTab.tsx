import { Fragment } from "react";

import { REALISASI_STAGE_LABEL } from "../../../api/productionOrders";
import { STAGE_KEYS, type AutofillItem, type JadwalRow, type JadwalStage, type JadwalVariant } from "./utils";

interface Props {
  jadwalRows: JadwalRow[];
  jadwalTotals: { rencana: number; aktual: number };

  awal: string;
  akhir: string;
  setAwal: (v: string) => void;
  setAkhir: (v: string) => void;

  loadingOrder: boolean;
  loadingJadwal: boolean;

  expanded: Record<string, boolean>;
  setExpanded: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;

  saving: boolean;
  today: string;

  statusOf: (
    r: number,
    a: number
  ) => { text: string; cls: string };

  gotoInput: (t: string) => void;
  autofill: (t: string, items: AutofillItem[]) => Promise<void>;
}

export default function JadwalTab({
  jadwalRows,
  jadwalTotals,
  awal,
  akhir,
  setAwal,
  setAkhir,
  loadingOrder,
  loadingJadwal,
  expanded,
  setExpanded,
  saving,
  today,
  statusOf,
  gotoInput,
  autofill,
}: Props) {
  const selisih =
    jadwalTotals.aktual - jadwalTotals.rencana;

  const progress =
    jadwalTotals.rencana > 0
      ? Math.min(
          100,
          Math.round(
            (jadwalTotals.aktual /
              jadwalTotals.rencana) *
              100
          )
        )
      : 0;

  const totalStages = STAGE_KEYS.length;

  const stageTotals: { key: (typeof STAGE_KEYS)[number]; rencana: number; aktual: number }[] =
    STAGE_KEYS.map((k) => ({
      key: k,
      rencana: jadwalRows.reduce(
        (n, d) => n + (d.stages.find((s) => s.key === k)?.rencana ?? 0),
        0
      ),
      aktual: jadwalRows.reduce(
        (n, d) => n + (d.stages.find((s) => s.key === k)?.aktual ?? 0),
        0
      ),
    }));

  return (
    <div className="space-y-4">
      {/* =====================================================
          SUMMARY
      ====================================================== */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* Rencana */}
        <SummaryCard
          label="Total Rencana"
          value={jadwalTotals.rencana}
          description="Target produksi periode"
          icon={<ChartIcon />}
        />

        {/* Realisasi */}
        <SummaryCard
          label="Total Realisasi"
          value={jadwalTotals.aktual}
          description="Hasil aktual produksi"
          icon={<CheckIcon />}
          iconClass="bg-emerald-50 text-emerald-600"
        />

        {/* Selisih */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                Selisih
              </p>

              <p
                className={[
                  "mt-1.5 text-xl font-bold tabular-nums",
                  selisih < 0
                    ? "text-red-600"
                    : selisih > 0
                      ? "text-sky-600"
                      : "text-slate-800",
                ].join(" ")}
              >
                {selisih > 0 ? "+" : ""}
                {selisih.toLocaleString("id-ID")}
              </p>

              <p className="mt-0.5 text-[11px] text-slate-400">
                Aktual dibanding rencana
              </p>
            </div>

            <div
              className={[
                "flex h-9 w-9 items-center justify-center rounded-lg",
                selisih < 0
                  ? "bg-red-50 text-red-600"
                  : selisih > 0
                    ? "bg-sky-50 text-sky-600"
                    : "bg-slate-100 text-slate-500",
              ].join(" ")}
            >
              <DifferenceIcon />
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                Progress
              </p>

              <p className="mt-1.5 text-xl font-bold tabular-nums text-slate-800">
                {progress}%
              </p>

              <div className="mt-2 h-1.5 w-full max-w-[150px] overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <ProgressIcon />
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          MAIN CARD
      ====================================================== */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* =================================================
            TOOLBAR
        ================================================== */}
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            {/* Title */}
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1E3A5F] text-white">
                <CalendarIcon />
              </div>

              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-800">
                  Jadwal Realisasi
                </h3>

                <p className="mt-0.5 text-[11px] text-slate-400">
                  Perbandingan rencana dan realisasi produksi
                </p>
              </div>
            </div>

            {/* Date Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Dari
                </span>

                <input
                  type="date"
                  value={awal}
                  max={akhir}
                  onChange={(e) =>
                    e.target.value &&
                    setAwal(e.target.value)
                  }
                  className="border-0 bg-transparent p-0 text-xs font-semibold text-slate-700 outline-none focus:ring-0"
                />
              </div>

              <span className="text-xs text-slate-300">
                →
              </span>

              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Sampai
                </span>

                <input
                  type="date"
                  value={akhir}
                  min={awal}
                  onChange={(e) =>
                    e.target.value &&
                    setAkhir(e.target.value)
                  }
                  className="border-0 bg-transparent p-0 text-xs font-semibold text-slate-700 outline-none focus:ring-0"
                />
              </div>
            </div>
          </div>
        </div>

        {/* =================================================
            LEGEND
        ================================================== */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
            Keterangan
          </span>

          <span className="text-[11px] text-slate-500">
            <span className="text-slate-400">
              Atas
            </span>{" "}
            = rencana
          </span>

          <span className="text-[11px] text-slate-500">
            <span className="font-bold text-slate-800">
              Bawah
            </span>{" "}
            = realisasi
          </span>

          <LegendDot
            className="bg-emerald-500"
            label="Tercapai"
          />

          <LegendDot
            className="bg-red-500"
            label="Kurang"
          />

          <LegendDot
            className="bg-sky-500"
            label="Lebih"
          />

          <LegendDot
            className="bg-amber-500"
            label="Tanpa rencana"
          />
        </div>

        {/* =================================================
            CONTENT
        ================================================== */}
        {loadingOrder || loadingJadwal ? (
          <LoadingState />
        ) : jadwalRows.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-left text-sm">
              {/* =================================================
                  TABLE HEADER
              ================================================== */}
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-[0.07em] text-slate-500">
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-30 border-b border-slate-200 bg-white px-4 py-3 text-left"
                  >
                    Tanggal
                  </th>

                  <th
                    rowSpan={2}
                    className="border-b border-slate-200 bg-white px-4 py-3 text-left"
                  >
                    Hari / Jam
                  </th>

                  <th
                    colSpan={totalStages}
                    className="border-b border-l border-slate-200 bg-slate-50 px-4 py-2 text-center text-slate-700"
                  >
                    Realisasi Tahap
                  </th>

                  <th
                    colSpan={2}
                    className="border-b border-l border-slate-200 bg-slate-50 px-4 py-2 text-center text-slate-700"
                  >
                    Produksi
                  </th>

                  <th
                    rowSpan={2}
                    className="border-b border-l border-slate-200 bg-white px-4 py-3 text-left"
                  >
                    Status
                  </th>

                  <th
                    rowSpan={2}
                    className="border-b border-l border-slate-200 bg-white px-4 py-3 text-right"
                  >
                    Aksi
                  </th>
                </tr>

                <tr className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                  {STAGE_KEYS.map((k) => (
                    <th
                      key={k}
                      className="whitespace-nowrap border-b border-l border-slate-200 bg-white px-4 py-2.5 text-right"
                    >
                      <span className="text-slate-600">
                        {REALISASI_STAGE_LABEL[k]}
                      </span>

                      <span className="mt-0.5 block text-[8px] font-normal normal-case text-slate-400">
                        rencana → aktual
                      </span>
                    </th>
                  ))}

                  <th className="border-b border-l border-slate-200 bg-white px-4 py-2.5 text-left">
                    Variant
                  </th>

                  <th className="whitespace-nowrap border-b border-slate-200 bg-white px-4 py-2.5 text-right">
                    Jumlah

                    <span className="mt-0.5 block text-[8px] font-normal normal-case text-slate-400">
                      rencana → aktual
                    </span>
                  </th>
                </tr>
              </thead>

              {/* =================================================
                  TABLE BODY
              ================================================== */}
              <tbody>
                {jadwalRows.map((d: JadwalRow) => {
                  const st = statusOf(
                    d.rencana,
                    d.aktual
                  );

                  const open =
                    !!expanded[d.tanggal];

                  const rowBg =
                    d.unfilledTotal > 0 &&
                    d.tanggal >= today
                      ? "bg-amber-50/30"
                      : d.rencana > 0 &&
                          d.aktual < d.rencana &&
                          d.tanggal < today
                        ? "bg-red-50/30"
                        : d.rencana > 0 &&
                            d.aktual >= d.rencana
                          ? "bg-emerald-50/20"
                          : "";

                  const cell = (
                    rencana: number,
                    aktual: number
                  ) => {
                    const diff = aktual - rencana;

                    return (
                      <div className="text-right leading-tight tabular-nums">
                        <div className="text-[10px] text-slate-400">
                          {rencana.toLocaleString(
                            "id-ID"
                          )}
                        </div>

                        <div
                          className={[
                            "mt-0.5 text-[13px] font-bold",
                            rencana === 0 &&
                            aktual === 0
                              ? "text-slate-300"
                              : aktual === rencana
                                ? "text-emerald-600"
                                : diff < 0
                                  ? "text-red-600"
                                  : "text-sky-600",
                          ].join(" ")}
                        >
                          {aktual.toLocaleString(
                            "id-ID"
                          )}
                        </div>
                      </div>
                    );
                  };

                  return (
                    <Fragment key={d.tanggal}>
                      <tr
                        className={[
                          "group border-b border-slate-100 transition-colors",
                          "last:border-0 hover:bg-slate-50",
                          rowBg,
                        ].join(" ")}
                      >
                        {/* Tanggal */}
                        <td
                          className={[
                            "sticky left-0 z-10 whitespace-nowrap border-r border-slate-100 px-4 py-3",
                            rowBg || "bg-white",
                            "group-hover:bg-slate-50",
                          ].join(" ")}
                        >
                          <div className="font-semibold text-slate-800 tabular-nums">
                            {d.tanggal
                              .split("-")
                              .reverse()
                              .join("/")}
                          </div>

                          {d.tanggal === today && (
                            <span className="mt-1 inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-600">
                              Hari ini
                            </span>
                          )}
                        </td>

                        {/* Hari */}
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="font-medium text-slate-700">
                            {d.hari}
                          </div>

                          {d.jam > 0 && (
                            <div className="mt-0.5 text-[10px] text-slate-400">
                              {d.jam} jam kerja
                            </div>
                          )}
                        </td>

                        {/* Stages */}
                        {d.stages.map((s: JadwalStage) => (
                          <td
                            key={s.key}
                            className="border-l border-slate-100 px-4 py-3"
                          >
                            {cell(
                              s.rencana,
                              s.aktual
                            )}
                          </td>
                        ))}

                        {/* Variant */}
                        <td className="min-w-[240px] max-w-[420px] border-l border-slate-100 px-4 py-3">
                          {d.items.length === 0 ? (
                            <span className="text-slate-300">
                              —
                            </span>
                          ) : (
                            <>
                              <ul className="space-y-1.5">
                                {(open
                                  ? d.items
                                  : d.items.slice(
                                      0,
                                      3
                                    )
                                ).map((v: JadwalVariant) => (
                                  <li
                                    key={v.variantId}
                                    className="flex items-center justify-between gap-3"
                                  >
                                    <span className="min-w-0 truncate text-[12px] font-medium text-slate-700">
                                      {v.label}
                                    </span>

                                    <span className="shrink-0 whitespace-nowrap tabular-nums">
                                      <span className="text-[10px] text-slate-400">
                                        {v.rencana.toLocaleString(
                                          "id-ID"
                                        )}
                                      </span>

                                      <span className="mx-1 text-slate-300">
                                        →
                                      </span>

                                      <b className="text-[11px] text-slate-800">
                                        {v.aktual.toLocaleString(
                                          "id-ID"
                                        )}
                                      </b>
                                    </span>
                                  </li>
                                ))}
                              </ul>

                              {d.items.length >
                                3 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpanded(
                                      (p) => ({
                                        ...p,
                                        [d.tanggal]:
                                          !p[
                                            d.tanggal
                                          ],
                                      })
                                    )
                                  }
                                  className="mt-2 text-[11px] font-semibold text-sky-600 transition-colors hover:text-sky-700 hover:underline"
                                >
                                  {open
                                    ? "Tutup daftar"
                                    : `+ ${
                                        d.items.length -
                                        3
                                      } item lainnya`}
                                </button>
                              )}
                            </>
                          )}
                        </td>

                        {/* Jumlah */}
                        <td className="border-l border-slate-100 px-4 py-3 text-right">
                          <div className="tabular-nums">
                            <div className="text-[10px] text-slate-400">
                              {d.rencana.toLocaleString(
                                "id-ID"
                              )}
                            </div>

                            <div className="mt-0.5 text-[13px] font-bold text-slate-800">
                              {d.aktual.toLocaleString(
                                "id-ID"
                              )}
                            </div>

                            {d.fgTotal > 0 && (
                              <div className="mt-1 text-[9px] font-medium text-slate-400">
                                FG{" "}
                                {d.fgTotal.toLocaleString(
                                  "id-ID"
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="whitespace-nowrap border-l border-slate-100 px-4 py-3">
                          <span
                            className={[
                              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold",
                              st.cls,
                            ].join(" ")}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {st.text}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="whitespace-nowrap border-l border-slate-100 px-4 py-3 text-right">
                          <div className="flex flex-col items-end gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                gotoInput(
                                  d.tanggal
                                )
                              }
                              className="rounded-lg bg-[#1E3A5F] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#142B48] active:scale-[0.98]"
                            >
                              Isi Realisasi
                            </button>

                            {d.unfilledTotal >
                              0 && (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() =>
                                  void autofill(
                                    d.tanggal,
                                    d.unfilled
                                  )
                                }
                                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                +
                                {d.unfilledTotal.toLocaleString(
                                  "id-ID"
                                )}{" "}
                                finishgood
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>

              {/* =================================================
                  FOOTER
              ================================================== */}
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50 text-slate-800">
                  <td
                    className="sticky left-0 z-30 bg-slate-50 px-4 py-3"
                    colSpan={2}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wide">
                      Total
                    </span>
                  </td>

                  {stageTotals.map((s) => (
                    <td
                      key={s.key}
                      className="border-l border-slate-200 px-4 py-3 text-right tabular-nums"
                    >
                      <div className="text-[10px] text-slate-400">
                        {s.rencana.toLocaleString(
                          "id-ID"
                        )}
                      </div>

                      <div className="mt-0.5 text-[13px] font-bold text-slate-800">
                        {s.aktual.toLocaleString(
                          "id-ID"
                        )}
                      </div>
                    </td>
                  ))}

                  <td className="border-l border-slate-200 px-4 py-3 text-right text-[10px] text-slate-400">
                    Total item
                  </td>

                  <td className="border-l border-slate-200 px-4 py-3 text-right tabular-nums">
                    <div className="text-[10px] text-slate-400">
                      {jadwalTotals.rencana.toLocaleString(
                        "id-ID"
                      )}
                    </div>

                    <div className="mt-0.5 text-[13px] font-bold text-slate-800">
                      {jadwalTotals.aktual.toLocaleString(
                        "id-ID"
                      )}
                    </div>
                  </td>

                  <td
                    className="border-l border-slate-200 px-4 py-3"
                    colSpan={2}
                  >
                    {(() => {
                      const st = statusOf(
                        jadwalTotals.rencana,
                        jadwalTotals.aktual
                      );

                      return (
                        <span
                          className={[
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold",
                            st.cls,
                          ].join(" ")}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {st.text}
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/* =========================================================
   SUMMARY CARD
========================================================= */

function SummaryCard({
  label,
  value,
  description,
  icon,
  iconClass = "bg-slate-100 text-slate-600",
}: {
  label: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  iconClass?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
            {label}
          </p>

          <p className="mt-1.5 text-xl font-bold tracking-tight text-slate-900 tabular-nums">
            {value.toLocaleString("id-ID")}
          </p>

          <p className="mt-0.5 text-[11px] text-slate-400">
            {description}
          </p>
        </div>

        <div
          className={[
            "flex h-9 w-9 items-center justify-center rounded-lg",
            iconClass,
          ].join(" ")}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   LEGEND
========================================================= */

function LegendDot({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
      <span
        className={[
          "h-1.5 w-1.5 rounded-full",
          className,
        ].join(" ")}
      />

      {label}
    </span>
  );
}

/* =========================================================
   STATES
========================================================= */

function LoadingState() {
  return (
    <div className="p-12">
      <div className="flex flex-col items-center justify-center text-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-[#1E3A5F]" />

        <p className="mt-4 text-sm font-semibold text-slate-700">
          Memuat jadwal realisasi...
        </p>

        <p className="mt-1 text-xs text-slate-400">
          Mohon tunggu sebentar
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-14 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <CalendarIcon />
      </div>

      <p className="mt-4 text-sm font-semibold text-slate-800">
        Tidak ada data pada periode ini
      </p>

      <p className="mt-1 text-sm text-slate-500">
        Coba pilih rentang tanggal yang berbeda.
      </p>
    </div>
  );
}

/* =========================================================
   ICONS
========================================================= */

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="17"
        rx="2"
      />

      <path d="M8 2v4M16 2v4M3 10h18" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
    >
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 16v-5" />
      <path d="M12 16V8" />
      <path d="M16 16v-9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function DifferenceIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
    >
      <path d="M12 19V5" />
      <path d="m6 11 6-6 6 6" />
    </svg>
  );
}

function ProgressIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-4 w-4"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2" />
    </svg>
  );
}