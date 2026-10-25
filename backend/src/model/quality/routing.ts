import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";
import { QualityError } from "./qualityError.js";

export const productionStages = [
  "BUFFING",
  "BASE_COAT",
  "DECAL_SOLID",
  "DECAL_MOTIF",
  "TOP_COAT",
] as const;

export type ProductionStage = (typeof productionStages)[number];

export type ProductionRoutingStageInput = {
  stage: ProductionStage;
  inputItemId: number;
  outputItemId: number;
};

const expectedDivision: Record<ProductionStage, string> = {
  BUFFING: "Buffing",
  BASE_COAT: "Base Coat",
  DECAL_SOLID: "Decal Solid",
  DECAL_MOTIF: "Decal Motif",
  TOP_COAT: "Top Coat",
};

const routingInclude = {
  productVariant: {
    select: {
      id: true,
      kodeVariant: true,
      product: { select: { nama: true } },
      style: { select: { nama: true } },
      color: { select: { nama: true } },
      size: { select: { nama: true } },
    },
  },
  bom: {
    select: {
      id: true,
      kode: true,
      nama: true,
      version: true,
      isActive: true,
      berlakuMulai: true,
      berlakuSelesai: true,
    },
  },
  stages: {
    orderBy: { sequence: "asc" as const },
    include: {
      divisi: { select: { id: true, nama: true } },
      inputItem: { select: { id: true, kode: true, nama: true, unit: true } },
      outputItem: { select: { id: true, kode: true, nama: true, unit: true } },
    },
  },
} as const;

function requiredStageOrder(stages: ProductionRoutingStageInput[]) {
  const decalStage = stages.find((stage) =>
    stage.stage === "DECAL_SOLID" || stage.stage === "DECAL_MOTIF",
  )?.stage;
  if (!decalStage || stages.length !== 4) {
    throw new QualityError("ROUTING_INVALID", "Routing wajib berisi Buffing, Base Coat, satu jalur Decal, dan Top Coat");
  }
  const expected = ["BUFFING", "BASE_COAT", decalStage, "TOP_COAT"];
  if (stages.some((stage, index) => stage.stage !== expected[index])) {
    throw new QualityError("ROUTING_INVALID", "Urutan tahap harus Buffing → Base Coat → Decal → Top Coat");
  }
  if (new Set(stages.map((stage) => stage.stage)).size !== stages.length) {
    throw new QualityError("ROUTING_INVALID", "Tahap routing tidak boleh duplikat");
  }
  return stages;
}

function bomIsEffective(bom: {
  isActive: boolean;
  berlakuMulai: Date | null;
  berlakuSelesai: Date | null;
}) {
  const now = new Date();
  return bom.isActive &&
    (bom.berlakuMulai === null || bom.berlakuMulai <= now) &&
    (bom.berlakuSelesai === null || bom.berlakuSelesai >= now);
}

