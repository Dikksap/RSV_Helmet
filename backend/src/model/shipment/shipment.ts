import { randomUUID } from "node:crypto";
import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";
import {
  postInventoryMovementInTransaction,
} from "../inventory/inventory.js";

export class ShipmentError extends Error {
  constructor(
    public readonly code:
      | "INPUT_INVALID"
      | "SHIPMENT_NOT_FOUND"
      | "SHIPMENT_STATE"
      | "SHIPMENT_CONFLICT"
      | "LOCATION_INVALID"
      | "BARANG_NOT_AVAILABLE"
      | "RETURN_NOT_ALLOWED"
      | "STATUS_TRANSITION",
    message: string,
  ) {
    super(message);
    this.name = "ShipmentError";
  }
}

const shipmentInclude = {
  fromLocation: { select: { id: true, code: true, name: true, gudangId: true } },
  createdBy: { select: { id: true, name: true } },
  postedBy: { select: { id: true, name: true } },
  lines: {
    orderBy: { id: "asc" as const },
    include: {
      barang: {
        select: {
          id: true,
          kodeBarang: true,
          status: true,
          gudangId: true,
          variant: { select: { kodeVariant: true } },
        },
      },
      returns: { select: { id: true, returnId: true, condition: true } },
    },
  },
  returns: {
    orderBy: { receivedAt: "desc" as const },
    include: {
      toLocation: { select: { id: true, code: true, name: true } },
      receivedBy: { select: { id: true, name: true } },
      lines: true,
    },
  },
} as const;

const returnInclude = {
  shipment: { select: { id: true, number: true, recipientName: true } },
  toLocation: { select: { id: true, code: true, name: true } },
  receivedBy: { select: { id: true, name: true } },
  lines: {
    include: {
      shipmentLine: {
        select: {
          id: true,
          barang: { select: { id: true, kodeBarang: true, status: true } },
        },
      },
    },
  },
} as const;

const finishedGoodsReceiptInclude = {
  location: { select: { id: true, code: true, name: true, gudangId: true } },
  receivedBy: { select: { id: true, name: true } },
  lines: {
    include: {
      qualityLine: { select: { id: true, inspectionId: true } },
      barang: { select: { id: true, kodeBarang: true, status: true } },
    },
  },
} as const;

function makeNumber(prefix: string) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

async function requireTransition(
  tx: PrismaTransactionClient,
  fromKode: string,
  toKode: string,
) {
  const transition = await tx.statusTransition.findUnique({
    where: { fromKode_toKode: { fromKode, toKode } },
    select: { fromKode: true },
  });
  if (!transition) {
    throw new ShipmentError(
      "STATUS_TRANSITION",
      `Transisi status ${fromKode} ke ${toKode} belum diizinkan`,
    );
  }
}

async function getWarehouseLocation(tx: PrismaTransactionClient, locationId: number) {
  const location = await tx.inventoryLocation.findUnique({
    where: { id: locationId },
    select: { id: true, type: true, gudangId: true, isActive: true },
  });
  if (!location || !location.isActive || location.type !== "WAREHOUSE" || !location.gudangId) {
    throw new ShipmentError("LOCATION_INVALID", "Lokasi harus berupa gudang aktif yang terpetakan");
  }
  return location;
}

async function getGoodsBalancesAtLocation(barangIds: number[], locationId: number) {
  if (barangIds.length === 0) return new Map<number, number>();
  const movements = await prisma.inventoryMovement.findMany({
    where: {
      barangId: { in: barangIds },
      OR: [{ fromLocationId: locationId }, { toLocationId: locationId }],
    },
    select: { barangId: true, fromLocationId: true, toLocationId: true, quantity: true },
  });
  const balances = new Map<number, number>();
  for (const movement of movements) {
    if (movement.barangId === null) continue;
    const quantity = Number(movement.quantity);
    if (movement.fromLocationId === locationId) {
      balances.set(movement.barangId, (balances.get(movement.barangId) ?? 0) - quantity);
    }
    if (movement.toLocationId === locationId) {
      balances.set(movement.barangId, (balances.get(movement.barangId) ?? 0) + quantity);
    }
  }
  return balances;
}

