import { useEffect, useRef, useState, type ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsLeftRight,
  faCheck,
  faChevronDown,
  faClockRotateLeft,
  faCopy,
  faPenToSquare,
  faRotate,
  faTableColumns,
  faTrashCan,
  faWarehouse,
} from "@fortawesome/free-solid-svg-icons";
import type { Barang } from "../../../api/barang";
import { StatusBadge } from "./StatusBadge";

type BarangTableProps = {
  barang: Barang[];
  currentPage: number;
  pageSize: number | "all";
  totalBarang: number;
  now: number;
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: (checked: boolean) => void;
  onRowClick: (item: Barang) => void;
  onEdit?: (item: Barang) => void;
  onDelete?: (item: Barang) => void;
  onRiwayat?: (item: Barang) => void;
  onMutasi?: (item: Barang) => void;
  formatDate: (date: string) => string;
  formatRelativeTime: (date: string, nowMs: number) => string;
  caption?: string;
  /** Slot kanan footer tabel (mis. pagination + jumlah baris). */
  footer?: ReactNode;
  onRefresh?: () => void | Promise<void>;
};

type Density = "comfortable" | "compact";
type ColumnKey = "batch" | "dus" | "gudang" | "tanggal";

const COLUMN_KEYS: ColumnKey[] = ["batch", "dus", "gudang", "tanggal"];
const COLUMN_LABELS: Record<ColumnKey, string> = {
  batch: "Batch",
  dus: "Dus",
  gudang: "Gudang",
  tanggal: "Tanggal",
};
const DENSITY_KEY = "rsv.barang.table.density";
const COLUMNS_KEY = "rsv.barang.table.hidden-columns";

const n = (value: number) => value.toLocaleString("id-ID");
const batchLabel = (b: Barang) => (b.batch ? `BC${String(b.batch.nomorBatch).padStart(3, "0")}` : null);
const gudangLabel = (b: Barang) => (b.gudang ? `${b.gudang.kode} - ${b.gudang.name}` : null);
const variantLabel = (b: Barang) =>
  `${b.variant.product.nama} / ${b.variant.style.nama} / ${b.variant.color.nama} / ${b.variant.size.nama}`;

function readDensity(): Density {
  try {
    return window.localStorage.getItem(DENSITY_KEY) === "compact" ? "compact" : "comfortable";
  } catch {
    return "comfortable";
  }
}

function readHiddenColumns(): Set<ColumnKey> {
  try {
    const raw = window.localStorage.getItem(COLUMNS_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is ColumnKey => typeof value === "string" && COLUMN_KEYS.includes(value as ColumnKey)));
  } catch {
    return new Set();
  }
}

const TOOL_BTN =
  "inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-[#1E3A5F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/50 disabled:cursor-not-allowed disabled:opacity-50";
const CELL = "px-2 align-middle";
const HEAD = "px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500";

function ReturFlag({ item, formatDate }: { item: Barang; formatDate: (date: string) => string }) {
  if (!item.pernahRetur) return null;
  return (
    <span
      title={item.tanggalReturTerakhir ? `Retur ${item.jumlahRetur ?? 1}x, terakhir ${formatDate(item.tanggalReturTerakhir)}` : "Pernah retur"}
      className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700"
    >
      RETUR{(item.jumlahRetur ?? 0) > 1 ? ` ×${item.jumlahRetur}` : ""}
    </span>
  );
}

