import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxesStacked,
  faFilePdf,
  faRotate,
} from "@fortawesome/free-solid-svg-icons";
import {
  getBarangRekapVariant,
  type BarangRekapVariantRow,
} from "../../api/barang";
import { BarangTabs } from "../../components/admin/DaftarBarang/BarangTabs";
import { Pagination } from "../../components/admin/DaftarBarang/Pagination";
import { DATE_PRESETS, getPresetRange } from "../../lib/datePresets";
import { useLiveSocketContext } from "../../lib/LiveSocketContext";
import { downloadRekapBarangVariantPdf } from "../../lib/rekapBarangVariantPdf";
import { useStatusOptions } from "../../lib/useStatusOptions";

const BASE = "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

type RekapResult = {
  key: string;
  rows: BarangRekapVariantRow[];
  statuses: string[];
  error: string | null;
};

type RekapRow = { row: BarangRekapVariantRow; total: number };
type RekapGroup = {
  key: string;
  tanggal: string | null;
  item: string;
  rows: RekapRow[];
  total: number;
};

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/50";
const FIELD =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#00A8E8] focus:ring-2 focus:ring-[#00A8E8]/20";
const BTN = `${BASE} ${FOCUS}`;
const BTN_GHOST = `${BTN} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
const MASTER_BTN =
  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[#1E3A5F] ring-1 ring-slate-200/70 transition hover:bg-[#F5F7FA] disabled:cursor-not-allowed disabled:opacity-50";

const DEFAULT_PRESET = "";
const EMPTY_ROWS: BarangRekapVariantRow[] = [];
const EMPTY_STATUSES: string[] = [];

const errMsg = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;
const n = (value: number) => value.toLocaleString("id-ID");

function formatTanggal(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition ${FOCUS} ${
        active
          ? "border-[#1E3A5F] bg-[#1E3A5F] text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-[#1E3A5F]/40"
      }`}
    >
      {children}
    </button>
  );
}

