import { randomUUID } from "node:crypto";
import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";
import {
  ensureDivisionInventoryLocation,
  postInventoryMovementInTransaction,
} from "../inventory/inventory.js";

export class WipRejectError extends Error {
  constructor(
    public readonly code:
      | "INVALID_INPUT"
      | "REJECT_NOT_FOUND"
      | "REASON_NOT_FOUND"
      | "DIVISION_NOT_FOUND"
      | "ITEM_NOT_FOUND"
      | "TOPCOAT_ITEM_REQUIRED"
      | "INSUFFICIENT_STOCK"
      | "SCOPE_DENIED"
      | "INVALID_STATUS"
      | "ATTEMPT_NOT_FOUND"
      | "ALREADY_REVIEWED"
      | "LOT_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "WipRejectError";
  }
}

const rejectInclude = {
  item: { select: { id: true, nama: true, kode: true, unit: true } },
  reason: { select: { id: true, name: true } },
  repairDivision: { select: { id: true, nama: true } },
  repairStage: {
    select: {
      id: true,
      stage: true,
      sequence: true,
      outputItems: {
        include: { item: { select: { id: true, nama: true, kode: true, unit: true } } },
      },
    },
  },
  recordedBy: { select: { id: true, name: true } },
  claimedBy: { select: { id: true, name: true } },
  attempts: {
    orderBy: { performedAt: "desc" as const },
    include: {
      performedBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
      outputItem: { select: { id: true, kode: true, nama: true, unit: true } },
    },
  },
};

