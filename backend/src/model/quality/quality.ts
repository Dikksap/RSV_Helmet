import { randomUUID } from "node:crypto";
import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";
import { generateBarangBulkInTransaction } from "../barang/barang.generate.js";
import {
  ensureDivisionInventoryLocation,
  postInventoryMovementInTransaction,
} from "../inventory/inventory.js";
import { QualityError } from "./qualityError.js";
import { getActiveRoutingForOutput } from "./routing.js";

export { QualityError } from "./qualityError.js";

export type QualityDefectInput = {
  description: string;
  quantity: number;
  foundAtDivisionId?: number | null;
  originDivisionId?: number | null;
  repairDivisionId?: number | null;
};

export type QualityLineInput = {
  pemakaianMaterialItemId: number;
  productVariantId?: number | null;
  inspectedQuantity: number;
  passedQuantity: number;
  repairQuantity: number;
  rejectedQuantity: number;
  defects?: QualityDefectInput[];
};

export type QualityLineOutcomeInput = {
  productVariantId?: number | null;
  passedQuantity: number;
  repairQuantity: number;
  rejectedQuantity: number;
  defects?: QualityDefectInput[];
};

const inspectionInclude = {
  inspector: { select: { id: true, name: true } },
  reopenedFrom: { select: { id: true, number: true } },
  lines: {
    orderBy: { id: "asc" as const },
    include: {
      lot: {
        select: {
          id: true,
          itemId: true,
          jumlahDiterima: true,
          jumlahDipakai: true,
          jumlahSisa: true,
          satuan: true,
          item: { select: { id: true, kode: true, nama: true, unit: true } },
          pemakaian: { select: { id: true, nomor: true, divisiId: true, divisi: { select: { id: true, nama: true } } } },
        },
      },
      variant: { select: { id: true, kodeVariant: true } },
      defects: {
        include: {
          foundAt: { select: { id: true, nama: true } },
          originDivision: { select: { id: true, nama: true } },
          repairDivision: { select: { id: true, nama: true } },
          assignments: true,
        },
      },
      repairAttempt: {
        select: {
          id: true,
          assignmentId: true,
          reviewApproved: true,
        },
      },
      productionRouting: {
        select: {
          id: true,
          version: true,
          bom: { select: { id: true, kode: true, nama: true, version: true } },
          stages: {
            select: {
              stage: true,
              divisi: { select: { id: true, nama: true } },
            },
            orderBy: { sequence: "asc" },
          },
        },
      },
      producedBarang: { select: { id: true, kodeBarang: true, status: true } },
    },
  },
} as const;

function validateOutcome(line: Pick<QualityLineInput,
  "inspectedQuantity" | "passedQuantity" | "repairQuantity" | "rejectedQuantity" | "productVariantId">) {
  const quantities = [
    line.inspectedQuantity,
    line.passedQuantity,
    line.repairQuantity,
    line.rejectedQuantity,
  ];
  if (
    quantities.some((quantity) => !Number.isSafeInteger(quantity) || quantity < 0) ||
    line.inspectedQuantity <= 0 ||
    line.passedQuantity + line.repairQuantity + line.rejectedQuantity !== line.inspectedQuantity
  ) {
    throw new QualityError(
      "INPUT_INVALID",
      "Jumlah inspeksi harus bilangan bulat positif dan hasil harus sama dengan jumlah inspeksi",
    );
  }
  if (line.passedQuantity > 0 && !line.productVariantId) {
    throw new QualityError("VARIANT_REQUIRED", "Varian wajib untuk hasil QC yang lolos");
  }
}

function validateDefects(line: QualityLineInput) {
  const defects = line.defects ?? [];
  if (
    defects.some((defect) =>
      !defect.description.trim() ||
      !Number.isSafeInteger(defect.quantity) ||
      defect.quantity <= 0,
    )
  ) {
    throw new QualityError("INPUT_INVALID", "Deskripsi wajib diisi dan jumlah defect harus bilangan bulat positif");
  }
  const repairCapacity = defects
    .filter((defect) =>
      defect.originDivisionId != null &&
      defect.repairDivisionId != null &&
      defect.originDivisionId === defect.repairDivisionId,
    )
    .reduce((total, defect) => total + defect.quantity, 0);
  if (line.repairQuantity > 0 && repairCapacity < line.repairQuantity) {
    throw new QualityError(
      "DEFECT_ASSIGNMENT_REQUIRED",
      "Setiap unit repair harus memiliki divisi asal defect yang sama dengan divisi repair",
    );
  }
  if (defects.some((defect) =>
    defect.repairDivisionId != null &&
    (defect.originDivisionId == null || defect.originDivisionId !== defect.repairDivisionId),
  )) {
    throw new QualityError("DEFECT_ASSIGNMENT_REQUIRED", "Divisi repair harus sama dengan divisi asal defect");
  }
}

export async function listQualityInspections(filters: {
  status?: "DRAFT" | "COMPLETED";
  take: number;
}) {
  return prisma.qualityInspection.findMany({
    where: filters.status ? { status: filters.status } : {},
    include: inspectionInclude,
    orderBy: [{ inspectedAt: "desc" }, { id: "desc" }],
    take: filters.take,
  });
}

