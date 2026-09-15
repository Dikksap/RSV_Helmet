import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faArrowRightFromBracket,
  faCheckCircle,
  faClipboardList,
  faRotateLeft,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import {
  getBarangStats,
  getBatchRentangTanggal,
  type BarangStats,
  type BatchRentangTanggal,
  type StatusBarang,
} from "../api/barang";
import { getProducts, type Product } from "../api/products";

const STATUS_ORDER: StatusBarang[] = [
  "FINISHGOOD",
  "REGISTER",
  "RETUR",
  "OUT",
  "BAD",
];

const STATUS_META: Record<
  StatusBarang,
  { label: string; badge: string; text: string }
> = {
  FINISHGOOD: {
    label: "Finish Good",
    badge: "border-emerald-200 bg-emerald-50",
    text: "text-emerald-700",
  },
  REGISTER: {
    label: "Register",
    badge: "border-sky-200 bg-sky-50",
    text: "text-sky-700",
  },
  RETUR: {
    label: "Retur",
    badge: "border-amber-200 bg-amber-50",
    text: "text-amber-700",
  },
  OUT: {
    label: "Keluar",
    badge: "border-[#1E3A5F]/15 bg-[#1E3A5F]/5",
    text: "text-[#1E3A5F]",
  },
  BAD: {
    label: "Rusak",
    badge: "border-red-200 bg-red-50",
    text: "text-[#EF4444]",
  },
};

const STATUS_ICON: Record<StatusBarang, IconDefinition> = {
  FINISHGOOD: faCheckCircle,
  REGISTER: faClipboardList,
  RETUR: faRotateLeft,
  OUT: faArrowRightFromBracket,
  BAD: faTriangleExclamation,
};

function pctOf(part: number, total: number): string {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : "—";
}

