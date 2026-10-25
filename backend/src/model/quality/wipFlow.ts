import { randomUUID } from "node:crypto";
import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";
import { postInventoryMovementInTransaction } from "../inventory/inventory.js";
import { QualityError } from "./qualityError.js";

const REPORT_MOVEMENT_LIMIT = 1000;

export type WipFlowFilters = {
  from: Date;
  to: Date;
  divisionId?: number;
  itemId?: number;
};

export type WipStocktakeInput = {
  locationId: number;
  notes?: string | null;
  items: Array<{ itemId: number; physicalQuantity: number; reason: string }>;
};

type MovementGroup = {
  itemId: number | null;
  locationId: number | null;
  quantity: number;
};

function keyOf(locationId: number, itemId: number) {
  return `${locationId}:${itemId}`;
}

function addGroup(map: Map<string, number>, locationId: number | null, itemId: number | null, amount: number) {
  if (locationId === null || itemId === null) return;
  const key = keyOf(locationId, itemId);
  map.set(key, (map.get(key) ?? 0) + amount);
}

function groupRows(
  rows: Array<{ itemId: number | null; fromLocationId?: number | null; toLocationId?: number | null; _sum: { quantity: unknown } }>,
  direction: "from" | "to",
): MovementGroup[] {
  return rows.map((row) => ({
    itemId: row.itemId,
    locationId: direction === "from" ? row.fromLocationId ?? null : row.toLocationId ?? null,
    quantity: Number(row._sum.quantity ?? 0),
  }));
}

export function calculateWipStocktakeDifference(systemQuantity: number, physicalQuantity: number) {
  if (
    !Number.isFinite(systemQuantity) ||
    !Number.isFinite(physicalQuantity) ||
    systemQuantity < 0 ||
    physicalQuantity < 0
  ) {
    throw new QualityError("INPUT_INVALID", "Saldo sistem dan hitung fisik harus angka non-negatif");
  }
  const difference = Math.round((physicalQuantity - systemQuantity) * 1_000_000) / 1_000_000;
  return Object.is(difference, -0) ? 0 : difference;
}