function rounded(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function divisionKey(value: string) {
  return value.toLocaleLowerCase("id-ID").replace(/[^a-z0-9]/g, "");
}

async function getLotBalance(
  tx: PrismaTransactionClient,
  lotId: number,
  itemId: number,
  locationId: number,
) {
  const movements = await tx.inventoryMovement.findMany({
    where: {
      pemakaianMaterialItemId: lotId,
      itemId,
      OR: [{ fromLocationId: locationId }, { toLocationId: locationId }],
    },
    select: { quantity: true, fromLocationId: true, toLocationId: true },
  });
  return rounded(movements.reduce((balance, movement) => {
    const quantity = Number(movement.quantity);
    return balance
      - (movement.fromLocationId === locationId ? quantity : 0)
      + (movement.toLocationId === locationId ? quantity : 0);
  }, 0));
}

export async function listRejectOptions() {
  const [reasons, divisions, routings] = await Promise.all([
    prisma.qualityRejectReason.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.divisi.findMany({ select: { id: true, nama: true }, orderBy: { nama: "asc" } }),
    prisma.productionRouting.findMany({
      where: { isActive: true },
      select: {
        stages: {
          orderBy: { sequence: "asc" },
          select: {
            divisiId: true,
            inputItems: { select: { itemId: true } },
            outputItems: {
              select: {
                item: {
                  select: {
                    id: true,
                    divisiId: true,
                    nama: true,
                    kode: true,
                    unit: true,
                    jenis: true,
                    isActive: true,
                  },
                },
              },
            },
            id: true,
            sequence: true,
            stage: true,
            divisi: { select: { id: true, nama: true } },
          },
        },
      },
    }),
  ]);
  const finalItems = new Map<number, {
    id: number;
    nama: string;
    kode: string;
    unit: string;
    divisionId: number;
    repairStages: Array<{
      id: number;
      stage: string;
      sequence: number;
      divisiId: number;
      divisionName: string;
      outputItems: Array<{ id: number; kode: string; nama: string; unit: string | null }>;
    }>;
  }>();
  for (const routing of routings) {
    const finalStage = routing.stages[routing.stages.length - 1];
    for (const { item } of finalStage?.outputItems ?? []) {
      if (item.isActive && item.jenis === "SM" && item.divisiId === finalStage?.divisiId) {
        finalItems.set(item.id, {
          id: item.id,
          nama: item.nama,
          kode: item.kode,
          unit: item.unit ?? "pcs",
          divisionId: finalStage.divisiId,
          repairStages: routing.stages.slice(0, -1).flatMap((stage, index) => {
            const nextStage = routing.stages[index + 1];
            const nextStageInputs = new Set(nextStage?.inputItems.map((input) => input.itemId) ?? []);
            const outputItems = stage.outputItems
              .filter((output) =>
                output.item.isActive &&
                output.item.jenis === "SM" &&
                nextStageInputs.has(output.item.id),
              )
              .map((output) => ({
                id: output.item.id,
                kode: output.item.kode,
                nama: output.item.nama,
                unit: output.item.unit,
              }));
            return outputItems.length > 0
              ? [{
                  id: stage.id,
                  stage: stage.stage,
                  sequence: stage.sequence,
                  divisiId: stage.divisiId,
                  divisionName: stage.divisi.nama,
                  outputItems,
                }]
              : [];
          }),
        });
      }
    }
  }
  const finalItemValues = [...finalItems.values()];
  const divisionIds = [...new Set(finalItemValues.map((item) => item.divisionId))];
  const [locations, lots] = await Promise.all([
    prisma.inventoryLocation.findMany({
      where: { type: "DIVISION", isActive: true, divisiId: { in: divisionIds } },
      select: { id: true, divisiId: true },
    }),
    prisma.pemakaianMaterialItem.findMany({
      where: {
        itemId: { in: finalItemValues.map((item) => item.id) },
        jumlahSisa: { gt: 0 },
        pemakaian: { divisiId: { in: divisionIds } },
      },
      select: { id: true, itemId: true, jumlahSisa: true, pemakaian: { select: { divisiId: true } } },
    }),
  ]);
  const locationByDivision = new Map(locations.flatMap((location) =>
    location.divisiId === null ? [] : [[location.divisiId, location.id] as const],
  ));
  const lotIds = lots.map((lot) => lot.id);
  const locationIds = locations.map((location) => location.id);
  const movements = lotIds.length && locationIds.length
    ? await prisma.inventoryMovement.findMany({
      where: {
        pemakaianMaterialItemId: { in: lotIds },
        OR: [
          { fromLocationId: { in: locationIds } },
          { toLocationId: { in: locationIds } },
        ],
      },
      select: { pemakaianMaterialItemId: true, fromLocationId: true, toLocationId: true, quantity: true },
    })
    : [];
  const balances = new Map<string, number>();
  for (const movement of movements) {
    if (movement.pemakaianMaterialItemId === null) continue;
    const quantity = Number(movement.quantity);
    if (movement.fromLocationId !== null) {
      const key = `${movement.pemakaianMaterialItemId}:${movement.fromLocationId}`;
      balances.set(key, (balances.get(key) ?? 0) - quantity);
    }
    if (movement.toLocationId !== null) {
      const key = `${movement.pemakaianMaterialItemId}:${movement.toLocationId}`;
      balances.set(key, (balances.get(key) ?? 0) + quantity);
    }
  }
  const availableByItem = new Map<number, number>();
  for (const lot of lots) {
    const locationId = locationByDivision.get(lot.pemakaian.divisiId);
    if (locationId === undefined) continue;
    const balance = balances.get(`${lot.id}:${locationId}`) ?? 0;
    if (balance <= 0) continue;
    availableByItem.set(
      lot.itemId!,
      rounded((availableByItem.get(lot.itemId!) ?? 0) + Math.min(Number(lot.jumlahSisa), balance)),
    );
  }
  return {
    reasons,
    divisions: divisions.filter((division) => divisionKey(division.nama) !== "qc"),
    items: finalItemValues
      .map(({ divisionId, ...item }) => ({
        ...item,
        divisionId,
        availableQuantity: availableByItem.get(item.id) ?? 0,
      }))
      .filter((item) => item.availableQuantity > 0)
      .sort((a, b) => a.nama.localeCompare(b.nama)),
  };
}

export async function listRejectReasons() {
  return prisma.qualityRejectReason.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { createdBy: { select: { id: true, name: true } } },
  });
}

export async function createRejectReason(name: string, createdById: number) {
  const cleanName = name.trim().replace(/\s+/g, " ");
  if (cleanName.length < 2 || cleanName.length > 191) {
    throw new WipRejectError("INVALID_INPUT", "Alasan reject harus berisi 2 sampai 191 karakter");
  }
  const existing = await prisma.qualityRejectReason.findFirst({
    where: { name: { equals: cleanName } },
  });
  if (existing) {
    if (!existing.isActive) {
      return prisma.qualityRejectReason.update({
        where: { id: existing.id },
        data: { isActive: true },
        include: { createdBy: { select: { id: true, name: true } } },
      });
    }
    throw new WipRejectError("INVALID_INPUT", "Alasan tersebut sudah tersedia");
  }
  return prisma.qualityRejectReason.create({
    data: { name: cleanName, createdById },
    include: { createdBy: { select: { id: true, name: true } } },
  });
}

