import prisma from "../src/lib/prisma.js";

async function main() {
  const perakitanDivisi = await prisma.divisi.findFirst({
    where: { nama: { contains: "Perakitan" } },
    select: { id: true, nama: true },
  });
  if (!perakitanDivisi) throw new Error("Divisi Perakitan tidak ditemukan");

  const routings = await prisma.productionRouting.findMany({
    where: { isActive: true },
    include: {
      stages: {
        orderBy: { sequence: "asc" },
        include: { outputItems: true },
      },
    },
  });

  for (const routing of routings) {
    const existingPerakitan = routing.stages.find((s) => s.stage === "PERAKITAN");
    if (existingPerakitan) {
      console.log(`Routing ${routing.id} sudah punya stage PERAKITAN.`);
      continue;
    }
    const lastStage = routing.stages[routing.stages.length - 1];
    if (!lastStage) continue;
    const topCoatOutputs = lastStage.outputItems.map((o) => o.itemId);
    const newSequence = lastStage.sequence + 1;

    const newStage = await prisma.productionRoutingStage.create({
      data: {
        routingId: routing.id,
        stage: "PERAKITAN",
        sequence: newSequence,
        divisiId: perakitanDivisi.id,
        inputItems: {
          create: topCoatOutputs.map((itemId) => ({ itemId })),
        },
      },
    });
    console.log(`Routing ${routing.id} ditambah stage PERAKITAN (id: ${newStage.id}, sequence: ${newSequence}, inputs: ${topCoatOutputs.join(",")}).`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