export async function listQualityLots(take = 500) {
  const activeRoutings = await prisma.productionRouting.findMany({
    where: { isActive: true, bom: { isActive: true } },
    include: {
      bom: { select: { isActive: true, berlakuMulai: true, berlakuSelesai: true } },
      productVariant: { select: { id: true, kodeVariant: true } },
      stages: {
        select: {
          stage: true,
          divisiId: true,
          outputItemId: true,
          divisi: { select: { id: true, nama: true } },
        },
      },
    },
  });
  const current = new Date();
  const routeRows = activeRoutings.flatMap((routing) => {
    const validBom = routing.bom.isActive &&
      (routing.bom.berlakuMulai === null || routing.bom.berlakuMulai <= current) &&
      (routing.bom.berlakuSelesai === null || routing.bom.berlakuSelesai >= current);
    return validBom
      ? routing.stages
        .filter((stage) => stage.stage === "TOP_COAT")
        .map((stage) => ({ ...stage, routing, variant: routing.productVariant }))
      : [];
  });
  if (routeRows.length === 0) return [];

  const outputItemIds = [...new Set(routeRows.map((stage) => stage.outputItemId))];
  const divisionIds = [...new Set(routeRows.map((stage) => stage.divisiId))];
  const locations = await prisma.inventoryLocation.findMany({
    where: {
      type: "DIVISION",
      isActive: true,
      divisiId: { in: divisionIds },
    },
    select: { id: true, divisiId: true },
  });
  const locationByDivision = new Map(
    locations.flatMap((location) => location.divisiId === null ? [] : [[location.divisiId, location.id] as const]),
  );
  const lots = await prisma.pemakaianMaterialItem.findMany({
    where: {
      jumlahSisa: { gt: 0 },
      itemId: { in: outputItemIds },
      pemakaian: { divisiId: { in: divisionIds } },
    },
    select: {
      id: true,
      jumlahSisa: true,
      satuan: true,
      item: { select: { id: true, kode: true, nama: true, unit: true } },
      pemakaian: {
        select: {
          id: true,
          nomor: true,
          divisi: { select: { id: true, nama: true } },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
  });
  if (lots.length === 0) return [];

  const movements = await prisma.inventoryMovement.findMany({
    where: { pemakaianMaterialItemId: { in: lots.map((lot) => lot.id) } },
    select: { pemakaianMaterialItemId: true, fromLocationId: true, toLocationId: true, quantity: true },
  });
  const balances = new Map<string, number>();
  for (const movement of movements) {
    const lotId = movement.pemakaianMaterialItemId;
    if (lotId === null) continue;
    const qty = Number(movement.quantity);
    if (movement.fromLocationId !== null) {
      const key = `${lotId}:${movement.fromLocationId}`;
      balances.set(key, (balances.get(key) ?? 0) - qty);
    }
    if (movement.toLocationId !== null) {
      const key = `${lotId}:${movement.toLocationId}`;
      balances.set(key, (balances.get(key) ?? 0) + qty);
    }
  }
  return lots.flatMap((lot) => {
    const locationId = locationByDivision.get(lot.pemakaian.divisi.id);
    const ledgerBalance = locationId === undefined
      ? 0
      : balances.get(`${lot.id}:${locationId}`) ?? 0;
    const available = Math.min(ledgerBalance, Number(lot.jumlahSisa));
    if (available <= 0) return [];
    const routingVariants = routeRows
      .filter((stage) =>
        stage.divisiId === lot.pemakaian.divisi.id &&
        stage.outputItemId === lot.item?.id,
      )
      .map(({ routing, variant }) => ({
        routingId: routing.id,
        version: routing.version,
        productVariantId: variant.id,
        kodeVariant: variant.kodeVariant,
        originDivisions: routing.stages.map((stage) => ({
          id: stage.divisi.id,
          nama: stage.divisi.nama,
        })),
      }));
    return routingVariants.length === 0 ? [] : [{ ...lot, available, routingVariants }];
  });
}

export async function listQualityVariants(take = 500) {
  return prisma.productVariant.findMany({
    select: {
      id: true,
      kodeVariant: true,
      product: { select: { nama: true } },
      style: { select: { nama: true } },
      color: { select: { nama: true } },
      size: { select: { nama: true } },
    },
    orderBy: [{ product: { nama: "asc" } }, { kodeVariant: "asc" }],
    take,
  });
}

const repairAssignmentInclude = {
  repairDivision: { select: { id: true, nama: true } },
  assignedBy: { select: { id: true, name: true } },
  inspectionLine: {
    include: {
      inspection: { select: { id: true, number: true, status: true } },
      lot: {
        select: {
          id: true,
          itemId: true,
          jumlahSisa: true,
          satuan: true,
          item: { select: { id: true, kode: true, nama: true, unit: true } },
        },
      },
      defects: {
        select: {
          id: true,
          description: true,
          quantity: true,
          originDivisionId: true,
          originDivision: { select: { id: true, nama: true } },
        },
      },
    },
  },
  attempts: {
    orderBy: { performedAt: "asc" as const },
    include: {
      performedBy: { select: { id: true, name: true } },
      reviewedBy: { select: { id: true, name: true } },
      inspectionLine: {
        select: {
          id: true,
          inspection: { select: { id: true, number: true, status: true } },
        },
      },
    },
  },
} as const;

export async function listRepairAssignments(filters: { divisiId?: number }) {
  return prisma.repairAssignment.findMany({
    where: filters.divisiId ? { repairDivisionId: filters.divisiId } : {},
    include: repairAssignmentInclude,
    orderBy: [{ assignedAt: "desc" }, { id: "desc" }],
    take: 500,
  });
}

export async function createRepairAttempt(
  assignmentId: number,
  input: { quantityAttempted: number; quantityRepaired: number; notes?: string | null },
  performedById: number,
  divisiId?: number,
) {
  const { quantityAttempted, quantityRepaired } = input;
  if (
    !Number.isSafeInteger(quantityAttempted) ||
    !Number.isSafeInteger(quantityRepaired) ||
    quantityAttempted <= 0 ||
    quantityRepaired < 0 ||
    quantityRepaired > quantityAttempted
  ) {
    throw new QualityError("INPUT_INVALID", "Jumlah attempt dan hasil repair harus bilangan bulat yang valid");
  }

  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    await tx.$queryRaw`SELECT id FROM RepairAssignment WHERE id = ${assignmentId} FOR UPDATE`;
    const assignment = await tx.repairAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        attempts: {
          select: { quantityRepaired: true, reviewApproved: true },
        },
      },
    });
    if (!assignment) throw new QualityError("REPAIR_NOT_FOUND", "Penugasan repair tidak ditemukan");
    if (divisiId !== undefined && assignment.repairDivisionId !== divisiId) {
      throw new QualityError("REPAIR_SCOPE_DENIED", "Penugasan hanya dapat dikerjakan oleh divisi yang ditugaskan");
    }
    if (assignment.status === "SUBMITTED" || assignment.status === "COMPLETED" || assignment.status === "CANCELLED") {
      throw new QualityError("REPAIR_NOT_READY", "Penugasan belum dapat menerima attempt baru");
    }
    const completedQuantity = assignment.attempts.reduce(
      (total, attempt) => total + (attempt.reviewApproved ? Number(attempt.quantityRepaired) : 0),
      0,
    );
    const outstanding = Number(assignment.quantity) - completedQuantity;
    if (quantityAttempted > outstanding) {
      throw new QualityError("REPAIR_QUANTITY_EXCEEDED", "Jumlah attempt melebihi sisa penugasan");
    }

    const quantityRemaining = quantityAttempted - quantityRepaired;
    const outcome = quantityRepaired === 0
      ? "FAILED"
      : quantityRemaining === 0 ? "REPAIRED" : "PARTIAL";
    const attempt = await tx.repairAttempt.create({
      data: {
        assignmentId,
        performedById,
        outcome,
        quantityAttempted,
        quantityRepaired,
        quantityRemaining,
        notes: input.notes?.trim() || null,
      },
    });
    await tx.repairAssignment.update({
      where: { id: assignmentId },
      data: { status: "SUBMITTED" },
    });
    const updated = await tx.repairAssignment.findUnique({
      where: { id: assignmentId },
      include: repairAssignmentInclude,
    });
    if (!updated) throw new QualityError("REPAIR_NOT_FOUND", "Penugasan repair tidak ditemukan");
    return updated;
  });
}

