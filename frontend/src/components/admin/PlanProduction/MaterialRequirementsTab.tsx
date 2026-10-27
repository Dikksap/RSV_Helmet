import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBoxesStacked, faDownload } from "@fortawesome/free-solid-svg-icons";
import { getBoms, type Bom, type BomItem } from "../../../api/bom";
import type { ProductionOrderSummary } from "../../../api/productionOrders";
import { getSaldoBulk } from "../../../api/stokItem";

interface Props {
  detail: ProductionOrderSummary;
}

interface MaterialRequirement {
  itemId: number;
  kode: string;
  nama: string;
  unit: string;
  stockUnit: string;
  qty: number;
}

interface MissingBom {
  item: string;
  qty: number;
}

interface UnresolvedSubassembly {
  kode: string;
  nama: string;
}

interface Calculation {
  materials: MaterialRequirement[];
  missingBoms: MissingBom[];
  unresolvedSubassemblies: UnresolvedSubassembly[];
  producibleProducts: ProducibleProduct[];
}

interface ProducibleProduct {
  key: string;
  nama: string;
  variant: string;
  maxQty: number | null;
}

interface MaterialStockComparison extends MaterialRequirement {
  stock: number | null;
  shortage: number | null;
}

type SortDirection = "asc" | "desc";
type SortState<Key extends string> = { key: Key; direction: SortDirection };
type MaterialSortKey =
  | "kode"
  | "nama"
  | "unit"
  | "qty"
  | "stock"
  | "shortage";
type ProductSortKey = "nama" | "variant" | "maxQty" | "status";

function compareSortValues(
  a: string | number | null,
  b: string | number | null,
  direction: SortDirection,
): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  const result =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b), "id", {
          numeric: true,
          sensitivity: "base",
        });
  return direction === "asc" ? result : -result;
}

function SortHeader({
  label,
  direction,
  align = "left",
  onClick,
}: {
  label: string;
  direction: SortDirection | null;
  align?: "left" | "right";
  onClick: () => void;
}) {
  return (
    <th
      aria-sort={
        direction === null
          ? "none"
          : direction === "asc"
            ? "ascending"
            : "descending"
      }
      className={`px-5 py-3 font-semibold ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 rounded font-semibold hover:text-[#0088C0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A8E8]/50 ${align === "right" ? "justify-end" : ""}`}
        aria-label={`Urutkan berdasarkan ${label}${direction ? `, saat ini ${direction === "asc" ? "menaik" : "menurun"}` : ""}`}
      >
        {label}
        <span aria-hidden="true" className="text-[10px] text-slate-400">
          {direction === "asc" ? "▲" : direction === "desc" ? "▼" : "↕"}
        </span>
      </button>
    </th>
  );
}

function stockOf(
  material: MaterialRequirement,
  stock: Record<number, number> | null,
): number | null {
  return stock === null || material.unit !== material.stockUnit
    ? null
    : (stock[material.itemId] ?? 0);
}

function maxProducible(
  materials: MaterialRequirement[],
  stock: Record<number, number> | null,
): number | null {
  if (stock === null || materials.length === 0) return null;
  const consumedMaterials = materials.filter((material) => material.qty > 0);
  if (
    consumedMaterials.length === 0 ||
    consumedMaterials.some((material) => material.unit !== material.stockUnit)
  ) {
    return null;
  }
  return Math.min(
    ...consumedMaterials.map((material) =>
      Math.floor(
        Math.max(0, stock[material.itemId] ?? 0) / material.qty + 1e-9,
      ),
    ),
  );
}

const numberFmt = (value: number) =>
  value.toLocaleString("id-ID", { maximumFractionDigits: 3 });

function bomOrder(a: Bom, b: Bom): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

