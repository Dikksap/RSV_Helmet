import prisma from "../src/lib/prisma.js";
import {
  createHasilProduksi,
  type HasilProduksiItemInput,
} from "../src/model/hasilProduksiHarian/hasilProduksiHarian.js";
import {
  approveWipTransfer,
  createWipTransfer,
} from "../src/model/wipTransfer/wipTransfer.js";
import {
  ArahWipTransfer,
  StatusWipTransfer,
  TipeHasilProduksiItem,
} from "../generated/prisma/enums.js";

const sampleRoutes = [
  { style: "Motif", color: "BOB", baseCoat: "SM0026", decal: "SM0032", topCoat: "SM0001" },
  { style: "Motif", color: "Carbon", baseCoat: "SM0026", decal: "SM0033", topCoat: "SM0002" },
  { style: "Motif", color: "Nation", baseCoat: "SM0027", decal: "SM0034", topCoat: "SM0003" },
  { style: "Motif", color: "Redline", baseCoat: "SM0028", decal: "SM0035", topCoat: "SM0004" },
  { style: "Solid", color: "Black Doff", baseCoat: "SM0026", decal: "SM0029", topCoat: "SM0005" },
  { style: "Solid", color: "Black Glossy", baseCoat: "SM0026", decal: "SM0029", topCoat: "SM0006" },
  { style: "Solid", color: "Platinum Grey", baseCoat: "SM0028", decal: "SM0031", topCoat: "SM0007" },
  { style: "Solid", color: "White Glossy", baseCoat: "SM0027", decal: "SM0030", topCoat: "SM0008" },
] as const;

const seedPrefix = "SEED-WIP-OCT-2026";
const productionDate = new Date("2026-10-25T00:00:00.000Z");

function requiredId(id: number | undefined, label: string) {
  if (id === undefined) throw new Error(`${label} tidak ditemukan saat seeding alur produksi`);
  return id;
}

async function loadItems(codes: string[]) {
  const rows = await prisma.item.findMany({
    where: { kode: { in: codes } },
    select: { id: true, kode: true, nama: true, unit: true },
  });
  const byCode = new Map(rows.map((row) => [row.kode, row]));
  const missing = codes.filter((code) => !byCode.has(code));
  if (missing.length > 0) {
    throw new Error(`Item proses belum di-seed: ${missing.join(", ")}`);
  }
  return byCode;
}

async function configureProductionRoutings(
  variantByStyleColor: Map<string, Array<{ id: number }>>,
  itemIds: Map<string, number>,
  divisionIds: Map<string, number>,
) {
  for (const definition of sampleRoutes) {
    const variants = variantByStyleColor.get(`${definition.style}:${definition.color}`) ?? [];
    if (variants.length === 0) {
      throw new Error(`Varian ${definition.style} ${definition.color} belum tersedia`);
    }
    const stages = [
      {
        stage: "BUFFING" as const,
        divisiId: requiredId(divisionIds.get("Buffing"), "Divisi Buffing"),
        inputItemId: requiredId(itemIds.get("RAW020"), "Item RAW020"),
        outputItemId: requiredId(itemIds.get("SM0025"), "Item SM0025"),
      },
      {
        stage: "BASE_COAT" as const,
        divisiId: requiredId(divisionIds.get("Base Coat"), "Divisi Base Coat"),
        inputItemId: requiredId(itemIds.get("SM0025"), "Item SM0025"),
        outputItemId: requiredId(itemIds.get(definition.baseCoat), `Item ${definition.baseCoat}`),
      },
      {
        stage: definition.style === "Solid" ? "DECAL_SOLID" as const : "DECAL_MOTIF" as const,
        divisiId: requiredId(
          divisionIds.get(definition.style === "Solid" ? "Decal Solid" : "Decal Motif"),
          `Divisi Decal ${definition.style}`,
        ),
        inputItemId: requiredId(itemIds.get(definition.baseCoat), `Item ${definition.baseCoat}`),
        outputItemId: requiredId(itemIds.get(definition.decal), `Item ${definition.decal}`),
      },
      {
        stage: "TOP_COAT" as const,
        divisiId: requiredId(divisionIds.get("Top Coat"), "Divisi Top Coat"),
        inputItemId: requiredId(itemIds.get(definition.decal), `Item ${definition.decal}`),
        outputItemId: requiredId(itemIds.get(definition.topCoat), `Item ${definition.topCoat}`),
      },
    ];

    for (const variant of variants) {
      const bomCode = `${seedPrefix}-BOM-${variant.id}`;
      const bom = await prisma.bom.upsert({
        where: { kode: bomCode },
        update: {
          nama: `BOM seed ${definition.style} ${definition.color}`,
          version: "1",
          isActive: true,
          berlakuMulai: null,
          berlakuSelesai: null,
          productVariantId: variant.id,
          subassemblyId: null,
        },
        create: {
          kode: bomCode,
          nama: `BOM seed ${definition.style} ${definition.color}`,
          version: "1",
          isActive: true,
          productVariantId: variant.id,
        },
        select: { id: true },
      });
      await prisma.bomItem.deleteMany({ where: { bomId: bom.id } });
      await prisma.bomItem.create({
        data: {
          bomId: bom.id,
          itemId: stages[3].outputItemId,
          quantity: 1,
          unit: "Pcs",
        },
      });

      await prisma.productionRouting.updateMany({
        where: { productVariantId: variant.id, isActive: true, version: { not: 1 } },
        data: { isActive: false },
      });
      await prisma.productionRouting.upsert({
        where: { productVariantId_version: { productVariantId: variant.id, version: 1 } },
        update: {
          bomId: bom.id,
          isActive: true,
          stages: {
            deleteMany: {},
            create: stages.map(({ stage, divisiId, inputItemId, outputItemId }, sequence) => ({
              stage,
              sequence,
              divisiId,
              inputItemId,
              outputItemId,
            })),
          },
        },
        create: {
          productVariantId: variant.id,
          bomId: bom.id,
          version: 1,
          isActive: true,
          stages: {
            create: stages.map(({ stage, divisiId, inputItemId, outputItemId }, sequence) => ({
              stage,
              sequence,
              divisiId,
              inputItemId,
              outputItemId,
            })),
          },
        },
      });
    }
  }
}