function validateWipRejectInput(input: {
  itemId: number;
  quantity: number;
  reasonId: number;
  repairDivisionId: number;
  recordedById: number;
}) {
  if (!Number.isSafeInteger(input.itemId) || input.itemId <= 0 ||
      !Number.isSafeInteger(input.reasonId) || input.reasonId <= 0 ||
      !Number.isSafeInteger(input.repairDivisionId) || input.repairDivisionId <= 0 ||
      !Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
    throw new WipRejectError("INVALID_INPUT", "Item, jumlah pcs, alasan, dan divisi repair wajib diisi dengan benar");
  }
}

export async function createWipReject(input: {
  itemId: number;
  quantity: number;
  reasonId: number;
  repairDivisionId: number;
  recordedById: number;
}) {
  validateWipRejectInput(input);
  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    const item = await tx.item.findUnique({
      where: { id: input.itemId },
      include: { divisi: { select: { id: true, nama: true } } },
    });
    if (!item || !item.isActive) throw new WipRejectError("ITEM_NOT_FOUND", "Item output tahap akhir tidak ditemukan");
    const routings = await tx.productionRouting.findMany({
      where: {
        isActive: true,
        stages: { some: { outputItems: { some: { itemId: item.id } } } },
      },
      select: {
        stages: {
          orderBy: { sequence: "asc" },
          select: { outputItems: { select: { itemId: true } }, divisiId: true },
        },
      },
    });
    const isFinalRoutingOutput = routings.some((routing) => {
      const finalStage = routing.stages[routing.stages.length - 1];
      return finalStage?.outputItems.some((output) => output.itemId === item.id) &&
        finalStage.divisiId === item.divisiId;
    });
    if (!item.divisi || item.jenis !== "SM" || !isFinalRoutingOutput) {
      throw new WipRejectError("TOPCOAT_ITEM_REQUIRED", "QC Akhir hanya menerima item output tahap terakhir dari routing aktif");
    }
    const reason = await tx.qualityRejectReason.findFirst({
      where: { id: input.reasonId, isActive: true },
    });
    if (!reason) throw new WipRejectError("REASON_NOT_FOUND", "Alasan reject tidak aktif atau tidak ditemukan");
    const repairDivision = await tx.divisi.findUnique({ where: { id: input.repairDivisionId } });
    if (!repairDivision) throw new WipRejectError("DIVISION_NOT_FOUND", "Divisi repair tidak ditemukan");
    if (divisionKey(repairDivision.nama) === "qc") {
      throw new WipRejectError("INVALID_INPUT", "Pilih divisi produksi untuk melakukan repair");
    }

    const sourceLocation = await ensureDivisionInventoryLocation(tx, item.divisi.id);
    const targetLocation = await ensureDivisionInventoryLocation(tx, repairDivision.id);
    const candidateLots = await tx.pemakaianMaterialItem.findMany({
      where: {
        itemId: item.id,
        jumlahSisa: { gt: 0 },
        pemakaian: { divisiId: item.divisi.id },
      },
      include: { pemakaian: { select: { tanggal: true, nomor: true } } },
      orderBy: [{ pemakaian: { tanggal: "asc" } }, { id: "asc" }],
    });
    const allocations: Array<{ lotId: number; quantity: number }> = [];
    let remaining = rounded(input.quantity);
    for (const lot of candidateLots) {
      if (remaining <= 0) break;
      await tx.$queryRaw`SELECT id FROM PemakaianMaterialItem WHERE id = ${lot.id} FOR UPDATE`;
      const lockedLot = await tx.pemakaianMaterialItem.findUnique({ where: { id: lot.id } });
      if (!lockedLot || Number(lockedLot.jumlahSisa) <= 0) continue;
      const stock = await getLotBalance(tx, lot.id, item.id, sourceLocation.id);
      const available = Math.min(Number(lockedLot.jumlahSisa), stock);
      const quantity = rounded(Math.min(remaining, available));
      if (quantity <= 0) continue;
      allocations.push({ lotId: lot.id, quantity });
      remaining = rounded(remaining - quantity);
    }
    if (remaining > 0) {
      throw new WipRejectError(
        "INSUFFICIENT_STOCK",
        `Stok item di lokasi divisi produksi tidak cukup. Kekurangan ${remaining} ${item.unit}.`,
      );
    }

    const reject = await tx.wipReject.create({
      data: {
        number: `QC-REJ-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`,
        itemId: item.id,
        quantity: rounded(input.quantity),
        reasonId: reason.id,
        repairDivisionId: repairDivision.id,
        recordedById: input.recordedById,
        lots: { create: allocations.map((allocation) => ({
          pemakaianMaterialItemId: allocation.lotId,
          quantity: allocation.quantity,
        })) },
      },
    });
    for (const allocation of allocations) {
      await tx.pemakaianMaterialItem.update({
        where: { id: allocation.lotId },
        data: { jumlahSisa: { decrement: allocation.quantity } },
      });
      await postInventoryMovementInTransaction(tx, {
        itemId: item.id,
        pemakaianMaterialItemId: allocation.lotId,
        fromLocationId: sourceLocation.id,
        toLocationId: targetLocation.id,
        type: "QC",
        quantity: allocation.quantity,
        idempotencyKey: `wip-reject:${reject.id}:lot:${allocation.lotId}`,
        sourceType: "WIP_REJECT",
        sourceId: String(reject.id),
        reason: `Reject QC ${reject.number}: ${reason.name}`,
        userId: input.recordedById,
      });
    }
    return tx.wipReject.findUniqueOrThrow({
      where: { id: reject.id },
      include: rejectInclude,
    });
  });
}