function calculateRequirements(
  detail: ProductionOrderSummary,
  boms: Bom[],
  stock: Record<number, number> | null,
): Calculation {
  const activeBoms = boms.filter((bom) => bom.isActive);
  const materials = new Map<string, MaterialRequirement>();
  const missingBoms: MissingBom[] = [];
  const unresolvedSubassemblies = new Map<string, UnresolvedSubassembly>();

  const requirementsForBom = (
    bom: Bom,
    multiplier: number,
  ): {
    materials: Map<string, MaterialRequirement>;
    unresolvedSubassemblies: Map<string, UnresolvedSubassembly>;
    complete: boolean;
  } => {
    const bomMaterials = new Map<string, MaterialRequirement>();
    const bomUnresolvedSubassemblies = new Map<string, UnresolvedSubassembly>();
    let complete = true;
    const walkItems = (
      items: BomItem[],
      parentBom: Bom,
      ancestors: Set<number>,
      currentMultiplier: number,
    ) => {
      for (const entry of items) {
        const quantity = Number(entry.quantity);
        const scrapPercent = Number(entry.scrapPercent ?? 0);
        if (!Number.isFinite(quantity) || quantity < 0) {
          throw new Error(`Jumlah BOM tidak valid pada baris ${entry.id ?? "tanpa ID"}.`);
        }
        if (!Number.isFinite(scrapPercent) || scrapPercent < 0) {
          throw new Error(`Persentase scrap tidak valid pada baris ${entry.id ?? "tanpa ID"}.`);
        }

        const requiredQty =
          currentMultiplier * quantity * (1 + scrapPercent / 100);
        const children = entry.children ?? [];
        if (children.length > 0) {
          walkItems(children, parentBom, ancestors, requiredQty);
          continue;
        }

        if (entry.subassemblyId != null) {
          const subassemblyBoms = activeBoms
            .filter((candidate) => candidate.subassemblyId === entry.subassemblyId)
            .sort(
              (a, b) =>
                Number(b.version === parentBom.version) -
                  Number(a.version === parentBom.version) ||
                bomOrder(a, b),
            );
          const nestedBom = subassemblyBoms[0];
          if (!nestedBom) {
            complete = false;
            const kode = entry.subassembly?.kode ?? `#${entry.subassemblyId}`;
            bomUnresolvedSubassemblies.set(kode, {
              kode,
              nama: entry.subassembly?.nama ?? "Subassembly",
            });
            continue;
          }
          if (ancestors.has(nestedBom.id)) {
            throw new Error(`Siklus terdeteksi pada BOM subassembly ${nestedBom.nama}.`);
          }
          const nextAncestors = new Set(ancestors);
          nextAncestors.add(nestedBom.id);
          walkItems(nestedBom.items, nestedBom, nextAncestors, requiredQty);
          continue;
        }

        if (!entry.item) {
          throw new Error(`Material pada BOM tidak memiliki referensi item (baris ${entry.id ?? "tanpa ID"}).`);
        }
        const unit = entry.unit ?? entry.item.unit ?? "pcs";
        const key = `${entry.item.id}|${unit}`;
        const existing = bomMaterials.get(key);
        if (existing) existing.qty += requiredQty;
        else {
          bomMaterials.set(key, {
            itemId: entry.item.id,
            kode: entry.item.kode,
            nama: entry.item.nama,
            unit,
            stockUnit: entry.item.unit ?? "pcs",
            qty: requiredQty,
          });
        }
      }
    };

    walkItems(bom.items, bom, new Set([bom.id]), multiplier);
    return {
      materials: bomMaterials,
      unresolvedSubassemblies: bomUnresolvedSubassemblies,
      complete,
    };
  };

  for (const orderItem of detail.items) {
    const bom = activeBoms
      .filter((candidate) => candidate.productVariantId === orderItem.variantId)
      .sort(bomOrder)[0];
    if (!bom) {
      missingBoms.push({
        item: `${orderItem.variant.product.nama} · ${orderItem.variant.kodeVariant}`,
        qty: orderItem.qty,
      });
      continue;
    }

    const required = requirementsForBom(bom, orderItem.qty);
    for (const [key, subassembly] of required.unresolvedSubassemblies) {
      unresolvedSubassemblies.set(key, subassembly);
    }
    for (const [key, material] of required.materials) {
      const existing = materials.get(key);
      if (existing) existing.qty += material.qty;
      else materials.set(key, material);
    }
  }

  const latestProductBoms = new Map<number, Bom>();
  for (const bom of activeBoms.filter((candidate) => candidate.productVariantId != null)) {
    const variantId = bom.productVariantId;
    if (variantId == null) continue;
    const current = latestProductBoms.get(variantId);
    if (!current || bomOrder(bom, current) < 0) latestProductBoms.set(variantId, bom);
  }

  return {
    materials: [...materials.values()].sort(
      (a, b) => a.kode.localeCompare(b.kode, "id") || a.unit.localeCompare(b.unit, "id"),
    ),
    missingBoms,
    unresolvedSubassemblies: [...unresolvedSubassemblies.values()].sort((a, b) =>
      a.kode.localeCompare(b.kode, "id"),
    ),
    producibleProducts: [...latestProductBoms.values()]
      .map((bom) => {
        const product = bom.productVariant;
        if (!product) return null;
        const requirement = requirementsForBom(bom, 1);
        const orderVariant = detail.items.find(
          (item) => item.variantId === product.id,
        )?.variant;
        const variant = [
          product.style?.nama ?? orderVariant?.style.nama,
          product.color?.nama ?? orderVariant?.color.nama,
          product.size?.nama ?? orderVariant?.size.nama,
        ]
          .filter((name): name is string => Boolean(name))
          .join(" ");
        return {
          key: String(product.id),
          nama: product.product?.nama ?? bom.nama,
          variant,
          maxQty: requirement.complete
            ? maxProducible([...requirement.materials.values()], stock)
            : null,
        };
      })
      .filter((product): product is ProducibleProduct => product !== null),
  };
}