export function BarangTable({
  barang,
  currentPage,
  pageSize,
  totalBarang,
  now,
  selectedIds,
  onToggle,
  onToggleAll,
  onRowClick,
  onEdit,
  onDelete,
  onRiwayat,
  onMutasi,
  formatDate,
  formatRelativeTime,
  caption,
  footer,
  onRefresh,
}: BarangTableProps) {
  const [density, setDensity] = useState<Density>(readDensity);
  const [hiddenColumns, setHiddenColumns] = useState<Set<ColumnKey>>(readHiddenColumns);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);
  const copyTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    try {
      window.localStorage.setItem(DENSITY_KEY, density);
    } catch {
      /* localStorage bisa diblokir; preferensi cukup berlaku di sesi ini. */
    }
  }, [density]);

  useEffect(() => {
    try {
      window.localStorage.setItem(COLUMNS_KEY, JSON.stringify([...hiddenColumns]));
    } catch {
      /* abaikan */
    }
  }, [hiddenColumns]);

  useEffect(() => {
    if (!columnsOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!columnsRef.current?.contains(event.target as Node)) setColumnsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setColumnsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [columnsOpen]);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const show = (key: ColumnKey) => !hiddenColumns.has(key);
  const allSelected = barang.length > 0 && barang.every((b) => selectedIds.has(b.id));
  const someSelected = !allSelected && barang.some((b) => selectedIds.has(b.id));
  const size = pageSize === "all" ? barang.length : pageSize;
  const rowNo = (i: number) => (currentPage - 1) * size + i + 1;
  const hasActions = Boolean(onEdit || onDelete || onRiwayat || onMutasi);
  const range =
    totalBarang > 0 && size > 0
      ? `${((currentPage - 1) * size + 1).toLocaleString("id-ID")}–${Math.min(currentPage * size, totalBarang).toLocaleString("id-ID")}`
      : "0";
  const footerText = `Menampilkan ${range} dari ${n(totalBarang)} ${caption ? "hasil pencarian" : "barang"}`;

  const toggleColumn = (key: ColumnKey) =>
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const copyCode = async (item: Barang) => {
    try {
      await navigator.clipboard.writeText(item.kodeBarang);
      setCopiedId(item.id);
      window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* clipboard tidak tersedia */
    }
  };

  const refresh = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const selectAllCheckbox = (label: string) => (
    <input
      type="checkbox"
      checked={allSelected}
      ref={(el) => {
        if (el) el.indeterminate = someSelected;
      }}
      onChange={(e) => onToggleAll(e.target.checked)}
      aria-label={label}
      className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-[#1E3A5F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/50"
    />
  );

  const actions = (item: Barang, compact = false) => {
    if (!hasActions) return null;
    const btn = compact ? "h-8 w-8" : "h-7 w-7";
    return (
      <div className="flex items-center justify-end gap-0" onClick={(e) => e.stopPropagation()}>
        {onRiwayat && (
          <button
            type="button"
            onClick={() => onRiwayat(item)}
            title="Riwayat status"
            aria-label={`Riwayat ${item.kodeBarang}`}
            className={`grid ${btn} place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-[#1E3A5F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/50`}
          >
            <FontAwesomeIcon icon={faClockRotateLeft} className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
        {onMutasi && (
          <button
            type="button"
            onClick={() => onMutasi(item)}
            title="Mutasi gudang"
            aria-label={`Mutasi ${item.kodeBarang}`}
            className={`grid ${btn} place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-[#1E3A5F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/50`}
          >
            <FontAwesomeIcon icon={faArrowsLeftRight} className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(item)}
            title="Edit barang"
            aria-label={`Edit ${item.kodeBarang}`}
            className={`grid ${btn} place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-[#1E3A5F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/50`}
          >
            <FontAwesomeIcon icon={faPenToSquare} className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(item)}
            title="Hapus barang"
            aria-label={`Hapus ${item.kodeBarang}`}
            className={`grid ${btn} place-items-center rounded-lg text-slate-500 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50`}
          >
            <FontAwesomeIcon icon={faTrashCan} className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
      </div>
    );
  };

  const codeCell = (item: Barang, compact = false) => (
    <div className={`relative flex min-w-0 items-center ${compact ? "w-full gap-1" : ""}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRowClick(item);
        }}
        title={`Lihat detail ${item.kodeBarang}`}
        className={`min-w-0 truncate rounded font-mono font-semibold text-[#1E3A5F] transition hover:text-[#0088C0] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/50 ${
          compact ? "text-[13px]" : "text-[11px]"
        }`}
      >
        {item.kodeBarang}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void copyCode(item);
        }}
        title={copiedId === item.id ? "Kode disalin" : "Salin kode barang"}
        aria-label={`Salin kode ${item.kodeBarang}`}
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/50 ${
          copiedId === item.id ? "text-emerald-600" : "text-slate-500 hover:bg-slate-100 hover:text-[#1E3A5F] xl:opacity-0 xl:group-hover:opacity-100 xl:focus-visible:opacity-100"
        } ${compact ? "ml-auto" : "absolute right-0 top-1/2 -translate-y-1/2 bg-white/90 group-hover:bg-slate-50"}`}
      >
        <FontAwesomeIcon icon={copiedId === item.id ? faCheck : faCopy} className="h-3 w-3" aria-hidden="true" />
      </button>
    </div>
  );

  const gudangCell = (item: Barang) => {
    if (!item.gudang) {
      return (
        <span className="inline-flex items-center whitespace-nowrap rounded-md border border-amber-200/70 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
          Belum ditempatkan
        </span>
      );
    }
    return (
      <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-600" title={gudangLabel(item) ?? undefined}>
        <FontAwesomeIcon icon={faWarehouse} className="h-2.5 w-2.5 shrink-0 text-slate-400" aria-hidden="true" />
        <span className="truncate">
          <span className="font-semibold text-slate-700">{item.gudang.kode}</span>
          <span className="mx-1 text-slate-300">·</span>
          {item.gudang.name}
        </span>
      </span>
    );
  };

  return (
    <div aria-busy={refreshing}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-t-2xl border-b border-slate-100 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Data barang</h2>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600">
            {n(barang.length)}
          </span>
          <span className="hidden text-[11px] text-slate-500 sm:inline">baris di halaman ini</span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {onRefresh && (
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              title="Muat ulang data"
              aria-label="Muat ulang data barang"
              className={`${TOOL_BTN} px-2`}
            >
              <FontAwesomeIcon icon={faRotate} spin={refreshing} className="h-3 w-3" aria-hidden="true" />
            </button>
          )}

          <div className="hidden items-center rounded-lg border border-slate-200 bg-slate-50/80 p-0.5 xl:flex" role="group" aria-label="Kepadatan baris">
            {(["comfortable", "compact"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDensity(value)}
                aria-pressed={density === value}
                title={value === "comfortable" ? "Baris nyaman" : "Baris kompak"}
                className={`h-7 rounded-md px-2 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/50 ${
                  density === value ? "bg-white text-[#1E3A5F] shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {value === "comfortable" ? "Nyaman" : "Kompak"}
              </button>
            ))}
          </div>

          <div className="relative hidden xl:block" ref={columnsRef}>
            <button
              type="button"
              onClick={() => setColumnsOpen((open) => !open)}
              aria-expanded={columnsOpen}
              aria-haspopup="true"
              className={TOOL_BTN}
              title="Atur kolom tabel"
            >
              <FontAwesomeIcon icon={faTableColumns} className="h-3 w-3" aria-hidden="true" />
              <span className="hidden md:inline">Kolom</span>
              {hiddenColumns.size > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1E3A5F] px-1 text-[9px] font-bold text-white">
                  {hiddenColumns.size}
                </span>
              )}
              <FontAwesomeIcon icon={faChevronDown} className="h-2.5 w-2.5 text-slate-400" aria-hidden="true" />
            </button>
            {columnsOpen && (
              <div
                role="group"
                aria-label="Pilih kolom yang ditampilkan"
                className="absolute right-0 top-full z-30 mt-1.5 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_18px_40px_-16px_rgba(15,23,42,0.35)]"
              >
                <p className="px-2 pb-1.5 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Kolom tabel</p>
                {COLUMN_KEYS.map((key) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={show(key)}
                      onChange={() => toggleColumn(key)}
                      className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 accent-[#1E3A5F]"
                    />
                    {COLUMN_LABELS[key]}
                  </label>
                ))}
                <div className="mt-1 border-t border-slate-100 pt-1">
                  <button
                    type="button"
                    onClick={() => setHiddenColumns(new Set())}
                    disabled={hiddenColumns.size === 0}
                    className="w-full rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-[#0088C0] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Tampilkan semua kolom
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {caption && (
        <p className="border-b border-amber-100 bg-amber-50/70 px-3 py-2 text-[11px] font-medium text-amber-800 sm:px-4">{caption}</p>
      )}

      {/* Mobile / tablet: kartu ringkas */}
      <div className="xl:hidden">
        <div className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
          {selectAllCheckbox("Pilih semua barang di halaman ini")}
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Pilih semua</span>
          <span className="ml-auto text-[11px] font-medium tabular-nums text-slate-500">{barang.length} item</span>
        </div>
        <ul className="divide-y divide-slate-100" aria-label="Daftar barang">
          {barang.map((item, i) => {
            const checked = selectedIds.has(item.id);
            return (
              <li
                key={item.id}
                onClick={() => onRowClick(item)}
                className={`cursor-pointer px-3.5 py-3 transition ${
                  checked ? "bg-[#00A8E8]/[0.06]" : "active:bg-slate-50"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(item.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Pilih ${item.kodeBarang}`}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 accent-[#1E3A5F]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="min-w-0">{codeCell(item, true)}</div>
                    <div className="mt-1 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-slate-800">{item.variant.product.nama}</p>
                        <p className="truncate text-[11px] text-slate-500">
                          {item.variant.style.nama} · {item.variant.color.nama} · {item.variant.size.nama}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <ReturFlag item={item} formatDate={formatDate} />
                        <StatusBadge status={item.status} />
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {batchLabel(item) && (
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
                          {batchLabel(item)}
                        </span>
                      )}
                      {item.group && (
                        <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                          {item.group.nama}
                        </span>
                      )}
                      <span className="inline-flex min-w-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-600">
                        <FontAwesomeIcon icon={faWarehouse} className="h-2.5 w-2.5 shrink-0 text-slate-400" aria-hidden="true" />
                        <span className="truncate">{item.gudang ? `${item.gudang.kode} · ${item.gudang.name}` : "Belum ditempatkan"}</span>
                      </span>
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-slate-600">
                        {item.tanggal ? formatDate(item.tanggal) : "Tanpa tanggal"}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[10px] tabular-nums text-slate-500">
                        #{rowNo(i)} · dibuat {formatRelativeTime(item.createdAt, now)}
                      </span>
                      {hasActions && actions(item, true)}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Desktop: tabel data */}
      <div className="hidden overflow-x-auto xl:block">
        <table className="w-full min-w-[1024px] table-fixed border-collapse text-sm">
          <caption className="sr-only">
            {caption ?? `Daftar barang, menampilkan ${range} dari ${n(totalBarang)} barang`}
          </caption>
          <colgroup>
            <col className="w-9" />
            <col className="w-10" />
            <col className="w-[184px]" />
            <col />
            {show("batch") && <col className="w-[66px]" />}
            {show("dus") && <col className="w-[72px]" />}
            {show("gudang") && <col className="w-[124px]" />}
            <col className="w-[132px]" />
            {show("tanggal") && <col className="w-[96px]" />}
            {hasActions && <col className="w-[128px]" />}
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th scope="col" className="px-2 py-2.5 text-center">
                {selectAllCheckbox("Pilih semua barang di halaman ini")}
              </th>
              <th scope="col" className={`${HEAD} text-right`}>
                No
              </th>
              <th scope="col" className={HEAD}>
                Kode barang
              </th>
              <th scope="col" className={HEAD}>
                Produk &amp; varian
              </th>
              {show("batch") && (
                <th scope="col" className={HEAD}>
                  Batch
                </th>
              )}
              {show("dus") && (
                <th scope="col" className={HEAD}>
                  Dus
                </th>
              )}
              {show("gudang") && (
                <th scope="col" className={HEAD}>
                  Gudang
                </th>
              )}
              <th scope="col" className={HEAD}>
                Status
              </th>
              {show("tanggal") && (
                <th scope="col" className={HEAD} title="Tanggal barang dan waktu data dibuat">
                  Tanggal
                </th>
              )}
              {hasActions && (
                <th
                  scope="col"
                  className={`${HEAD} sticky right-0 z-20 border-l border-slate-200 bg-slate-50 pr-2 text-right shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.4)]`}
                >
                  Aksi
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {barang.map((item, i) => {
              const checked = selectedIds.has(item.id);
              const pad = density === "compact" ? "py-1.5" : "py-2.5";
              return (
                <tr
                  key={item.id}
                  onClick={() => onRowClick(item)}
                  className={`group cursor-pointer border-b border-slate-100/80 transition-colors last:border-b-0 ${
                    checked ? "bg-[#00A8E8]/[0.06]" : "hover:bg-slate-50/80"
                  }`}
                >
                  <td className={`${CELL} ${pad} relative text-center`} onClick={(e) => e.stopPropagation()}>
                    {checked && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-[#00A8E8]" aria-hidden="true" />}
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(item.id)}
                      aria-label={`Pilih ${item.kodeBarang}`}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-[#1E3A5F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/50"
                    />
                  </td>
                  <td className={`${CELL} ${pad} text-right text-[11px] tabular-nums text-slate-500`}>{rowNo(i)}</td>
                  <td className={`${CELL} ${pad}`}>{codeCell(item)}</td>
                  <td className={`${CELL} ${pad}`}>
                    <p className="truncate text-[13px] font-medium text-slate-800" title={variantLabel(item)}>
                      {item.variant.product.nama}
                    </p>
                    <p className="truncate text-[11px] text-slate-500" title={variantLabel(item)}>
                      {item.variant.style.nama}
                      <span className="mx-1 text-slate-300">·</span>
                      {item.variant.color.nama}
                      <span className="mx-1 text-slate-300">·</span>
                      {item.variant.size.nama}
                    </p>
                  </td>
                  {show("batch") && (
                    <td className={`${CELL} ${pad}`}>
                      {batchLabel(item) ? (
                        <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
                          {batchLabel(item)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  )}
                  {show("dus") && (
                    <td className={`${CELL} ${pad}`}>
                      <span className="block truncate text-xs text-slate-600" title={item.group?.nama ?? undefined}>
                        {item.group?.nama ?? <span className="text-slate-300">—</span>}
                      </span>
                    </td>
                  )}
                  {show("gudang") && <td className={`${CELL} ${pad}`}>{gudangCell(item)}</td>}
                  <td className={`${CELL} ${pad}`}>
                    <div className="flex flex-wrap items-center gap-1">
                      <StatusBadge status={item.status} />
                      <ReturFlag item={item} formatDate={formatDate} />
                    </div>
                  </td>
                  {show("tanggal") && (
                    <td className={`${CELL} ${pad}`}>
                      <span className="block whitespace-nowrap text-[11px] font-medium text-slate-600">
                        {item.tanggal ? formatDate(item.tanggal) : "—"}
                      </span>
                      <span
                        className="block whitespace-nowrap text-[10px] text-slate-500"
                        title={`Dibuat ${formatDate(item.createdAt)}`}
                      >
                        {formatRelativeTime(item.createdAt, now)}
                      </span>
                    </td>
                  )}
                  {hasActions && (
                    <td
                      className={`${CELL} ${pad} sticky right-0 z-10 border-l border-slate-100 pr-2 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.35)] ${
                        checked ? "bg-[#F1FAFE]" : "bg-white group-hover:bg-slate-50"
                      }`}
                    >
                      {actions(item)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 rounded-b-2xl border-t border-slate-100 bg-slate-50/50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <p className="min-w-0 truncate text-[11px] text-slate-500">{footerText}</p>
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#00A8E8]/10 px-2 py-0.5 text-[11px] font-semibold text-[#0088C0]">
              {n(selectedIds.size)} dipilih
            </span>
          )}
          {footer}
        </div>
      </div>
    </div>
  );
}
