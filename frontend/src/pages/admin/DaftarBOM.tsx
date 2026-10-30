import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faArrowsRotate,
  faBoxOpen,
  faChevronDown,
  faChevronRight,
  faCircleQuestion,
  faLayerGroup,
  faMagnifyingGlass,
  faPlus,
  faSitemap,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { getBoms, type Bom, type BomItem } from "../../api/bom";
import KpiStrip from "../../components/admin/PlanProduction/KpiStrip";

type OutputFilter = "all" | "product" | "subassembly";
type ActiveFilter = "all" | "active" | "inactive";

type OutputLabel = {
  kind: "Produk" | "Subassembly" | "Tidak diketahui";
  title: string;
  subtitle: string;
};

const FIELD = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20";
const BUTTON = "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY = "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1E3A5F] px-4 text-sm font-semibold text-white transition hover:bg-[#162C48] disabled:cursor-not-allowed disabled:opacity-50";
const SMALL = "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50";

const OUTPUT_OPTIONS: { value: OutputFilter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "product", label: "Produk" },
  { value: "subassembly", label: "Subassembly" },
];

const STATUS_OPTIONS: { value: ActiveFilter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Nonaktif" },
];

const OUTPUT_TONE: Record<OutputLabel["kind"], { tile: string; text: string; icon: IconDefinition }> = {
  Produk: { tile: "bg-sky-50 text-sky-600", text: "text-sky-700", icon: faBoxOpen },
  Subassembly: { tile: "bg-violet-50 text-violet-600", text: "text-violet-700", icon: faLayerGroup },
  "Tidak diketahui": { tile: "bg-slate-100 text-slate-400", text: "text-slate-500", icon: faCircleQuestion },
};

function itemLabel(item: BomItem) {
  return item.item?.nama ?? item.subassembly?.nama ?? "Komponen tidak dikenal";
}

function itemCode(item: BomItem) {
  return item.item?.kode ?? item.subassembly?.kode ?? "-";
}

function countItems(items: BomItem[]): number {
  return items.reduce((total, item) => total + 1 + countItems(item.children ?? []), 0);
}

function getDepth(items: BomItem[]): number {
  return items.reduce((max, item) => Math.max(max, 1 + getDepth(item.children ?? [])), 0);
}

function productVariantLabel(bom: Bom): string {
  const variant = bom.productVariant;
  if (!variant) return "";
  return [
    variant.product?.nama,
    variant.style?.nama,
    variant.color?.nama,
    variant.size?.nama,
  ].filter((part): part is string => Boolean(part?.trim())).join(" ");
}

function searchableBomText(bom: Bom): string {
  const componentText = (items: BomItem[]): string => items
    .map((item) => `${itemLabel(item)} ${itemCode(item)} ${componentText(item.children ?? [])}`)
    .join(" ");
  const outputText = bom.productVariant
    ? `${productVariantLabel(bom)} ${bom.productVariant.kodeVariant}`
    : `${bom.subassembly?.kode ?? ""} ${bom.subassembly?.nama ?? ""}`;
  return `${bom.nama} ${bom.kode ?? ""} ${bom.version} ${outputText} ${componentText(bom.items)}`.toLocaleLowerCase();
}

function outputLabel(bom: Bom): OutputLabel {
  if (bom.productVariant) {
    return {
      kind: "Produk",
      title: productVariantLabel(bom) || `Produk variant #${bom.productVariant.id}`,
      subtitle: bom.productVariant.kodeVariant,
    };
  }
  if (bom.subassembly) {
    return { kind: "Subassembly", title: bom.subassembly.nama, subtitle: bom.subassembly.kode };
  }
  return { kind: "Tidak diketahui", title: "Output tidak diketahui", subtitle: "" };
}

