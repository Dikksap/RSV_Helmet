import prisma from "../../lib/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { awalHariBisnis, tambahHariBisnis, tanggalBisnis } from "../../lib/tanggalBisnis.js";
import { explodeVariantBom, BomError, type BomExplosion } from "../bom/resolver.js";
import {
  createPrismaLotGraphLoader,
  leavesForLotQuantity,
  mergeLeafMaps,
  type LeafQuantity,
  type LotLeafResult,
} from "./genealogy.js";

export type ReportPeriod = { from: Date; to: Date };

export type ReportFilter = ReportPeriod & {
  productId?: number;
  variantId?: number;
  orderId?: number;
  divisiId?: number;
  itemId?: number;
  status?: string;
  limit?: number;
};

export type ReportWarning = { code: string; message: string; count?: number };

export function buildPeriod(from: Date, to: Date): ReportPeriod {
  return { from: awalHariBisnis(from), to: tambahHariBisnis(to, 1) };
}

function round6(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function variantWhere(filter: ReportFilter) {
  if (filter.variantId !== undefined) return { variantId: filter.variantId };
  if (filter.productId !== undefined) return { variant: { productId: filter.productId } };
  return {};
}

function headerWhere(filter: ReportFilter): Prisma.HasilProduksiHarianWhereInput {
  return {
    tanggalProduksi: { gte: filter.from, lt: filter.to },
    ...(filter.orderId !== undefined ? { orderId: filter.orderId } : {}),
    ...(filter.divisiId !== undefined ? { divisiId: filter.divisiId } : {}),
  };
}

function lineVariantWhere(filter: ReportFilter): Prisma.HasilProduksiHarianItemWhereInput {
  if (filter.variantId !== undefined) return { productVariantId: filter.variantId };
  if (filter.productId !== undefined) return { productVariant: { productId: filter.productId } };
  return {};
}

function barangWhere(filter: ReportFilter): Prisma.BarangWhereInput {
  return { ...variantWhere(filter) };
}

// =============================================
// A. Finished Goods Summary
// =============================================

export async function getFinishedGoodsSummary(filter: ReportFilter) {
  const warnings: ReportWarning[] = [];
  const period = { from: filter.from, to: filter.to };

  const outputRows = await prisma.hasilProduksiHarianItem.groupBy({
    by: ["productVariantId"],
    where: {
      tipe: "HASIL",
      hasilProduksiHarian: headerWhere(filter),
      ...lineVariantWhere(filter),
    },
    _sum: { jumlah: true },
  });
  const productionOutput = outputRows.reduce((total, row) => total + Number(row._sum.jumlah ?? 0), 0);

  const linkedInPeriod: Prisma.BarangWhereInput = {
    hasilProduksiHarianItem: { hasilProduksiHarian: headerWhere(filter) },
  };
  const createdInPeriod: Prisma.BarangWhereInput = {
    hasilProduksiHarianItemId: null,
    createdAt: { gte: filter.from, lt: filter.to },
  };

  const [barangGenerated, firstFgRows, registerNotFg, legacyUnlinked] = await Promise.all([
    prisma.barang.count({
      where: { AND: [barangWhere(filter), { OR: [linkedInPeriod, createdInPeriod] }] },
    }),
    prisma.barang.groupBy({
      by: ["variantId"],
      where: { ...barangWhere(filter), finishGoodAt: { gte: period.from, lt: period.to } },
      _count: { _all: true },
    }),
    prisma.barang.count({
      where: {
        AND: [
          barangWhere(filter),
          { status: "REGISTER", finishGoodAt: null },
          { OR: [linkedInPeriod, createdInPeriod] },
        ],
      },
    }),
    prisma.barang.count({
      where: {
        AND: [
          barangWhere(filter),
          { finishGoodAt: null, hasilProduksiHarianItemId: null, qualityInspectionLineId: null },
        ],
      },
    }),
  ]);
  const firstFg = firstFgRows.reduce((total, row) => total + row._count._all, 0);

  const [retur, out, bad, riwayatRows] = await Promise.all([
    prisma.barang.count({
      where: { ...barangWhere(filter), status: "RETUR", finishGoodAt: { gte: period.from, lt: period.to } },
    }),
    prisma.barang.count({
      where: { ...barangWhere(filter), status: "OUT", finishGoodAt: { gte: period.from, lt: period.to } },
    }),
    prisma.barang.count({
      where: { ...barangWhere(filter), status: "BAD", finishGoodAt: { gte: period.from, lt: period.to } },
    }),
    prisma.riwayatBarang.count({
      where: {
        tanggal: { gte: period.from, lt: period.to },
        barang: barangWhere(filter),
      },
    }),
  ]);

  // Reject/repair tercatat pada level lot/Item (bukan per varian). Jika filter
  // varian dipakai, angka ini tidak dapat diatribusikan dan dilaporkan 0 +
  // peringatan, bukan ditebak.
  let reject = 0;
  let repair = 0;
  if (filter.variantId === undefined && filter.productId === undefined) {
    const rejectAgg = await prisma.wipReject.aggregate({
      where: { createdAt: { gte: period.from, lt: period.to } },
      _sum: { quantity: true },
    });
    reject = Number(rejectAgg._sum.quantity ?? 0);
    const repairAgg = await prisma.wipRejectRepairAttempt.aggregate({
      where: {
        reviewApproved: true,
        performedAt: { gte: period.from, lt: period.to },
      },
      _sum: { quantityRepaired: true },
    });
    repair = Number(repairAgg._sum.quantityRepaired ?? 0);
  } else {
    warnings.push({
      code: "REJECT_TIDAK_DAPAT_DIATRIBUSIKAN",
      message: "Reject/repair dicatat per lot Item sehingga tidak dapat difilter per varian",
    });
  }

  const variantIds = new Set<number>();
  for (const row of outputRows) if (row.productVariantId !== null) variantIds.add(row.productVariantId);
  for (const row of firstFgRows) variantIds.add(row.variantId);
  const variants = variantIds.size
    ? await prisma.productVariant.findMany({
        where: { id: { in: [...variantIds] } },
        select: {
          id: true,
          kodeVariant: true,
          product: { select: { id: true, nama: true } },
          style: { select: { nama: true } },
          color: { select: { nama: true } },
          size: { select: { nama: true } },
        },
      })
    : [];

  const perVariant = variants.map((variant) => {
    const output = outputRows.find((row) => row.productVariantId === variant.id);
    const fg = firstFgRows.find((row) => row.variantId === variant.id);
    const outputQty = Number(output?._sum.jumlah ?? 0);
    const fgQty = fg?._count._all ?? 0;
    return {
      variantId: variant.id,
      kodeVariant: variant.kodeVariant,
      product: variant.product.nama,
      style: variant.style.nama,
      color: variant.color.nama,
      size: variant.size.nama,
      outputQty,
      fgFirstCount: fgQty,
      gap: round6(outputQty - fgQty),
    };
  });

  if (legacyUnlinked > 0) {
    warnings.push({
      code: "LEGACY_UNLINKED",
      message: "Sebagian Barang tidak memiliki tautan produksi/QC sehingga tidak dapat ditelusuri",
      count: legacyUnlinked,
    });
  }

  return {
    period: { from: tanggalBisnis(period.from), to: tanggalBisnis(new Date(period.to.getTime() - 1)) },
    basis: "FINISHGOOD" as const,
    totals: {
      productionOutput: round6(productionOutput),
      barangGenerated,
      fgFirstCount: firstFg,
      registerNotFinishGood: registerNotFg,
      reject: round6(reject),
      repair: round6(repair),
      retur,
      out,
      bad,
      statusChanges: riwayatRows,
      gapProductionVsFinishGood: round6(productionOutput - firstFg),
      legacyUnlinked,
    },
    perVariant: perVariant.sort((a, b) => b.fgFirstCount - a.fgFirstCount || a.kodeVariant.localeCompare(b.kodeVariant)),
    warnings,
  };
}

// =============================================
// B. Material Consumption
// =============================================

type ConsumptionAccumulator = {
  theoretical: Map<number, LeafQuantity>;
  actual: Map<number, LeafQuantity>;
  incomplete: boolean;
  unmatchedTheoretical: number;
};

function addTo(map: Map<number, LeafQuantity>, leaf: LeafQuantity) {
  const current = map.get(leaf.itemId);
  map.set(leaf.itemId, { ...leaf, quantity: round6((current?.quantity ?? 0) + leaf.quantity) });
}

function addBomExplosion(map: Map<number, LeafQuantity>, explosion: BomExplosion, factor: number) {
  for (const line of explosion.lines) {
    addTo(map, {
      itemId: line.itemId,
      kode: line.kode,
      nama: line.nama,
      jenis: line.jenis,
      unit: line.unit,
      quantity: line.quantity * factor,
    });
  }
}

async function theoreticalForVariantDate(
  variantId: number,
  dateKey: string,
  quantity: number,
  cache: Map<string, { explosion: BomExplosion | null; error?: string }>,
) {
  const key = `${variantId}:${dateKey}`;
  let entry = cache.get(key);
  if (!entry) {
    try {
      const explosion = await explodeVariantBom(prisma, variantId, 1, awalHariBisnis(dateKey));
      entry = { explosion };
    } catch (error) {
      entry = {
        explosion: null,
        error: error instanceof BomError ? error.code : "BOM_ERROR",
      };
    }
    cache.set(key, entry);
  }
  return entry;
}

export async function getMaterialConsumption(filter: ReportFilter & { basis?: "FINISHGOOD" | "PRODUKSI" }) {
  const basis = filter.basis ?? "FINISHGOOD";
  const warnings: ReportWarning[] = [];
  const loader = createPrismaLotGraphLoader();
  const leafCache = new Map<number, LotLeafResult>();
  const bomCache = new Map<string, { explosion: BomExplosion | null; error?: string }>();
  const acc: ConsumptionAccumulator = {
    theoretical: new Map(),
    actual: new Map(),
    incomplete: false,
    unmatchedTheoretical: 0,
  };
  let outputQty = 0;
  let fgQty = 0;
  let linkedFgQty = 0;
  const lineIds = new Set<number>();
  let bomIncomplete = false;
  let missingBom = 0;

  if (basis === "FINISHGOOD") {
    const units = await prisma.barang.findMany({
      where: { ...barangWhere(filter), finishGoodAt: { gte: filter.from, lt: filter.to } },
      select: {
        id: true,
        variantId: true,
        hasilProduksiHarianItemId: true,
        qualityInspectionLine: { select: { pemakaianMaterialItemId: true } },
        hasilProduksiHarianItem: {
          select: {
            id: true,
            productVariantId: true,
            jumlah: true,
            hasilProduksiHarian: { select: { tanggalProduksi: true } },
          },
        },
      },
    });
    fgQty = units.length;
    linkedFgQty = units.filter(
      (unit) => unit.hasilProduksiHarianItemId !== null || unit.qualityInspectionLine !== null,
    ).length;

    const perLine = new Map<
      number,
      { units: number; variantId: number; date: Date; jumlah: number }
    >();
    for (const unit of units) {
      const line = unit.hasilProduksiHarianItem;
      if (!line) continue;
      lineIds.add(line.id);
      const current = perLine.get(line.id);
      perLine.set(line.id, {
        units: (current?.units ?? 0) + 1,
        variantId: line.productVariantId ?? unit.variantId,
        date: line.hasilProduksiHarian.tanggalProduksi,
        jumlah: Number(line.jumlah),
      });
    }

    for (const [lineId, row] of perLine) {
      outputQty += row.jumlah;
      const lot = await prisma.pemakaianMaterialItem.findUnique({
        where: { hasilProduksiHarianItemId: lineId },
        select: { id: true },
      });
      if (!lot) {
        acc.incomplete = true;
        continue;
      }
      const consumption = await leavesForLotQuantity(loader, lot.id, row.units, leafCache);
      if (consumption.incomplete) acc.incomplete = true;
      mergeLeafMaps(acc.actual, consumption.leaves);

      const entry = await theoreticalForVariantDate(
        row.variantId,
        tanggalBisnis(row.date),
        row.units,
        bomCache,
      );
      if (entry.explosion) {
        addBomExplosion(acc.theoretical, entry.explosion, row.units);
        if (entry.explosion.incomplete) bomIncomplete = true;
      } else {
        missingBom += 1;
      }
    }

    if (units.some((unit) => !unit.hasilProduksiHarianItem && !unit.qualityInspectionLine)) {
      acc.incomplete = true;
      warnings.push({
        code: "LEGACY_UNLINKED",
        message: "Ada unit FINISHGOOD tanpa tautan produksi/lot sehingga tidak dapat dialokasikan",
      });
    }
  } else {
    // Basis PRODUKSI: seluruh konsumsi aktual run pada periode.
    const headers = await prisma.hasilProduksiHarian.findMany({
      where: headerWhere(filter),
      select: {
        id: true,
        nomor: true,
        tanggalProduksi: true,
        items: { select: { id: true, tipe: true, jumlah: true, productVariantId: true } },
      },
    });

    for (const header of headers) {
      const hasilLines = header.items.filter((line) => line.tipe === "HASIL");
      outputQty += hasilLines.reduce((total, line) => total + Number(line.jumlah), 0);
      for (const line of hasilLines) lineIds.add(line.id);

      const edges = await prisma.hasilProduksiPemakaian.findMany({
        where: { hasilProduksiHarianItem: { hasilProduksiHarianId: header.id } },
        select: { pemakaianMaterialItemId: true, jumlah: true },
      });
      for (const edge of edges) {
        const consumption = await leavesForLotQuantity(
          loader,
          edge.pemakaianMaterialItemId,
          Number(edge.jumlah),
          leafCache,
        );
        if (consumption.incomplete) acc.incomplete = true;
        mergeLeafMaps(acc.actual, consumption.leaves);
      }

      for (const line of hasilLines) {
        if (line.productVariantId === null) continue;
        if (filter.variantId !== undefined && line.productVariantId !== filter.variantId) continue;
        const entry = await theoreticalForVariantDate(
          line.productVariantId,
          tanggalBisnis(header.tanggalProduksi),
          Number(line.jumlah),
          bomCache,
        );
        if (entry.explosion) {
          addBomExplosion(acc.theoretical, entry.explosion, Number(line.jumlah));
          if (entry.explosion.incomplete) bomIncomplete = true;
        } else {
          missingBom += 1;
        }
      }
    }
    fgQty = await prisma.barang.count({
      where: { ...barangWhere(filter), finishGoodAt: { gte: filter.from, lt: filter.to } },
    });
    linkedFgQty = await prisma.barang.count({
      where: {
        AND: [
          barangWhere(filter),
          { finishGoodAt: { gte: filter.from, lt: filter.to } },
          {
            OR: [
              { hasilProduksiHarianItemId: { not: null } },
              { qualityInspectionLineId: { not: null } },
            ],
          },
        ],
      },
    });
  }

  const itemIds = new Set<number>([...acc.theoretical.keys(), ...acc.actual.keys()]);
  let rows = [...itemIds].map((itemId) => {
    const theoretical = acc.theoretical.get(itemId);
    const actual = acc.actual.get(itemId);
    const reference = theoretical ?? actual!;
    const theoreticalQty = round6(theoretical?.quantity ?? 0);
    const actualQty = round6(actual?.quantity ?? 0);
    const variance = round6(actualQty - theoreticalQty);
    const variancePercentage =
      theoreticalQty === 0 ? null : round6((variance / theoreticalQty) * 100);
    return {
      itemId,
      kode: reference.kode,
      nama: reference.nama,
      jenis: reference.jenis,
      unit: reference.unit,
      theoreticalQty,
      actualQty,
      variance,
      variancePercentage,
      comparisonStatus:
        theoreticalQty > 0 && actualQty > 0
          ? ("MATCH" as const)
          : theoreticalQty > 0
            ? ("TEORITIS_ONLY" as const)
            : ("AKTUAL_ONLY" as const),
    };
  });

  if (filter.itemId !== undefined) rows = rows.filter((row) => row.itemId === filter.itemId);

  const lotCount = await prisma.hasilProduksiHarianItem.count({
    where: { tipe: "HASIL", hasilProduksiHarian: headerWhere(filter), ...lineVariantWhere(filter) },
  });

  if (filter.variantId !== undefined || filter.productId !== undefined) {
    warnings.push({
      code: "FILTER_VARIAN",
      message:
        "Filter varian hanya menyaring output produksi dan unit; material actual tetap dihitung dari genealogi lot (tanpa menebak alokasi antar varian pada lot bersama)",
    });
  }
  if (acc.incomplete) {
    warnings.push({
      code: "LOT_TIDAK_LENGKAP",
      message: "Sebagian genealogi lot tidak lengkap; angka actual tidak mencakup rantai yang hilang",
    });
  }
  if (bomIncomplete) {
    warnings.push({
      code: "BOM_TIDAK_LENGKAP",
      message: "Ekspansi BOM berhenti pada komponen yang belum punya BOM anak",
    });
  }
  if (missingBom > 0) {
    warnings.push({
      code: "BOM_NOT_FOUND",
      message: "Ada output varian tanpa BOM efektif; kebutuhan teoretis tidak dihitung",
      count: missingBom,
    });
  }

  return {
    period: {
      from: tanggalBisnis(filter.from),
      to: tanggalBisnis(new Date(filter.to.getTime() - 1)),
    },
    basis,
    summary: {
      productionOutput: round6(outputQty),
      finishGoodUnits: fgQty,
      linkedFinishGoodUnits: linkedFgQty,
      unlinkedFinishGoodUnits: Math.max(fgQty - linkedFgQty, 0),
      lotCount,
      theoreticalIncomplete: bomIncomplete,
      genealogyIncomplete: acc.incomplete,
    },
    rows: rows.sort((a, b) => a.kode.localeCompare(b.kode)),
    warnings,
  };
}

// =============================================
// C. Traceability
// =============================================

export async function getTraceability(
  filter: ReportFilter & { kodeBarang?: string; barangId?: number },
) {
  const loader = createPrismaLotGraphLoader();
  const leafCache = new Map<number, LotLeafResult>();
  const warnings: ReportWarning[] = [];
  const limit = Math.min(filter.limit ?? 50, 200);

  const where: Prisma.BarangWhereInput = {};
  if (filter.kodeBarang) where.kodeBarang = filter.kodeBarang;
  else if (filter.barangId !== undefined) where.id = filter.barangId;
  else {
    where.finishGoodAt = { gte: filter.from, lt: filter.to };
    Object.assign(where, variantWhere(filter));
    if (filter.status) where.status = filter.status;
  }

  const units = await prisma.barang.findMany({
    where,
    take: limit,
    orderBy: [{ finishGoodAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      kodeBarang: true,
      status: true,
      finishGoodAt: true,
      createdAt: true,
      variant: {
        select: {
          id: true,
          kodeVariant: true,
          product: { select: { id: true, nama: true } },
          style: { select: { nama: true } },
          color: { select: { nama: true } },
          size: { select: { nama: true } },
        },
      },
      riwayat: { orderBy: { tanggal: "asc" }, select: { status: true, tanggal: true, keterangan: true } },
      qualityInspectionLine: { select: { pemakaianMaterialItemId: true, inspectedQuantity: true } },
      hasilProduksiHarianItem: {
        select: {
          id: true,
          tipe: true,
          jumlah: true,
          productVariantId: true,
          hasilProduksiHarian: {
            select: {
              id: true,
              nomor: true,
              tanggalProduksi: true,
              divisi: { select: { id: true, nama: true } },
              routingStage: { select: { id: true, stage: true, sequence: true } },
              bom: { select: { id: true, version: true } },
            },
          },
        },
      },
    },
  });

  const rows = [];
  for (const unit of units) {
    const line = unit.hasilProduksiHarianItem;
    let lotId: number | null = null;
    let genealogySource: "PRODUCTION_OUTPUT" | "QUALITY_INSPECTION" | null = null;

    if (line) {
      const lot = await prisma.pemakaianMaterialItem.findUnique({
        where: { hasilProduksiHarianItemId: line.id },
        select: { id: true },
      });
      if (lot) {
        lotId = lot.id;
        genealogySource = "PRODUCTION_OUTPUT";
      }
    }
    if (lotId === null && unit.qualityInspectionLine?.pemakaianMaterialItemId) {
      lotId = unit.qualityInspectionLine.pemakaianMaterialItemId;
      genealogySource = "QUALITY_INSPECTION";
    }

    let materials: LeafQuantity[] = [];
    let incomplete = false;
    if (lotId !== null) {
      const consumption = await leavesForLotQuantity(loader, lotId, 1, leafCache);
      materials = consumption.leaves;
      incomplete = consumption.incomplete;
    }
    if (lotId === null) incomplete = true;

    rows.push({
      kodeBarang: unit.kodeBarang,
      status: unit.status,
      finishGoodAt: unit.finishGoodAt,
      variant: {
        id: unit.variant.id,
        kodeVariant: unit.variant.kodeVariant,
        product: unit.variant.product.nama,
        style: unit.variant.style.nama,
        color: unit.variant.color.nama,
        size: unit.variant.size.nama,
      },
      production: line
        ? {
            lineId: line.id,
            hasilProduksiHarianId: line.hasilProduksiHarian.id,
            nomor: line.hasilProduksiHarian.nomor,
            tanggalProduksi: line.hasilProduksiHarian.tanggalProduksi,
            divisi: line.hasilProduksiHarian.divisi,
            stage: line.hasilProduksiHarian.routingStage,
            bomVersion: line.hasilProduksiHarian.bom?.version ?? null,
            outputQuantity: Number(line.jumlah),
          }
        : null,
      lotId,
      genealogySource,
      materialsPerUnit: materials,
      statusHistory: unit.riwayat,
      flags:
        lotId === null
          ? ["LEGACY_UNLINKED"]
          : incomplete
            ? ["LOT_TIDAK_LENGKAP"]
            : [],
    });
  }

  const unlinked = rows.filter((row) => row.flags.includes("LEGACY_UNLINKED")).length;
  if (unlinked > 0) {
    warnings.push({
      code: "LEGACY_UNLINKED",
      message: "Unit tanpa tautan produksi/QC tidak memiliki genealogi material",
      count: unlinked,
    });
  }

  return {
    period: {
      from: tanggalBisnis(filter.from),
      to: tanggalBisnis(new Date(filter.to.getTime() - 1)),
    },
    total: rows.length,
    rows,
    warnings,
  };
}

// =============================================
// D. Reconciliation
// =============================================

export async function getReconciliation(filter: ReportFilter) {
  const outputRows = await prisma.hasilProduksiHarianItem.groupBy({
    by: ["productVariantId"],
    where: { tipe: "HASIL", hasilProduksiHarian: headerWhere(filter) },
    _sum: { jumlah: true },
  });
  const generatedRows = await prisma.barang.groupBy({
    by: ["variantId"],
    where: { AND: [barangWhere(filter), { hasilProduksiHarianItem: { hasilProduksiHarian: headerWhere(filter) } }] },
    _count: { _all: true },
  });
  const statusRows = await prisma.barang.groupBy({
    by: ["variantId", "status"],
    where: { AND: [barangWhere(filter), { hasilProduksiHarianItem: { hasilProduksiHarian: headerWhere(filter) } }] },
    _count: { _all: true },
  });
  const fgRows = await prisma.barang.groupBy({
    by: ["variantId"],
    where: {
      ...barangWhere(filter),
      finishGoodAt: { gte: filter.from, lt: filter.to },
    },
    _count: { _all: true },
  });

  const variantIds = new Set<number>();
  for (const row of outputRows) if (row.productVariantId !== null) variantIds.add(row.productVariantId);
  for (const row of generatedRows) variantIds.add(row.variantId);
  for (const row of fgRows) variantIds.add(row.variantId);

  const variants = variantIds.size
    ? await prisma.productVariant.findMany({
        where: { id: { in: [...variantIds] } },
        select: {
          id: true,
          kodeVariant: true,
          product: { select: { nama: true } },
          color: { select: { nama: true } },
          size: { select: { nama: true } },
        },
      })
    : [];

  let wipRows: Array<{ itemId: number | null; kode: string; nama: string; unit: string; quantity: number }> = [];
  if (filter.variantId === undefined && filter.productId === undefined) {
    const lots = await prisma.pemakaianMaterialItem.groupBy({
      by: ["itemId"],
      where: {
        jumlahSisa: { gt: 0 },
        pemakaian: {
          tanggal: { gte: filter.from, lt: filter.to },
          divisiId: filter.divisiId ?? undefined,
        },
      },
      _sum: { jumlahSisa: true },
    });
    const items = await prisma.item.findMany({
      where: { id: { in: lots.map((row) => row.itemId).filter((id): id is number => id !== null) } },
      select: { id: true, kode: true, nama: true, unit: true },
    });
    wipRows = lots.map((row) => {
      const item = items.find((candidate) => candidate.id === row.itemId);
      return {
        itemId: row.itemId,
        kode: item?.kode ?? `I${row.itemId}`,
        nama: item?.nama ?? "-",
        unit: item?.unit ?? "-",
        quantity: round6(Number(row._sum.jumlahSisa ?? 0)),
      };
    });
  }

  const rows = variants.map((variant) => {
    const output = Number(
      outputRows.find((row) => row.productVariantId === variant.id)?._sum.jumlah ?? 0,
    );
    const generated = generatedRows.find((row) => row.variantId === variant.id)?._count._all ?? 0;
    const statusOf = (status: string) =>
      statusRows.find((row) => row.variantId === variant.id && row.status === status)?._count._all ?? 0;
    const fg = fgRows.find((row) => row.variantId === variant.id)?._count._all ?? 0;
    const register = statusOf("REGISTER");
    const retur = statusOf("RETUR");
    const out = statusOf("OUT");
    const bad = statusOf("BAD");
    return {
      variantId: variant.id,
      kodeVariant: variant.kodeVariant,
      product: variant.product.nama,
      color: variant.color.nama,
      size: variant.size.nama,
      producedQty: round6(output),
      barangGenerated: generated,
      finishGoodQty: fg,
      registerNotFinishGood: register,
      retur,
      out,
      bad,
      gapProducedVsGenerated: round6(output - generated),
      bucketTotal: register + fg + retur + out + bad,
    };
  });

  const [legacyUnlinked, legacyGenerations] = await Promise.all([
    prisma.barang.count({
      where: {
        finishGoodAt: null,
        hasilProduksiHarianItemId: null,
        qualityInspectionLineId: null,
      },
    }),
    prisma.produksiHarian.count({
      where: { tanggalProduksi: { gte: filter.from, lt: filter.to } },
    }),
  ]);

  const warnings: ReportWarning[] = [];
  if (legacyGenerations > 0) {
    warnings.push({
      code: "PH_LEGACY",
      message:
        "Ada transaksi ProduksiHarian (legacy) pada periode ini. Laporan kanonik memakai HasilProduksiHarian; angka PH tidak digabung agar tidak dihitung dua kali.",
      count: legacyGenerations,
    });
  }
  if (legacyUnlinked > 0) {
    warnings.push({
      code: "LEGACY_UNLINKED",
      message: "Unit lama tanpa tautan produksi/QC dipertahankan sebagai legacy, bukan dihapus",
      count: legacyUnlinked,
    });
  }

  return {
    period: {
      from: tanggalBisnis(filter.from),
      to: tanggalBisnis(new Date(filter.to.getTime() - 1)),
    },
    perVariant: rows.sort((a, b) => a.kodeVariant.localeCompare(b.kodeVariant)),
    wip: wipRows.sort((a, b) => a.kode.localeCompare(b.kode)),
    legacy: { unlinkedBarang: legacyUnlinked, produksiHarianTransaksi: legacyGenerations },
    warnings,
    bucketRule:
      "Satu Barang dihitung tepat satu kali pada bucket status saat ini (REGISTER/RETUR/OUT/BAD) atau bucket FINISHGOOD bila finishGoodAt jatuh pada periode. Produced dan generated ditampilkan terpisah sebagai pembanding, bukan penjumlahan.",
  };
}
