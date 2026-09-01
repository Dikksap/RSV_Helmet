import { useCallback, useEffect, useMemo, useState } from "react";
import {
  exportBarang,
  getBarangPage,
  searchBarang,
  type Barang,
  type StatusBarang,
} from "../api/barang";
import { getProducts, type Product } from "../api/products";
import { HeaderSection } from "../components/DaftarBarang/HeaderSection";
import { FilterSection } from "../components/DaftarBarang/FilterSection";
import { BarangTable } from "../components/DaftarBarang/BarangTable";
import { Pagination } from "../components/DaftarBarang/Pagination";
import { QRModal } from "../components/DaftarBarang/QRModal";

function DaftarBarang() {
  const [barang, setBarang] = useState<Barang[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [variantFilter, setVariantFilter] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [tanggalAwal, setTanggalAwal] = useState("");
  const [tanggalAkhir, setTanggalAkhir] = useState("");
  const [datePreset, setDatePreset] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBarang, setTotalBarang] = useState(0);
  const [selectedBarang, setSelectedBarang] = useState<Barang | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
  
    return () => window.clearInterval(id);
  }, []);

  const fetchBarang = useCallback(
    async (page = 1) => {
      setIsLoading(true);
      setError(null);
      try {
        const data =
          search &&
          !statusFilter &&
          !variantFilter &&
          !tanggalAwal &&
          !tanggalAkhir
            ? await searchBarang(search, 20)
            : await getBarangPage({
                page,
                limit: 20,
                variantId: variantFilter ? Number(variantFilter) : undefined,
                status: statusFilter
                  ? (statusFilter as StatusBarang)
                  : undefined,
                tanggalAwal: tanggalAwal || undefined,
                tanggalAkhir: tanggalAkhir || undefined,
              });
        setBarang(data.data);
        setTotalPages("totalPages" in data.meta ? data.meta.totalPages : 1);
        setTotalBarang(
          "total" in data.meta ? data.meta.total : data.meta.count,
        );
        setCurrentPage(page);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat barang");
      } finally {
        setIsLoading(false);
      }
    },
    [tanggalAwal, tanggalAkhir, variantFilter, search, statusFilter],
  );

  useEffect(() => {
    const refreshId = window.setTimeout(() => void fetchBarang(1), 0);
    return () => window.clearTimeout(refreshId);
  }, [fetchBarang]);

  useEffect(() => {
    getProducts()
      .then(setProducts)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedBarang(null);
    };
    if (selectedBarang) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedBarang]);

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

  const hasActiveFilters =
    Boolean(search) ||
    Boolean(statusFilter) ||
    Boolean(variantFilter) ||
    Boolean(tanggalAwal) ||
    Boolean(tanggalAkhir);

  const handleResetFilters = () => {
    setSearch("");
    setStatusFilter("");
    setVariantFilter("");
    setTanggalAwal("");
    setTanggalAkhir("");
    setDatePreset("");
  };

  const handleExport = async (format: "json" | "csv") => {
    setIsExporting(true);
    try {
      const blob = await exportBarang({
        format,
        variantId: variantFilter ? Number(variantFilter) : undefined,
        status: statusFilter ? (statusFilter as StatusBarang) : undefined,
        tanggalAwal: tanggalAwal || undefined,
        tanggalAkhir: tanggalAkhir || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `barang-export-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal export barang");
    } finally {
      setIsExporting(false);
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const formatRelativeTime = (date: string, nowMs: number) => {
    const diffMs = nowMs - new Date(date).getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return "baru saja";
    if (minutes < 60) return `${minutes} menit lalu`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} jam lalu`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} hari lalu`;
    return `${Math.floor(days / 7)} minggu lalu`;
  };

  return (
    <div className="space-y-6">
      <HeaderSection
        totalBarang={totalBarang}
        isExporting={isExporting}
        onExportCSV={() => handleExport("csv")}
        onExportJSON={() => handleExport("json")}
      />

      <FilterSection
        search={search}
        statusFilter={statusFilter}
        variantFilter={variantFilter}
        tanggalAwal={tanggalAwal}
        tanggalAkhir={tanggalAkhir}
        datePreset={datePreset}
        variantOptions={variantOptions}
        currentPage={currentPage}
        totalPages={totalPages}
        hasActiveFilters={hasActiveFilters}
        onSearchChange={setSearch}
        onStatusChange={setStatusFilter}
        onVariantChange={setVariantFilter}
        onDatePresetChange={setDatePreset}
        onTanggalAwalChange={setTanggalAwal}
        onTanggalAkhirChange={setTanggalAkhir}
        onResetFilters={handleResetFilters}
      />

      {isLoading && (
        <div className="flex items-center justify-center rounded-2xl border border-brand-border bg-brand-surface-card p-12">
          <p className="animate-pulse text-sm text-brand-grey">
            Memuat data barang...
          </p>
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          {error}
        </div>
      )}

      {!isLoading && !error && (
        <section className="space-y-4">
          {barang.length === 0 ? (
            <div className="rounded-2xl border border-brand-border bg-brand-surface-card p-12 text-center text-sm italic text-brand-grey">
              {hasActiveFilters
                ? "Tidak ada barang yang memenuhi kriteria filter."
                : "Belum ada data barang."}
            </div>
          ) : (
            <>
              <BarangTable
                barang={barang}
                currentPage={currentPage}
                totalBarang={totalBarang}
                now={now}
                onRowClick={setSelectedBarang}
                formatDate={formatDate}
                formatRelativeTime={formatRelativeTime}
              />
              {totalPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={fetchBarang}
                />
              )}
            </>
          )}
        </section>
      )}

      {selectedBarang && (
        <QRModal barang={selectedBarang} onClose={() => setSelectedBarang(null)} />
      )}
    </div>
  );
}

export default DaftarBarang;