function StatistikBarang() {
  const [stats, setStats] = useState<BarangStats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [variantId, setVariantId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [batchSelesai, setBatchSelesai] = useState<BatchRentangTanggal[]>([]);
  const [batchAktif, setBatchAktif] = useState<BatchRentangTanggal[]>([]);
  const [batchLoading, setBatchLoading] = useState(true);
  const [batchError, setBatchError] = useState<string | null>(null);

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(() => undefined);

    getBatchRentangTanggal()
      .then((res) => {
        setBatchSelesai(res.selesai);
        setBatchAktif(res.aktif);
        setBatchError(null);
      })
      .catch(() => setBatchError("Gagal memuat rentang tanggal batch."))
      .finally(() => setBatchLoading(false));
  }, []);

  useEffect(() => {
    getBarangStats({
      variantId: variantId ? Number(variantId) : undefined,
      batchId: batchId ? Number(batchId) : undefined,
    })
      .then(setStats)
      .catch((err: unknown) =>
        setError(
          err instanceof Error ? err.message : "Gagal memuat statistik barang",
        ),
      )
      .finally(() => setIsLoading(false));
  }, [variantId, batchId]);

  const handleVariantChange = (value: string) => {
    if (value) setBatchId("");
    setIsLoading(true);
    setError(null);
    setVariantId(value);
  };

  const handleBatchChange = (value: string) => {
    if (value) setVariantId("");
    setIsLoading(true);
    setError(null);
    setBatchId(value);
  };

  const handleResetFilter = () => {
    setIsLoading(true);
    setError(null);
    setVariantId("");
    setBatchId("");
  };

  const isFiltered = Boolean(variantId || batchId);

  const variantOptions = useMemo(
    () =>
      products
        .flatMap((product) =>
          product.variants.map((variant) => ({
            id: variant.id,
            nama: `${product.nama} / ${variant.style.nama} / ${variant.color.nama} / ${variant.size.nama}`,
          })),
        )
        .sort((a, b) => a.nama.localeCompare(b.nama)),
    [products],
  );

  const batchOptions = stats?.perBatch ?? [];

  const inputCls =
    "h-9 w-full cursor-pointer rounded-lg border border-[#D1D5DB] bg-white px-3 text-[14px] text-[#1F2937] outline-none transition placeholder:text-[#6B7280]/60 focus:border-[#00A8E8] focus:ring-2 focus:ring-[#00A8E8]/20";
  const labelCls = "grid gap-1 text-xs font-medium text-[#1F2937]";

  return (
    <div className="mx-auto w-full max-w-7xl space-y-3">
      {/* Header compact single row */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm sm:px-4">
        <div className="min-w-0">
          <Link
            to="/admin/barang"
            className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] hover:text-[#00A8E8]"
          >
            ← Daftar barang
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold leading-none tracking-tight text-[#1E3A5F] sm:text-xl">
              Statistik Barang
            </h1>
            {!isLoading && stats && (
              <span className="inline-flex items-center rounded-full border border-[#1E3A5F]/10 bg-[#F5F7FA] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#1E3A5F]">
                {stats.total.toLocaleString("id-ID")} total
              </span>
            )}
          </div>
          <p className="mt-0.5 hidden text-xs leading-none text-[#6B7280] sm:block">
            Distribusi per variant & batch
          </p>
        </div>
        {isFiltered && !isLoading && (
          <button
            type="button"
            onClick={handleResetFilter}
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-[#6B7280] hover:bg-slate-50 hover:text-[#1F2937]"
          >
            Reset filter
          </button>
        )}
      </div>

      {/* Filter Card compact */}
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#1E3A5F]">
            Filter Analisis
          </p>
          {isFiltered && (
            <span className="text-[11px] font-medium text-[#00A8E8]">Filter aktif</span>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={labelCls}>
            <span>Variant</span>
            <select
              value={variantId}
              onChange={(event) => handleVariantChange(event.target.value)}
              className={inputCls}
            >
              <option value="">Semua variant</option>
              {variantOptions.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.nama}
                </option>
              ))}
            </select>
          </label>
          <label className={labelCls}>
            <span>Batch</span>
            <select
              value={batchId}
              onChange={(event) => handleBatchChange(event.target.value)}
              className={inputCls}
            >
              <option value="">Semua batch</option>
              {batchOptions.map((batch) => (
                <option key={batch.batchId} value={batch.batchId}>
                  {String(batch.nomorBatch).padStart(3, "0")}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`animate-pulse rounded-xl border border-slate-200 bg-white ${i === 0 ? "col-span-2 h-[84px] sm:col-span-1" : "h-[84px]"}`}
              />
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />
            <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />
          </div>
        </div>
      )}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-[#EF4444]">
          {error}
        </p>
      )}
      {!isLoading && !error && stats && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:gap-2 md:grid-cols-3 xl:grid-cols-6">
            <div className="group relative col-span-2 overflow-hidden rounded-xl border border-[#00A8E8]/20 bg-gradient-to-br from-white to-[#F5F7FA] p-3.5 shadow-sm sm:col-span-1">
              <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-[#00A8E8]/10 blur-xl" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#1E3A5F]">
                Total barang
              </p>
              <strong className="mt-1.5 block text-2xl font-bold tabular-nums text-[#1E3A5F]">
                {stats.total.toLocaleString("id-ID")}
              </strong>
              <p className="mt-0.5 truncate text-[11px] text-[#6B7280]">
                {isFiltered ? "Hasil filter" : "Semua"} • {stats.perVariant.length} varian • {stats.perBatch.length} batch
              </p>
            </div>
            {STATUS_ORDER.map((status) => (
              <div
                key={status}
                className="group rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm hover:shadow"
              >
                <p className="truncate text-[11px] font-bold uppercase tracking-wider text-[#1E3A5F]">
                  {STATUS_META[status].label}
                </p>
                <div className="mt-1.5 flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <strong className="block text-2xl font-bold tabular-nums leading-none text-[#1F2937]">
                      {(stats.perStatus[status] ?? 0).toLocaleString("id-ID")}
                    </strong>
                    <p className="mt-1 text-[11px] tabular-nums leading-none text-[#6B7280]">
                      {pctOf(stats.perStatus[status] ?? 0, stats.total)}
                    </p>
                  </div>
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border shadow-sm ${STATUS_META[status].badge} ${STATUS_META[status].text}`}
                  >
                    <FontAwesomeIcon icon={STATUS_ICON[status]} className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <StatsTable
              title="Jumlah per variant"
              rows={stats.perVariant.map((item) => ({
                label: item.nama,
                total: item.total,
              }))}
            />
            <StatsTable
              title="Jumlah per batch"
              rows={stats.perBatch.map((item) => ({
                label: `BC${String(item.nomorBatch).padStart(3, "0")}`,
                total: item.total,
              }))}
            />
          </div>

          {batchLoading ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />
              <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />
            </div>
          ) : batchError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-[#EF4444]">
              {batchError}
            </p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              <BatchRentangTable title="Batch Selesai" rows={batchSelesai} />
              <BatchRentangTable title="Batch Aktif" rows={batchAktif} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatsTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; total: number }>;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-[#F5F7FA] px-3 py-2.5">
        <h2 className="truncate text-xs font-bold tracking-wide text-[#1E3A5F]">{title}</h2>
        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#6B7280]">
          {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-8 text-center text-sm text-[#6B7280]">Tidak ada data.</p>
      ) : (
        <div className="max-h-[260px] divide-y divide-slate-100 overflow-y-auto">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-[#F5F7FA]"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] text-[#1F2937]">
                {row.label}
              </span>
              <strong className="shrink-0 rounded-full border border-[#00A8E8]/15 bg-[#00A8E8]/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-[#00A8E8]">
                {row.total}
              </strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function BatchRentangTable({
  title,
  rows,
}: {
  title: string;
  rows: BatchRentangTanggal[];
}) {
  const formatDateTime = (value: string) =>
    new Date(value).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-[#F5F7FA] px-3 py-2.5">
        <h2 className="truncate text-xs font-bold tracking-wide text-[#1E3A5F]">{title}</h2>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
            title === "Batch Aktif"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-white text-[#6B7280]"
          }`}
        >
          {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-8 text-center text-sm text-[#6B7280]">Tidak ada data.</p>
      ) : (
        <>
          {/* mobile cards */}
          <div className="divide-y divide-slate-100 sm:hidden">
            {rows.map((row) => (
              <div key={row.batchId} className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-[#1E3A5F]">
                    BC{String(row.nomorBatch).padStart(3, "0")}
                  </span>
                  <span className="rounded-full border border-[#00A8E8]/15 bg-[#00A8E8]/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#00A8E8]">
                    {row.totalProduksi} pcs
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <div className="rounded-lg bg-[#F5F7FA] px-2 py-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">Mulai</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-[#1F2937]">{formatDateTime(row.tanggalMulai)}</p>
                  </div>
                  <div className="rounded-lg bg-[#F5F7FA] px-2 py-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">Selesai</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-[#1F2937]">{formatDateTime(row.tanggalSelesai)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* desktop table */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[480px] text-left text-[13px]">
              <thead className="bg-[#F5F7FA] text-[11px] uppercase tracking-wider text-[#1E3A5F]">
                <tr>
                  <th className="px-3 py-2 font-bold">Batch</th>
                  <th className="px-3 py-2 font-bold">Total</th>
                  <th className="px-3 py-2 font-bold">Mulai</th>
                  <th className="px-3 py-2 font-bold">Selesai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[#1F2937]">
                {rows.map((row) => (
                  <tr key={row.batchId} className="hover:bg-[#F5F7FA]">
                    <td className="px-3 py-2 font-mono text-xs font-bold text-[#1E3A5F]">
                      BC{String(row.nomorBatch).padStart(3, "0")}
                    </td>
                    <td className="px-3 py-2 font-medium tabular-nums">
                      {row.totalProduksi}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">
                      {formatDateTime(row.tanggalMulai)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">
                      {formatDateTime(row.tanggalSelesai)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

export default StatistikBarang;