export async function listWipRejects(filters: {
  repairDivisionId?: number;
  status?: string;
  limit?: number;
}) {
  const allowedStatuses = ["OPEN", "IN_PROGRESS", "WAITING_QC", "COMPLETED"] as const;
  const statuses = filters.status === "ACTIVE"
    ? ["OPEN", "IN_PROGRESS", "WAITING_QC"] as const
    : filters.status?.split(",").filter((value): value is (typeof allowedStatuses)[number] =>
        allowedStatuses.includes(value as (typeof allowedStatuses)[number]),
      );
  const rows = await prisma.wipReject.findMany({
    where: {
      ...(filters.repairDivisionId ? { repairDivisionId: filters.repairDivisionId } : {}),
      ...(statuses?.length ? { status: { in: [...statuses] } } : {}),
    },
    include: rejectInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: filters.limit ?? 100,
  });
  return rows.map((reject) => {
    const repaired = reject.attempts.reduce(
      (sum, attempt) => sum + (attempt.reviewApproved === true || attempt.outputItemId !== null
        ? Number(attempt.quantityRepaired)
        : 0),
      0,
    );
    return {
      ...reject,
      quantityRemaining: rounded(Math.max(0, Number(reject.quantity) - repaired)),
    };
  });
}

export async function claimWipReject(rejectId: number, userId: number, divisionId: number) {
  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    await tx.$queryRaw`SELECT id FROM WipReject WHERE id = ${rejectId} FOR UPDATE`;
    const reject = await tx.wipReject.findUnique({ where: { id: rejectId } });
    if (!reject) throw new WipRejectError("REJECT_NOT_FOUND", "Reject WIP tidak ditemukan");
    if (reject.repairDivisionId !== divisionId) {
      throw new WipRejectError("SCOPE_DENIED", "Reject ini bukan untuk divisi Anda");
    }
    if (reject.status === "WAITING_QC" || reject.status === "COMPLETED") {
      throw new WipRejectError("INVALID_STATUS", "Reject sedang menunggu QC atau sudah selesai");
    }
    if (reject.claimedById && reject.claimedById !== userId) {
      throw new WipRejectError("INVALID_STATUS", "Reject sedang dikerjakan anggota divisi lain");
    }
    return tx.wipReject.update({
      where: { id: reject.id },
      data: { status: "IN_PROGRESS", claimedById: userId, claimedAt: new Date() },
      include: rejectInclude,
    });
  });
}

