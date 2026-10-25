// Seed master Item + stok dari export Kelola Item 2026-10-17
// (item-20261017-semua-tanggal.csv, dibekukan di prisma/data/item-20261017.ts).
//
// Dipanggil dari prisma/seed.ts. Tetap bisa standalone:
// docker exec -it backend-api-1 npx tsx prisma/seed-item.ts
// Aman diulang: item di-upsert, ledger + permintaan dilewati kalau mutasi sudah ada.
import "dotenv/config";
import { pathToFileURL } from "node:url";
import prisma from "../src/lib/prisma.js";
import { getSaldoBulk } from "../src/model/stokItem/stokItem.js";
import {
  createPermintaan,
  setApproval,
} from "../src/model/permintaanBarang/permintaanBarang.js";
import { ITEM_20261017 } from "./data/item-20261017.js";
import { ITEM_PROSES } from "./data/item-proses.js";

const TANGGAL_STOK = new Date("2026-10-01T00:00:00.000Z");
const TANGGAL_PERMINTAAN = new Date("2026-10-15T00:00:00.000Z");

// Mapping PM historis dari export. `departemen` permintaan harus sama dengan
// nama Divisi supaya approval membuat pemakaian material otomatis.
const DIVISI_PERMINTAAN: Record<string, string> = {
  RAW001: "Perakitan",
  RAW004: "Perakitan",
  HP0043: "Perakitan",
  RAW060: "Perakitan",
  RAW020: "Buffing",
  RAW031: "Decal Motif",
  HP0028: "QC",
};

