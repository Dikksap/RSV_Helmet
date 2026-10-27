import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowsRotate, faChevronDown, faChevronRight, faMagnifyingGlass, faPlus } from "@fortawesome/free-solid-svg-icons";
import { getBoms, type Bom, type BomItem } from "../../api/bom";

type OutputFilter = "all" | "product" | "subassembly";
type ActiveFilter = "all" | "active" | "inactive";

const FIELD = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#00A8E8] focus:outline-none focus:ring-2 focus:ring-[#00A8E8]/20";
const BUTTON = "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY = "inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1E3A5F] px-4 text-sm font-semibold text-white transition hover:bg-[#162C48]";

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

function outputLabel(bom: Bom) {
  if (bom.productVariant) {
    return { title: productVariantLabel(bom) || `Produk variant #${bom.productVariant.id}` };
  }
  if (bom.subassembly) {
    return {
      title: `${bom.subassembly.nama} · ${bom.subassembly.kode}`,
    };
  }
  return { title: "Output tidak diketahui" };
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

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      setRows(await getBoms());
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Gagal memuat daftar BOM.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

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

  const toggleExpanded = (id: number) => setExpandedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const renderComponent = (item: BomItem, depth = 0, index = 0): ReactNode => {
    const children = item.children ?? [];
    return (
      <li key={item.id ?? `${itemCode(item)}-${depth}-${index}`} className="py-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">L{item.level ?? depth + 1}</span>
          <span className="font-mono text-xs text-slate-500">{itemCode(item)}</span>
          <span className="font-medium text-slate-800">{itemLabel(item)}</span>
          <span className="text-xs text-slate-500">
            {Number(item.quantity).toLocaleString("id-ID")} {item.unit ?? item.item?.unit ?? ""}
          </span>
        </div>
        {children.length > 0 && (
          <ul className="ml-5 border-l border-slate-200 pl-3">
            {children.map((child, childIndex) => renderComponent(child, depth + 1, childIndex))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-3xl">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#00A8E8]">Manajemen</p>
          <h1 className="text-[32px] font-bold leading-[1.2] tracking-tight text-[#1E3A5F] sm:text-4xl">Daftar BOM</h1>
          <p className="mt-2 text-base text-[#6B7280]">Lihat BOM produk dan subassembly beserta susunan level komponennya.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void load(true)} className={BUTTON} disabled={loading || refreshing}>
            <FontAwesomeIcon icon={faArrowsRotate} className={refreshing ? "animate-spin" : ""} />
            Muat ulang
          </button>
          <Link to="/admin/bom" className={PRIMARY}>
            <FontAwesomeIcon icon={faPlus} />
            Penyusun BOM
          </Link>
        </div>
      </header>

      <section className="rounded-xl bg-white p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)] sm:p-6">
        <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_220px_200px]">
          <label className="space-y-1.5 text-xs font-semibold text-slate-600">
            Cari BOM atau komponen
            <span className="relative block">
              <FontAwesomeIcon icon={faMagnifyingGlass} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                className={`${FIELD} pl-9`}
                placeholder="Kode, nama output, versi, komponen..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </span>
          </label>
          <label className="space-y-1.5 text-xs font-semibold text-slate-600">
            Jenis output
            <select className={FIELD} value={outputFilter} onChange={(event) => setOutputFilter(event.target.value as OutputFilter)}>
              <option value="all">Semua output</option>
              <option value="product">Produk</option>
              <option value="subassembly">Subassembly</option>
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-semibold text-slate-600">
            Status
            <select className={FIELD} value={activeFilter} onChange={(event) => setActiveFilter(event.target.value as ActiveFilter)}>
              <option value="all">Semua status</option>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
          <span>{filtered.length} dari {rows.length} BOM</span>
          <span>{rows.filter((bom) => bom.isActive).length} aktif · {rows.filter((bom) => !bom.isActive).length} nonaktif</span>
        </div>
      </section>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>Gagal memuat daftar BOM: {error}</span>
          <button type="button" onClick={() => void load()} className="font-semibold underline">Coba lagi</button>
        </div>
      )}

      <section className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
        {loading ? (
          <p className="animate-pulse px-5 py-12 text-center text-sm text-slate-500">Memuat daftar BOM...</p>
        ) : !error && filtered.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="font-semibold text-slate-700">{rows.length ? "Tidak ada BOM yang cocok dengan filter." : "Belum ada BOM di database."}</p>
            <p className="mt-1 text-sm text-slate-500">Gunakan Penyusun BOM untuk membuat dan menyimpan BOM.</p>
            <Link to="/admin/bom" className={`${PRIMARY} mt-4`}>Buka Penyusun BOM</Link>
          </div>
        ) : !error && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-[#F5F7FA] text-[#6B7280]">
                <tr>
                  <th className="w-12 px-4 py-4" aria-label="Detail komponen" />
                  <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider">Output</th>
                  <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider">BOM</th>
                  <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider">Versi</th>
                  <th className="px-4 py-4 text-right text-xs font-semibold uppercase tracking-wider">Komponen</th>
                  <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((bom) => {
                  const output = outputLabel(bom);
                  const isExpanded = expandedIds.has(bom.id);
                  return (
                    <FragmentRow
                      key={bom.id}
                      bom={bom}
                      output={output}
                      expanded={isExpanded}
                      onToggle={() => toggleExpanded(bom.id)}
                      renderComponent={renderComponent}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function FragmentRow({
  bom,
  output,
  expanded,
  onToggle,
  renderComponent,
}: {
  bom: Bom;
  output: { title: string };
  expanded: boolean;
  onToggle: () => void;
  renderComponent: (item: BomItem, depth?: number, index?: number) => ReactNode;
}) {
  const itemCount = countItems(bom.items);
  const depth = getDepth(bom.items);
  return (
    <>
      <tr className="text-sm hover:bg-slate-50">
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={onToggle}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label={`${expanded ? "Tutup" : "Lihat"} komponen ${bom.nama}`}
            aria-expanded={expanded}
          >
            <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} className="h-3 w-3" />
          </button>
        </td>
        <td className="px-4 py-3">
          <div className="whitespace-nowrap font-medium text-slate-800">{output.title}</div>
        </td>
        <td className="px-4 py-3">
          <div className="font-medium text-slate-800">{bom.nama}</div>
          <div className="mt-0.5 font-mono text-xs text-slate-500">{bom.kode || `BOM-${bom.id}`}</div>
        </td>
        <td className="px-4 py-3 font-mono text-slate-700">{bom.version}</td>
        <td className="px-4 py-3 text-right tabular-nums text-slate-700">
          {itemCount}
          <span className="ml-1 text-xs text-slate-400">{depth ? `· ${depth} level` : ""}</span>
        </td>
        <td className="px-4 py-3">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${bom.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
            {bom.isActive ? "Aktif" : "Nonaktif"}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50/70">
          <td colSpan={6} className="px-6 py-4">
            {bom.items.length ? (
              <ul className="space-y-1">{bom.items.map((item, index) => renderComponent(item, 0, index))}</ul>
            ) : (
              <p className="text-sm text-slate-500">BOM ini belum memiliki komponen.</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
