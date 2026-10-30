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