export async function listFinishedGoodsReceiptCandidates() {
  const qcDivision = await prisma.divisi.findFirst({
    where: { nama: { equals: "QC" } },
    select: { id: true },
  });
  const qcLocation = qcDivision
    ? await prisma.inventoryLocation.findUnique({
        where: { divisiId: qcDivision.id },
        select: { id: true, isActive: true },
      })
    : null;
  if (!qcLocation?.isActive) {
    throw new ShipmentError("LOCATION_INVALID", "Lokasi divisi QC belum dipetakan atau tidak aktif");
  }
  const lines = await prisma.qualityInspectionLine.findMany({
    where: {
      inspection: { status: "COMPLETED" },
      passedQuantity: { gt: 0 },
      producedBarang: { some: { status: "REGISTER" } },
    },
    select: {
      id: true,
      variant: { select: { kodeVariant: true } },
      inspection: { select: { number: true, inspectedAt: true } },
      producedBarang: {
        where: { status: "REGISTER" },
        select: { id: true, kodeBarang: true },
        orderBy: { kodeBarang: "asc" },
      },
    },
    orderBy: [{ inspection: { inspectedAt: "desc" } }, { id: "desc" }],
    take: 500,
  });
  const barangIds = lines.flatMap((line) => line.producedBarang.map((barang) => barang.id));
  const balances = await getGoodsBalancesAtLocation(barangIds, qcLocation.id);
  return lines
    .map((line) => ({
      id: line.id,
      inspectionNumber: line.inspection.number,
      variantCode: line.variant?.kodeVariant ?? null,
      units: line.producedBarang.filter((barang) => (balances.get(barang.id) ?? 0) > 0),
    }))
    .filter((line) => line.units.length > 0);
}

export async function listAvailableFinishedGoods(locationId: number) {
  const location = await prisma.inventoryLocation.findUnique({
    where: { id: locationId },
    select: { id: true, type: true, gudangId: true, isActive: true },
  });
  if (!location || !location.isActive || location.type !== "WAREHOUSE" || !location.gudangId) {
    throw new ShipmentError("LOCATION_INVALID", "Lokasi harus berupa gudang aktif yang terpetakan");
  }
  const barangs = await prisma.barang.findMany({
    where: { status: "FINISHGOOD", gudangId: location.gudangId },
    select: {
      id: true,
      kodeBarang: true,
      variant: { select: { kodeVariant: true } },
    },
    orderBy: { kodeBarang: "asc" },
  });
  const balances = await getGoodsBalancesAtLocation(barangs.map((barang) => barang.id), locationId);
  return barangs
    .filter((barang) => (balances.get(barang.id) ?? 0) > 0)
    .map((barang) => ({ ...barang, locationId }));
}

export async function listCustomerShipments(take: number) {
  return prisma.customerShipment.findMany({
    include: shipmentInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
  });
}

export async function getCustomerShipment(id: number) {
  const shipment = await prisma.customerShipment.findUnique({
    where: { id },
    include: shipmentInclude,
  });
  if (!shipment) throw new ShipmentError("SHIPMENT_NOT_FOUND", "Shipment tidak ditemukan");
  return shipment;
}