export async function reviewRepairAttempt(
  assignmentId: number,
  attemptId: number,
  input: { approved: boolean; notes?: string | null },
  reviewedById: number,
) {
  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    await tx.$queryRaw`SELECT id FROM RepairAssignment WHERE id = ${assignmentId} FOR UPDATE`;
    await tx.$queryRaw`SELECT id FROM RepairAttempt WHERE id = ${attemptId} FOR UPDATE`;
    const attempt = await tx.repairAttempt.findUnique({
      where: { id: attemptId },
      include: {
        assignment: {
          include: {
            inspectionLine: {
              include: {
                inspection: { select: { id: true, number: true } },
                lot: { select: { id: true, itemId: true } },
                defects: { select: { id: true, originDivisionId: true } },
              },
            },
            attempts: { select: { id: true, quantityRepaired: true, reviewApproved: true } },
          },
        },
      },
    });
    if (!attempt || attempt.assignmentId !== assignmentId) {
      throw new QualityError("REPAIR_NOT_FOUND", "Attempt repair tidak ditemukan");
    }
    if (attempt.reviewedAt || attempt.assignment.status !== "SUBMITTED") {
      throw new QualityError("REPAIR_ALREADY_REVIEWED", "Attempt sudah direview atau penugasan tidak menunggu review");
    }
    if (!attempt.assignment.inspectionLine.lot) {
      throw new QualityError("LOT_NOT_FOUND", "Penugasan repair tidak memiliki lot WIP");
    }
    const sourceLine = attempt.assignment.inspectionLine;
    const sourceLot = sourceLine.lot;
    if (!sourceLot) throw new QualityError("LOT_NOT_FOUND", "Penugasan repair tidak memiliki lot WIP");
    const defect = sourceLine.defects.find((row) => row.id === attempt.assignment.defectId);
    if (!defect?.originDivisionId || defect.originDivisionId !== attempt.assignment.repairDivisionId) {
      throw new QualityError("REPAIR_NOT_READY", "Divisi asal defect harus sama dengan divisi yang memperbaiki");
    }

    let inspection = null;
    if (input.approved && Number(attempt.quantityRepaired) > 0) {
      const routingId = sourceLine.productionRoutingId;
      if (!routingId) throw new QualityError("ROUTING_INVALID", "Inspeksi sumber belum terhubung dengan routing produksi");
      const routing = await tx.productionRouting.findUnique({
        where: { id: routingId },
        include: { stages: { orderBy: { sequence: "asc" } } },
      });
      if (!routing) throw new QualityError("ROUTING_INVALID", "Routing sumber repair tidak ditemukan");
      const repairStage = routing.stages.find((stage) => stage.divisiId === defect.originDivisionId);
      if (!repairStage) throw new QualityError("ROUTING_INVALID", "Divisi asal defect tidak termasuk routing varian ini");
      const qcDivision = await tx.divisi.findFirst({
        where: { nama: { equals: "QC" } },
        select: { id: true },
      });
      if (!qcDivision) throw new QualityError("LOCATION_NOT_FOUND", "Divisi QC belum tersedia");
      const repairLocation = await ensureDivisionInventoryLocation(tx, attempt.assignment.repairDivisionId);
      const quantity = Number(attempt.quantityRepaired);
      if (repairStage.stage === "TOP_COAT") {
        const qcLocation = await ensureDivisionInventoryLocation(tx, qcDivision.id);
        await postInventoryMovementInTransaction(tx, {
          itemId: sourceLot.itemId,
          pemakaianMaterialItemId: sourceLot.id,
          fromLocationId: repairLocation.id,
          toLocationId: qcLocation.id,
          type: "REPAIR",
          quantity,
          idempotencyKey: `repair:${attempt.id}:to-qc`,
          sourceType: "REPAIR_REVIEW",
          sourceId: String(attempt.id),
          reason: `Repair Top Coat attempt ${attempt.id} disetujui untuk QC Akhir`,
          userId: reviewedById,
        });
        const now = new Date();
        inspection = await tx.qualityInspection.create({
          data: {
            number: `QC-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`,
            inspectorId: reviewedById,
            notes: `QC Akhir ulang setelah repair Top Coat attempt ${attempt.id}`,
            lines: {
              create: {
                repairAttemptId: attempt.id,
                pemakaianMaterialItemId: sourceLot.id,
                productionRoutingId: routingId,
                productVariantId: sourceLine.productVariantId,
                inspectedQuantity: attempt.quantityRepaired,
              },
            },
          },
          include: inspectionInclude,
        });
      } else {
        const targetItem = await tx.item.findUnique({
          where: { id: repairStage.outputItemId },
          select: { id: true, unit: true },
        });
        if (!targetItem) throw new QualityError("ROUTING_INVALID", "Item hasil tahap repair tidak ditemukan");
        const number = `RPR-${attempt.id}-${randomUUID().slice(0, 8).toUpperCase()}`;
        const rework = await tx.pemakaianMaterial.create({
          data: {
            nomor: number,
            divisiId: defect.originDivisionId,
            tanggal: new Date(),
            userId: reviewedById,
            sumber: "REPAIR",
            keterangan: `Output repair ${attempt.id}; lanjut dari ${repairStage.stage}`,
            items: {
              create: {
                itemId: targetItem.id,
                jumlahDiterima: quantity,
                jumlahDipakai: 0,
                jumlahSisa: quantity,
                satuan: targetItem.unit,
                keteranganSisa: `Lanjut ke tahap setelah ${repairStage.stage}`,
              },
            },
          },
          select: { items: { select: { id: true } } },
        });
        const newLotId = rework.items[0]?.id;
        if (!newLotId) throw new QualityError("REPAIR_NOT_READY", "Lot hasil repair tidak berhasil dibuat");
        await postInventoryMovementInTransaction(tx, {
          itemId: sourceLot.itemId,
          pemakaianMaterialItemId: sourceLot.id,
          fromLocationId: repairLocation.id,
          type: "REPAIR",
          quantity,
          idempotencyKey: `repair:${attempt.id}:consume-final-item`,
          sourceType: "REPAIR_REVIEW",
          sourceId: String(attempt.id),
          reason: `Konversi hasil repair ${repairStage.stage} dari item Top Coat`,
          userId: reviewedById,
        });
        await postInventoryMovementInTransaction(tx, {
          itemId: targetItem.id,
          pemakaianMaterialItemId: newLotId,
          toLocationId: repairLocation.id,
          type: "REPAIR",
          quantity,
          idempotencyKey: `repair:${attempt.id}:to-next-stage`,
          sourceType: "REPAIR_REWORK_OUTPUT",
          sourceId: `${attempt.id}:${routingId}:${repairStage.id}`,
          reason: `Output repair ${repairStage.stage}; lanjut ke tahap berikutnya`,
          userId: reviewedById,
        });
      }
    }

    const reviewedAt = new Date();
    const reviewedAttempt = await tx.repairAttempt.update({
      where: { id: attempt.id },
      data: {
        reviewedById,
        reviewedAt,
        reviewApproved: input.approved,
        reviewNotes: input.notes?.trim() || null,
      },
    });
    const acceptedQuantity = attempt.assignment.attempts.reduce(
      (total, prior) => total + (prior.reviewApproved ? Number(prior.quantityRepaired) : 0),
      0,
    ) + (input.approved ? Number(attempt.quantityRepaired) : 0);
    const completed = acceptedQuantity >= Number(attempt.assignment.quantity);
    const assignment = await tx.repairAssignment.update({
      where: { id: assignmentId },
      data: {
        status: completed ? "COMPLETED" : "IN_PROGRESS",
        ...(completed ? {
          completedAt: reviewedAt,
          reviewedById,
          reviewedAt,
          reviewNotes: input.notes?.trim() || null,
        } : {}),
      },
      include: repairAssignmentInclude,
    });
    return { attempt: reviewedAttempt, assignment, inspection };
  });
}