async function validateRouting(
  tx: PrismaTransactionClient,
  productVariantId: number,
  bomId: number,
  stagesInput: ProductionRoutingStageInput[],
) {
  const stages = requiredStageOrder(stagesInput);
  const [variant, bom, items] = await Promise.all([
    tx.productVariant.findUnique({ where: { id: productVariantId }, select: { id: true } }),
    tx.bom.findUnique({
      where: { id: bomId },
      include: {
        items: {
          select: {
            itemId: true,
            subassembly: { select: { itemId: true } },
          },
        },
      },
    }),
    tx.item.findMany({
      where: { id: { in: [...new Set(stages.flatMap((stage) => [stage.inputItemId, stage.outputItemId]))] } },
      select: { id: true, kode: true, nama: true, divisiId: true, jenis: true },
    }),
  ]);
  if (!variant) throw new QualityError("ROUTING_INVALID", "Varian produk tidak ditemukan");
  if (!bom || bom.productVariantId !== productVariantId || bom.subassemblyId !== null || !bomIsEffective(bom)) {
    throw new QualityError("ROUTING_INVALID", "Pilih BOM produk varian yang aktif dan sedang berlaku");
  }
  if (items.length !== new Set(stages.flatMap((stage) => [stage.inputItemId, stage.outputItemId])).size) {
    throw new QualityError("ROUTING_INVALID", "Salah satu Item routing tidak ditemukan");
  }

  const requiredDivisionNames = [...new Set(stages.map((stage) => expectedDivision[stage.stage]))];
  const routingDivisions = await tx.divisi.findMany({
    where: { nama: { in: requiredDivisionNames } },
    select: { id: true, nama: true },
  });
  if (routingDivisions.length !== requiredDivisionNames.length) {
    throw new QualityError("ROUTING_INVALID", "Divisi Buffing, Base Coat, Decal Solid/Motif, dan Top Coat harus tersedia");
  }
  const divisionByName = new Map(routingDivisions.map((division) => [division.nama, division.id]));
  const itemById = new Map(items.map((item) => [item.id, item]));
  for (const [index, stage] of stages.entries()) {
    const divisionId = divisionByName.get(expectedDivision[stage.stage]);
    const inputItem = itemById.get(stage.inputItemId);
    const outputItem = itemById.get(stage.outputItemId);
    if (!divisionId || !inputItem || !outputItem) {
      throw new QualityError("ROUTING_INVALID", "Tahap routing belum memiliki divisi atau Item yang valid");
    }
    if (outputItem.divisiId !== divisionId || outputItem.jenis !== "SM") {
      throw new QualityError("ROUTING_INVALID", `Item hasil ${outputItem.kode} harus berupa SM milik divisi ${expectedDivision[stage.stage]}`);
    }
    if (index === 0 && inputItem.divisiId !== divisionId) {
      throw new QualityError("ROUTING_INVALID", `Item batok mentah ${inputItem.kode} harus tersedia di divisi Buffing`);
    }
    if (index > 0 && stages[index - 1]?.outputItemId !== stage.inputItemId) {
      throw new QualityError("ROUTING_INVALID", "Item input setiap tahap harus sama dengan output tahap sebelumnya");
    }
  }
  const topcoatStage = stages[stages.length - 1];
  const topcoatIncludedInBom = bom.items.some((item) =>
    item.itemId === topcoatStage.outputItemId ||
    item.subassembly?.itemId === topcoatStage.outputItemId,
  );
  if (!topcoatIncludedInBom) {
    throw new QualityError("ROUTING_INVALID", "BOM aktif harus mencantumkan Item hasil Top Coat sebagai komponen atau subassembly");
  }
  return { stages, divisionByName };
}

export async function listProductionRoutings() {
  return prisma.productionRouting.findMany({
    where: { isActive: true },
    include: routingInclude,
    orderBy: [{ productVariant: { kodeVariant: "asc" } }, { version: "desc" }],
  });
}

export async function saveProductionRouting(
  productVariantId: number,
  input: { bomId: number; stages: ProductionRoutingStageInput[] },
) {
  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    const { stages, divisionByName } = await validateRouting(
      tx,
      productVariantId,
      input.bomId,
      input.stages,
    );
    const current = await tx.productionRouting.findFirst({
      where: { productVariantId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const version = (current?.version ?? 0) + 1;
    await tx.productionRouting.updateMany({
      where: { productVariantId, isActive: true },
      data: { isActive: false },
    });
    return tx.productionRouting.create({
      data: {
        productVariantId,
        bomId: input.bomId,
        version,
        stages: {
          create: stages.map((stage, sequence) => ({
            stage: stage.stage,
            sequence,
            divisiId: divisionByName.get(expectedDivision[stage.stage])!,
            inputItemId: stage.inputItemId,
            outputItemId: stage.outputItemId,
          })),
        },
      },
      include: routingInclude,
    });
  });
}

export async function getActiveRoutingForOutput(
  tx: PrismaTransactionClient,
  productVariantId: number,
  outputItemId: number,
) {
  const routings = await tx.productionRouting.findMany({
    where: {
      productVariantId,
      isActive: true,
      bom: { isActive: true },
      stages: { some: { stage: "TOP_COAT", outputItemId } },
    },
    include: {
      bom: { select: { isActive: true, berlakuMulai: true, berlakuSelesai: true } },
      stages: { orderBy: { sequence: "asc" } },
    },
  });
  return routings.find((routing) => bomIsEffective(routing.bom)) ?? null;
}

export async function getRoutingStage(
  tx: PrismaTransactionClient,
  routingId: number,
  stage: ProductionStage,
) {
  return tx.productionRoutingStage.findUnique({
    where: { routingId_stage: { routingId, stage } },
  });
}
