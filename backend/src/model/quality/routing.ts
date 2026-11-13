import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";

export async function getActiveRoutingForOutput(
  tx: PrismaTransactionClient,
  outputItemId: number,
) {
  const routings = await tx.productionRouting.findMany({
    where: {
      isActive: true,
      stages: { some: { outputItems: { some: { itemId: outputItemId } } } },
    },
    include: { stages: { orderBy: { sequence: "asc" }, include: { outputItems: true } } },
  });
  return routings.find((routing) => {
    const lastStage = routing.stages[routing.stages.length - 1];
    return lastStage?.outputItems.some((item) => item.itemId === outputItemId);
  }) ?? null;
}

export async function getRoutingStage(
  tx: PrismaTransactionClient,
  routingId: number,
  stage: string,
) {
  return tx.productionRoutingStage.findFirst({
    where: { routingId, stage },
    orderBy: { sequence: "asc" },
  });
}

export class RoutingError extends Error {
  constructor(
    public readonly code: "ROUTING_TIDAK_VALID" | "ROUTING_TIDAK_DITEMUKAN",
    message: string,
  ) {
    super(message);
    this.name = "RoutingError";
  }
}

const routingInclude = {
  stages: {
    orderBy: { sequence: "asc" as const },
    include: {
      divisi: { select: { id: true, nama: true } },
      inputItems: { include: { item: { select: { id: true, kode: true, nama: true, unit: true } } } },
      outputItems: { include: { item: { select: { id: true, kode: true, nama: true, unit: true } } } },
    },
  },
};

export async function listRoutings(activeOnly = true) {
  return prisma.productionRouting.findMany({
    where: activeOnly ? { isActive: true } : {},
    include: routingInclude,
    orderBy: [{ version: "desc" }, { id: "desc" }],
  });
}

export type RoutingStageInput = {
  stage: string;
  divisiId: number;
  inputItemIds: number[];
  outputItemIds: number[];
};

/**
 * Ganti routing aktif dengan versi baru.
 *
 * Routing ditulis sebagai VERSI BARU (bukan update in-place) supaya transaksi
 * produksi lama yang menyimpan `routingStageId` tetap dapat direproduksi.
 *
 * `routingId` (opsional) membatasi penggantian pada satu lineage routing saja,
 * sehingga routing aktif lain (mis. Solid & Motif) tidak ikut dinonaktifkan.
 */
export async function replaceActiveRouting(stages: RoutingStageInput[], routingId?: number) {
  if (
    routingId !== undefined &&
    (!Number.isInteger(routingId) || routingId <= 0)
  ) {
    throw new RoutingError("ROUTING_TIDAK_VALID", "routingId harus angka bulat positif");
  }
  if (!Array.isArray(stages) || stages.length === 0) {
    throw new RoutingError("ROUTING_TIDAK_VALID", "Minimal satu tahap routing diperlukan");
  }
  const seen = new Set<string>();
  for (const [index, stage] of stages.entries()) {
    const name = String(stage.stage ?? "").trim().toUpperCase();
    if (!name) throw new RoutingError("ROUTING_TIDAK_VALID", `stages[${index}].stage wajib diisi`);
    if (seen.has(name)) {
      throw new RoutingError("ROUTING_TIDAK_VALID", `Tahap "${name}" duplikat`);
    }
    seen.add(name);
    if (!Number.isInteger(stage.divisiId) || stage.divisiId <= 0) {
      throw new RoutingError("ROUTING_TIDAK_VALID", `stages[${index}].divisiId tidak valid`);
    }
    if (!Array.isArray(stage.inputItemIds) || stage.inputItemIds.length === 0) {
      throw new RoutingError("ROUTING_TIDAK_VALID", `stages[${index}].inputItemIds wajib diisi`);
    }
    const isLast = index === stages.length - 1;
    if (!Array.isArray(stage.outputItemIds)) {
      throw new RoutingError("ROUTING_TIDAK_VALID", `stages[${index}].outputItemIds wajib array`);
    }
    if (stage.outputItemIds.length === 0 && !isLast) {
      throw new RoutingError("ROUTING_TIDAK_VALID", `stages[${index}].outputItemIds wajib diisi untuk tahap non-akhir`);
    }
  }

  const divisiIds = [...new Set(stages.map((stage) => stage.divisiId))];
  const itemIds = [
    ...new Set(stages.flatMap((stage) => [...stage.inputItemIds, ...(stage.outputItemIds ?? [])])),
  ];
  const [divisiRows, itemRows] = await Promise.all([
    prisma.divisi.findMany({ where: { id: { in: divisiIds } }, select: { id: true } }),
    prisma.item.findMany({ where: { id: { in: itemIds } }, select: { id: true } }),
  ]);
  if (divisiRows.length !== divisiIds.length) {
    throw new RoutingError("ROUTING_TIDAK_VALID", "Ada divisi yang tidak ditemukan");
  }
  if (itemRows.length !== itemIds.length) {
    const ada = new Set(itemRows.map((row) => row.id));
    throw new RoutingError(
      "ROUTING_TIDAK_VALID",
      `Item tidak ditemukan: ${itemIds.filter((id) => !ada.has(id)).join(", ")}`,
    );
  }

  if (routingId !== undefined) {
    const existing = await prisma.productionRouting.findUnique({
      where: { id: routingId },
      select: { id: true },
    });
    if (!existing) {
      throw new RoutingError("ROUTING_TIDAK_DITEMUKAN", "Routing yang akan diubah tidak ditemukan");
    }
  }

  return prisma.$transaction(async (tx) => {
    const latest = await tx.productionRouting.findFirst({
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const version = (latest?.version ?? 0) + 1;
    if (routingId !== undefined) {
      await tx.productionRouting.update({
        where: { id: routingId },
        data: { isActive: false },
      });
    } else {
      await tx.productionRouting.updateMany({ where: { isActive: true }, data: { isActive: false } });
    }
    return tx.productionRouting.create({
      data: {
        version,
        isActive: true,
        stages: {
          create: stages.map((stage, index) => ({
            stage: String(stage.stage).trim().toUpperCase(),
            sequence: index,
            divisiId: stage.divisiId,
            inputItems: { create: [...new Set(stage.inputItemIds)].map((itemId) => ({ itemId })) },
            outputItems: { create: [...new Set(stage.outputItemIds)].map((itemId) => ({ itemId })) },
          })),
        },
      },
      include: routingInclude,
    });
  });
}