export async function getQualityInspection(id: number) {
  const inspection = await prisma.qualityInspection.findUnique({
    where: { id },
    include: inspectionInclude,
  });
  if (!inspection) throw new QualityError("INSPECTION_NOT_FOUND", "Inspeksi QC tidak ditemukan");
  return inspection;
}

export async function updateQualityInspectionLine(
  inspectionId: number,
  lineId: number,
  input: QualityLineOutcomeInput,
) {
  const validationLine: QualityLineInput = {
    pemakaianMaterialItemId: 1,
    inspectedQuantity: 1,
    passedQuantity: input.passedQuantity,
    repairQuantity: input.repairQuantity,
    rejectedQuantity: input.rejectedQuantity,
    productVariantId: input.productVariantId ?? null,
    defects: input.defects,
  };
  if (
    [input.passedQuantity, input.repairQuantity, input.rejectedQuantity]
      .some((quantity) => !Number.isSafeInteger(quantity) || quantity < 0)
  ) {
    throw new QualityError("INPUT_INVALID", "Jumlah hasil inspeksi harus bilangan bulat non-negatif");
  }
  validateDefects(validationLine);
  const variantId = input.productVariantId ?? null;
  if (variantId === null) {
    throw new QualityError("VARIANT_REQUIRED", "Pilih varian Top Coat yang sesuai dengan lot");
  }

  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    await tx.$queryRaw`SELECT id FROM QualityInspection WHERE id = ${inspectionId} FOR UPDATE`;
    const line = await tx.qualityInspectionLine.findFirst({
      where: { id: lineId, inspectionId },
      include: {
        inspection: { select: { status: true } },
        lot: { select: { itemId: true, pemakaian: { select: { divisiId: true } } } },
      },
    });
    if (!line) throw new QualityError("INSPECTION_NOT_FOUND", "Baris inspeksi tidak ditemukan");
    if (line.inspection.status !== "DRAFT") {
      throw new QualityError("INSPECTION_FINALIZED", "Hasil inspeksi yang sudah final tidak dapat diubah");
    }
    const finalInput = {
      ...validationLine,
      inspectedQuantity: Number(line.inspectedQuantity),
    };
    validateOutcome(finalInput);
    if (!line.lot?.itemId) throw new QualityError("LOT_NOT_FOUND", "Baris inspeksi tidak memiliki lot WIP");
    const routing = await getActiveRoutingForOutput(tx, variantId, line.lot.itemId);
    const topcoat = routing?.stages.find((stage) => stage.stage === "TOP_COAT");
    if (!routing || !topcoat || topcoat.divisiId !== line.lot.pemakaian.divisiId) {
      throw new QualityError("ROUTING_INVALID", "Varian harus memiliki routing Top Coat aktif yang sesuai dengan lot");
    }
    await tx.qualityDefect.deleteMany({ where: { inspectionLineId: lineId } });
    await tx.qualityInspectionLine.update({
      where: { id: lineId },
      data: {
        productVariantId: variantId,
        productionRoutingId: routing.id,
        passedQuantity: input.passedQuantity,
        repairQuantity: input.repairQuantity,
        rejectedQuantity: input.rejectedQuantity,
        defects: {
          create: (input.defects ?? []).map((defect) => ({
            description: defect.description.trim(),
            quantity: defect.quantity,
            foundAtDivisionId: defect.foundAtDivisionId ?? null,
            originDivisionId: defect.originDivisionId ?? null,
            repairDivisionId: defect.repairDivisionId ?? null,
          })),
        },
      },
    });
    const updated = await tx.qualityInspection.findUnique({
      where: { id: inspectionId },
      include: inspectionInclude,
    });
    if (!updated) throw new QualityError("INSPECTION_NOT_FOUND", "Inspeksi QC tidak ditemukan");
    return updated;
  });
}