function toCsv(rows: MaterialStockComparison[]): string {
  const cell = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const lines = [
    [
      "Kode Material",
      "Nama Material",
      "Satuan",
      "Kebutuhan",
      "Stok Saat Ini",
      "Kekurangan",
    ],
    ...rows.map((row) => [
      row.kode,
      row.nama,
      row.unit,
      row.qty,
      row.stock ??
        (row.unit === row.stockUnit
          ? "Tidak tersedia"
          : `Perlu konversi (${row.stockUnit})`),
      row.shortage ?? "—",
    ]),
  ].map((line) => line.map(cell).join(","));
  return `\uFEFF${lines.join("\r\n")}`;
}

export default function MaterialRequirementsTab({ detail }: Props) {
  const [boms, setBoms] = useState<Bom[]>([]);
  const [stock, setStock] = useState<Record<number, number> | null>(null);
  const [materialSort, setMaterialSort] = useState<SortState<MaterialSortKey>>({
    key: "kode",
    direction: "asc",
  });
  const [productSort, setProductSort] = useState<SortState<ProductSortKey>>({
    key: "nama",
    direction: "asc",
  });
  const [loading, setLoading] = useState(true);
  const [stockLoading, setStockLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stockError, setStockError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await getBoms({ aktif: true });
        if (!active) return;
        setBoms(result);
        setError(null);
        setLoading(false);

        const itemIds = new Set<number>();
        const collectItemIds = (items: BomItem[]) => {
          for (const item of items) {
            if (item.item?.id) itemIds.add(item.item.id);
            if (item.children?.length) collectItemIds(item.children);
          }
        };
        for (const bom of result) collectItemIds(bom.items);

        try {
          const balances = await getSaldoBulk([...itemIds]);
          if (!active) return;
          setStock(balances.saldo);
          setStockError(null);
        } catch (cause: unknown) {
          if (active) {
            setStock(null);
            setStockError(
              cause instanceof Error
                ? cause.message
                : "Gagal memuat saldo stok material.",
            );
          }
        } finally {
          if (active) setStockLoading(false);
        }
      } catch (cause: unknown) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Gagal memuat data BOM aktif.",
          );
          setLoading(false);
          setStockLoading(false);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const calculation = useMemo(() => {
    if (loading || error) return null;
    try {
      return { result: calculateRequirements(detail, boms, stock), error: null };
    } catch (cause) {
      return {
        result: null,
        error:
          cause instanceof Error
            ? cause.message
            : "Gagal menghitung kebutuhan material.",
      };
    }
  }, [boms, detail, error, loading, stock]);

  const materialStockComparisons = useMemo<MaterialStockComparison[]>(
    () =>
      (calculation?.result?.materials ?? []).map((material) => {
        const available = stockOf(material, stock);
        return {
          ...material,
          stock: available,
          shortage:
            available === null ? null : Math.max(0, material.qty - available),
        };
      }),
    [calculation, stock],
  );

  const sortedMaterials = useMemo(
    () =>
      [...materialStockComparisons].sort((a, b) =>
        compareSortValues(a[materialSort.key], b[materialSort.key], materialSort.direction),
      ),
    [materialStockComparisons, materialSort],
  );

  const sortedProducts = useMemo(
    () =>
      [...(calculation?.result?.producibleProducts ?? [])].sort((a, b) => {
        const valueOf = (product: ProducibleProduct) => {
          if (productSort.key === "status") {
            return product.maxQty === null
              ? "Tidak dapat dihitung"
              : product.maxQty > 0
                ? "Dapat diproduksi"
                : "Stok belum cukup";
          }
          return product[productSort.key];
        };
        return compareSortValues(
          valueOf(a),
          valueOf(b),
          productSort.direction,
        );
      }),
    [calculation, productSort],
  );

  const toggleMaterialSort = (key: MaterialSortKey) => {
    setMaterialSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const toggleProductSort = (key: ProductSortKey) => {
    setProductSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const download = () => {
    if (!sortedMaterials.length) return;
    const blob = new Blob([toCsv(sortedMaterials)], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `kebutuhan-material-${detail.nomor}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const result = calculation?.result;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:px-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#1E3A5F] text-white">
              <FontAwesomeIcon icon={faBoxesStacked} />
            </span>
            <div>
              <h2 className="font-semibold text-[#1E3A5F]">
                Kebutuhan Material
              </h2>
              <p className="text-xs text-slate-500">
                Perhitungan berdasarkan BOM aktif dan jumlah pada order{" "}
                {detail.nomor}.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={download}
            disabled={!sortedMaterials.length}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FontAwesomeIcon icon={faDownload} />
            Export CSV
          </button>
        </div>

        {loading || stockLoading ? (
          <p className="animate-pulse p-6 text-sm text-slate-500">
            Memuat BOM dan stok material...
          </p>
        ) : error ? (
          <p role="alert" className="p-6 text-sm text-red-600">
            {error}
          </p>
        ) : (
          <>
            {stockError && (
              <p role="alert" className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
                Kebutuhan material tersedia, tetapi saldo stok gagal dimuat: {stockError}
              </p>
            )}
            {calculation?.error && (
              <p role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
                {calculation.error}
              </p>
            )}
            {!calculation?.error && !result?.materials.length ? (
          <p className="p-6 text-center text-sm text-slate-500">
            Belum ada kebutuhan material yang dapat dihitung untuk order ini.
          </p>
            ) : !calculation?.error && result ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  {([
                    ["kode", "Kode Material"],
                    ["nama", "Nama Material"],
                    ["unit", "Satuan"],
                    ["qty", "Kebutuhan"],
                    ["stock", "Stok saat ini"],
                    ["shortage", "Kekurangan"],
                  ] as const).map(([key, label]) => (
                    <SortHeader
                      key={key}
                      label={label}
                      align={key === "qty" || key === "stock" || key === "shortage" ? "right" : "left"}
                      direction={materialSort.key === key ? materialSort.direction : null}
                      onClick={() => toggleMaterialSort(key)}
                    />
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedMaterials.map((material) => (
                  <tr key={`${material.itemId}|${material.unit}`}>
                    <td className="whitespace-nowrap px-5 py-3 font-mono text-xs font-semibold text-[#1E3A5F]">
                      {material.kode}
                    </td>
                    <td className="px-5 py-3 text-slate-700">{material.nama}</td>
                    <td className="px-5 py-3 text-slate-500">{material.unit}</td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums text-[#1E3A5F]">
                      {numberFmt(material.qty)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                      {material.stock === null
                        ? stockError
                          ? "Tidak tersedia"
                          : `Perlu konversi (${material.stockUnit})`
                        : numberFmt(material.stock)}
                    </td>
                    <td className={`px-5 py-3 text-right font-semibold tabular-nums ${material.shortage !== null && material.shortage > 0 ? "text-red-600" : "text-emerald-700"}`}>
                      {material.shortage === null
                        ? "—"
                        : numberFmt(material.shortage)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50">
                  <th
                    scope="row"
                    colSpan={5}
                    className="px-5 py-3 text-left text-sm font-semibold text-[#1E3A5F]"
                  >
                    Total jenis material
                  </th>
                  <td className="px-5 py-3 text-right font-bold tabular-nums text-[#1E3A5F]">
                    {result.materials.length}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
            ) : null}
          </>
        )}
      </section>

      {!loading && !error && !stockLoading && !calculation?.error && result && (
        <div className="space-y-3">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="font-semibold text-[#1E3A5F]">
                Estimasi Produk dari Stok Saat Ini
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Maksimum per varian jika seluruh stok dialokasikan hanya untuk
                varian tersebut. Angka antarvarian tidak dapat dijumlahkan
                karena menggunakan saldo stok yang sama.
              </p>
            </div>
            {stockError ? (
              <p role="alert" className="p-5 text-sm text-amber-800">
                Estimasi belum tersedia karena saldo stok gagal dimuat: {stockError}
              </p>
            ) : result.producibleProducts.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">
                Belum ada BOM aktif untuk produk jadi.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      {([
                        ["nama", "Produk"],
                        ["variant", "Varian"],
                        ["maxQty", "Maks. dapat dibuat"],
                        ["status", "Status"],
                      ] as const).map(([key, label]) => (
                        <SortHeader
                          key={key}
                          label={label}
                          align={key === "maxQty" ? "right" : "left"}
                          direction={productSort.key === key ? productSort.direction : null}
                          onClick={() => toggleProductSort(key)}
                        />
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedProducts.map((product) => (
                      <tr key={product.key}>
                        <td className="px-5 py-3 font-medium text-slate-700">
                          {product.nama}
                        </td>
                        <td className="px-5 py-3 text-slate-500">
                          {product.variant || "—"}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold tabular-nums text-[#1E3A5F]">
                          {product.maxQty === null
                            ? "Tidak dapat dihitung"
                            : numberFmt(product.maxQty)}
                        </td>
                        <td className="px-5 py-3">
                          {product.maxQty === null ? (
                            <span className="text-xs font-medium text-amber-700">
                              BOM belum lengkap atau satuan perlu konversi
                            </span>
                          ) : product.maxQty > 0 ? (
                            <span className="text-xs font-semibold text-emerald-700">
                              Dapat diproduksi
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-red-600">
                              Stok belum cukup
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {result.missingBoms.length > 0 && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="text-sm font-semibold text-amber-900">
                BOM aktif belum tersedia untuk {result.missingBoms.length} item
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-amber-800">
                {result.missingBoms.map((item) => (
                  <li key={item.item}>
                    {item.item} · {numberFmt(item.qty)} pcs
                  </li>
                ))}
              </ul>
            </section>
          )}
          {result.unresolvedSubassemblies.length > 0 && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="text-sm font-semibold text-amber-900">
                Subassembly belum memiliki BOM aktif
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-amber-800">
                {result.unresolvedSubassemblies.map((item) => (
                  <li key={item.kode}>
                    {item.kode} · {item.nama}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
