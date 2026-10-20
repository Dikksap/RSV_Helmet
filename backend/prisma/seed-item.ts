// Seed master Item + stok dari export Kelola Item 2026-10-17
// (item-20261017-semua-tanggal.csv, dibekukan di prisma/data/item-20261017.ts).
//
// Jalankan di container: docker exec -it backend-api-1 npx tsx prisma/seed-item.ts
// Aman diulang: item di-upsert, ledger + permintaan dilewati kalau mutasi sudah ada.
import "dotenv/config";
import prisma from "../src/lib/prisma.js";
import { getSaldoBulk } from "../src/model/stokItem/stokItem.js";
import {
  createPermintaan,
  setApproval,
} from "../src/model/permintaanBarang/permintaanBarang.js";
import { ITEM_20261017 } from "./data/item-20261017.js";

const TANGGAL_STOK = new Date("2026-10-01T00:00:00.000Z");
const TANGGAL_PERMINTAAN = new Date("2026-10-15T00:00:00.000Z");

// Item dengan keluar > 0 dipetakan ke divisi. `departemen` permintaan harus
// sama dengan nama Divisi supaya approval membuat pemakaian material otomatis.
const DIVISI_PERMINTAAN: Record<string, string> = {
  RAW001: "Perakitan",
  RAW004: "Perakitan",
  HP0043: "Perakitan",
  RAW060: "Perakitan",
  RAW020: "Base Coat",
  RAW031: "Decal Motif",
  HP0028: "QC",
};

async function main() {
  console.log("Seeding item + stok dari export 2026-10-17...");

  const idByKode = new Map<string, number>();
  for (const row of ITEM_20261017) {
    const data = {
      nama: row.nama,
      unit: row.unit,
      jenis: row.jenis,
      isActive: true,
    };
    const item = await prisma.item.upsert({
      where: { kode: row.kode },
      update: data,
      create: { kode: row.kode, ...data },
    });
    idByKode.set(row.kode, item.id);
  }
  console.log(`✓ ${ITEM_20261017.length} Item`);

  const ids = [...idByKode.values()];
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
    const permintaan = await createPermintaan({
      tanggal: TANGGAL_PERMINTAAN,
      departemen: divisi,
      namaPeminta: `Operator ${divisi}`,
      kebutuhanUntuk: "Produksi",
      prioritas: "Normal",
      tanggalDibutuhkan: null,
      alasan: `Kebutuhan material ${divisi} (export stok 2026-10-17)`,
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

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