export async function createQualityInspection(
  input: {
    notes?: string | null;
    lines: QualityLineInput[];
  },
  inspectorId: number,
) {
  if (!input.lines.length) {
    throw new QualityError("INPUT_INVALID", "Inspeksi minimal memiliki satu baris");
  }
  for (const line of input.lines) {
    validateOutcome(line);
    validateDefects(line);
  }

  const now = new Date();
  const number = `QC-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    const lineData = await Promise.all(input.lines.map(async (line) => {
      if (!line.productVariantId) {
        throw new QualityError("VARIANT_REQUIRED", "Pilih varian hasil Top Coat untuk setiap inspeksi");
      }
      const lot = await tx.pemakaianMaterialItem.findUnique({
        where: { id: line.pemakaianMaterialItemId },
        select: {
          id: true,
          itemId: true,
          jumlahSisa: true,
          pemakaian: { select: { divisiId: true } },
        },
      });
      if (!lot || lot.itemId === null) throw new QualityError("LOT_NOT_FOUND", "Lot WIP tidak ditemukan");
      if (Number(lot.jumlahSisa) < line.inspectedQuantity) {
        throw new QualityError("WIP_SHORT", "Jumlah inspeksi melebihi saldo lot yang tersedia");
      }
      const routing = await getActiveRoutingForOutput(tx, line.productVariantId, lot.itemId);
      const topcoat = routing?.stages.find((stage) => stage.stage === "TOP_COAT");
      if (!routing || !topcoat || topcoat.divisiId !== lot.pemakaian.divisiId) {
        throw new QualityError("ROUTING_INVALID", "QC Akhir hanya dapat menerima output Top Coat dari routing/BOM aktif");
      }
      return {
        pemakaianMaterialItemId: line.pemakaianMaterialItemId,
        productionRoutingId: routing.id,
        productVariantId: line.productVariantId,
        inspectedQuantity: line.inspectedQuantity,
        passedQuantity: line.passedQuantity,
        repairQuantity: line.repairQuantity,
        rejectedQuantity: line.rejectedQuantity,
        defects: {
          create: (line.defects ?? []).map((defect) => ({
            description: defect.description.trim(),
            quantity: defect.quantity,
            foundAtDivisionId: defect.foundAtDivisionId ?? null,
            originDivisionId: defect.originDivisionId ?? null,
            repairDivisionId: defect.repairDivisionId ?? null,
          })),
        },
      };
    }));

    return tx.qualityInspection.create({
      data: {
        number,
        inspectorId,
        notes: input.notes?.trim() || null,
        lines: { create: lineData },
      },
      include: inspectionInclude,
    });
  });
}

export type ReopenQualityLineInput = Omit<QualityLineInput, "pemakaianMaterialItemId" | "productVariantId"> & {
  sourceLineId: number;
};

export async function reopenQualityInspection(
  sourceInspectionId: number,
  reason: string,
  lines: ReopenQualityLineInput[],
  inspectorId: number,
) {
  const reopenReason = reason.trim();
  if (reopenReason.length < 5 || lines.length === 0) {
    throw new QualityError("INPUT_INVALID", "Alasan minimal 5 karakter dan baris pembukaan ulang wajib diisi");
  }
  if (new Set(lines.map((line) => line.sourceLineId)).size !== lines.length) {
    throw new QualityError("INPUT_INVALID", "Satu baris reject hanya boleh dicantumkan satu kali per inspeksi");
  }
  for (const line of lines) {
    validateOutcome({
      ...line,
      productVariantId: line.passedQuantity > 0 ? 1 : null,
    });
    validateDefects({ ...line, pemakaianMaterialItemId: 1, productVariantId: null });
  }

  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    await tx.$queryRaw`SELECT id FROM QualityInspection WHERE id = ${sourceInspectionId} FOR UPDATE`;
    const sourceInspection = await tx.qualityInspection.findUnique({
      where: { id: sourceInspectionId },
      include: { lines: { select: { id: true, pemakaianMaterialItemId: true, productVariantId: true, productionRoutingId: true, rejectedQuantity: true } } },
    });
    if (!sourceInspection || sourceInspection.status !== "COMPLETED") {
      throw new QualityError("INSPECTION_NOT_FOUND", "Hanya keputusan QC final yang dapat dibuka ulang");
    }

    const sourceLinesById = new Map(sourceInspection.lines.map((line) => [line.id, line]));
    for (const line of lines) {
      const source = sourceLinesById.get(line.sourceLineId);
      if (!source || !source.pemakaianMaterialItemId || Number(source.rejectedQuantity) <= 0) {
        throw new QualityError("INPUT_INVALID", "Baris sumber bukan reject final yang dapat dibuka ulang");
      }
      if (line.passedQuantity > 0 && !source.productVariantId) {
        throw new QualityError("VARIANT_REQUIRED", "Varian sumber belum ditetapkan untuk unit yang lolos");
      }
      await tx.$queryRaw`SELECT id FROM QualityInspectionLine WHERE id = ${source.id} FOR UPDATE`;
      const reopened = await tx.qualityInspectionLine.findMany({
        where: {
          reopenedFromLineId: source.id,
          inspection: { status: "COMPLETED" },
        },
        select: { inspectedQuantity: true },
      });
      const previousQuantity = reopened.reduce(
        (total, row) => total + Number(row.inspectedQuantity),
        0,
      );
      if (previousQuantity + line.inspectedQuantity > Number(source.rejectedQuantity)) {
        throw new QualityError("INPUT_INVALID", "Jumlah pembukaan ulang melebihi reject final yang tersisa");
      }
    }

    const now = new Date();
    const number = `QC-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
    return tx.qualityInspection.create({
      data: {
        number,
        inspectorId,
        reopenedFromId: sourceInspectionId,
        reopenReason,
        lines: {
          create: lines.map((line) => {
            const source = sourceLinesById.get(line.sourceLineId)!;
            return {
              pemakaianMaterialItemId: source.pemakaianMaterialItemId,
              reopenedFromLineId: source.id,
              productVariantId: source.productVariantId,
              productionRoutingId: source.productionRoutingId,
              inspectedQuantity: line.inspectedQuantity,
              passedQuantity: line.passedQuantity,
              repairQuantity: line.repairQuantity,
              rejectedQuantity: line.rejectedQuantity,
              defects: {
                create: (line.defects ?? []).map((defect) => ({
                  description: defect.description.trim(),
                  quantity: defect.quantity,
                  foundAtDivisionId: defect.foundAtDivisionId ?? null,
                  originDivisionId: defect.originDivisionId ?? null,
                  repairDivisionId: defect.repairDivisionId ?? null,
                })),
              },
            };
          }),
        },
      },
      include: inspectionInclude,
    });
  });
}