async function transfer(
  itemCode: string,
  quantity: number,
  sourceDivisionId: number,
  targetDivisionId: number,
  itemIdByCode: Map<string, number>,
  step: string,
) {
  const itemId = requiredId(itemIdByCode.get(itemCode), `Item ${itemCode}`);
  const access = { userId: 1, admin: true, divisiId: null };
  const draft = await createWipTransfer(
    {
      tanggal: productionDate,
      arah: ArahWipTransfer.KIRIM,
      divisiAsalId: sourceDivisionId,
      divisiTujuanId: targetDivisionId,
      keterangan: `${seedPrefix} ${step}`,
      items: [{ itemId, jumlah: quantity }],
    },
    access,
  );
  await approveWipTransfer(
    draft.id,
    {
      status: StatusWipTransfer.DISETUJUI,
      items: draft.items.map((item) => ({ id: item.id, jumlahDisetujui: quantity })),
    },
    access,
  );
}

async function produce(
  number: string,
  divisionId: number,
  inputCode: string,
  inputQuantity: number,
  outputs: Array<{ code: string; quantity: number }>,
  itemByCode: Map<string, { id: number }>,
) {
  const input = itemByCode.get(inputCode);
  if (!input) throw new Error(`Item input ${inputCode} tidak ditemukan`);
  const items: HasilProduksiItemInput[] = [
    {
      itemId: input.id,
      tipe: TipeHasilProduksiItem.MASUK,
      jumlah: inputQuantity,
      keterangan: `Input ${inputCode}`,
    },
    ...outputs.map(({ code, quantity }) => {
      const output = itemByCode.get(code);
      if (!output) throw new Error(`Item hasil ${code} tidak ditemukan`);
      return {
        itemId: output.id,
        tipe: TipeHasilProduksiItem.HASIL,
        jumlah: quantity,
        keterangan: `Hasil ${code}`,
      };
    }),
  ];
  await createHasilProduksi(
    {
      nomor: `${seedPrefix}-${number}`,
      tanggalProduksi: productionDate,
      divisiId: divisionId,
      keterangan: `Seed alur WIP ${number}`,
      items,
    },
    1,
  );
}