export default function RekapBarangVariant() {
  const { subscribe } = useLiveSocketContext();
  const { options: statusOptions } = useStatusOptions();

  const [datePreset, setDatePreset] = useState(DEFAULT_PRESET);
  const [tanggalAwal, setTanggalAwal] = useState("");
  const [tanggalAkhir, setTanggalAkhir] = useState("");
  const [search, setSearch] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [result, setResult] = useState<RekapResult | null>(null);

  const reqRef = useRef(0);

  const statusMeta = useMemo(
    () => new Map(statusOptions.map((option) => [option.value, option])),
    [statusOptions],
  );

  const key = JSON.stringify({ tanggalAwal, tanggalAkhir });

  const load = useCallback(() => {
    const req = ++reqRef.current;
    getBarangRekapVariant({ tanggalAwal, tanggalAkhir })
      .then((data) => {
        if (req !== reqRef.current) return;
        setResult({
          key,
          rows: data.data,
          statuses: data.statuses,
          error: null,
        });
      })
      .catch((e) => {
        if (req !== reqRef.current) return;
        setResult((prev) =>
          prev?.key === key && !prev.error
            ? prev
            : {
                key,
                rows: [],
                statuses: [],
                error: errMsg(e, "Gagal mengambil rekap varian"),
              },
        );
      });
  }, [key, tanggalAwal, tanggalAkhir]);

  useEffect(() => {
    load();
  }, [load]);

  const loading = result?.key !== key;
  const rows = result && !loading ? result.rows : EMPTY_ROWS;
  const statuses = result && !loading ? result.statuses : EMPTY_STATUSES;
  const error = !loading ? (result?.error ?? null) : null;

  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    let timer: number | undefined;
    const unsub = subscribe((payload) => {
      if (!payload.type.startsWith("barang.")) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => loadRef.current(), 1000);
    });
    return () => {
      unsub();
      window.clearTimeout(timer);
    };
  }, [subscribe]);

  const visibleStatuses = useMemo(() => {
    const chosen = selectedStatuses ?? statuses;
    return statuses.filter((kode) => chosen.includes(kode));
  }, [selectedStatuses, statuses]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .map((row) => {
        const total =
          visibleStatuses.length === 0
            ? row.total
            : visibleStatuses.reduce(
                (sum, kode) => sum + (row.perStatus[kode] ?? 0),
                0,
              );
        return { row, total };
      })
      .filter(({ row, total }) => {
        if (selectedStatuses !== null && total === 0) return false;
        if (!q) return true;
        return `${row.kodeVariant} ${row.product} ${row.style} ${row.color} ${row.size}`
          .toLowerCase()
          .includes(q);
      });
  }, [rows, search, selectedStatuses, visibleStatuses]);

  const groups = useMemo(() => {
    const map = new Map<string, RekapGroup>();
    for (const item of filtered) {
      const key = `${item.row.tanggal ?? ""}\u0000${item.row.product}\u0000${item.row.style}\u0000${item.row.color}`;
      let group = map.get(key);
      if (!group) {
        group = {
          key,
          tanggal: item.row.tanggal,
          item: `${item.row.style} ${item.row.color}`,
          rows: [],
          total: 0,
        };
        map.set(key, group);
      }
      group.rows.push(item);
      group.total += item.total;
    }
    return [...map.values()]
      .map((group) => ({
        ...group,
        rows: [...group.rows].sort(
          (a, b) =>
            a.row.sizeUrutan - b.row.sizeUrutan ||
            a.row.size.localeCompare(b.row.size),
        ),
      }))
      .sort(
        (a, b) =>
          (b.tanggal ?? "").localeCompare(a.tanggal ?? "") ||
          a.item.localeCompare(b.item),
      );
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(groups.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageGroups = groups.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const rowOffset = groups
    .slice(0, (currentPage - 1) * pageSize)
    .reduce((sum, group) => sum + group.rows.length, 0);

  const totals = useMemo(
    () =>
      visibleStatuses.map((kode) =>
        filtered.reduce(
          (sum, { row }) => sum + (row.perStatus[kode] ?? 0),
          0,
        ),
      ),
    [filtered, visibleStatuses],
  );
  const grandTotal = useMemo(
    () => filtered.reduce((sum, item) => sum + item.total, 0),
    [filtered],
  );

  const handlePreset = (value: string) => {
    setDatePreset(value);
    setPage(1);
    if (!value) {
      setTanggalAwal("");
      setTanggalAkhir("");
      return;
    }
    const range = getPresetRange(value);
    if (range) {
      setTanggalAwal(range.start);
      setTanggalAkhir(range.end);
    }
  };

  const toggleStatus = (kode: string) => {
    const current = selectedStatuses ?? statuses;
    const next = current.includes(kode)
      ? current.filter((item) => item !== kode)
      : [...current, kode];
    if (next.length === 0) return;
    setSelectedStatuses(next.length === statuses.length ? null : next);
    setPage(1);
  };

  const resetFilters = () => {
    setDatePreset(DEFAULT_PRESET);
    setTanggalAwal("");
    setTanggalAkhir("");
    setSearch("");
    setSelectedStatuses(null);
    setPage(1);
  };

  const hasActiveFilters =
    datePreset !== DEFAULT_PRESET ||
    tanggalAwal !== "" ||
    tanggalAkhir !== "" ||
    search.trim() !== "" ||
    selectedStatuses !== null;

  const periodeLabel =
    tanggalAwal || tanggalAkhir
      ? `${tanggalAwal ? formatTanggal(tanggalAwal) : "…"} – ${tanggalAkhir ? formatTanggal(tanggalAkhir) : "…"}`
      : "Semua tanggal";

  return (
    <div className="w-full space-y-4">
      <BarangTabs />

      <section className="rounded-xl bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#1E3A5F] text-white">
            <FontAwesomeIcon icon={faBoxesStacked} className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[#1E3A5F]">
              Rekap Barang per Varian
            </h1>
            <p className="mt-0.5 text-sm text-[#6B7280]">
              Jumlah barang per item dan ukuran berdasarkan status, difilter
              tanggal barang.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Periode
            <select
              className={FIELD}
              value={datePreset}
              onChange={(e) => handlePreset(e.target.value)}
            >
              <option value="">Semua tanggal</option>
              {DATE_PRESETS.map((preset) => (
                <option key={preset.label} value={preset.label}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Tgl Awal
            <input
              type="date"
              className={FIELD}
              value={tanggalAwal}
              onChange={(e) => {
                setTanggalAwal(e.target.value);
                setDatePreset("");
                setPage(1);
              }}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Tgl Akhir
            <input
              type="date"
              className={FIELD}
              value={tanggalAkhir}
              onChange={(e) => {
                setTanggalAkhir(e.target.value);
                setDatePreset("");
                setPage(1);
              }}
            />
          </label>

          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
            Cari varian
            <input
              type="search"
              className={FIELD}
              placeholder="Kode / produk / style / warna / ukuran"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Status
          </span>
          <Chip
            active={selectedStatuses === null}
            onClick={() => {
              setSelectedStatuses(null);
              setPage(1);
            }}
          >
            Semua
          </Chip>
          {statuses.map((kode) => {
            const meta = statusMeta.get(kode);
            const active = selectedStatuses === null || selectedStatuses.includes(kode);
            return (
              <Chip key={kode} active={active} onClick={() => toggleStatus(kode)}>
                <span
                  aria-hidden="true"
                  className="h-2 w-2 rounded-full"
                  style={{ background: meta?.warna ?? "#94A3B8" }}
                />
                {meta?.label ?? kode}
              </Chip>
            );
          })}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="ml-auto text-xs font-medium text-[#EF4444] hover:underline"
            >
              Reset filter
            </button>
          )}
        </div>
      </section>

      {error ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 text-sm text-[#EF4444] shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
        >
          {error}
          <button type="button" onClick={load} className={`${BTN_GHOST} h-9`}>
            Coba lagi
          </button>
        </div>
      ) : loading && rows.length === 0 ? (
        <div
          className="space-y-2 rounded-xl bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)]"
          aria-label="Memuat rekap varian"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex animate-pulse gap-4 py-2">
              <div className="h-4 w-16 rounded bg-slate-200" />
              <div className="h-4 flex-1 rounded bg-slate-200" />
              <div className="h-4 w-24 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl bg-white px-6 py-12 text-center shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <p className="font-semibold text-[#1E3A5F]">Tidak ada data</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-[#6B7280]">
            Tidak ada barang pada periode dan status yang dipilih.
          </p>
          {(tanggalAwal || tanggalAkhir) && (
            <button
              type="button"
              onClick={() => handlePreset("")}
              className={`${BTN_GHOST} mt-4`}
            >
              Tampilkan semua tanggal
            </button>
          )}
        </div>
      ) : (
        <section className="space-y-3" aria-busy={loading}>
          <div className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 p-4">
              <div className="min-w-0">
                <h2 className="font-semibold text-[#1E3A5F]">Data Rekap Varian</h2>
                <p className="mt-0.5 text-xs text-[#6B7280]">
                  {periodeLabel} · {n(new Set(filtered.map(({ row }) => row.tanggal)).size)} tanggal · {n(filtered.length)} varian-hari ·{" "}
                  {n(grandTotal)} barang
                  {loading && <span className="ml-1">· memuat…</span>}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs text-[#6B7280]">
                  Item/halaman
                  <select
                    value={String(pageSize)}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-[#1F2937] focus:border-[#00A8E8] focus:outline-none"
                  >
                    {[20, 50, 100].map((size) => (
                      <option key={size} value={String(size)}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    downloadRekapBarangVariantPdf(
                      groups,
                      visibleStatuses,
                      periodeLabel,
                      (kode) => statusMeta.get(kode)?.label ?? kode,
                      `laporan-rekap-variant-${tanggalAwal || "semua"}-${tanggalAkhir || "tanggal"}.pdf`,
                    )
                  }
                  disabled={loading || filtered.length === 0}
                  className={`${MASTER_BTN} text-[#1E3A5F]`}
                  title="Unduh seluruh data sesuai filter sebagai PDF"
                >
                  <FontAwesomeIcon icon={faFilePdf} className="h-3.5 w-3.5" />
                  Laporan PDF
                </button>
                <button
                  type="button"
                  onClick={load}
                  disabled={loading}
                  className={MASTER_BTN}
                >
                  <FontAwesomeIcon
                    icon={faRotate}
                    className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                  />
                  Muat ulang
                </button>
              </div>
            </div>

            {/* --- Bagian tabel hanya dengan scroll horizontal (jika perlu) --- */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <caption className="sr-only">
                  Rekap jumlah barang per tanggal, item, ukuran, dan status
                </caption>
                <thead className="bg-[#F8FAFC]">
                  <tr className="border-b-2 border-slate-200 text-xs uppercase tracking-wider text-slate-600">
                    <th className="w-12 px-4 py-3.5 font-bold">No</th>
                    <th className="min-w-[200px] px-4 py-3.5 font-bold">Item</th>
                    <th className="px-4 py-3.5 font-bold">Size</th>
                    {visibleStatuses.map((kode) => (
                      <th key={kode} className="px-4 py-3.5 text-right font-bold">
                        {statusMeta.get(kode)?.label ?? kode}
                      </th>
                    ))}
                    <th className="px-4 py-3.5 text-right font-bold">
                      Total per Item
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {pageGroups.flatMap((group, groupIndex) => {
                    const rowsBefore = pageGroups
                      .slice(0, groupIndex)
                      .reduce((sum, item) => sum + item.rows.length, 0);
                    const dateHeader =
                      groupIndex === 0 ||
                      pageGroups[groupIndex - 1].tanggal !== group.tanggal;
                      
                    return [
                      ...(dateHeader
                        ? [
                            <tr
                              key={`tanggal-${group.tanggal ?? "kosong"}-${groupIndex}`}
                              className="bg-slate-100/80"
                            >
                              <td
                                colSpan={visibleStatuses.length + 4}
                                className="border-b border-slate-200 px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-slate-700"
                              >
                                {group.tanggal
                                  ? formatTanggal(group.tanggal)
                                  : "Tanpa tanggal"}
                              </td>
                            </tr>,
                          ]
                        : []),
                      ...group.rows.map(({ row }, rowIndex) => {
                        const isLastInGroup = rowIndex === group.rows.length - 1;
                        return (
                          <tr
                            key={`${group.key}-${row.variantId}`}
                            className={`transition-colors hover:bg-slate-50 ${
                              isLastInGroup
                                ? "border-b-2 border-slate-200"
                                : "border-b border-slate-100"
                            }`}
                          >
                            <td className="px-4 py-2.5 tabular-nums text-slate-500">
                              {rowOffset + rowsBefore + rowIndex + 1}
                            </td>
                            {rowIndex === 0 && (
                              <td
                                rowSpan={group.rows.length}
                                className="border-r border-slate-100 bg-slate-50/50 px-4 py-3 align-top font-semibold text-slate-800"
                              >
                                {group.item}
                              </td>
                            )}
                            <td className="px-4 py-2.5 font-medium text-slate-700">
                              {row.size}
                            </td>
                            {visibleStatuses.map((kode) => (
                              <td
                                key={kode}
                                className="px-4 py-2.5 text-right tabular-nums text-slate-600"
                              >
                                {n(row.perStatus[kode] ?? 0)}
                              </td>
                            ))}
                            {rowIndex === 0 && (
                              <td
                                rowSpan={group.rows.length}
                                className="border-l border-slate-100 bg-[#1E3A5F]/[0.02] px-4 py-3 text-right align-top font-bold tabular-nums text-[#1E3A5F]"
                              >
                                {n(group.total)}
                              </td>
                            )}
                          </tr>
                        );
                      }),
                    ];
                  })}
                </tbody>
                <tfoot className="bg-slate-50">
                  <tr className="border-t-2 border-slate-200 font-bold">
                    <td colSpan={3} className="px-4 py-3.5 text-[#1E3A5F]">
                      TOTAL KESELURUHAN
                    </td>
                    {totals.map((value, i) => (
                      <td
                        key={visibleStatuses[i]}
                        className="px-4 py-3.5 text-right tabular-nums text-[#1E3A5F]"
                      >
                        {n(value)}
                      </td>
                    ))}
                    <td className="px-4 py-3.5 text-right tabular-nums text-[#1E3A5F]">
                      {n(grandTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {/* --- Akhir bagian tabel --- */}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center sm:justify-end">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}