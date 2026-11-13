import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBoxesStacked,
  faClipboardCheck,
  faDiagramProject,
  faSpinner,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { getUser } from "../../../api/auth";
import { getDivisi, type Divisi } from "../../../api/divisi";
import { getItems, type Item } from "../../../api/item";
import { getProducts, getVariantProduk, type Product, type VariantProdukRow } from "../../../api/products";
import { defaultFilters, toReportFilters, type LaporanFiltersState } from "./types";
import PeriodFilter from "./PeriodFilter";
import FinishedGoodsTab from "./FinishedGoodsTab";
import MaterialConsumptionTab from "./MaterialConsumptionTab";
import TraceabilityTab from "./TraceabilityTab";
import ReconciliationTab from "./ReconciliationTab";

const TABS = [
  { id: "fg", label: "Finished Goods", icon: faClipboardCheck },
  { id: "konsumsi", label: "Konsumsi Material", icon: faBoxesStacked },
  { id: "trace", label: "Traceability", icon: faDiagramProject },
  { id: "rekonsiliasi", label: "Rekonsiliasi", icon: faBoxesStacked },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function LaporanProduksiContent() {
  const user = getUser();
  const lockedDivisiId = user?.role === "admin" ? null : user?.divisiId ?? null;

  const [tab, setTab] = useState<TabId>("fg");
  const [state, setState] = useState<LaporanFiltersState>(() => {
    const base = defaultFilters();
    return lockedDivisiId ? { ...base, divisiId: String(lockedDivisiId) } : base;
  });
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<VariantProdukRow[]>([]);
  const [divisions, setDivisions] = useState<Divisi[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getProducts(), getVariantProduk(), getDivisi(), getItems({ aktif: true })])
      .then(([productRows, variantRows, divisionRows, itemRows]) => {
        if (!active) return;
        setProducts(productRows);
        setVariants(variantRows);
        setDivisions(divisionRows);
        setItems(itemRows);
        setError(null);
      })
      .catch((reason) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Gagal memuat master data laporan.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filters = useMemo(() => {
    const base = toReportFilters(state);
    // Hanya traceability yang menyaring unit berdasarkan status saat ini; laporan
    // lain memakai basis waktu (FINISHGOOD pertama / output produksi) sehingga
    // filter status tidak boleh ikut terkirim.
    return tab === "trace" ? base : { ...base, status: null };
  }, [state, tab]);

  const onChange = (patch: Partial<LaporanFiltersState>) => {
    setState((current) => ({
      ...current,
      ...patch,
      ...(lockedDivisiId ? { divisiId: String(lockedDivisiId) } : {}),
    }));
  };

  if (loading) {
    return (
      <div className="grid place-items-center rounded-2xl border border-slate-200 bg-white py-12 text-sm text-slate-500">
        <FontAwesomeIcon icon={faSpinner} spin />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <FontAwesomeIcon icon={faTriangleExclamation} className="mr-2" />
          {error}
        </p>
      )}

      <PeriodFilter
        state={state}
        onChange={onChange}
        divisions={lockedDivisiId ? divisions.filter((row) => row.id === lockedDivisiId) : divisions}
        items={items}
        products={products}
        variants={variants}
        showStatus={tab === "trace"}
      />

      <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
        {TABS.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => setTab(row.id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition sm:px-4 ${
              tab === row.id ? "bg-[#1E3A5F] text-white shadow" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <FontAwesomeIcon icon={row.icon} /> {row.label}
          </button>
        ))}
      </nav>

      {tab === "fg" && <FinishedGoodsTab filters={filters} />}
      {tab === "konsumsi" && <MaterialConsumptionTab filters={filters} />}
      {tab === "trace" && <TraceabilityTab filters={filters} />}
      {tab === "rekonsiliasi" && <ReconciliationTab filters={filters} />}
    </div>
  );
}
