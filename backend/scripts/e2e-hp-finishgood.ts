import prisma from "../src/lib/prisma.js";
import { createHasilProduksi } from "../src/model/hasilProduksiHarian/hasilProduksiHarian.js";
import { createWipTransfer, approveWipTransfer } from "../src/model/wipTransfer/wipTransfer.js";
import { updateBarangStatus } from "../src/model/barang/barang.status.js";
import { getTraceability } from "../src/model/reports/reports.js";

const TANGGAL = new Date("2026-11-09T09:00:00+07:00");
const access = { userId: 1, admin: true, divisiId: null };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

async function itemId(kode: string) {
  const item = await prisma.item.findUnique({ where: { kode }, select: { id: true } });
  assert(item, `item ${kode} tidak ada`);
  return item.id;
}

async function lotSisa(headerItemId: number) {
  const lot = await prisma.pemakaianMaterialItem.findUnique({
    where: { hasilProduksiHarianItemId: headerItemId },
    select: { id: true, jumlahSisa: true, jumlahDipakai: true },
  });
  return lot ? { id: lot.id, sisa: Number(lot.jumlahSisa), dipakai: Number(lot.jumlahDipakai) } : null;
}

try {
  const sm0026 = await itemId("SM0026");
  const sm0029 = await itemId("SM0029");
  const sm0005 = await itemId("SM0005");

  // ---------- Test A: tahap non-terakhir (Decal Solid), idempoten ----------
  const payloadA = {
    nomor: "E2E-HP-DECAL-1",
    divisiId: 3,
    tanggalProduksi: TANGGAL,
    idempotencyKey: "e2e-hp-decal-1",
    keterangan: "E2E test decal (harian)",
    items: [
      { itemId: sm0026, tipe: "MASUK" as const, jumlah: 1 },
      { itemId: sm0029, tipe: "HASIL" as const, jumlah: 1 },
    ],
  };
  const hpA = await createHasilProduksi(payloadA, 1);
  const hpARepeat = await createHasilProduksi(payloadA, 1);
  assert(hpA.id === hpARepeat.id, "idempotency: dokumen kedua harus sama");

  const hasilA = hpA.items.find((row) => row.tipe === "HASIL");
  assert(hasilA, "baris HASIL tidak ada");
  const lotA = await lotSisa(hasilA.id);
  const moveA = await prisma.inventoryMovement.findMany({
    where: { hasilProduksiHarianId: hpA.id },
    select: { type: true, fromLocationId: true, toLocationId: true, quantity: true, sourceType: true },
  });
  console.log("[A] HP", { id: hpA.id, nomor: hpA.nomor, routingStageId: hpA.routingStageId, bomId: hpA.bomId });
  console.log("[A] lot output", lotA);
  console.log("[A] movements", moveA.map((m) => `${m.sourceType}:${m.type}:${Number(m.quantity)}:${m.fromLocationId ?? "-"}->${m.toLocationId ?? "-"}`));
  assert(moveA.length === 2, "harus ada 2 movement (konsumsi + output)");
  assert(lotA, "lot output harus ada");
  assert(
    lotA.sisa + lotA.dipakai === 1,
    "lot output non-varian harus berjumlah 1 (sisa+bekas pakai; bisa 0 bila sudah ditransfer)",
  );

  // ---------- Transfer WIP Decal Solid -> Top Coat (hanya bila saldo tujuan belum ada) ----------
  const topCoatLocation = await prisma.inventoryLocation.findUnique({
    where: { divisiId: 5 },
    select: { id: true },
  });
  assert(topCoatLocation, "lokasi divisi Top Coat tidak ada");
  const saldoTujuan = await prisma.stockBalance.aggregate({
    where: { itemId: sm0029, locationId: topCoatLocation.id },
    _sum: { quantity: true },
  });
  const decalLocation = await prisma.inventoryLocation.findUnique({
    where: { divisiId: 3 },
    select: { id: true },
  });
  assert(decalLocation, "lokasi divisi Decal Solid tidak ada");
  const saldoAsal = await prisma.stockBalance.aggregate({
    where: { itemId: sm0029, locationId: decalLocation.id },
    _sum: { quantity: true },
  });
  if (Number(saldoTujuan._sum.quantity ?? 0) < 1 && Number(saldoAsal._sum.quantity ?? 0) < 1) {
    const suffix = Date.now();
    await createHasilProduksi(
      {
        nomor: `E2E-HP-DECAL-2-${suffix}`,
        divisiId: 3,
        tanggalProduksi: TANGGAL,
        idempotencyKey: `e2e-hp-decal-2-${suffix}`,
        keterangan: "E2E test decal tambahan (harian)",
        items: [
          { itemId: sm0026, tipe: "MASUK", jumlah: 1 },
          { itemId: sm0029, tipe: "HASIL", jumlah: 1 },
        ],
      },
      1,
    );
    console.log("[A2] produksi decal tambahan dibuat");
  }
  if (Number(saldoTujuan._sum.quantity ?? 0) < 1) {
    const draft = await createWipTransfer(
      {
        tanggal: TANGGAL,
        divisiAsalId: 3,
        divisiTujuanId: 5,
        keterangan: "E2E test transfer decal ke top coat",
        items: [{ itemId: sm0029, jumlah: 1 }],
      },
      access,
    );
    await approveWipTransfer(
      draft.id,
      { status: "DISETUJUI", items: draft.items.map((row) => ({ id: row.id, jumlahDisetujui: 1 })) },
      access,
    );
    console.log("[T] transfer", { id: draft.id, nomor: draft.nomor });
  } else {
    console.log("[T] transfer dilewati (saldo Top Coat sudah tersedia)");
  }

  // ---------- Test B: tahap terakhir, output ProductVariant -> unit Barang ----------
  const variant = await prisma.productVariant.findFirst({
    where: { style: { nama: "Solid" }, color: { nama: "Black Doff" } },
    orderBy: { id: "asc" },
    select: { id: true, kodeVariant: true },
  });
  assert(variant, "variant Solid/Black Doff tidak ada");
  const bom = await prisma.bom.findFirst({
    where: { productVariantId: variant.id, isActive: true },
    select: { id: true, version: true },
  });
  assert(bom, "BOM variant tidak ada");

  const payloadB = {
    nomor: "E2E-HP-TOPCOAT-1",
    divisiId: 5,
    tanggalProduksi: TANGGAL,
    idempotencyKey: "e2e-hp-topcoat-1",
    keterangan: "E2E test top coat varian (harian)",
    items: [
      { itemId: sm0029, tipe: "MASUK" as const, jumlah: 1 },
      { itemId: sm0005, tipe: "HASIL" as const, jumlah: 1, productVariantId: variant.id },
    ],
  };
  const hpB = await createHasilProduksi(payloadB, 1);
  const hasilB = hpB.items.find((row) => row.tipe === "HASIL");
  assert(hasilB, "baris HASIL B tidak ada");
  const lotB = await lotSisa(hasilB.id);
  const barang = await prisma.barang.findMany({
    where: { hasilProduksiHarianItemId: hasilB.id },
    select: { id: true, kodeBarang: true, status: true, finishGoodAt: true, variantId: true },
  });
  console.log("[B] HP", { id: hpB.id, nomor: hpB.nomor, routingStageId: hpB.routingStageId, bomId: hpB.bomId });
  console.log("[B] lot output", lotB);
  console.log("[B] unit", barang);
  assert(hpB.bomId === bom.id, "header harus menyimpan bomId yang dipakai");
  assert(lotB?.sisa === 0 && lotB.dipakai === 1, "lot output varian harus habis dikonversi");
  assert(barang.length === 1, "harus membuat tepat 1 unit Barang");
  assert(barang[0].variantId === variant.id, "unit harus memakai variant yang diminta");
  if (barang[0].finishGoodAt === null) {
    assert(barang[0].status === "REGISTER", "unit baru harus REGISTER sebelum scan");
  } else {
    console.log("[B] unit sudah FINISHGOOD dari eksekusi sebelumnya (idempoten)");
  }

  // ---------- Scan FINISHGOOD + idempotensi ----------
  const unitId = barang[0].id;
  const fg1 = await updateBarangStatus(unitId, "FINISHGOOD", "E2E scan QC", { userId: 1 });
  const fg2 = await updateBarangStatus(unitId, "FINISHGOOD", "E2E scan QC ulang", { userId: 1 });
  const history = await prisma.riwayatBarang.findMany({
    where: { barangId: unitId },
    select: { status: true, keterangan: true },
  });
  console.log("[F] fg1", { status: fg1.status, finishGoodAt: fg1.finishGoodAt, already: (fg1 as { alreadyFinishGood?: boolean }).alreadyFinishGood ?? false });
  console.log("[F] fg2", { already: (fg2 as { alreadyFinishGood?: boolean }).alreadyFinishGood ?? false, finishGoodAt: fg2.finishGoodAt });
  console.log("[F] history", history);
  assert(fg1.finishGoodAt !== null, "finishGoodAt harus terisi");
  assert((fg2 as { alreadyFinishGood?: boolean }).alreadyFinishGood === true, "scan kedua harus idempoten");
  assert(
    fg1.finishGoodAt?.getTime() === fg2.finishGoodAt?.getTime(),
    "finishGoodAt tidak boleh berubah",
  );
  assert(
    history.filter((row) => row.status === "FINISHGOOD").length === 1,
    "histori FINISHGOOD tidak boleh ganda",
  );

  // ---------- Traceability unit -> lot -> material ----------
  const trace = await getTraceability({
    from: new Date("2026-11-09T00:00:00+07:00"),
    to: new Date("2026-11-09T00:00:00+07:00"),
    barangId: unitId,
  });
  const row = trace.rows[0];
  console.log("[R] trace", {
    kode: row?.kodeBarang,
    flags: row?.flags,
    production: row?.production?.nomor ?? null,
    bomVersion: row?.production?.bomVersion ?? null,
    stage: row?.production?.stage?.stage ?? null,
    materials: row?.materialsPerUnit?.map((m) => `${m.kode} x${m.quantity}`).slice(0, 6) ?? [],
  });
  assert(row && row.flags.length === 0, "unit baru tidak boleh LEGACY_UNLINKED");
  assert((row.materialsPerUnit?.length ?? 0) > 0, "traceability harus menemukan material");
  assert(row.production?.nomor === "E2E-HP-TOPCOAT-1", "traceability harus menunjuk dokumen HP yang benar");

  console.log("E2E_OK");
} catch (error) {
  console.error("E2E_FAIL", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