export async function receiveFinishedGoods(input: {
  qualityInspectionLineId: number;
  locationId: number;
  idempotencyKey: string;
  barangIds: number[];
}, receivedById: number) {
  const key = input.idempotencyKey.trim();
  const barangIds = [...new Set(input.barangIds)].sort((a, b) => a - b);
  if (
    key.length < 8 || key.length > 191 ||
    barangIds.length === 0 ||
    barangIds.length !== input.barangIds.length
  ) {
    throw new ShipmentError("INPUT_INVALID", "idempotencyKey dan daftar barcode unik wajib diisi");
  }
  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    const prior = await tx.finishedGoodsReceipt.findUnique({
      where: { idempotencyKey: key },
      include: finishedGoodsReceiptInclude,
    });
    if (prior) {
      const same =
        prior.locationId === input.locationId &&
        prior.lines.every((line) => line.qualityInspectionLineId === input.qualityInspectionLineId) &&
        prior.lines.map((line) => line.barangId).sort((a, b) => a - b).join(",") === barangIds.join(",");
      if (!same) {
        throw new ShipmentError("SHIPMENT_CONFLICT", "idempotencyKey sudah dipakai untuk penerimaan berbeda");
      }
      return prior;
    }

    const location = await getWarehouseLocation(tx, input.locationId);
    const qualityLine = await tx.qualityInspectionLine.findUnique({
      where: { id: input.qualityInspectionLineId },
      include: {
        inspection: { select: { id: true, status: true, number: true } },
        producedBarang: { select: { id: true, status: true, gudangId: true } },
      },
    });
    if (!qualityLine || qualityLine.inspection.status !== "COMPLETED") {
      throw new ShipmentError("BARANG_NOT_AVAILABLE", "Penerimaan hanya untuk hasil QC yang sudah final");
    }
    const selected = qualityLine.producedBarang.filter((barang) => barangIds.includes(barang.id));
    if (
      selected.length !== barangIds.length ||
      selected.some((barang) => barang.status !== "REGISTER" || barang.gudangId !== null)
    ) {
      throw new ShipmentError("BARANG_NOT_AVAILABLE", "Unit tidak berada pada antrean penerimaan Finish Good");
    }

    const qcDivision = await tx.divisi.findFirst({
      where: { nama: { equals: "QC" } },
      select: { id: true },
    });
    const qcLocation = qcDivision
      ? await tx.inventoryLocation.findUnique({
          where: { divisiId: qcDivision.id },
          select: { id: true, isActive: true },
        })
      : null;
    if (!qcLocation?.isActive) {
      throw new ShipmentError("LOCATION_INVALID", "Lokasi divisi QC belum dipetakan atau tidak aktif");
    }

    const receipt = await tx.finishedGoodsReceipt.create({
      data: {
        number: makeNumber("FG"),
        idempotencyKey: key,
        locationId: location.id,
        receivedById,
        lines: {
          create: barangIds.map((barangId) => ({
            qualityInspectionLineId: qualityLine.id,
            barangId,
          })),
        },
      },
      include: finishedGoodsReceiptInclude,
    });
    await requireTransition(tx, "REGISTER", "FINISHGOOD");
    for (const barangId of barangIds) {
      await postInventoryMovementInTransaction(tx, {
        barangId,
        fromLocationId: qcLocation.id,
        toLocationId: location.id,
        type: "QC",
        quantity: 1,
        idempotencyKey: `fg:${receipt.id}:unit:${barangId}`,
        sourceType: "FINISHED_GOODS_RECEIPT",
        sourceId: `${receipt.id}:${barangId}`,
        reason: `Penerimaan ${receipt.number}`,
        userId: receivedById,
      });
      const changed = await tx.barang.updateMany({
        where: { id: barangId, status: "REGISTER", gudangId: null },
        data: { status: "FINISHGOOD", gudangId: location.gudangId },
      });
      if (changed.count !== 1) {
        throw new ShipmentError("BARANG_NOT_AVAILABLE", `Barang ${barangId} berubah saat penerimaan FG`);
      }
      await tx.riwayatBarang.create({
        data: {
          barangId,
          status: "FINISHGOOD",
          keterangan: `Diterima sebagai Finish Good melalui ${receipt.number}`,
        },
      });
    }
    return receipt;
  });
}

export async function createCustomerShipment(input: {
  fromLocationId: number;
  recipientName: string;
  recipientAddress: string;
  reference?: string | null;
  idempotencyKey: string;
  barangIds: number[];
}, createdById: number) {
  const name = input.recipientName.trim();
  const address = input.recipientAddress.trim();
  const key = input.idempotencyKey.trim();
  const barangIds = [...new Set(input.barangIds)].sort((a, b) => a - b);
  if (!name || !address || barangIds.length === 0 || barangIds.length !== input.barangIds.length) {
    throw new ShipmentError("INPUT_INVALID", "Nama, alamat, dan daftar barcode unik wajib diisi");
  }
  if (key.length < 8 || key.length > 191) {
    throw new ShipmentError("INPUT_INVALID", "idempotencyKey wajib 8 sampai 191 karakter");
  }
  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    const prior = await tx.customerShipment.findUnique({
      where: { idempotencyKey: key },
      include: shipmentInclude,
    });
    if (prior) {
      const same =
        prior.fromLocationId === input.fromLocationId &&
        prior.recipientName === name &&
        prior.recipientAddress === address &&
        prior.reference === (input.reference?.trim() || null) &&
        prior.lines.map((line) => line.barangId).sort((a, b) => a - b).join(",") === barangIds.join(",");
      if (!same) throw new ShipmentError("SHIPMENT_CONFLICT", "idempotencyKey sudah dipakai untuk draft berbeda");
      return prior;
    }

    const location = await getWarehouseLocation(tx, input.fromLocationId);
    const barangs = await tx.barang.findMany({
      where: { id: { in: barangIds } },
      select: { id: true, status: true, gudangId: true },
    });
    if (
      barangs.length !== barangIds.length ||
      barangs.some((barang) => barang.status !== "FINISHGOOD" || barang.gudangId !== location.gudangId)
    ) {
      throw new ShipmentError("BARANG_NOT_AVAILABLE", "Semua unit harus berstatus Finish Good di gudang sumber");
    }

    return tx.customerShipment.create({
      data: {
        number: makeNumber("SHP"),
        idempotencyKey: key,
        fromLocationId: location.id,
        recipientName: name,
        recipientAddress: address,
        reference: input.reference?.trim() || null,
        createdById,
        lines: { create: barangIds.map((barangId) => ({ barangId })) },
      },
      include: shipmentInclude,
    });
  });
}