export async function finalizeQualityInspection(id: number, inspectorId: number) {
  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    await tx.$queryRaw`SELECT id FROM QualityInspection WHERE id = ${id} FOR UPDATE`;
    const inspection = await tx.qualityInspection.findUnique({
      where: { id },
      include: {
        lines: {
          orderBy: { id: "asc" },
          include: {
            lot: {
              include: {
                item: { select: { id: true, kode: true, nama: true } },
                pemakaian: { select: { divisiId: true } },
              },
            },
            reopenedFrom: {
              include: {
                inspection: { select: { status: true } },
                lot: { select: { id: true } },
                barangTarget: { select: { id: true } },
              },
            },
            repairAttempt: { select: { id: true, reviewApproved: true } },
            defects: { orderBy: { id: "asc" } },
          },
        },
      },
    });
    if (!inspection) throw new QualityError("INSPECTION_NOT_FOUND", "Inspeksi QC tidak ditemukan");
    if (inspection.status === "COMPLETED") {
      return tx.qualityInspection.findUnique({
        where: { id },
        include: inspectionInclude,
      });
    }

    const qcDivision = await tx.divisi.findFirst({
      where: { nama: { equals: "QC" } },
      select: { id: true },
    });
    const qcLocation = qcDivision
      ? await ensureDivisionInventoryLocation(tx, qcDivision.id)
      : null;
    if (!qcLocation) {
      throw new QualityError("LOCATION_NOT_FOUND", "Divisi QC belum tersedia");
    }

    for (const line of inspection.lines) {
      validateOutcome({
        inspectedQuantity: Number(line.inspectedQuantity),
        passedQuantity: Number(line.passedQuantity),
        repairQuantity: Number(line.repairQuantity),
        rejectedQuantity: Number(line.rejectedQuantity),
        productVariantId: line.productVariantId,
      });
      if (!line.lot) throw new QualityError("LOT_NOT_FOUND", "Baris inspeksi tidak memiliki lot WIP");
      if (!line.productionRoutingId || !line.productVariantId) {
        throw new QualityError("ROUTING_INVALID", "Inspeksi QC wajib terhubung ke routing Top Coat dan varian");
      }
      const topcoatStage = await tx.productionRoutingStage.findUnique({
        where: {
          routingId_stage: {
            routingId: line.productionRoutingId,
            stage: "TOP_COAT",
          },
        },
      });
      if (
        !topcoatStage ||
        topcoatStage.outputItemId !== line.lot.itemId ||
        topcoatStage.divisiId !== line.lot.pemakaian.divisiId
      ) {
        throw new QualityError("ROUTING_INVALID", "Lot inspeksi bukan output Top Coat dari routing yang dipilih");
      }
      validateDefects({
        pemakaianMaterialItemId: line.lot.id,
        inspectedQuantity: Number(line.inspectedQuantity),
        passedQuantity: Number(line.passedQuantity),
        repairQuantity: Number(line.repairQuantity),
        rejectedQuantity: Number(line.rejectedQuantity),
        productVariantId: line.productVariantId,
        defects: line.defects.map((defect) => ({
          ...defect,
          quantity: Number(defect.quantity),
        })),
      });
      const routingStages = await tx.productionRoutingStage.findMany({
        where: { routingId: line.productionRoutingId },
        select: { divisiId: true },
      });
      const routingDivisionIds = new Set(routingStages.map((stage) => stage.divisiId));
      if (line.defects.some((defect) =>
        defect.repairDivisionId !== null &&
        (defect.originDivisionId === null || !routingDivisionIds.has(defect.originDivisionId)),
      )) {
        throw new QualityError("ROUTING_INVALID", "Asal defect repair harus merupakan tahap dalam routing varian");
      }
      const isRepairReinspection = line.repairAttemptId !== null;
      const isReopened = line.reopenedFromLineId !== null || isRepairReinspection;
      if (isRepairReinspection) {
        if (!line.repairAttempt || line.repairAttempt.reviewApproved !== true) {
          throw new QualityError("REPAIR_NOT_READY", "Hasil repair belum disetujui QC");
        }
        await tx.$queryRaw`SELECT id FROM RepairAttempt WHERE id = ${line.repairAttemptId!} FOR UPDATE`;
      } else if (line.reopenedFromLineId !== null) {
        await tx.$queryRaw`SELECT id FROM QualityInspectionLine WHERE id = ${line.reopenedFromLineId!} FOR UPDATE`;
        const sourceLine = line.reopenedFrom;
        if (!sourceLine || sourceLine.inspection.status !== "COMPLETED") {
          throw new QualityError("INSPECTION_NOT_FOUND", "Keputusan sumber pembukaan ulang tidak ditemukan");
        }
        const reopened = await tx.qualityInspectionLine.findMany({
          where: {
            reopenedFromLineId: sourceLine.id,
            inspection: { status: "COMPLETED" },
          },
          select: { inspectedQuantity: true },
        });
        const totalReopened = reopened.reduce(
          (total, row) => total + Number(row.inspectedQuantity),
          0,
        );
        if (totalReopened + Number(line.inspectedQuantity) > Number(sourceLine.rejectedQuantity)) {
          throw new QualityError("WIP_SHORT", "Jumlah pembukaan ulang melebihi reject final yang tersisa");
        }
      } else if (Number(line.lot.jumlahSisa) < Number(line.inspectedQuantity)) {
        throw new QualityError("WIP_SHORT", `Saldo lot ${line.lot.id} tidak cukup`);
      }
      if (Number(line.passedQuantity) > 0 && !line.productVariantId) {
        throw new QualityError("VARIANT_REQUIRED", "Varian wajib untuk hasil QC yang lolos");
      }

      await tx.$queryRaw`SELECT id FROM PemakaianMaterialItem WHERE id = ${line.lot.id} FOR UPDATE`;
      const sourceLocation = isReopened
        ? qcLocation
        : await ensureDivisionInventoryLocation(tx, line.lot.pemakaian.divisiId);

      if (sourceLocation.id !== qcLocation.id) {
        await postInventoryMovementInTransaction(tx, {
          itemId: line.lot.itemId,
          pemakaianMaterialItemId: line.lot.id,
          fromLocationId: sourceLocation.id,
          toLocationId: qcLocation.id,
          type: "QC",
          quantity: Number(line.inspectedQuantity),
          idempotencyKey: `qc:${inspection.id}:line:${line.id}:to-qc`,
          sourceType: "QUALITY_INSPECTION",
          sourceId: `${inspection.id}:${line.id}`,
          reason: `Pemeriksaan ${inspection.number}`,
          userId: inspectorId,
        });
      }

      if (!isReopened) {
        const changed = await tx.pemakaianMaterialItem.updateMany({
          where: {
            id: line.lot.id,
            jumlahSisa: { gte: Number(line.inspectedQuantity) },
          },
          data: {
            jumlahSisa: { decrement: Number(line.inspectedQuantity) },
            jumlahDipakai: { increment: Number(line.inspectedQuantity) },
          },
        });
        if (changed.count !== 1) {
          throw new QualityError("WIP_SHORT", `Saldo lot ${line.lot.id} berubah saat inspeksi`);
        }
      }

      const passed = Number(line.passedQuantity);
      if (passed > 0) {
        await postInventoryMovementInTransaction(tx, {
          itemId: line.lot.itemId,
          pemakaianMaterialItemId: line.lot.id,
          fromLocationId: qcLocation.id,
          type: "QC",
          quantity: passed,
          idempotencyKey: `qc:${inspection.id}:line:${line.id}:item-pass`,
          sourceType: "QUALITY_PASS",
          sourceId: `${inspection.id}:${line.id}`,
          reason: `Konversi hasil lolos ${inspection.number}`,
          userId: inspectorId,
        });
        const variantId = line.productVariantId;
        if (!variantId) {
          throw new QualityError("VARIANT_REQUIRED", "Varian wajib untuk hasil QC yang lolos");
        }
        const generated = await generateBarangBulkInTransaction(
          tx,
          variantId,
          passed,
          inspection.inspectedAt,
        );
        const barangIds = generated.batches.flatMap((batch) => batch.barang.map((barang) => barang.id));
        const assigned = await tx.barang.updateMany({
          where: { id: { in: barangIds }, status: "REGISTER" },
          data: { qualityInspectionLineId: line.id },
        });
        if (assigned.count !== passed) {
          throw new QualityError("INPUT_INVALID", "Jumlah unit barcode hasil generate tidak sesuai");
        }
        for (const barangId of barangIds) {
          await postInventoryMovementInTransaction(tx, {
            barangId,
            toLocationId: qcLocation.id,
            type: "QC",
            quantity: 1,
            idempotencyKey: `qc:${inspection.id}:line:${line.id}:unit:${barangId}`,
            sourceType: "QUALITY_PASS",
            sourceId: `${inspection.id}:${line.id}`,
            reason: `Unit lolos QC ${inspection.number}`,
            userId: inspectorId,
          });
        }
      }

      let remainingRepair = Number(line.repairQuantity);
      for (const defect of line.defects) {
        if (remainingRepair <= 0 || defect.repairDivisionId === null) continue;
        const assignedQuantity = Math.min(remainingRepair, Number(defect.quantity));
        if (assignedQuantity <= 0) continue;
        await tx.repairAssignment.create({
          data: {
            inspectionLineId: line.id,
            defectId: defect.id,
            repairDivisionId: defect.repairDivisionId,
            quantity: assignedQuantity,
            assignedById: inspectorId,
          },
        });
        const repairLocation = await ensureDivisionInventoryLocation(
          tx,
          defect.repairDivisionId,
        );
        await postInventoryMovementInTransaction(tx, {
          itemId: line.lot.itemId,
          pemakaianMaterialItemId: line.lot.id,
          fromLocationId: qcLocation.id,
          toLocationId: repairLocation.id,
          type: "QC",
          quantity: assignedQuantity,
          idempotencyKey: `qc:${inspection.id}:line:${line.id}:repair:${defect.id}`,
          sourceType: "QUALITY_REPAIR_ASSIGNMENT",
          sourceId: `${inspection.id}:${line.id}:${defect.id}`,
          reason: `Penugasan repair QC ${inspection.number}`,
          userId: inspectorId,
        });
        remainingRepair -= assignedQuantity;
      }
      if (remainingRepair > 0) {
        throw new QualityError("DEFECT_ASSIGNMENT_REQUIRED", "Kuantitas repair belum memiliki penugasan defect");
      }
    }

    await tx.qualityInspection.update({
      where: { id },
      data: { status: "COMPLETED" },
    });
    return tx.qualityInspection.findUnique({
      where: { id },
      include: inspectionInclude,
    });
  });
}
