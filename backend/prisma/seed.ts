import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import sharedPrisma from "../src/lib/prisma.js";
import { seedItem } from "./seed-item.js";
import { seedProductionFlow } from "./seed-production-flow.js";

const adapter = new PrismaMariaDb({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "rootpassword",
  database: process.env.DB_NAME || "express_api",
  connectionLimit: 5,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // ── Users ─────────────────────────────────────────────────────────────
  const users = [
    { name: "Admin",        email: "admin@example.com",    password: "admin123",    role: "admin" },
    { name: "Budi Santoso", email: "budi@example.com",     password: "budi123",     role: "user" },
    { name: "Siti Rahayu",  email: "siti@example.com",     password: "siti123",     role: "user" },
    { name: "Petugas Gudang", email: "gudang@example.com", password: "gudang123",   role: "gudang" },
    { name: "Operator Produksi", email: "produksi@example.com", password: "produksi123", role: "produksi" },
    { name: "Petugas QC",   email: "qc@example.com",       password: "qc123",       role: "qc" },
    { name: "Supervisor Inventory", email: "supervisor@example.com", password: "supervisor123", role: "supervisor" },
  ];

  await prisma.role.upsert({
    where: { kode: "supervisor" },
    update: { nama: "Supervisor" },
    create: { kode: "supervisor", nama: "Supervisor" },
  });

  for (const user of users) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    await prisma.user.upsert({
      where: { email: user.email },
      update: { role: user.role },
      create: { name: user.name, email: user.email, password: hashedPassword, role: user.role },
    });
    console.log(`✓ User "${user.name}" (${user.email})`);
  }

  // ── StatusBarang (master dinamis) ──────────────────────────────────────
  const statusSeed = [
    { kode: "REGISTER", nama: "Register", warna: "#6B7280", urutan: 1 },
    { kode: "FINISHGOOD", nama: "Finish Good", warna: "#10B981", urutan: 2 },
    { kode: "RETUR", nama: "Retur", warna: "#F59E0B", urutan: 3 },
    { kode: "OUT", nama: "Keluar", warna: "#3B82F6", urutan: 4 },
    { kode: "BAD", nama: "Bad", warna: "#EF4444", urutan: 5 },
  ];
  for (const s of statusSeed) {
    await prisma.statusBarang.upsert({
      where: { kode: s.kode },
      update: { nama: s.nama, warna: s.warna, urutan: s.urutan },
      create: s,
    });
  }
  console.log(`✓ ${statusSeed.length} StatusBarang selesai`);

  // ── RBAC: grant permission + matriks visibilitas status barang ─────────
  // Role dan permission master dibuat oleh migration add_rbac_role_permission.
  // Role "admin" sengaja tanpa baris: ia melewati matriks dan selalu punya
  // seluruh permission (lihat model/role/role.ts).
  const permissionGrants: Record<string, string[]> = {
    user: [
      "BARANG_LIHAT",
      "BARANG_STATISTIK_LIHAT",
      "BARANG_SCAN",
      "BARANG_UBAH_STATUS",
      "BARANG_GENERATE",
      "BARANG_KELOLA",
      "MUTASI_GUDANG",
      "KELOLA_ITEM",
      "BOM_KELOLA",
    ],
    produksi: [
      "BARANG_LIHAT",
      "BARANG_STATISTIK_LIHAT",
      "BARANG_SCAN",
      "BARANG_UBAH_STATUS",
      "BARANG_GENERATE",
      "BOM_KELOLA",
      "REPAIR_WORK",
    ],
    qc: [
      "BARANG_LIHAT",
      "BARANG_STATISTIK_LIHAT",
      "BARANG_SCAN",
      "BARANG_UBAH_STATUS",
      "QUALITY_VIEW",
      "QUALITY_INSPECT",
      "QUALITY_FINALIZE",
      "QUALITY_REOPEN",
      "REPAIR_ASSIGN",
    ],
    gudang: [
      "BARANG_LIHAT",
      "MUTASI_GUDANG",
      "KELOLA_ITEM",
      "BOM_KELOLA",
      "INVENTORY_VIEW",
      "INVENTORY_MOVE",
      "INVENTORY_ADJUST",
    ],
    supervisor: ["INVENTORY_VIEW", "INVENTORY_ADJUST_APPROVE"],
  };

  const allStatus = statusSeed.map((s) => s.kode);
  const lihatSemua = Object.fromEntries(allStatus.map((k) => [k, true]));
  const statusViewGrants: Record<string, Record<string, boolean>> = {
    user: lihatSemua,
    produksi: lihatSemua,
    qc: lihatSemua,
    // Gudang hanya boleh melihat barang jadi dan retur.
    gudang: { REGISTER: false, FINISHGOOD: true, RETUR: true, OUT: false, BAD: false },
  };

  await prisma.permission.upsert({
    where: { kode: "KELOLA_ITEM" },
    update: { nama: "Kelola (tambah/ubah/hapus) item", kelompok: "ITEM" },
    create: { kode: "KELOLA_ITEM", nama: "Kelola (tambah/ubah/hapus) item", kelompok: "ITEM" },
  });
  await prisma.permission.upsert({
    where: { kode: "BOM_KELOLA" },
    update: { nama: "Kelola Bill of Materials dan subassembly", kelompok: "BOM" },
    create: { kode: "BOM_KELOLA", nama: "Kelola Bill of Materials dan subassembly", kelompok: "BOM" },
  });
  for (const permission of [
    { kode: "INVENTORY_VIEW", nama: "Lihat saldo dan mutasi inventory", kelompok: "INVENTORY" },
    { kode: "INVENTORY_MOVE", nama: "Memindahkan stok antar lokasi", kelompok: "INVENTORY" },
    { kode: "INVENTORY_ADJUST", nama: "Mencatat saldo awal dan penyesuaian inventory", kelompok: "INVENTORY" },
    { kode: "INVENTORY_ADJUST_APPROVE", nama: "Menyetujui atau menolak adjustment inventory", kelompok: "INVENTORY" },
    { kode: "INVENTORY_LOCATION_MANAGE", nama: "Memetakan master ke lokasi inventory", kelompok: "INVENTORY" },
    { kode: "QUALITY_VIEW", nama: "Melihat inspeksi QC", kelompok: "QUALITY" },
    { kode: "QUALITY_INSPECT", nama: "Mencatat hasil inspeksi QC", kelompok: "QUALITY" },
    { kode: "QUALITY_FINALIZE", nama: "Memfinalkan keputusan QC", kelompok: "QUALITY" },
    { kode: "QUALITY_REOPEN", nama: "Membuka ulang reject final QC", kelompok: "QUALITY" },
    { kode: "QUALITY_ROUTING_MANAGE", nama: "Mengelola routing proses QC dan BOM", kelompok: "QUALITY" },
    { kode: "REPAIR_ASSIGN", nama: "Menugaskan perbaikan hasil QC", kelompok: "REPAIR" },
    { kode: "REPAIR_WORK", nama: "Mengerjakan penugasan repair sesuai divisi", kelompok: "REPAIR" },
  ]) {
    await prisma.permission.upsert({
      where: { kode: permission.kode },
      update: { nama: permission.nama, kelompok: permission.kelompok },
      create: permission,
    });
  }

  const permissionId = new Map(
    (await prisma.permission.findMany()).map((p) => [p.kode, p.id]),
  );

  for (const [roleKode, kodes] of Object.entries(permissionGrants)) {
    const role = await prisma.role.findUnique({ where: { kode: roleKode } });
    if (!role) throw new Error(`Role "${roleKode}" tidak ada. Jalankan migration add_rbac_role_permission.`);

    await prisma.rolePermission.createMany({
      data: kodes
        .filter((kode) => permissionId.has(kode))
        .map((kode) => ({ roleId: role.id, permissionId: permissionId.get(kode)! })),
      skipDuplicates: true,
    });

    const statusGrant = statusViewGrants[roleKode] ?? {};
    for (const [statusKode, canView] of Object.entries(statusGrant)) {
      await prisma.roleBarangStatusPermission.upsert({
        where: { roleId_statusKode: { roleId: role.id, statusKode } },
        update: { canView },
        create: { roleId: role.id, statusKode, canView },
      });
    }

    console.log(`✓ Role "${roleKode}": ${kodes.length} permission, ${Object.keys(statusGrant).length} status`);
  }

  // ── Divisi (1:1 dengan tahap jadwal produksi, dipakai SPK) ──────────────
  const divisiNames = ["Buffing", "Base Coat", "Decal Solid", "Decal Motif", "Top Coat", "Perakitan", "QC"];
  for (const nama of divisiNames) {
    await prisma.divisi.upsert({
      where: { nama },
      update: {},
      create: { nama },
    });
  }
  console.log(`✓ ${divisiNames.length} Divisi selesai`);

  const buffingDivision = await prisma.divisi.findUniqueOrThrow({
    where: { nama: "Buffing" },
    select: { id: true },
  });
  await prisma.user.updateMany({
    where: { email: "produksi@example.com", divisiId: null },
    data: { divisiId: buffingDivision.id },
  });
  console.log("✓ Operator Produksi contoh terhubung ke divisi Buffing");

  // Item + saldo awal + PM historis ikut seed utama.
  await seedItem();

  // ── Product ────────────────────────────────────────────────────────────
  const product = await prisma.product.upsert({
    where: { id: 1 },
    update: {},
    create: { nama: "Windbreaker", prefix: "wb" },
  });
  console.log(`✓ Product "${product.nama}"`);

  // ── Styles ─────────────────────────────────────────────────────────────
  const styleNames = ["Motif", "Solid"];
  const styles: Record<string, { id: number; nama: string }> = {};
  for (const nama of styleNames) {
    const s = await prisma.style.upsert({
      where: { nama },
      update: {},
      create: { nama },
    });
    styles[nama] = s;
  }
  console.log(`✓ ${styleNames.length} Style selesai`);

  // ── Colors ─────────────────────────────────────────────────────────────
  const colorNames = [
    "BOB",
    "Carbon",
    "Nation",
    "Redline",
    "Black Doff",
    "Black Glossy",
    "Platinum Grey",
    "White Glossy",
  ];
  const colors: Record<string, { id: number; nama: string }> = {};
  for (const nama of colorNames) {
    const c = await prisma.color.upsert({
      where: { nama },
      update: {},
      create: { nama },
    });
    colors[nama] = c;
  }
  console.log(`✓ ${colorNames.length} Color selesai`);

  // ── Sizes ──────────────────────────────────────────────────────────────
  const sizeData = [
    { nama: "LG",  urutan: 1 },
    { nama: "MD",  urutan: 2 },
    { nama: "XL",  urutan: 3 },
    { nama: "XXL", urutan: 4 },
  ];
  const sizes: Record<string, { id: number; nama: string }> = {};
  for (const { nama, urutan } of sizeData) {
    const s = await prisma.size.upsert({
      where: { nama },
      update: { urutan },
      create: { nama, urutan },
    });
    sizes[nama] = s;
  }
  console.log(`✓ ${sizeData.length} Size selesai`);

  // ── ProductVariants ────────────────────────────────────────────────────
  // Setiap kombinasi style+color WAJIB punya semua ukuran (LG, MD, XL, XXL)
  const variantCombos = [
    { style: "Motif", colors: ["BOB", "Carbon", "Nation", "Redline"] },
    { style: "Solid", colors: ["Black Doff", "Black Glossy", "Platinum Grey", "White Glossy"] },
  ];

  const variants: { style: string; color: string; size: string }[] = [];
  for (const { style, colors } of variantCombos) {
    for (const color of colors) {
      for (const { nama } of sizeData) {
        variants.push({ style, color, size: nama });
      }
    }
  }

  const lastVariant = await prisma.productVariant.findFirst({
    orderBy: { id: "desc" },
    select: { id: true },
  });
  let nextVariantNum = (lastVariant?.id ?? 0) + 1;

  let count = 0;
  for (const v of variants) {
    await prisma.productVariant.upsert({
      where: {
        productId_styleId_colorId_sizeId: {
          productId: product.id,
          styleId:   styles[v.style].id,
          colorId:   colors[v.color].id,
          sizeId:    sizes[v.size].id,
        },
      },
      update: {},
      create: {
        productId:  product.id,
        styleId:    styles[v.style].id,
        colorId:    colors[v.color].id,
        sizeId:     sizes[v.size].id,
        kodeVariant: `${product.prefix.toUpperCase()}${String(nextVariantNum++).padStart(3, "0")}`,
      },
    });
    count++;
  }
  console.log(`✓ ${count} ProductVariant selesai`);

  await seedProductionFlow();

  // ── Barang (5010 pcs) ─────────────────────────────────────────────────
  // Generation barang tidak idempoten (tanggal acak -> kodeBarang baru),
  // jadi lewati kalau data sudah ada supaya seed berulang tidak menumpuk.
  const existingBarang = await prisma.barang.count();
  if (existingBarang > 0) {
    console.log(`~ ${existingBarang} Barang sudah ada, lewati generation`);
    console.log("\n✅ Seeding selesai.");
    return;
  }

  const TOTAL_BARANG = 5010;
  const BATCH_KAPASITAS = 5000;

  const allVariants = await prisma.productVariant.findMany({
    select: { id: true, kodeVariant: true },
  });

  if (allVariants.length === 0) {
    throw new Error("Tidak ada variant. Jalankan seed variant terlebih dahulu.");
  }

  // Helper: random date antara 1 Jan - 27 Agust 2026
  const msAwal = new Date("2026-01-01T00:00:00.000Z").getTime();
  const msAkhir = new Date("2026-08-27T23:59:59.999Z").getTime();
  function randomDate(): Date {
    return new Date(msAwal + Math.random() * (msAkhir - msAwal));
  }

  // Format DDMMYY
  function fmtDate(d: Date): string {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear()).slice(2);
    return `${day}${month}${year}`;
  }

  function dateOnly(d: Date): Date {
    const only = new Date(d);
    only.setHours(0, 0, 0, 0);
    return only;
  }

  function counterKey(bId: number, vId: number, tgl: Date): string {
    return `${bId}-${vId}-${dateOnly(tgl).getTime()}`;
  }

  // Ambil batch aktif terakhir (atau buat baru)
  let currentBatch = await prisma.productionBatch.findFirst({
    where: { status: "AKTIF" },
    orderBy: { nomorBatch: "desc" },
    select: { id: true, nomorBatch: true, totalProduksi: true, kapasitas: true },
  });

  if (!currentBatch) {
    currentBatch = await prisma.productionBatch.create({
      data: { nomorBatch: 1, totalProduksi: 0, kapasitas: BATCH_KAPASITAS, status: "AKTIF" },
      select: { id: true, nomorBatch: true, totalProduksi: true, kapasitas: true },
    });
  }

  // Pre-load counter yang sudah ada di batch ini (untuk nomor urut lanjutan)
  const existingCounters = await prisma.barangCounter.findMany({
    where: { batchId: currentBatch.id },
    select: { batchId: true, variantId: true, tanggal: true, currentCount: true },
  });
  const counterMap = new Map<string, number>();
  for (const c of existingCounters) {
    counterMap.set(counterKey(c.batchId, c.variantId, c.tanggal), c.currentCount);
  }

  // Siapkan batch list: [{ id, nomorBatch, sisaKapasitas }]
  const batches: { id: number; nomorBatch: number; sisa: number }[] = [];
  let sisaBatch = currentBatch.kapasitas - currentBatch.totalProduksi;
  batches.push({ id: currentBatch.id, nomorBatch: currentBatch.nomorBatch, sisa: sisaBatch });

  // Generate 5010 data barang dengan random variant + tanggal
  const barangInput: { variantId: number; tanggal: Date }[] = [];
  for (let i = 0; i < TOTAL_BARANG; i++) {
    barangInput.push({
      variantId: allVariants[Math.floor(Math.random() * allVariants.length)].id,
      tanggal: randomDate(),
    });
  }

  // Assign ke batch secara sequential berdasarkan kapasitas
  const barangData: {
    variantId: number;
    tanggal: Date;
    batchId: number;
    nomorBatch: number;
  }[] = [];

  let batchIdx = 0;
  for (const item of barangInput) {
    // Cek sisa batch sekarang, buat baru jika penuh
    if (batches[batchIdx].sisa <= 0) {
      const lastBatch = batches[batchIdx];
      const newBatch = await prisma.productionBatch.create({
        data: {
          nomorBatch: lastBatch.nomorBatch + 1,
          totalProduksi: 0,
          kapasitas: BATCH_KAPASITAS,
          status: "AKTIF",
        },
        select: { id: true, nomorBatch: true },
      });
      // Tandai batch lama SELESAI
      await prisma.productionBatch.update({
        where: { id: lastBatch.id },
        data: { status: "SELESAI" },
      });
      batches.push({ id: newBatch.id, nomorBatch: newBatch.nomorBatch, sisa: BATCH_KAPASITAS });
      batchIdx++;
    }

    barangData.push({
      variantId: item.variantId,
      tanggal: item.tanggal,
      batchId: batches[batchIdx].id,
      nomorBatch: batches[batchIdx].nomorBatch,
    });
    batches[batchIdx].sisa--;
  }

  // Sort by batch -> variant -> tanggal untuk penomoran counter
  barangData.sort((a, b) => {
    if (a.batchId !== b.batchId) return a.batchId - b.batchId;
    if (a.variantId !== b.variantId) return a.variantId - b.variantId;
    return a.tanggal.getTime() - b.tanggal.getTime();
  });

  // Build barang records + riwayat
  const allBarang: { kodeBarang: string; variantId: number; batchId: number; tanggal: Date; status: string }[] = [];
  const allRiwayat: { status: string; tanggal: Date; keterangan: string }[] = [];

  for (const d of barangData) {
    const key = counterKey(d.batchId, d.variantId, d.tanggal);
    const nextNum = (counterMap.get(key) ?? 0) + 1;
    counterMap.set(key, nextNum);

    const kodeVariant = allVariants.find((v) => v.id === d.variantId)!.kodeVariant;
    const kodeBarang = `BC${String(d.nomorBatch).padStart(3, "0")}-${kodeVariant}-${fmtDate(d.tanggal)}-${String(nextNum).padStart(4, "0")}`;

    allBarang.push({
      kodeBarang,
      variantId: d.variantId,
      batchId: d.batchId,
      tanggal: d.tanggal,
      status: "FINISHGOOD",
    });

    allRiwayat.push({
      status: "FINISHGOOD",
      tanggal: d.tanggal,
      keterangan: "Barang dibuat",
    });
  }

  // Bulk insert barang per 1000
  const CHUNK = 1000;
  const allInsertedIds: number[] = [];

  for (let start = 0; start < allBarang.length; start += CHUNK) {
    const chunk = allBarang.slice(start, start + CHUNK);
    await prisma.barang.createMany({ data: chunk, skipDuplicates: true });

    const inserted = await prisma.barang.findMany({
      where: { kodeBarang: { in: chunk.map((b) => b.kodeBarang) } },
      select: { id: true, kodeBarang: true },
      orderBy: { id: "asc" },
    });
    allInsertedIds.push(...inserted.map((r) => r.id));
  }
  console.log(`✓ ${allBarang.length} Barang selesai`);

  // Bulk insert riwayat per 1000
  const riwayatData = allRiwayat.map((r, idx) => ({
    barangId: allInsertedIds[idx],
    status: r.status as any,
    tanggal: r.tanggal,
    keterangan: r.keterangan,
  }));

  for (let start = 0; start < riwayatData.length; start += CHUNK) {
    await prisma.riwayatBarang.createMany({ data: riwayatData.slice(start, start + CHUNK) });
  }
  console.log(`✓ ${riwayatData.length} RiwayatBarang selesai`);

  // Upsert BarangCounter per (batchId, variantId, tanggal)
  const counterEntries = new Map<string, { batchId: number; variantId: number; tanggal: Date; count: number }>();
  for (let i = 0; i < barangData.length; i++) {
    const d = barangData[i];
    const key = counterKey(d.batchId, d.variantId, d.tanggal);
    if (!counterEntries.has(key)) {
      counterEntries.set(key, { batchId: d.batchId, variantId: d.variantId, tanggal: dateOnly(d.tanggal), count: 0 });
    }
    counterEntries.get(key)!.count++;
  }

  for (const entry of counterEntries.values()) {
    await prisma.barangCounter.upsert({
      where: {
        batchId_variantId_tanggal: {
          batchId: entry.batchId,
          variantId: entry.variantId,
          tanggal: entry.tanggal,
        },
      },
      update: { currentCount: entry.count },
      create: {
        batchId: entry.batchId,
        variantId: entry.variantId,
        tanggal: entry.tanggal,
        currentCount: entry.count,
      },
    });
  }
  console.log(`✓ ${counterEntries.size} BarangCounter selesai`);

  // Update totalProduksi semua batch yang terpengaruh
  for (const b of batches) {
    const total = await prisma.barang.count({ where: { batchId: b.id } });
    await prisma.productionBatch.update({
      where: { id: b.id },
      data: {
        totalProduksi: total,
        status: total >= BATCH_KAPASITAS ? "SELESAI" : "AKTIF",
      },
    });
  }
  console.log(`✓ ${batches.length} ProductionBatch totalProduksi diupdate`);

  console.log("\n✅ Seeding selesai.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await sharedPrisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await sharedPrisma.$disconnect();
    process.exit(1);
  });