async function getWipLocations(divisionId?: number) {
  return prisma.inventoryLocation.findMany({
    where: {
      type: "DIVISION",
      isActive: true,
      ...(divisionId ? { divisiId: divisionId } : {}),
    },
    select: {
      id: true,
      code: true,
      name: true,
      divisiId: true,
      divisi: { select: { id: true, nama: true } },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

async function getRoutedStageLabels(itemIds: number[]) {
  const now = new Date();
  const routings = await prisma.productionRouting.findMany({
    where: {
      isActive: true,
      bom: {
        isActive: true,
        AND: [
          { OR: [{ berlakuMulai: null }, { berlakuMulai: { lte: now } }] },
          { OR: [{ berlakuSelesai: null }, { berlakuSelesai: { gte: now } }] },
        ],
      },
    },
    select: {
      stages: {
        select: {
          stage: true,
          divisiId: true,
          outputItemId: true,
          divisi: { select: { nama: true } },
          outputItem: { select: { kode: true, nama: true, unit: true } },
        },
      },
    },
  });
  const labels = new Map<string, {
    stage: string;
    divisionName: string;
    code: string;
    name: string;
    unit: string;
  }>();
  for (const routing of routings) {
    for (const stage of routing.stages) {
      if (!itemIds.includes(stage.outputItemId)) continue;
      labels.set(keyOf(stage.divisiId, stage.outputItemId), {
        stage: stage.stage,
        divisionName: stage.divisi.nama,
        code: stage.outputItem.kode,
        name: stage.outputItem.nama,
        unit: stage.outputItem.unit,
      });
    }
  }
  return labels;
}

export async function listWipStocktakeOptions() {
  const [locations, items] = await Promise.all([
    getWipLocations(),
    prisma.item.findMany({
      where: {
        jenis: "SM",
        isActive: true,
        OR: [
          { productionRoutingOutputs: { some: {} } },
          { productionRoutingInputs: { some: {} } },
        ],
      },
      select: {
        id: true,
        kode: true,
        nama: true,
        unit: true,
        divisiId: true,
      },
      orderBy: [{ nama: "asc" }, { kode: "asc" }],
    }),
  ]);
  const itemIds = items.map((item) => item.id);
  if (locations.length === 0 || itemIds.length === 0) return [];
  const locationIds = locations.map((location) => location.id);
  const [from, to, routeLabels] = await Promise.all([
    prisma.inventoryMovement.groupBy({
      by: ["itemId", "fromLocationId"],
      where: {
        itemId: { in: itemIds },
        fromLocationId: { in: locationIds },
      },
      _sum: { quantity: true },
    }),
    prisma.inventoryMovement.groupBy({
      by: ["itemId", "toLocationId"],
      where: {
        itemId: { in: itemIds },
        toLocationId: { in: locationIds },
      },
      _sum: { quantity: true },
    }),
    getRoutedStageLabels(itemIds),
  ]);
  const balances = new Map<string, number>();
  for (const row of groupRows(from, "from")) addGroup(balances, row.locationId, row.itemId, -row.quantity);
  for (const row of groupRows(to, "to")) addGroup(balances, row.locationId, row.itemId, row.quantity);

  return locations.flatMap((location) => items.flatMap((item) => {
    const key = keyOf(location.id, item.id);
    const stage = routeLabels.get(key);
    const quantity = balances.get(key) ?? 0;
    if (quantity <= 0 && !stage) return [];
    return [{
      locationId: location.id,
      locationName: location.name,
      divisionId: location.divisiId,
      divisionName: location.divisi?.nama ?? location.name,
      itemId: item.id,
      itemCode: item.kode,
      itemName: item.nama,
      unit: item.unit,
      quantity: Math.max(0, quantity),
      stage: stage?.stage ?? null,
    }];
  }));
}

export async function getWipFlowReport(filters: WipFlowFilters) {
  if (filters.from > filters.to) {
    throw new QualityError("INPUT_INVALID", "Tanggal mulai tidak boleh melebihi tanggal akhir");
  }
  const locations = await getWipLocations(filters.divisionId);
  if (locations.length === 0) {
    return {
      period: { from: filters.from, to: filters.to },
      totals: emptyFlowTotals(),
      balances: [],
      qualityByStage: [],
      repairByDivision: [],
      movements: [],
      movementCount: 0,
      movementsTruncated: false,
    };
  }
  const locationIds = locations.map((location) => location.id);
  const items = await prisma.item.findMany({
    where: {
      jenis: "SM",
      isActive: true,
      OR: [
        { productionRoutingOutputs: { some: {} } },
        { productionRoutingInputs: { some: {} } },
      ],
      ...(filters.itemId ? { id: filters.itemId } : {}),
    },
    select: { id: true, kode: true, nama: true, unit: true },
    orderBy: [{ nama: "asc" }, { kode: "asc" }],
  });
  const itemIds = items.map((item) => item.id);
  if (itemIds.length === 0) {
    return {
      period: { from: filters.from, to: filters.to },
      totals: emptyFlowTotals(),
      balances: [],
      qualityByStage: [],
      repairByDivision: [],
      movements: [],
      movementCount: 0,
      movementsTruncated: false,
    };
  }
  const routeLabels = await getRoutedStageLabels(itemIds);
  const movementWhere = {
    itemId: { in: itemIds },
    OR: [
      { fromLocationId: { in: locationIds } },
      { toLocationId: { in: locationIds } },
    ],
  };
  const [openingFrom, openingTo, closingFrom, closingTo, periodFrom, periodTo, movementCount, movements, qualityLines, repairAttempts] =
    await Promise.all([
      prisma.inventoryMovement.groupBy({
        by: ["itemId", "fromLocationId"],
        where: { ...movementWhere, fromLocationId: { in: locationIds }, occurredAt: { lt: filters.from } },
        _sum: { quantity: true },
      }),
      prisma.inventoryMovement.groupBy({
        by: ["itemId", "toLocationId"],
        where: { ...movementWhere, toLocationId: { in: locationIds }, occurredAt: { lt: filters.from } },
        _sum: { quantity: true },
      }),
      prisma.inventoryMovement.groupBy({
        by: ["itemId", "fromLocationId"],
        where: { ...movementWhere, fromLocationId: { in: locationIds }, occurredAt: { lte: filters.to } },
        _sum: { quantity: true },
      }),
      prisma.inventoryMovement.groupBy({
        by: ["itemId", "toLocationId"],
        where: { ...movementWhere, toLocationId: { in: locationIds }, occurredAt: { lte: filters.to } },
        _sum: { quantity: true },
      }),
      prisma.inventoryMovement.groupBy({
        by: ["itemId", "fromLocationId", "type"],
        where: { ...movementWhere, fromLocationId: { in: locationIds }, occurredAt: { gte: filters.from, lte: filters.to } },
        _sum: { quantity: true },
      }),
      prisma.inventoryMovement.groupBy({
        by: ["itemId", "toLocationId", "type"],
        where: { ...movementWhere, toLocationId: { in: locationIds }, occurredAt: { gte: filters.from, lte: filters.to } },
        _sum: { quantity: true },
      }),
      prisma.inventoryMovement.count({
        where: { ...movementWhere, occurredAt: { gte: filters.from, lte: filters.to } },
      }),
      prisma.inventoryMovement.findMany({
        where: { ...movementWhere, occurredAt: { gte: filters.from, lte: filters.to } },
        select: {
          id: true,
          type: true,
          quantity: true,
          occurredAt: true,
          sourceType: true,
          sourceId: true,
          reason: true,
          item: { select: { kode: true, nama: true, unit: true } },
          fromLocation: { select: { name: true, divisi: { select: { nama: true } } } },
          toLocation: { select: { name: true, divisi: { select: { nama: true } } } },
        },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        take: REPORT_MOVEMENT_LIMIT,
      }),
      prisma.qualityInspectionLine.findMany({
        where: {
          inspection: {
            status: "COMPLETED",
            inspectedAt: { gte: filters.from, lte: filters.to },
          },
          ...(filters.itemId ? { lot: { itemId: filters.itemId } } : {}),
          ...(filters.divisionId ? {
            productionRouting: {
              stages: { some: { stage: "TOP_COAT", divisiId: filters.divisionId } },
            },
          } : {}),
        },
        select: {
          inspectedQuantity: true,
          passedQuantity: true,
          repairQuantity: true,
          rejectedQuantity: true,
          productionRouting: {
            select: {
              stages: {
                select: {
                  stage: true,
                  divisi: { select: { id: true, nama: true } },
                },
              },
            },
          },
        },
      }),
      prisma.repairAttempt.findMany({
        where: {
          performedAt: { gte: filters.from, lte: filters.to },
          ...((filters.divisionId || filters.itemId) ? {
            assignment: {
              AND: [
                ...(filters.divisionId ? [{ repairDivisionId: filters.divisionId }] : []),
                ...(filters.itemId ? [{ inspectionLine: { lot: { itemId: filters.itemId } } }] : []),
              ],
            },
          } : {}),
        },
        select: {
          quantityAttempted: true,
          quantityRepaired: true,
          reviewApproved: true,
          assignment: {
            select: {
              repairDivision: { select: { id: true, nama: true } },
            },
          },
        },
      }),
    ]);

  const opening = new Map<string, number>();
  const closing = new Map<string, number>();
  const inflow = new Map<string, number>();
  const outflow = new Map<string, number>();
  const addAggregates = (
    target: Map<string, number>,
    fromRows: Array<{ itemId: number | null; fromLocationId: number | null; _sum: { quantity: unknown } }>,
    toRows: Array<{ itemId: number | null; toLocationId: number | null; _sum: { quantity: unknown } }>,
  ) => {
    for (const row of fromRows) addGroup(target, row.fromLocationId, row.itemId, -Number(row._sum.quantity ?? 0));
    for (const row of toRows) addGroup(target, row.toLocationId, row.itemId, Number(row._sum.quantity ?? 0));
  };
  addAggregates(opening, openingFrom, openingTo);
  addAggregates(closing, closingFrom, closingTo);

  const totals = emptyFlowTotals();
  const byTypeFrom = new Map<string, number>();
  const byTypeTo = new Map<string, number>();
  for (const row of periodFrom) byTypeFrom.set(`${row.itemId}:${row.fromLocationId}:${row.type}`, Number(row._sum.quantity ?? 0));
  for (const row of periodTo) byTypeTo.set(`${row.itemId}:${row.toLocationId}:${row.type}`, Number(row._sum.quantity ?? 0));
  for (const [key, amount] of byTypeFrom) {
    const [, , type] = key.split(":");
    if (type === "PRODUCTION") totals.productionOut += amount;
    if (type === "TRANSFER") totals.transferOut += amount;
    if (type === "QC") totals.qcOut += amount;
    if (type === "REPAIR") totals.repairOut += amount;
    if (type === "ADJUSTMENT") totals.adjustmentOut += amount;
    if (type === "SHIPMENT") totals.shipmentOut += amount;
    const [itemId, locationId] = key.split(":");
    addGroup(outflow, Number(locationId), Number(itemId), amount);
  }
  for (const [key, amount] of byTypeTo) {
    const [, , type] = key.split(":");
    if (type === "PRODUCTION") totals.productionIn += amount;
    if (type === "TRANSFER") totals.transferIn += amount;
    if (type === "QC") totals.qcIn += amount;
    if (type === "REPAIR") totals.repairIn += amount;
    if (type === "ADJUSTMENT") totals.adjustmentIn += amount;
    if (type === "SHIPMENT") totals.shipmentIn += amount;
    const [itemId, locationId] = key.split(":");
    addGroup(inflow, Number(locationId), Number(itemId), amount);
  }
  const stageStats = new Map<string, { stage: string; divisionName: string; inspected: number; passed: number; repair: number; rejected: number }>();
  for (const line of qualityLines) {
    const stage = line.productionRouting?.stages.find((candidate) => candidate.stage === "TOP_COAT");
    const label = stage?.stage ?? "TOP_COAT";
    const divisionName = stage?.divisi.nama ?? "QC Akhir";
    const key = `${label}:${divisionName}`;
    const row = stageStats.get(key) ?? { stage: label, divisionName, inspected: 0, passed: 0, repair: 0, rejected: 0 };
    row.inspected += Number(line.inspectedQuantity);
    row.passed += Number(line.passedQuantity);
    row.repair += Number(line.repairQuantity);
    row.rejected += Number(line.rejectedQuantity);
    stageStats.set(key, row);
    totals.inspected += Number(line.inspectedQuantity);
    totals.passed += Number(line.passedQuantity);
    totals.repair += Number(line.repairQuantity);
    totals.rejected += Number(line.rejectedQuantity);
  }
  const repairStats = new Map<number, { divisionId: number; divisionName: string; attempted: number; repaired: number; approved: number; failed: number }>();
  for (const attempt of repairAttempts) {
    const division = attempt.assignment.repairDivision;
    const row = repairStats.get(division.id) ?? { divisionId: division.id, divisionName: division.nama, attempted: 0, repaired: 0, approved: 0, failed: 0 };
    row.attempted += Number(attempt.quantityAttempted);
    row.repaired += Number(attempt.quantityRepaired);
    if (attempt.reviewApproved === true) row.approved += Number(attempt.quantityRepaired);
    if (attempt.reviewApproved === false) row.failed += Number(attempt.quantityAttempted);
    repairStats.set(division.id, row);
    totals.repairAttempted += Number(attempt.quantityAttempted);
    totals.repairSucceeded += Number(attempt.quantityRepaired);
    if (attempt.reviewApproved === true) totals.repairApproved += Number(attempt.quantityRepaired);
    if (attempt.reviewApproved === false) totals.repairFailed += Number(attempt.quantityAttempted);
  }

  const itemById = new Map(items.map((item) => [item.id, item]));
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const balanceKeys = new Set([...opening.keys(), ...closing.keys(), ...inflow.keys(), ...outflow.keys()]);
  const balances = [...balanceKeys].flatMap((key) => {
    const [locationIdValue, itemIdValue] = key.split(":");
    const locationId = Number(locationIdValue);
    const itemId = Number(itemIdValue);
    const location = locationById.get(locationId);
    const item = itemById.get(itemId);
    if (!location || !item) return [];
    const label = routeLabels.get(key);
    const openingQuantity = opening.get(key) ?? 0;
    const incoming = inflow.get(key) ?? 0;
    const outgoing = outflow.get(key) ?? 0;
    return [{
      locationId,
      locationName: location.name,
      divisionName: location.divisi?.nama ?? location.name,
      itemId,
      itemCode: item.kode,
      itemName: item.nama,
      unit: item.unit,
      stage: label?.stage ?? null,
      opening: openingQuantity,
      inflow: incoming,
      outflow: outgoing,
      closing: closing.get(key) ?? 0,
      expectedClosing: openingQuantity + incoming - outgoing,
    }];
  }).sort((a, b) =>
    a.divisionName.localeCompare(b.divisionName) ||
    a.itemName.localeCompare(b.itemName),
  );

  totals.openingBalance = balances.reduce((sum, row) => sum + row.opening, 0);
  totals.closingBalance = balances.reduce((sum, row) => sum + row.closing, 0);
  const serializedMovements = movements.map((movement) => ({
    ...movement,
    id: movement.id.toString(),
    quantity: Number(movement.quantity),
  }));
  return {
    period: { from: filters.from, to: filters.to },
    totals,
    balances,
    qualityByStage: [...stageStats.values()],
    repairByDivision: [...repairStats.values()],
    movements: serializedMovements,
    movementCount,
    movementsTruncated: movementCount > REPORT_MOVEMENT_LIMIT,
  };
}

function emptyFlowTotals() {
  return {
    openingBalance: 0,
    closingBalance: 0,
    productionIn: 0,
    productionOut: 0,
    transferIn: 0,
    transferOut: 0,
    qcIn: 0,
    qcOut: 0,
    repairIn: 0,
    repairOut: 0,
    adjustmentIn: 0,
    adjustmentOut: 0,
    shipmentIn: 0,
    shipmentOut: 0,
    inspected: 0,
    passed: 0,
    repair: 0,
    rejected: 0,
    repairAttempted: 0,
    repairSucceeded: 0,
    repairApproved: 0,
    repairFailed: 0,
  };
}

export async function createWipStocktake(input: WipStocktakeInput, userId: number) {
  if (
    !Number.isSafeInteger(input.locationId) ||
    input.locationId <= 0 ||
    input.items.length === 0 ||
    input.items.length > 200 ||
    new Set(input.items.map((item) => item.itemId)).size !== input.items.length
  ) {
    throw new QualityError("INPUT_INVALID", "Pilih lokasi dan 1–200 item WIP unik untuk opname");
  }
  for (const line of input.items) {
    if (
      !Number.isSafeInteger(line.itemId) ||
      line.itemId <= 0 ||
      !Number.isFinite(line.physicalQuantity) ||
      line.physicalQuantity < 0 ||
      Math.abs(line.physicalQuantity * 1_000_000 - Math.round(line.physicalQuantity * 1_000_000)) > 1e-7 ||
      typeof line.reason !== "string"
    ) {
      throw new QualityError("INPUT_INVALID", "Jumlah fisik dan alasan tiap item harus valid");
    }
  }

  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    await tx.$queryRaw`SELECT id FROM InventoryLocation WHERE id = ${input.locationId} FOR UPDATE`;
    const location = await tx.inventoryLocation.findUnique({
      where: { id: input.locationId },
      select: { id: true, type: true, divisiId: true, name: true, isActive: true },
    });
    if (!location || location.type !== "DIVISION" || !location.divisiId || !location.isActive) {
      throw new QualityError("LOCATION_NOT_FOUND", "Opname WIP hanya berlaku pada lokasi divisi aktif");
    }

    const lines = [...input.items].sort((a, b) => a.itemId - b.itemId);
    for (const line of lines) {
      await tx.$queryRaw`SELECT id FROM Item WHERE id = ${line.itemId} FOR UPDATE`;
    }
    const items = await tx.item.findMany({
      where: { id: { in: lines.map((line) => line.itemId) } },
      select: { id: true, kode: true, nama: true, unit: true, jenis: true, isActive: true },
    });
    const itemById = new Map(items.map((item) => [item.id, item]));
    if (
      items.length !== lines.length ||
      items.some((item) => item.jenis !== "SM" || !item.isActive)
    ) {
      throw new QualityError("INPUT_INVALID", "Opname hanya dapat mencatat Item WIP jenis SM yang aktif");
    }

    const session = await tx.wipStocktakeSession.create({
      data: {
        number: `WIP-OPN-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`,
        locationId: location.id,
        countedById: userId,
        notes: input.notes?.trim() || null,
      },
    });
    for (const line of lines) {
      const item = itemById.get(line.itemId);
      if (!item) throw new QualityError("ITEM_NOT_FOUND", "Item WIP tidak ditemukan");
      const balanceMovements = await tx.inventoryMovement.findMany({
        where: {
          itemId: item.id,
          OR: [{ fromLocationId: location.id }, { toLocationId: location.id }],
        },
        select: { quantity: true, fromLocationId: true, toLocationId: true },
      });
      const systemQuantity = balanceMovements.reduce((balance, movement) => {
        if (movement.fromLocationId === location.id) return balance - Number(movement.quantity);
        if (movement.toLocationId === location.id) return balance + Number(movement.quantity);
        return balance;
      }, 0);
      if (systemQuantity < 0) {
        throw new QualityError("STOCKTAKE_CONFLICT", "Saldo ledger WIP negatif; rekonsiliasi ledger sebelum opname");
      }
      const hasStageAtLocation = await tx.productionRoutingStage.findFirst({
        where: { divisiId: location.divisiId, outputItemId: item.id },
        select: { id: true },
      });
      if (systemQuantity <= 0 && !hasStageAtLocation) {
        throw new QualityError("INPUT_INVALID", "Item ini tidak termasuk WIP tahap routing pada lokasi yang dipilih");
      }
      const difference = calculateWipStocktakeDifference(systemQuantity, line.physicalQuantity);
      const reason = line.reason.trim();
      if (difference !== 0 && reason.length < 5) {
        throw new QualityError("INPUT_INVALID", "Setiap selisih opname wajib disertai alasan minimal 5 karakter");
      }
      const savedLine = await tx.wipStocktakeLine.create({
        data: {
          sessionId: session.id,
          itemId: item.id,
          systemQuantity,
          physicalQuantity: line.physicalQuantity,
          difference,
          reason,
        },
      });
      if (difference > 0) {
        const isRoutedOutput = await tx.productionRoutingStage.findFirst({
          where: {
            divisiId: location.divisiId,
            outputItemId: item.id,
            routing: {
              isActive: true,
              bom: {
                isActive: true,
                AND: [
                  { OR: [{ berlakuMulai: null }, { berlakuMulai: { lte: session.countedAt } }] },
                  { OR: [{ berlakuSelesai: null }, { berlakuSelesai: { gte: session.countedAt } }] },
                ],
              },
            },
          },
          select: { id: true },
        });
        if (!isRoutedOutput) {
          throw new QualityError("STOCKTAKE_CONFLICT", "Penambahan WIP hanya dapat dilakukan untuk Item pada routing aktif di lokasi ini");
        }
        const lot = await tx.pemakaianMaterial.create({
          data: {
            nomor: `WIP-OPN-${session.id}-${item.id}`,
            divisiId: location.divisiId,
            tanggal: session.countedAt,
            userId,
            sumber: "OPNAME",
            keterangan: `Saldo tambahan hasil opname ${session.number}: ${reason}`,
            items: {
              create: {
                itemId: item.id,
                jumlahDiterima: difference,
                jumlahDipakai: 0,
                jumlahSisa: difference,
                satuan: item.unit,
                keteranganSisa: `Penyesuaian opname ${session.number}`,
              },
            },
          },
          select: { items: { select: { id: true } } },
        });
        const lotId = lot.items[0]?.id;
        if (!lotId) throw new QualityError("STOCKTAKE_CONFLICT", "Lot penyesuaian opname tidak terbentuk");
        await postInventoryMovementInTransaction(tx, {
          itemId: item.id,
          pemakaianMaterialItemId: lotId,
          toLocationId: location.id,
          type: "ADJUSTMENT",
          quantity: difference,
          idempotencyKey: `wip-stocktake:${savedLine.id}:positive`,
          sourceType: "WIP_STOCKTAKE",
          sourceId: String(savedLine.id),
          reason,
          userId,
          occurredAt: session.countedAt,
        });
      } else if (difference < 0) {
        let toRemove = Math.abs(difference);
        const lots = await tx.pemakaianMaterialItem.findMany({
          where: {
            itemId: item.id,
            jumlahSisa: { gt: 0 },
            pemakaian: { divisiId: location.divisiId },
          },
          select: {
            id: true,
            jumlahSisa: true,
            pemakaian: { select: { tanggal: true } },
          },
          orderBy: [{ pemakaian: { tanggal: "asc" } }, { id: "asc" }],
        });
        for (const lot of lots) {
          await tx.$queryRaw`SELECT id FROM PemakaianMaterialItem WHERE id = ${lot.id} FOR UPDATE`;
        }
        const movements = await tx.inventoryMovement.findMany({
          where: {
            pemakaianMaterialItemId: { in: lots.map((lot) => lot.id) },
            OR: [{ fromLocationId: location.id }, { toLocationId: location.id }],
          },
          select: { pemakaianMaterialItemId: true, quantity: true, fromLocationId: true, toLocationId: true },
        });
        const lotBalance = new Map<number, number>();
        for (const movement of movements) {
          if (movement.pemakaianMaterialItemId === null) continue;
          const quantity = Number(movement.quantity);
          const current = lotBalance.get(movement.pemakaianMaterialItemId) ?? 0;
          if (movement.fromLocationId === location.id) lotBalance.set(movement.pemakaianMaterialItemId, current - quantity);
          else if (movement.toLocationId === location.id) lotBalance.set(movement.pemakaianMaterialItemId, current + quantity);
        }
        let allocationIndex = 0;
        for (const lot of lots) {
          if (toRemove <= 0) break;
          const available = Math.min(
            Math.max(0, Number(lot.jumlahSisa)),
            Math.max(0, lotBalance.get(lot.id) ?? 0),
          );
          const quantity = Math.min(available, toRemove);
          if (quantity <= 0) continue;
          const updated = await tx.pemakaianMaterialItem.updateMany({
            where: { id: lot.id, jumlahSisa: { gte: quantity } },
            data: { jumlahSisa: { decrement: quantity } },
          });
          if (updated.count !== 1) {
            throw new QualityError("STOCKTAKE_CONFLICT", "Saldo lot berubah selama opname; ulangi hitung fisik");
          }
          await postInventoryMovementInTransaction(tx, {
            itemId: item.id,
            pemakaianMaterialItemId: lot.id,
            fromLocationId: location.id,
            type: "ADJUSTMENT",
            quantity,
            idempotencyKey: `wip-stocktake:${savedLine.id}:negative:${allocationIndex}`,
            sourceType: "WIP_STOCKTAKE",
            sourceId: String(savedLine.id),
            reason,
            userId,
            occurredAt: session.countedAt,
          });
          allocationIndex += 1;
          toRemove = Math.round((toRemove - quantity) * 1_000_000) / 1_000_000;
        }
        if (toRemove > 0) {
          throw new QualityError(
            "STOCKTAKE_CONFLICT",
            "Selisih melebihi saldo lot WIP yang dapat disesuaikan; periksa rekonsiliasi saldo terlebih dahulu",
          );
        }
      }
    }

    return tx.wipStocktakeSession.findUniqueOrThrow({
      where: { id: session.id },
      include: {
        location: { select: { id: true, name: true, divisi: { select: { nama: true } } } },
        countedBy: { select: { id: true, name: true } },
        lines: {
          include: { item: { select: { id: true, kode: true, nama: true, unit: true } } },
          orderBy: { id: "asc" },
        },
      },
    });
  });
}

export async function listWipStocktakes(page: number, limit: number) {
  const where = {};
  const [total, data] = await Promise.all([
    prisma.wipStocktakeSession.count({ where }),
    prisma.wipStocktakeSession.findMany({
      where,
      orderBy: [{ countedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        location: { select: { id: true, name: true, divisi: { select: { nama: true } } } },
        countedBy: { select: { id: true, name: true } },
        lines: {
          include: { item: { select: { id: true, kode: true, nama: true, unit: true } } },
          orderBy: { id: "asc" },
        },
      },
    }),
  ]);
  return { data, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}