const range = (prefix: string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${prefix}${String(from + i).padStart(3, "0")}`);

const SM_TOP_COAT = Array.from({ length: 8 }, (_, i) => `SM${String(i + 1).padStart(4, "0")}`);
const SM_PERAKITAN = Array.from({ length: 16 }, (_, i) => `SM${String(i + 9).padStart(4, "0")}`);
const PERAKITAN_RAW = [
  ...range("RAW", 1, 11),
  ...range("RAW", 15, 19),
  ...range("RAW", 21, 30),
  ...range("RAW", 37, 70),
  ...range("RAW", 73, 77),
  ...range("RAW", 83, 89),
  "HP0042",
  "HP0043",
  "HP0045",
  "HP0046",
];

// Divisi pemilik item, mengikuti alur produksi:
// Buffing -> Base Coat -> Decal -> Top Coat -> Perakitan.
// Item proses SM0025-SM0035 sudah membawa divisi sendiri di ITEM_PROSES.
const DIVISI_ITEM: Record<string, string> = {
  RAW020: "Buffing",
  RAW012: "Base Coat",
  RAW013: "Base Coat",
  RAW014: "Base Coat",
  RAW071: "Base Coat",
  RAW072: "Base Coat",
  RAW078: "Base Coat",
  RAW031: "Decal Motif",
  RAW032: "Decal Solid",
  RAW033: "Decal Solid",
  RAW034: "Decal Motif",
  RAW035: "Decal Motif",
  RAW036: "Decal Motif",
  RAW079: "Top Coat",
  RAW080: "Top Coat",
  RAW081: "Top Coat",
  RAW082: "Top Coat",
  HP0041: "Top Coat",
  HP0028: "QC",
  HP0048: "QC",
  HP0049: "QC",
  HP0050: "QC",
  ...Object.fromEntries(SM_TOP_COAT.map((kode) => [kode, "Top Coat"])),
  ...Object.fromEntries(SM_PERAKITAN.map((kode) => [kode, "Perakitan"])),
  ...Object.fromEntries(PERAKITAN_RAW.map((kode) => [kode, "Perakitan"])),
};

export async function seedItem(): Promise<void> {
  console.log("Seeding item + stok dari export 2026-10-17...");

  const divisiRows = await prisma.divisi.findMany({
    select: { id: true, nama: true },
  });
  const divisiIdByNama = new Map(divisiRows.map((row) => [row.nama, row.id]));

  const itemMaster = [
    ...ITEM_20261017.map((row) => ({
      kode: row.kode,
      nama: row.nama,
      unit: row.unit,
      jenis: row.jenis,
      divisi: DIVISI_ITEM[row.kode],
    })),
    ...ITEM_PROSES,
  ];

  const idByKode = new Map<string, number>();
  for (const row of itemMaster) {
    const divisiId = row.divisi ? divisiIdByNama.get(row.divisi) : undefined;
    if (row.divisi && divisiId === undefined) {
      throw new Error(`Divisi "${row.divisi}" untuk item ${row.kode} tidak ditemukan`);
    }
    const data = {
      nama: row.nama,
      unit: row.unit,
      jenis: row.jenis,
      isActive: true,
      ...(divisiId !== undefined ? { divisiId } : {}),
    };
    const item = await prisma.item.upsert({
      where: { kode: row.kode },
      update: data,
      create: { kode: row.kode, ...data },
    });
    idByKode.set(row.kode, item.id);
  }
  console.log(`✓ ${ITEM_20261017.length} Item + ${ITEM_PROSES.length} item proses`);

  const ids = ITEM_20261017.map((row) => idByKode.get(row.kode)!);
  const mutasiAda = await prisma.stokItemMutasi.count({
    where: { itemId: { in: ids } },
  });
  if (mutasiAda > 0) {
    console.log(`~ ${mutasiAda} StokItemMutasi sudah ada, lewati ledger + permintaan`);
    return;
  }

  await prisma.stokItemMutasi.createMany({
    data: ITEM_20261017.map((row) => ({
      itemId: idByKode.get(row.kode)!,
      tipe: "MASUK" as const,
      jumlah: row.masuk,
      tanggal: TANGGAL_STOK,
      keterangan: "Saldo awal (export 2026-10-17)",
    })),
  });
  console.log(`✓ ${ITEM_20261017.length} mutasi MASUK`);

  const keluarById = new Map(
    ITEM_20261017.map((row) => [idByKode.get(row.kode)!, row.keluar]),
  );
  const perDivisi = new Map<string, typeof ITEM_20261017>();
  for (const row of ITEM_20261017) {
    if (row.keluar <= 0) continue;
    const divisi = DIVISI_PERMINTAAN[row.kode];
    if (!divisi) {
      throw new Error(`Item ${row.kode} punya keluar > 0 tapi belum dipetakan ke divisi`);
    }
    perDivisi.set(divisi, [...(perDivisi.get(divisi) ?? []), row]);
  }

  for (const [divisi, rows] of perDivisi) {
    const divisiId = divisiIdByNama.get(divisi);
    if (divisiId === undefined) {
      throw new Error(`Divisi "${divisi}" untuk PM historis tidak ditemukan`);
    }
    const permintaan = await createPermintaan({
      tanggal: TANGGAL_PERMINTAAN,
      departemen: divisi,
      namaPeminta: `Operator ${divisi}`,
      kebutuhanUntuk: "Produksi",
      prioritas: "Normal",
      tanggalDibutuhkan: null,
      alasan: `Kebutuhan material ${divisi} (export stok 2026-10-17)`,
      divisiPemintaId: divisiId,
      divisiApproverId: divisiId,
      items: rows.map((row) => ({
        itemId: idByKode.get(row.kode)!,
        nama: row.nama,
        spesifikasi: null,
        jumlah: row.keluar,
        satuan: row.unit,
      })),
    });

    // Approval menulis mutasi KELUAR + pemakaian material sesuai aturan domain.
    await setApproval(
      permintaan.id,
      "DISETUJUI",
      permintaan.items.map((item) => ({
        id: item.id,
        jumlahDisetujui: keluarById.get(item.itemId!) ?? 0,
      })),
      null,
    );
    console.log(`✓ ${permintaan.noPermintaan} (${divisi}): ${rows.length} item`);
  }

  // Self-check: saldo ledger harus sama dengan stok di CSV.
  const saldo = await getSaldoBulk(ids);
  const beda = ITEM_20261017.filter(
    (row) => saldo[idByKode.get(row.kode)!] !== row.masuk - row.keluar,
  );
  if (beda.length > 0) {
    throw new Error(`Saldo tidak cocok CSV: ${beda.map((row) => row.kode).join(", ")}`);
  }
  console.log(`✓ Saldo ${ITEM_20261017.length} item cocok dengan CSV`);

  console.log("\n✅ Seeding item + stok selesai.");
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  seedItem()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
