import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";
import { QualityError } from "./qualityError.js";

export type ProductionRoutingStageInput = {
  stage: string;
  divisiId: number;
  inputItemIds: number[];
  outputItemIds: number[];
};

const routingInclude = {
  stages: {
    orderBy: { sequence: "asc" as const },
    include: {
      divisi: { select: { id: true, nama: true } },
      inputItems: { include: { item: { select: { id: true, kode: true, nama: true, unit: true } } } },
      outputItems: { include: { item: { select: { id: true, kode: true, nama: true, unit: true } } } },
    },
  },
} as const;

async function validateRouting(
  tx: PrismaTransactionClient,
  stagesInput: ProductionRoutingStageInput[],
) {
  const stages = stagesInput;
  if (stages.length < 2) {
    throw new QualityError("ROUTING_INVALID", "Routing harus memiliki minimal dua tahap produksi");
  }
  if (stages.some((stage) =>
    stage.inputItemIds.length === 0 ||
    stage.outputItemIds.length === 0 ||
    new Set(stage.inputItemIds).size !== stage.inputItemIds.length ||
    new Set(stage.outputItemIds).size !== stage.outputItemIds.length,
  )) {
    throw new QualityError("ROUTING_INVALID", "Setiap tahap harus memiliki Item input/output dan tidak boleh duplikat");
  }
  const itemIds = [...new Set(stages.flatMap((stage) => [...stage.inputItemIds, ...stage.outputItemIds]))];
  const [items, routingDivisions] = await Promise.all([
    tx.item.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, kode: true, nama: true, divisiId: true, jenis: true },
    }),
    tx.divisi.findMany({
      where: { id: { in: [...new Set(stages.map((stage) => stage.divisiId))] } },
      select: { id: true, nama: true },
    }),
  ]);
  if (items.length !== itemIds.length) {
    throw new QualityError("ROUTING_INVALID", "Salah satu Item routing tidak ditemukan");
  }

  const divisionById = new Set(routingDivisions.map((division) => division.id));
  if (divisionById.size !== new Set(stages.map((stage) => stage.divisiId)).size) {
    throw new QualityError("ROUTING_INVALID", "Salah satu divisi routing tidak ditemukan");
  }
  const itemById = new Map(items.map((item) => [item.id, item]));
  for (const [index, stage] of stages.entries()) {
    const divisionId = stage.divisiId;
    const inputItems = stage.inputItemIds.map((itemId) => itemById.get(itemId));
    const outputItems = stage.outputItemIds.map((itemId) => itemById.get(itemId));
    if (!stage.stage.trim() || stage.stage.trim().length > 80 || !divisionById.has(divisionId) || inputItems.includes(undefined) || outputItems.includes(undefined)) {
      throw new QualityError("ROUTING_INVALID", "Tahap routing belum memiliki divisi atau Item yang valid");
    }
    const invalidOutput = outputItems.find((item) => item!.divisiId !== divisionId || item!.jenis !== "SM");
    if (invalidOutput) {
      throw new QualityError("ROUTING_INVALID", `Item hasil ${invalidOutput.kode} harus berupa SM milik divisi yang dipilih`);
    }
    const invalidFirstInput = index === 0
      ? inputItems.find((item) => item!.divisiId !== divisionId)
      : undefined;
    if (invalidFirstInput) {
      throw new QualityError("ROUTING_INVALID", `Item input tahap pertama ${invalidFirstInput.kode} harus tersedia di divisi yang dipilih`);
    }
    if (index > 0) {
      const previousOutputs = new Set(stages[index - 1]!.outputItemIds);
      if (stage.inputItemIds.some((itemId) => !previousOutputs.has(itemId))) {
        throw new QualityError("ROUTING_INVALID", "Item input tahap harus berasal dari output tahap sebelumnya");
      }
    }
  }
  return { stages };
}

export async function listProductionRoutings() {
  return prisma.productionRouting.findMany({
    where: { isActive: true },
    include: routingInclude,
    orderBy: { version: "desc" },
  });
}

export async function saveProductionRouting(
  input: { stages: ProductionRoutingStageInput[] },
) {
  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    const { stages } = await validateRouting(tx, input.stages);
    const current = await tx.productionRouting.findFirst({
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const version = (current?.version ?? 0) + 1;
    await tx.productionRouting.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
    return tx.productionRouting.create({
      data: {
        version,
        stages: {
          create: stages.map((stage, sequence) => ({
            stage: stage.stage,
            sequence,
            divisiId: stage.divisiId,
            inputItems: { create: stage.inputItemIds.map((itemId) => ({ itemId })) },
            outputItems: { create: stage.outputItemIds.map((itemId) => ({ itemId })) },
          })),
        },
      },
      include: routingInclude,
    });
  });
}

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