function versionLabel(version: string) {
  return /^v/i.test(version) ? version : `v${version}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function errorText(reason: unknown) {
  return reason instanceof Error ? reason.message : "Gagal memuat daftar BOM.";
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-semibold text-slate-600">{label}</span>
      <div role="group" aria-label={label} className="inline-flex rounded-xl bg-slate-100 p-1">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={`h-8 rounded-lg px-3 text-xs font-semibold transition ${
                active ? "bg-[#1E3A5F] text-white shadow-sm" : "text-slate-600 hover:bg-white/70"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DaftarBOM() {
  const [rows, setRows] = useState<Bom[]>([]);
  const [search, setSearch] = useState("");
  const [outputFilter, setOutputFilter] = useState<OutputFilter>("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    try {
      setRows(await getBoms());
      setError(null);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    getBoms()
      .then((data) => {
        if (!alive) return;
        setRows(data);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (alive) setError(errorText(reason));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  const reload = () => {
    setRefreshing(true);
    void fetchRows();
  };

  const retry = () => {
    setLoading(true);
    void fetchRows();
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return rows.filter((bom) => {
      if (outputFilter === "product" && !bom.productVariantId) return false;
      if (outputFilter === "subassembly" && !bom.subassemblyId) return false;
      if (activeFilter === "active" && !bom.isActive) return false;
      if (activeFilter === "inactive" && bom.isActive) return false;
      return !query || searchableBomText(bom).includes(query);
    });
  }, [rows, search, outputFilter, activeFilter]);

  const activeCount = rows.filter((bom) => bom.isActive).length;
  const productCount = rows.filter((bom) => bom.productVariantId).length;
  const subassemblyCount = rows.filter((bom) => bom.subassemblyId).length;
  const hasFilter = search.trim() !== "" || outputFilter !== "all" || activeFilter !== "all";
  const allExpanded = filtered.length > 0 && filtered.every((bom) => expandedIds.has(bom.id));
  const latestUpdate = rows.reduce<string | null>(
    (latest, bom) => (!latest || new Date(bom.updatedAt) > new Date(latest) ? bom.updatedAt : latest),
    null,
  );

  const resetFilters = () => {
    setSearch("");
    setOutputFilter("all");
    setActiveFilter("all");
  };

  const toggleExpanded = (id: number) => setExpandedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const toggleAll = () => setExpandedIds((current) => {
    const next = new Set(current);
    filtered.forEach((bom) => {
      if (allExpanded) next.delete(bom.id);
      else next.add(bom.id);
    });
    return next;
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Manajemen Produksi</p>
          <h1 className="mt-1 flex flex-wrap items-center gap-2.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Daftar BOM
            {!loading && (
              <span className="rounded-full bg-[#00A8E8]/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-[#0088C0]">
                {rows.length.toLocaleString("id-ID")} BOM
              </span>
            )}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Bill of materials untuk produk jadi dan subassembly. Buka baris untuk melihat susunan komponen per level.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={reload} className={BUTTON} disabled={loading || refreshing}>
            <FontAwesomeIcon icon={faArrowsRotate} className={refreshing ? "animate-spin" : ""} />
            Muat ulang
          </button>
          <Link to="/admin/bom" className={PRIMARY}>
            <FontAwesomeIcon icon={faPlus} />
            Penyusun BOM
          </Link>
        </div>
      </header>

      {!loading && rows.length > 0 && (
        <KpiStrip
          items={[
            { label: "Total BOM", value: rows.length.toLocaleString("id-ID") },
            { label: "BOM aktif", value: activeCount.toLocaleString("id-ID"), tone: "green" },
            { label: "Produk", value: productCount.toLocaleString("id-ID") },
            { label: "Subassembly", value: subassemblyCount.toLocaleString("id-ID"), tone: "muted" },
          ]}
        />
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <label className="flex-1 space-y-1.5 text-xs font-semibold text-slate-600 xl:max-w-md">
            Cari BOM atau komponen
            <span className="relative block">
              <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                className={`${FIELD} pl-9 [&::-webkit-search-cancel-button]:appearance-none ${search ? "pr-11" : ""}`}
                placeholder="Kode, nama output, versi, atau komponen..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Hapus kata kunci"
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <FontAwesomeIcon icon={faXmark} className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          </label>
          <div className="flex flex-wrap items-end gap-4">
            <Segmented label="Jenis output" value={outputFilter} options={OUTPUT_OPTIONS} onChange={setOutputFilter} />
            <Segmented label="Status" value={activeFilter} options={STATUS_OPTIONS} onChange={setActiveFilter} />
            {hasFilter && (
              <button type="button" onClick={resetFilters} className={BUTTON}>
                Reset filter
              </button>
            )}
          </div>
        </div>
      </section>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>Gagal memuat daftar BOM: {error}</span>
          <button type="button" onClick={retry} className="font-semibold underline">Coba lagi</button>
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Struktur BOM</h2>
            <p className="mt-0.5 text-xs text-slate-500" aria-live="polite">
              {loading ? "Memuat data..." : `${filtered.length} dari ${rows.length} BOM ditampilkan`}
              {!loading && latestUpdate && <span className="hidden sm:inline"> · diperbarui {formatDate(latestUpdate)}</span>}
            </p>
          </div>
          {!loading && filtered.length > 0 && (
            <button type="button" onClick={toggleAll} className={SMALL}>
              <FontAwesomeIcon icon={allExpanded ? faChevronDown : faChevronRight} className="h-3 w-3" />
              {allExpanded ? "Tutup semua" : "Buka semua"}
            </button>
          )}
        </div>

        {loading ? (
          <div aria-busy="true" aria-label="Memuat daftar BOM">
            <span className="sr-only">Memuat daftar BOM...</span>
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="flex items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-0">
                <span className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-slate-100" />
                <span className="flex-1 space-y-2">
                  <span className="block h-3 w-1/3 animate-pulse rounded bg-slate-100" />
                  <span className="block h-2.5 w-1/5 animate-pulse rounded bg-slate-100" />
                </span>
                <span className="h-3 w-20 animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : !error && filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              <FontAwesomeIcon icon={rows.length ? faMagnifyingGlass : faSitemap} className="h-6 w-6" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-slate-900">
              {rows.length ? "Tidak ada BOM yang cocok" : "Belum ada BOM"}
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              {rows.length
                ? "Coba kata kunci lain atau kembalikan filter ke semua."
                : "Buat BOM pertama Anda lewat Penyusun BOM untuk mulai mendata komponen."}
            </p>
            {rows.length ? (
              <button type="button" onClick={resetFilters} className={`${BUTTON} mt-5`}>Reset filter</button>
            ) : (
              <Link to="/admin/bom" className={`${PRIMARY} mt-5`}>Buka Penyusun BOM</Link>
            )}
          </div>
        ) : !error && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <th className="w-12 py-3 pl-5" aria-label="Detail komponen" />
                  <th className="px-3 py-3">Output</th>
                  <th className="px-3 py-3">BOM</th>
                  <th className="hidden px-3 py-3 sm:table-cell">Versi</th>
                  <th className="px-3 py-3 text-right">Komponen</th>
                  <th className="py-3 pl-3 pr-5">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((bom) => (
                  <BomRow
                    key={bom.id}
                    bom={bom}
                    output={outputLabel(bom)}
                    expanded={expandedIds.has(bom.id)}
                    onToggle={() => toggleExpanded(bom.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function BomRow({
  bom,
  output,
  expanded,
  onToggle,
}: {
  bom: Bom;
  output: OutputLabel;
  expanded: boolean;
  onToggle: () => void;
}) {
  const tone = OUTPUT_TONE[output.kind];
  const itemCount = countItems(bom.items);
  const depth = getDepth(bom.items);

  return (
    <>
      <tr className={`group border-b border-slate-100 text-sm transition last:border-0 ${expanded ? "bg-[#F8FBFD]" : "hover:bg-slate-50/70"}`}>
        <td className="py-3 pl-5 pr-1">
          <button
            type="button"
            onClick={onToggle}
            className={`grid h-8 w-8 place-items-center rounded-lg transition ${
              expanded ? "bg-white text-[#0088C0] ring-1 ring-slate-200" : "text-slate-400 group-hover:bg-white group-hover:text-slate-600 group-hover:ring-1 group-hover:ring-slate-200"
            }`}
            aria-label={`${expanded ? "Sembunyikan" : "Lihat"} komponen ${bom.nama}`}
            aria-expanded={expanded}
          >
            <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} className="h-3 w-3" />
          </button>
        </td>
        <td className="px-3 py-3">
          <div className="flex items-start gap-2.5">
            <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone.tile}`}>
              <FontAwesomeIcon icon={tone.icon} className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <div className="font-medium text-slate-900">{output.title}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className={`font-semibold ${tone.text}`}>{output.kind}</span>
                {output.subtitle && (
                  <>
                    <span className="text-slate-300" aria-hidden="true">•</span>
                    <span className="font-mono text-slate-500">{output.subtitle}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </td>
        <td className="px-3 py-3">
          <div className="font-medium text-slate-800">{bom.nama}</div>
          <div className="mt-0.5 font-mono text-[11px] text-slate-500">{bom.kode || `BOM-${bom.id}`}</div>
        </td>
        <td className="hidden px-3 py-3 sm:table-cell">
          <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-600">
            {versionLabel(bom.version)}
          </span>
        </td>
        <td className="px-3 py-3 text-right">
          <div className="font-semibold tabular-nums text-slate-900">{itemCount}</div>
          <div className="text-[11px] text-slate-400">{itemCount === 0 ? "belum diisi" : depth > 1 ? `${depth} level` : "1 level"}</div>
        </td>
        <td className="py-3 pl-3 pr-5">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
            bom.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${bom.isActive ? "bg-emerald-500" : "bg-slate-400"}`} aria-hidden="true" />
            {bom.isActive ? "Aktif" : "Nonaktif"}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-100 bg-slate-50/60 last:border-0">
          <td colSpan={6} className="p-0">
            <div className="px-4 py-4 sm:pl-12">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">Struktur komponen</h3>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      {itemCount} komponen
                    </span>
                    <span className="rounded-md bg-[#00A8E8]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#0088C0]">
                      {depth} level
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">Versi {bom.version}</span>
                </div>
                <div className="px-4 py-3">
                  <ComponentTree items={bom.items} />
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ComponentTree({ items }: { items: BomItem[] }) {
  if (!items.length) {
    return <p className="py-2 text-sm text-slate-500">BOM ini belum memiliki komponen.</p>;
  }
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 border-b border-slate-100 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        <span>Komponen</span>
        <span>Jumlah</span>
      </div>
      <ul>
        {items.map((item, index) => (
          <ComponentRow key={item.id ?? `${itemCode(item)}-${index}`} item={item} />
        ))}
      </ul>
    </div>
  );
}

function ComponentRow({ item }: { item: BomItem }) {
  const children = item.children ?? [];
  const unit = item.unit ?? item.item?.unit ?? "";
  const quantity = Number(item.quantity);
  const scrap = Number(item.scrapPercent ?? 0);

  return (
    <li>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-2 py-2 transition hover:bg-slate-50">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-600">{itemCode(item)}</span>
        <span className="text-sm font-medium text-slate-800">{itemLabel(item)}</span>
        {item.subassembly && (
          <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">Rakitan</span>
        )}
        {children.length > 0 && (
          <span className="text-[11px] text-slate-400">{children.length} isi</span>
        )}
        {scrap > 0 && (
          <span className="text-[11px] font-medium text-amber-600">+{scrap}% scrap</span>
        )}
        <span className="ml-auto whitespace-nowrap text-sm tabular-nums text-slate-500">
          <strong className="font-semibold text-slate-900">{quantity.toLocaleString("id-ID")}</strong> {unit}
        </span>
      </div>
      {children.length > 0 && (
        <ul className="ml-3 border-l border-dashed border-slate-200 pl-2">
          {children.map((child, childIndex) => (
            <ComponentRow key={child.id ?? `${itemCode(child)}-${childIndex}`} item={child} />
          ))}
        </ul>
      )}
    </li>
  );
}