export async function postCustomerShipment(id: number, postedById: number) {
  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    await tx.$queryRaw`SELECT id FROM CustomerShipment WHERE id = ${id} FOR UPDATE`;
    const shipment = await tx.customerShipment.findUnique({
      where: { id },
      include: {
        fromLocation: { select: { id: true, gudangId: true, isActive: true, type: true } },
        lines: { include: { barang: { select: { id: true, status: true, gudangId: true } } } },
      },
    });
    if (!shipment) throw new ShipmentError("SHIPMENT_NOT_FOUND", "Shipment tidak ditemukan");
    if (shipment.status === "POSTED") {
      return tx.customerShipment.findUnique({ where: { id }, include: shipmentInclude });
    }
    if (shipment.status !== "DRAFT") {
      throw new ShipmentError("SHIPMENT_STATE", "Hanya draft shipment yang dapat diposting");
    }
    if (shipment.lines.length === 0) {
      throw new ShipmentError("INPUT_INVALID", "Shipment tidak memiliki unit");
    }
    if (!shipment.fromLocation.isActive || shipment.fromLocation.type !== "WAREHOUSE") {
      throw new ShipmentError("LOCATION_INVALID", "Gudang sumber shipment tidak aktif");
    }

    for (const line of shipment.lines) {
      if (
        line.barang.status !== "FINISHGOOD" ||
        line.barang.gudangId !== shipment.fromLocation.gudangId
      ) {
        throw new ShipmentError("BARANG_NOT_AVAILABLE", `Barang ${line.barang.id} tidak lagi tersedia`);
      }
      await requireTransition(tx, "FINISHGOOD", "OUT");
      await postInventoryMovementInTransaction(tx, {
        barangId: line.barangId,
        fromLocationId: shipment.fromLocationId,
        type: "SHIPMENT",
        quantity: 1,
        idempotencyKey: `shipment:${shipment.id}:line:${line.id}`,
        sourceType: "CUSTOMER_SHIPMENT",
        sourceId: `${shipment.id}:${line.id}`,
        reason: `Pengiriman ${shipment.number}`,
        userId: postedById,
      });
      const changed = await tx.barang.updateMany({
        where: {
          id: line.barangId,
          status: "FINISHGOOD",
          gudangId: shipment.fromLocation.gudangId,
        },
        data: { status: "OUT", gudangId: null },
      });
      if (changed.count !== 1) {
        throw new ShipmentError("BARANG_NOT_AVAILABLE", `Barang ${line.barang.id} berubah saat shipment`);
      }
      await tx.riwayatBarang.create({
        data: {
          barangId: line.barangId,
          status: "OUT",
          keterangan: `Dikirim melalui ${shipment.number}`,
        },
      });
    }
    await tx.customerShipment.update({
      where: { id },
      data: { status: "POSTED", postedById, shippedAt: new Date() },
    });
    return tx.customerShipment.findUnique({ where: { id }, include: shipmentInclude });
  });
}

export async function cancelCustomerShipment(id: number, reason: string) {
  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    await tx.$queryRaw`SELECT id FROM CustomerShipment WHERE id = ${id} FOR UPDATE`;
    const shipment = await tx.customerShipment.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!shipment) throw new ShipmentError("SHIPMENT_NOT_FOUND", "Shipment tidak ditemukan");
    if (shipment.status !== "DRAFT") {
      throw new ShipmentError("SHIPMENT_STATE", "Shipment hanya dapat dibatalkan saat masih draft");
    }
    await tx.customerShipment.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: reason.trim() },
    });
    return tx.customerShipment.findUnique({ where: { id }, include: shipmentInclude });
  });
}