export async function createWipRejectRepairAttempt(input: {
  rejectId: number;
  userId: number;
  divisionId: number;
  quantityAttempted: number;
  quantityRepaired: number;
  outputItemId?: number;
  notes?: string | null;
}) {
  if (!Number.isSafeInteger(input.quantityAttempted) || input.quantityAttempted <= 0 ||
      !Number.isSafeInteger(input.quantityRepaired) || input.quantityRepaired < 0 ||
      input.quantityRepaired > input.quantityAttempted) {
    throw new WipRejectError("INVALID_INPUT", "Jumlah pcs yang diperiksa harus bulat dan positif; jumlah berhasil tidak boleh melebihi jumlah diperiksa");
  }
  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    await tx.$queryRaw`SELECT id FROM WipReject WHERE id = ${input.rejectId} FOR UPDATE`;
    const reject = await tx.wipReject.findUnique({
      where: { id: input.rejectId },
      include: {
        lots: { include: { pemakaianMaterialItem: true } },
        repairStage: {
          include: {
            outputItems: { select: { itemId: true } },
            routing: {
              select: {
                stages: {
                  select: {
                    id: true,
                    sequence: true,
                    divisiId: true,
                    inputItems: { select: { itemId: true } },
                  },
                  orderBy: { sequence: "asc" },
                },
              },
            },
          },
        },
        attempts: {
          select: { quantityRepaired: true, reviewApproved: true, outputItemId: true },
        },
      },
    });
    if (!reject) throw new WipRejectError("REJECT_NOT_FOUND", "Reject WIP tidak ditemukan");
    if (reject.repairDivisionId !== input.divisionId) {
      throw new WipRejectError("SCOPE_DENIED", "Reject ini bukan untuk divisi Anda");
    }
    if (reject.status !== "IN_PROGRESS" || reject.claimedById !== input.userId) {
      throw new WipRejectError("INVALID_STATUS", "Ambil pekerjaan ini terlebih dahulu sebelum mencatat hasil");
    }
    if (input.quantityRepaired > 0 && reject.repairStageId &&
        (!input.outputItemId || !reject.repairStage?.outputItems.some((item) => item.itemId === input.outputItemId))) {
      throw new WipRejectError("INVALID_INPUT", "Pilih output yang dikonfigurasi pada tahap routing repair");
    }
    if (input.outputItemId !== undefined &&
        (!Number.isSafeInteger(input.outputItemId) || input.outputItemId <= 0)) {
      throw new WipRejectError("INVALID_INPUT", "Item output repair tidak valid");
    }
    const repairLocation = await ensureDivisionInventoryLocation(tx, input.divisionId);
    const routedRepair = reject.repairStageId !== null && reject.repairStage !== null;
    const qcDivision = routedRepair
      ? null
      : await tx.divisi.findFirst({ where: { nama: { equals: "QC" } }, select: { id: true } });
    if (!routedRepair && !qcDivision) throw new WipRejectError("DIVISION_NOT_FOUND", "Divisi QC belum tersedia");
    const qcLocation = qcDivision ? await ensureDivisionInventoryLocation(tx, qcDivision.id) : null;
    const lotBalances: Array<{ rejectLotId: number; lotId: number; available: number }> = [];
    for (const rejectLot of reject.lots) {
      const lotId = rejectLot.pemakaianMaterialItemId;
      await tx.$queryRaw`SELECT id FROM PemakaianMaterialItem WHERE id = ${lotId} FOR UPDATE`;
      const available = await getLotBalance(tx, lotId, reject.itemId, repairLocation.id);
      lotBalances.push({ rejectLotId: rejectLot.id, lotId, available });
    }
    const totalAvailable = rounded(lotBalances.reduce((sum, lot) => sum + lot.available, 0));
    if (input.quantityAttempted > totalAvailable) {
      throw new WipRejectError("INSUFFICIENT_STOCK", "Jumlah yang diperiksa melebihi saldo item di lokasi divisi");
    }
    let remainingToRepair = rounded(input.quantityRepaired);
    const allocations: Array<{ rejectLotId: number; lotId: number; quantity: number }> = [];
    for (const lot of lotBalances) {
      if (remainingToRepair <= 0) break;
      const quantity = rounded(Math.min(remainingToRepair, lot.available));
      if (quantity <= 0) continue;
      allocations.push({ rejectLotId: lot.rejectLotId, lotId: lot.lotId, quantity });
      remainingToRepair = rounded(remainingToRepair - quantity);
    }
    if (remainingToRepair > 0) {
      throw new WipRejectError("INSUFFICIENT_STOCK", "Saldo fisik di lokasi divisi tidak mencukupi untuk jumlah hasil repair");
    }

    const attempt = await tx.wipRejectRepairAttempt.create({
      data: {
        rejectId: reject.id,
        performedById: input.userId,
        quantityAttempted: rounded(input.quantityAttempted),
        quantityRepaired: rounded(input.quantityRepaired),
        ...(input.quantityRepaired > 0 && routedRepair ? { outputItemId: input.outputItemId } : {}),
        notes: input.notes?.trim() || null,
        ...(input.quantityRepaired === 0 ? {
          reviewedAt: new Date(),
          reviewApproved: false,
        } : {}),
        lots: {
          create: allocations.map((allocation) => ({
            rejectLotId: allocation.rejectLotId,
            quantity: allocation.quantity,
          })),
        },
      },
    });
    if (input.quantityRepaired > 0 && routedRepair) {
      const outputItem = await tx.item.findUnique({
        where: { id: input.outputItemId! },
        select: { id: true, unit: true, divisiId: true },
      });
      if (!outputItem || outputItem.divisiId !== input.divisionId) {
        throw new WipRejectError("INVALID_INPUT", "Output repair harus merupakan item milik divisi tahap routing");
      }
      const nextStage = reject.repairStage!.routing.stages.find(
        (stage) => stage.sequence > reject.repairStage!.sequence,
      );
      if (!nextStage || !nextStage.inputItems.some((item) => item.itemId === outputItem.id)) {
        throw new WipRejectError("INVALID_INPUT", "Output repair tidak dapat dilanjutkan ke tahap routing berikutnya");
      }
      const repairedLot = await tx.pemakaianMaterial.create({
        data: {
          nomor: `RPR-${reject.id}-${attempt.id}-${randomUUID().slice(0, 8).toUpperCase()}`,
          divisiId: input.divisionId,
          tanggal: new Date(),
          userId: input.userId,
          sumber: "REPAIR",
          keterangan: `Output repair ${reject.number}; lanjut ke ${nextStage ? "tahap routing berikutnya" : "QC akhir"}`,
          items: {
            create: {
              itemId: outputItem.id,
              jumlahDiterima: input.quantityRepaired,
              jumlahDipakai: 0,
              jumlahSisa: input.quantityRepaired,
              satuan: outputItem.unit,
              keteranganSisa: "Output repair untuk melanjutkan routing produksi",
            },
          },
        },
        select: { items: { select: { id: true } } },
      });
      const outputLotId = repairedLot.items[0]?.id;
      if (!outputLotId) throw new WipRejectError("LOT_NOT_FOUND", "Lot output repair tidak berhasil dibuat");
      for (const allocation of allocations) {
        await postInventoryMovementInTransaction(tx, {
          itemId: reject.itemId,
          pemakaianMaterialItemId: allocation.lotId,
          fromLocationId: repairLocation.id,
          type: "REPAIR",
          quantity: allocation.quantity,
          idempotencyKey: `wip-reject-repair:${attempt.id}:consume:${allocation.lotId}`,
          sourceType: "WIP_REJECT_REPAIR",
          sourceId: String(attempt.id),
          reason: `Input reject ${reject.number} diperbaiki pada tahap ${reject.repairStage!.stage}`,
          userId: input.userId,
        });
      }
      await postInventoryMovementInTransaction(tx, {
        itemId: outputItem.id,
        pemakaianMaterialItemId: outputLotId,
        toLocationId: repairLocation.id,
        type: "REPAIR",
        quantity: input.quantityRepaired,
        idempotencyKey: `wip-reject-repair:${attempt.id}:output:${outputLotId}`,
        sourceType: "WIP_REJECT_REPAIR_OUTPUT",
        sourceId: String(attempt.id),
        reason: `Output repair ${reject.number} untuk routing produksi`,
        userId: input.userId,
      });
    } else {
      for (const allocation of allocations) {
        await postInventoryMovementInTransaction(tx, {
          itemId: reject.itemId,
          pemakaianMaterialItemId: allocation.lotId,
          fromLocationId: repairLocation.id,
          toLocationId: qcLocation!.id,
          type: "REPAIR",
          quantity: allocation.quantity,
          idempotencyKey: `wip-reject-repair:${attempt.id}:lot:${allocation.lotId}`,
          sourceType: "WIP_REJECT_REPAIR",
          sourceId: String(attempt.id),
          reason: `Hasil repair ${reject.number} menunggu pemeriksaan QC`,
          userId: input.userId,
        });
      }
    }
    const previousAccepted = reject.attempts.reduce(
      (sum, previous) => sum + (previous.reviewApproved === true || previous.outputItemId !== null
        ? Number(previous.quantityRepaired)
        : 0),
      0,
    );
    const completeRoutedRepair = routedRepair && input.quantityRepaired > 0 &&
      rounded(previousAccepted + input.quantityRepaired) >= Number(reject.quantity);
    await tx.wipReject.update({
      where: { id: reject.id },
      data: {
        status: input.quantityRepaired > 0 && !routedRepair
          ? "WAITING_QC"
          : completeRoutedRepair ? "COMPLETED" : "OPEN",
        ...((input.quantityRepaired === 0 || routedRepair) ? { claimedById: null } : {}),
        ...(completeRoutedRepair ? { completedAt: new Date() } : {}),
      },
    });
    return tx.wipRejectRepairAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
      include: {
        reject: { include: rejectInclude },
        performedBy: { select: { id: true, name: true } },
      },
    });
  });
}

