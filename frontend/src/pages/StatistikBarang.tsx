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
    "h-12 w-full cursor-pointer rounded-lg border border-[#D1D5DB] bg-white px-3.5 text-[15px] font-normal text-[#1F2937] outline-none transition duration-200 ease hover:border-[#6B7280] focus:border-[#00A8E8] focus:ring-2 focus:ring-[#00A8E8]/20";
  const labelCls = "grid gap-2 text-sm font-medium text-[#1F2937]";

  return (
    <div className="space-y-5 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end sm:gap-4">
        <div>
          <Link
            to="/admin/barang"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#6B7280] transition duration-200 ease hover:text-[#00A8E8]"
          >
            ← Kembali ke daftar barang
          </Link>
          <h1 className="mt-3 text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:mt-4 sm:text-4xl">
            Statistik Barang
          </h1>
          <p className="mt-2 text-base text-[#6B7280]">
            Analisis distribusi jumlah barang berdasarkan variant dan batch produksi.
          </p>
        </div>
        {isFiltered && !isLoading && (
          <button
            type="button"
            onClick={handleResetFilter}
            className="inline-flex min-h-[48px] w-full items-center justify-center rounded-lg bg-[#F5F7FA] px-6 py-3 text-sm font-medium text-[#6B7280] transition duration-200 ease hover:bg-slate-200 hover:text-[#1F2937] sm:w-auto"
          >
            Reset filter
          </button>
        )}
      </div>

      {/* Filter Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#1E3A5F] sm:mb-4">
          Filter Analisis
        </p>
        <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
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
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`animate-pulse rounded-xl border border-slate-200 bg-white ${i === 0 ? "col-span-2 h-[120px] sm:col-span-1 sm:h-[104px]" : "h-[104px]"}`}
              />
            ))}
          </div>
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />
            <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />
          </div>
        </div>
      )}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[15px] font-medium text-[#EF4444]">
          {error}
        </p>
      )}
      {!isLoading && !error && stats && (
        <div className="space-y-5 sm:space-y-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div className="group relative col-span-2 overflow-hidden rounded-xl border border-[#00A8E8]/30 bg-gradient-to-br from-white to-[#F5F7FA] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition duration-200 ease hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.10)] sm:col-span-1">
              <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-[#00A8E8]/10 blur-xl transition group-hover:bg-[#00A8E8]/15" />
              <p className="text-xs font-semibold uppercase tracking-wider text-[#1E3A5F]">
                Total barang
              </p>
              <strong className="mt-2 block text-4xl font-bold tabular-nums text-[#1E3A5F] sm:mt-3">
                {stats.total}
              </strong>
              <p className="mt-1 truncate text-xs text-[#6B7280]">
                {isFiltered ? "Hasil filter" : "Semua data"} • {stats.perVariant.length} varian • {stats.perBatch.length} batch
              </p>
            </div>
            {STATUS_ORDER.map((status) => (
              <div
                key={status}
                className="group rounded-xl border border-slate-200 bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition duration-200 ease hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.10)]"
              >
                <p className="truncate text-xs font-semibold uppercase tracking-wider text-[#1E3A5F]">
                  {STATUS_META[status].label}
                </p>
                <div className="mt-2 flex items-end justify-between gap-2 sm:mt-3">
                  <div className="min-w-0">
                    <strong className="block text-3xl font-bold tabular-nums text-[#1F2937]">
                      {stats.perStatus[status] ?? 0}
                    </strong>
                    <p className="mt-0.5 text-xs tabular-nums text-[#6B7280]">
                      {pctOf(stats.perStatus[status] ?? 0, stats.total)} dari total
                    </p>
                  </div>
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border shadow-sm transition duration-200 ease group-hover:scale-105 sm:h-9 sm:w-9 ${STATUS_META[status].badge} ${STATUS_META[status].text}`}
                  >
                    <FontAwesomeIcon icon={STATUS_ICON[status]} className="h-4 w-4" />
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
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
                label: `${String(item.nomorBatch).padStart(3, "0")}`,
                total: item.total,
              }))}
            />
          </div>

          {batchLoading ? (
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
              <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />
              <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />
            </div>
          ) : batchError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[15px] font-medium text-[#EF4444]">
              {batchError}
            </p>
          ) : (
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
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
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-[#F5F7FA] px-4 py-3.5 sm:px-6 sm:py-4">
        <h2 className="truncate text-sm font-semibold tracking-wide text-[#1E3A5F]">{title}</h2>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold tabular-nums text-[#6B7280]">
          {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-[15px] text-[#6B7280] sm:px-6">Tidak ada data.</p>
      ) : (
        <div className="max-h-[300px] divide-y divide-slate-100 overflow-y-auto sm:max-h-[340px]">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-3 px-4 py-3 transition duration-200 ease hover:bg-[#F5F7FA] sm:gap-4 sm:px-6 sm:py-3.5"
            >
              <span className="min-w-0 flex-1 truncate text-[15px] font-normal text-[#1F2937]">
                {row.label}
              </span>
              <strong className="shrink-0 rounded-full border border-[#00A8E8]/20 bg-[#00A8E8]/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-[#00A8E8] sm:px-3 sm:text-sm">
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
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-[#F5F7FA] px-4 py-3.5 sm:px-6 sm:py-4">
        <h2 className="truncate text-sm font-semibold tracking-wide text-[#1E3A5F]">{title}</h2>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
            title === "Batch Aktif"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-[#F5F7FA] text-[#6B7280]"
          }`}
        >
          {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-[15px] text-[#6B7280] sm:px-6">Tidak ada data.</p>
      ) : (
        <>
          {/* Kartu susun untuk layar kecil */}
          <div className="divide-y divide-slate-100 sm:hidden">
            {rows.map((row) => (
              <div key={row.batchId} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm font-bold text-[#1E3A5F]">
                    Batch {String(row.nomorBatch).padStart(3, "0")}
                  </span>
                  <span className="rounded-full border border-[#00A8E8]/20 bg-[#00A8E8]/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-[#00A8E8]">
                    {row.totalProduksi} pcs
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-[#F5F7FA] px-2.5 py-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Mulai</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-[#1F2937]">{formatDateTime(row.tanggalMulai)}</p>
                  </div>
                  <div className="rounded-lg bg-[#F5F7FA] px-2.5 py-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">Selesai</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-[#1F2937]">{formatDateTime(row.tanggalSelesai)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Tabel untuk layar besar */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[520px] text-left text-[15px]">
              <thead className="bg-[#F5F7FA] text-[11px] uppercase tracking-wider text-[#1E3A5F]">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">Batch</th>
                  <th className="px-6 py-3.5 font-semibold">Total Produksi</th>
                  <th className="px-6 py-3.5 font-semibold">Mulai</th>
                  <th className="px-6 py-3.5 font-semibold">Selesai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[#1F2937]">
                {rows.map((row) => (
                  <tr key={row.batchId} className="transition duration-200 ease hover:bg-[#F5F7FA]">
                    <td className="px-6 py-4 font-mono text-sm font-bold text-[#1E3A5F]">
                      {String(row.nomorBatch).padStart(3, "0")}
                    </td>
                    <td className="px-6 py-4 font-medium tabular-nums text-[#1F2937]">
                      {row.totalProduksi}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      {formatDateTime(row.tanggalMulai)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
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