export async function receiveShipmentReturn(input: {
  shipmentId: number;
  toLocationId: number;
  idempotencyKey: string;
  reason: string;
  lines: Array<{ shipmentLineId: number; condition: string }>;
}, receivedById: number) {
  const key = input.idempotencyKey.trim();
  const reason = input.reason.trim();
  const lines = input.lines.slice().sort((a, b) => a.shipmentLineId - b.shipmentLineId);
  if (
    key.length < 8 || key.length > 191 ||
    reason.length < 5 ||
    lines.length === 0 ||
    new Set(lines.map((line) => line.shipmentLineId)).size !== lines.length ||
    lines.some((line) => !line.condition.trim())
  ) {
    throw new ShipmentError("INPUT_INVALID", "Alasan, kunci idempotensi, dan detail retur wajib valid");
  }
  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    const prior = await tx.shipmentReturn.findUnique({
      where: { idempotencyKey: key },
      include: returnInclude,
    });
    if (prior) {
      const same =
        prior.shipmentId === input.shipmentId &&
        prior.toLocationId === input.toLocationId &&
        prior.reason === reason &&
        prior.lines.map((line) => `${line.shipmentLineId}:${line.condition}`).sort().join("|") ===
          lines.map((line) => `${line.shipmentLineId}:${line.condition.trim()}`).sort().join("|");
      if (!same) throw new ShipmentError("SHIPMENT_CONFLICT", "idempotencyKey sudah dipakai untuk retur berbeda");
      return prior;
    }

    await tx.$queryRaw`SELECT id FROM CustomerShipment WHERE id = ${input.shipmentId} FOR UPDATE`;
    const shipment = await tx.customerShipment.findUnique({
      where: { id: input.shipmentId },
      select: { id: true, status: true, number: true },
    });
    if (!shipment) throw new ShipmentError("SHIPMENT_NOT_FOUND", "Shipment asal tidak ditemukan");
    if (shipment.status !== "POSTED") {
      throw new ShipmentError("RETURN_NOT_ALLOWED", "Retur hanya dapat merujuk shipment yang sudah diposting");
    }
    const location = await getWarehouseLocation(tx, input.toLocationId);
    const lineIds = lines.map((line) => line.shipmentLineId);
    const shipmentLines = await tx.customerShipmentLine.findMany({
      where: { id: { in: lineIds }, shipmentId: shipment.id },
      include: { barang: { select: { id: true, status: true, gudangId: true } } },
    });
    if (shipmentLines.length !== lineIds.length) {
      throw new ShipmentError("INPUT_INVALID", "Semua baris retur harus berasal dari shipment tersebut");
    }
    const alreadyReturned = await tx.shipmentReturnLine.findMany({
      where: { shipmentLineId: { in: lineIds } },
      select: { shipmentLineId: true },
    });
    if (alreadyReturned.length > 0 || shipmentLines.some((line) => line.barang.status !== "OUT")) {
      throw new ShipmentError("RETURN_NOT_ALLOWED", "Unit sudah pernah diretur atau bukan lagi berstatus OUT");
    }
    await requireTransition(tx, "OUT", "RETUR");

    const result = await tx.shipmentReturn.create({
      data: {
        number: makeNumber("RET"),
        idempotencyKey: key,
        shipmentId: shipment.id,
        toLocationId: location.id,
        receivedById,
        reason,
        lines: {
          create: lines.map((line) => ({
            shipmentLineId: line.shipmentLineId,
            condition: line.condition.trim(),
          })),
        },
      },
      include: returnInclude,
    });
    for (const line of shipmentLines) {
      await postInventoryMovementInTransaction(tx, {
        barangId: line.barangId,
        toLocationId: location.id,
        type: "RETURN",
        quantity: 1,
        idempotencyKey: `return:${result.id}:line:${line.id}`,
        sourceType: "SHIPMENT_RETURN",
        sourceId: `${result.id}:${line.id}`,
        reason,
        userId: receivedById,
      });
      const changed = await tx.barang.updateMany({
        where: { id: line.barangId, status: "OUT", gudangId: null },
        data: { status: "RETUR", gudangId: location.gudangId },
      });
      if (changed.count !== 1) {
        throw new ShipmentError("RETURN_NOT_ALLOWED", `Barang ${line.barangId} berubah saat penerimaan retur`);
      }
      await tx.riwayatBarang.create({
        data: {
          barangId: line.barangId,
          status: "RETUR",
          keterangan: `Retur dari ${shipment.number}: ${reason}`,
        },
      });
    }
    return result;
  });
}