export async function reviewWipRejectRepair(input: {
  rejectId: number;
  attemptId: number;
  reviewerId: number;
  approved: boolean;
  notes?: string | null;
}) {
  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    await tx.$queryRaw`SELECT id FROM WipReject WHERE id = ${input.rejectId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM WipRejectRepairAttempt WHERE id = ${input.attemptId} FOR UPDATE`;
    const attempt = await tx.wipRejectRepairAttempt.findUnique({
      where: { id: input.attemptId },
      include: {
        reject: {
          include: {
            lots: true,
            attempts: {
              where: { reviewApproved: true },
              select: { quantityRepaired: true },
            },
          },
        },
        lots: { include: { rejectLot: true } },
      },
    });
    if (!attempt || attempt.rejectId !== input.rejectId) {
      throw new WipRejectError("ATTEMPT_NOT_FOUND", "Hasil repair tidak ditemukan");
    }
    if (attempt.reviewedAt || attempt.reject.status !== "WAITING_QC") {
      throw new WipRejectError("ALREADY_REVIEWED", "Hasil repair sudah diperiksa atau tidak menunggu QC");
    }
    const qcDivision = await tx.divisi.findFirst({
      where: { nama: { equals: "QC" } },
      select: { id: true },
    });
    if (!qcDivision) throw new WipRejectError("DIVISION_NOT_FOUND", "Divisi QC belum tersedia");
    const qcLocation = await ensureDivisionInventoryLocation(tx, qcDivision.id);
    const repairLocation = await ensureDivisionInventoryLocation(tx, attempt.reject.repairDivisionId);
    if (!input.approved) {
      for (const allocation of attempt.lots) {
        await postInventoryMovementInTransaction(tx, {
          itemId: attempt.reject.itemId,
          pemakaianMaterialItemId: allocation.rejectLot.pemakaianMaterialItemId,
          fromLocationId: qcLocation.id,
          toLocationId: repairLocation.id,
          type: "QC",
          quantity: Number(allocation.quantity),
          idempotencyKey: `wip-reject-review:${attempt.id}:lot:${allocation.rejectLot.pemakaianMaterialItemId}`,
          sourceType: "WIP_REJECT_REVIEW",
          sourceId: String(attempt.id),
          reason: `QC meminta repair ulang untuk reject ${attempt.rejectId}`,
          userId: input.reviewerId,
        });
      }
    }
    const updatedAttempt = await tx.wipRejectRepairAttempt.update({
      where: { id: attempt.id },
      data: {
        reviewedById: input.reviewerId,
        reviewedAt: new Date(),
        reviewApproved: input.approved,
        reviewNotes: input.notes?.trim() || null,
      },
    });
    const acceptedPreviously = attempt.reject.attempts.reduce(
      (sum, previous) => sum + Number(previous.quantityRepaired),
      0,
    );
    const completed = input.approved &&
      rounded(acceptedPreviously + Number(attempt.quantityRepaired)) >= Number(attempt.reject.quantity);
    await tx.wipReject.update({
      where: { id: attempt.rejectId },
      data: {
        status: completed ? "COMPLETED" : "OPEN",
        claimedById: null,
        ...(completed ? { completedAt: new Date() } : {}),
      },
    });
    return updatedAttempt;
  });
}
