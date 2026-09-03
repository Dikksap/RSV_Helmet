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
    badge: "border-emerald-500/20 bg-emerald-500/10",
    text: "text-emerald-400",
  },
  REGISTER: {
    label: "Register",
    badge: "border-sky-500/20 bg-sky-500/10",
    text: "text-sky-400",
  },
  RETUR: {
    label: "Retur",
    badge: "border-amber-500/20 bg-amber-500/10",
    text: "text-amber-400",
  },
  OUT: {
    label: "Keluar",
    badge: "border-violet-500/20 bg-violet-500/10",
    text: "text-violet-400",
  },
  BAD: {
    label: "Rusak",
    badge: "border-rose-500/20 bg-rose-500/10",
    text: "text-rose-400",
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
    "h-12 w-full cursor-pointer rounded-xl border border-brand-border bg-brand-surface px-3.5 text-base font-medium text-white outline-none transition hover:border-brand-border/80 focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 sm:h-11 sm:text-sm";
  const labelCls = "grid gap-2 text-xs font-bold tracking-wide text-brand-grey";

  return (
    <div className="space-y-5 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end sm:gap-4">
        <div>
          <Link
            to="/admin/barang"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-brand-grey transition hover:text-brand-gold"
          >
            ← Kembali ke daftar barang
          </Link>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:mt-4 sm:text-3xl">
            Statistik Barang
          </h1>
          <p className="mt-2 text-sm text-brand-grey">
            Analisis distribusi jumlah barang berdasarkan variant dan batch produksi.
          </p>
        </div>
        {isFiltered && !isLoading && (
          <button
            type="button"
            onClick={handleResetFilter}
            className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-brand-border bg-brand-surface-card px-4 text-xs font-bold text-brand-grey-light transition hover:border-brand-gold/30 hover:text-brand-gold sm:h-9 sm:w-auto"
          >
            Reset filter
          </button>
        )}
      </div>

      {/* Filter Card */}
      <div className="rounded-2xl border border-brand-border bg-brand-surface-card p-4 shadow-sm sm:p-6">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-brand-grey sm:mb-4">
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
                className={`animate-pulse rounded-2xl border border-brand-border bg-brand-surface-card ${i === 0 ? "col-span-2 h-[120px] sm:col-span-1 sm:h-[104px]" : "h-[104px]"}`}
              />
            ))}
          </div>
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <div className="h-64 animate-pulse rounded-2xl border border-brand-border bg-brand-surface-card" />
            <div className="h-64 animate-pulse rounded-2xl border border-brand-border bg-brand-surface-card" />
          </div>
        </div>
      )}
      {error && (
        <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-300">
          {error}
        </p>
      )}
      {!isLoading && !error && stats && (
        <div className="space-y-5 sm:space-y-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div className="group relative col-span-2 overflow-hidden rounded-2xl border border-brand-gold/30 bg-gradient-to-br from-brand-surface-card to-brand-black p-4 shadow-sm transition hover:border-brand-gold/50 sm:col-span-1 sm:p-5">
              <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-brand-gold/10 blur-xl transition group-hover:bg-brand-gold/15" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-grey sm:text-xs">
                Total barang
              </p>
              <strong className="mt-2 block text-3xl font-black tabular-nums text-brand-gold sm:mt-3 sm:text-4xl">
                {stats.total}
              </strong>
              <p className="mt-1 truncate text-[11px] text-brand-grey sm:text-xs">
                {isFiltered ? "Hasil filter" : "Semua data"} • {stats.perVariant.length} varian • {stats.perBatch.length} batch
              </p>
            </div>
            {STATUS_ORDER.map((status) => (
              <div
                key={status}
                className="group rounded-2xl border border-brand-border bg-brand-surface-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-gold/20 hover:bg-brand-surface hover:shadow-md sm:p-5"
              >
                <p className="truncate text-[11px] font-bold uppercase tracking-wider text-brand-grey sm:text-xs">
                  {STATUS_META[status].label}
                </p>
                <div className="mt-2 flex items-end justify-between gap-2 sm:mt-3">
                  <div className="min-w-0">
                    <strong className="block text-2xl font-black tabular-nums text-white sm:text-3xl">
                      {stats.perStatus[status] ?? 0}
                    </strong>
                    <p className="mt-0.5 text-[11px] tabular-nums text-brand-grey sm:text-xs">
                      {pctOf(stats.perStatus[status] ?? 0, stats.total)} dari total
                    </p>
                  </div>
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border shadow-sm transition group-hover:scale-105 sm:h-9 sm:w-9 ${STATUS_META[status].badge} ${STATUS_META[status].text}`}
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
              <div className="h-64 animate-pulse rounded-2xl border border-brand-border bg-brand-surface-card" />
              <div className="h-64 animate-pulse rounded-2xl border border-brand-border bg-brand-surface-card" />
            </div>
          ) : batchError ? (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-300">
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
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-brand-border bg-brand-surface/40 px-4 py-3.5 sm:px-6 sm:py-4">
        <h2 className="truncate text-sm font-bold tracking-wide text-white">{title}</h2>
        <span className="shrink-0 rounded-full bg-brand-surface px-2.5 py-1 text-xs font-bold tabular-nums text-brand-grey">
          {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-brand-grey sm:px-6">Tidak ada data.</p>
      ) : (
        <div className="max-h-[300px] divide-y divide-brand-border overflow-y-auto sm:max-h-[340px]">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-brand-surface/60 sm:gap-4 sm:px-6 sm:py-3.5"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-brand-grey-light">
                {row.label}
              </span>
              <strong className="shrink-0 rounded-full border border-brand-gold/20 bg-brand-gold/10 px-2.5 py-1 text-xs font-bold tabular-nums text-brand-gold sm:px-3 sm:text-sm">
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
    <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-brand-border bg-brand-surface/40 px-4 py-3.5 sm:px-6 sm:py-4">
        <h2 className="truncate text-sm font-bold tracking-wide text-white">{title}</h2>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
            title === "Batch Aktif"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              : "border-brand-grey/20 bg-brand-grey/10 text-brand-grey-light"
          }`}
        >
          {rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-brand-grey sm:px-6">Tidak ada data.</p>
      ) : (
        <>
          {/* Kartu susun untuk layar kecil */}
          <div className="divide-y divide-brand-border sm:hidden">
            {rows.map((row) => (
              <div key={row.batchId} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-sm font-bold text-brand-gold">
                    Batch {String(row.nomorBatch).padStart(3, "0")}
                  </span>
                  <span className="rounded-full border border-brand-gold/20 bg-brand-gold/10 px-2.5 py-0.5 text-xs font-bold tabular-nums text-brand-gold">
                    {row.totalProduksi} pcs
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-brand-surface/60 px-2.5 py-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-grey">Mulai</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-brand-grey-light">{formatDateTime(row.tanggalMulai)}</p>
                  </div>
                  <div className="rounded-lg bg-brand-surface/60 px-2.5 py-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-grey">Selesai</p>
                    <p className="mt-0.5 text-[11px] leading-4 text-brand-grey-light">{formatDateTime(row.tanggalSelesai)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Tabel untuk layar besar */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-brand-surface/60 text-[10px] uppercase tracking-wider text-brand-grey">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">Batch</th>
                  <th className="px-6 py-3.5 font-semibold">Total Produksi</th>
                  <th className="px-6 py-3.5 font-semibold">Mulai</th>
                  <th className="px-6 py-3.5 font-semibold">Selesai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border text-brand-grey-light">
                {rows.map((row) => (
                  <tr key={row.batchId} className="transition hover:bg-brand-surface/60">
                    <td className="px-6 py-4 font-mono text-sm font-bold text-brand-gold">
                      {String(row.nomorBatch).padStart(3, "0")}
                    </td>
                    <td className="px-6 py-4 font-medium tabular-nums text-white">
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