export async function seedProductionFlow() {
  const allCodes = [
    "RAW020",
    "SM0001", "SM0002", "SM0003", "SM0004", "SM0005", "SM0006", "SM0007", "SM0008",
    "SM0025", "SM0026", "SM0027", "SM0028", "SM0029", "SM0030", "SM0031", "SM0032", "SM0033", "SM0034", "SM0035",
  ];
  const seedAlreadyPresent = await prisma.hasilProduksiHarian.findUnique({
    where: { nomor: `${seedPrefix}-BUFFING` },
    select: { id: true },
  });
  if (seedAlreadyPresent) {
    console.log("~ Seed alur WIP sudah ada, lewati.");
    return;
  }

  const [itemRows, divisionRows, variantRows] = await Promise.all([
    loadItems(allCodes),
    prisma.divisi.findMany({
      where: { nama: { in: ["Buffing", "Base Coat", "Decal Solid", "Decal Motif", "Top Coat"] } },
      select: { id: true, nama: true },
    }),
    prisma.productVariant.findMany({
      include: { style: { select: { nama: true } }, color: { select: { nama: true } } },
    }),
  ]);
  const itemIdByCode = new Map([...itemRows].map(([code, item]) => [code, item.id]));
  const divisionIdByName = new Map(divisionRows.map((division) => [division.nama, division.id]));
  const variantsByStyleColor = new Map<string, Array<{ id: number }>>();
  for (const variant of variantRows) {
    const key = `${variant.style.nama}:${variant.color.nama}`;
    variantsByStyleColor.set(key, [...(variantsByStyleColor.get(key) ?? []), { id: variant.id }]);
  }
  await configureProductionRoutings(variantsByStyleColor, itemIdByCode, divisionIdByName);

  const divisionId = (name: string) => requiredId(divisionIdByName.get(name), `Divisi ${name}`);
  const itemByCode = new Map([...itemRows].map(([code, item]) => [code, item]));
  const existingLot = await prisma.pemakaianMaterialItem.findFirst({
    where: {
      itemId: itemIdByCode.get("RAW020"),
      jumlahSisa: { gte: 8 },
      pemakaian: { divisiId: divisionId("Buffing") },
    },
    select: { id: true },
  });
  if (!existingLot) {
    throw new Error("Saldo bahan baku RAW020 di Buffing kurang dari 8 pcs untuk seed produksi");
  }

  await produce("BUFFING", divisionId("Buffing"), "RAW020", 8, [{ code: "SM0025", quantity: 8 }], itemByCode);
  await transfer("SM0025", 8, divisionId("Buffing"), divisionId("Base Coat"), itemIdByCode, "BUFFING-BASECOAT");
  await produce("BASECOAT", divisionId("Base Coat"), "SM0025", 8, [
    { code: "SM0026", quantity: 4 },
    { code: "SM0027", quantity: 2 },
    { code: "SM0028", quantity: 2 },
  ], itemByCode);

  const motifInputs = new Map([
    ["SM0026", { quantity: 2, outputs: [{ code: "SM0032", quantity: 1 }, { code: "SM0033", quantity: 1 }] }],
    ["SM0027", { quantity: 1, outputs: [{ code: "SM0034", quantity: 1 }] }],
    ["SM0028", { quantity: 1, outputs: [{ code: "SM0035", quantity: 1 }] }],
  ]);
  for (const [baseCoatCode, quantity] of [["SM0026", 2], ["SM0027", 1], ["SM0028", 1]] as const) {
    await transfer(baseCoatCode, quantity, divisionId("Base Coat"), divisionId("Decal Solid"), itemIdByCode, `BASECOAT-${baseCoatCode}-SOLID`);
  }
  for (const [baseCoatCode, data] of motifInputs) {
    await transfer(baseCoatCode, data.quantity, divisionId("Base Coat"), divisionId("Decal Motif"), itemIdByCode, `BASECOAT-${baseCoatCode}-MOTIF`);
  }

  const decalProduction = [
    { division: "Decal Solid", input: "SM0026", output: "SM0029", quantity: 2, number: "DECAL-SOLID-BLACK" },
    { division: "Decal Solid", input: "SM0027", output: "SM0030", quantity: 1, number: "DECAL-SOLID-WHITE" },
    { division: "Decal Solid", input: "SM0028", output: "SM0031", quantity: 1, number: "DECAL-SOLID-PLATINUM" },
    ...[...motifInputs].map(([input, data], index) => ({
      division: "Decal Motif",
      input,
      output: "",
      quantity: data.quantity,
      number: `DECAL-MOTIF-${input}`,
      outputs: data.outputs,
    })),
  ];
  const topCoatInputQuantity = new Map<string, number>();
  for (const row of decalProduction) {
    const outputs = "outputs" in row
      ? row.outputs
      : [{ code: row.output, quantity: row.quantity }];
    await produce(row.number, divisionId(row.division), row.input, row.quantity, outputs, itemByCode);
    for (const output of outputs) {
      topCoatInputQuantity.set(output.code, (topCoatInputQuantity.get(output.code) ?? 0) + output.quantity);
    }
  }

  for (const definition of sampleRoutes) {
    await transfer(definition.decal, 1, divisionId(
      definition.style === "Solid" ? "Decal Solid" : "Decal Motif",
    ), divisionId("Top Coat"), itemIdByCode, `DECAL-${definition.decal}-TOPCOAT-${definition.topCoat}`);
  }
  for (const definition of sampleRoutes) {
    const inputQuantity = topCoatInputQuantity.get(definition.decal);
    const expectedQuantity = sampleRoutes.filter((route) => route.decal === definition.decal).length;
    if (inputQuantity !== expectedQuantity) {
      throw new Error(`Seed tidak menghasilkan WIP decal ${definition.decal}`);
    }
    await produce(
      `TOPCOAT-${definition.topCoat}`,
      divisionId("Top Coat"),
      definition.decal,
      1,
      [{ code: definition.topCoat, quantity: 1 }],
      itemByCode,
    );
  }

  console.log("✓ Seed produksi WIP: Buffing → Base Coat → Decal → Top Coat (8 varian)");
}
