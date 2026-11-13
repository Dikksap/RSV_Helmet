import prisma from "../src/lib/prisma.js";
import { createHasilProduksi } from "../src/model/hasilProduksiHarian/hasilProduksiHarian.js";
import { updateBarangStatus } from "../src/model/barang/barang.status.js";
import { getFinishedGoodsSummary } from "../src/model/reports/reports.js";

async function main() {
  console.log("=== TEST E2E PERAKITAN & QC ===");

  // Find Perakitan stage
  const perakitanStage = await prisma.productionRoutingStage.findFirst({
    where: { divisiId: 6 },
    include: { routing: true, inputItems: true, outputItems: true },
  });

  if (!perakitanStage) {
    throw new Error("Perakitan stage not found!");
  }

  console.log(`Perakitan Stage: ID=${perakitanStage.id}, sequence=${perakitanStage.sequence}`);
  console.log(`Inputs: ${perakitanStage.inputItems.length}, Outputs: ${perakitanStage.outputItems.length}`);

  // Find a product variant
  const variant = await prisma.productVariant.findFirst({
    include: { product: true, color: true, size: true },
  });
  if (!variant) throw new Error("No active ProductVariant found!");

  // Find an admin user
  const user = await prisma.user.findFirst();
  if (!user) throw new Error("No user found!");

  // Ensure Perakitan (divisi 6) has WIP stock for inputItemId
  const inputItemId = perakitanStage.inputItems[0]?.itemId ?? 25;
  const pm = await prisma.pemakaianMaterial.create({
    data: {
      nomor: `SEED-WIP-${Date.now()}`,
      divisiId: 6,
      tanggal: new Date(),
      userId: user.id,
      items: {
        create: [
          {
            itemId: inputItemId,
            jumlahDiterima: 10,
            jumlahDipakai: 0,
            jumlahSisa: 10,
            satuan: "Pcs",
          },
        ],
      },
    },
    include: { items: true },
  });
  console.log(`✓ Seeded WIP via PemakaianMaterial ID=${pm.id} for Divisi 6, Item ${inputItemId}`);

  // Seed inventory location & StockBalance for Perakitan
  const location = await prisma.inventoryLocation.upsert({
    where: { divisiId: 6 },
    update: {},
    create: {
      code: "DIV-6",
      name: "Perakitan",
      type: "DIVISION",
      divisiId: 6,
    },
  });

  // Make sure ALL WIP items for divisi 6 and inputItemId have stock balance
  const allWipItems = await prisma.pemakaianMaterialItem.findMany({
    where: {
      itemId: inputItemId,
      pemakaian: { divisiId: 6 },
      jumlahSisa: { gt: 0 },
    },
  });
  for (const wip of allWipItems) {
    const key = `I:${inputItemId}:0:${wip.id}:${location.id}`;
    await prisma.stockBalance.upsert({
      where: { balanceKey: key },
      update: { quantity: 10 },
      create: {
        balanceKey: key,
        itemId: inputItemId,
        pemakaianMaterialItemId: wip.id,
        locationId: location.id,
        quantity: 10,
      },
    });
  }
  console.log(`✓ Seeded StockBalance for all active WIP items at location ${location.id}`);

  // 1. Submit Hasil Produksi for Perakitan (Divisi 6)
  const testDocNo = `TEST-PKT-${Date.now()}`;

  const result = await createHasilProduksi({
    tanggalProduksi: new Date(),
    divisiId: 6,
    routingStageId: perakitanStage.id,
    shift: 1,
    keterangan: "E2E Test Perakitan Output Variant",
    nomor: testDocNo,
    items: [
      {
        tipe: "MASUK",
        itemId: inputItemId,
        jumlah: 2,
        keterangan: "Penerimaan batok top coat",
      },
      {
        tipe: "HASIL",
        productVariantId: variant.id,
        // Notice itemId is omitted/null!
        jumlah: 2,
        keterangan: "Hasil perakitan helm jadi",
      },
    ],
  });

  console.log(`✓ Hasil Produksi Perakitan created: ID=${result.id}, No=${result.nomor}`);
  console.log(`  Items count: ${result.items.length}`);

  const hasilItem = result.items.find((i) => i.tipe === "HASIL");
  if (!hasilItem) throw new Error("No HASIL item found in result!");

  const generatedBarang = await prisma.barang.findMany({
    where: { hasilProduksiHarianItemId: hasilItem.id },
  });

  console.log(`  Barang generated: ${generatedBarang.length}`);
  if (generatedBarang.length !== 2) {
    throw new Error(`Expected 2 barang generated, got ${generatedBarang.length}`);
  }

  const sampleBarang = generatedBarang[0];
  console.log(`  Sample Barang: ID=${sampleBarang.id}, Kode=${sampleBarang.kodeBarang}, Status=${sampleBarang.status}`);

  // 2. QC Stage Checkpoint: Scan QR code to FINISHGOOD
  console.log("\n=== TEST QC SCAN CHECKPOINT ===");
  const scanResult = await updateBarangStatus(
    sampleBarang.id,
    "FINISHGOOD",
    "Passed Final QC",
    { userId: user.id },
  );

  console.log(`✓ QC Scan updated status to: ${scanResult.status}, finishGoodAt=${scanResult.finishGoodAt}`);

  // 3. Check Finished Goods Summary Report
  console.log("\n=== TEST FINISHED GOODS REPORT ===");
  const fgSummary = await getFinishedGoodsSummary({
    from: new Date(Date.now() - 24 * 3600 * 1000),
    to: new Date(Date.now() + 24 * 3600 * 1000),
  });

  console.log(`✓ FG Summary: productionOutput=${fgSummary.totals.productionOutput}, fgFirstCount=${fgSummary.totals.fgFirstCount}`);
  const variantRow = fgSummary.perVariant.find((v) => v.variantId === variant.id);
  console.log(`  Variant ${variant.kodeVariant}: outputQty=${variantRow?.outputQty}, fgFirstCount=${variantRow?.fgFirstCount}`);

  console.log("\n=== ALL E2E PERAKITAN & QC TESTS PASSED SUCCESSFULLY! ===");
}

main()
  .catch((e) => {
    console.error("Test failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
