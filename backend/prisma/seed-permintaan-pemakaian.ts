// Seed permintaan barang + pemakaian material banyak, tanggal disebar
// 2026-09-01..2026-10-16 (pemakaian 1-3 hari setelah permintaannya).
//
// Jalankan setelah prisma/seed-item.ts (butuh master Item + saldo awalnya):
//   docker exec -it backend-api-1 npx tsx prisma/seed-permintaan-pemakaian.ts
// Aman diulang: kalau permintaan bertanda "(data seed)" sudah ada, script berhenti.
import "dotenv/config";
import prisma from "../src/lib/prisma.js";
import { getSaldoBulk } from "../src/model/stokItem/stokItem.js";
import {
  createPermintaan,
  setApproval,
} from "../src/model/permintaanBarang/permintaanBarang.js";

const MARKER = "(data seed)";
const DIVISI = ["Buffing", "Base Coat", "Decal Solid", "Decal Motif", "Top Coat", "Perakitan", "QC"];
const NAMA_PEMINTA = [
  "Andi Pratama",
  "Budi Santoso",
  "Citra Dewi",
  "Dwi Lestari",
  "Eko Nugroho",
  "Fitri Handayani",
  "Gita Permata",
  "Hadi Susanto",
  "Indra Wijaya",
  "Joko Susilo",
];
const PRIORITAS = ["Normal", "Normal", "Normal", "Urgent", "Urgent", "Sangat Urgent"];
const JUMLAH_TANGGAL_PER_DIVISI = 8;
const TANGGAL_MULAI = new Date("2026-09-01T00:00:00.000Z");
const TANGGAL_SELESAI = new Date("2026-10-16T00:00:00.000Z");
const PELUANG_DISETUJUI = 0.85;
const HARI_MS = 86_400_000;

// PRNG deterministik: isi seed sama tiap kali dijalankan dari DB kosong.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pairKey = (divisiId: number, itemId: number) => `${divisiId}:${itemId}`;

async function main() {
  const sudahAda = await prisma.permintaanBarang.count({
    where: { alasan: { contains: MARKER } },
  });
  if (sudahAda > 0) {
    console.log(`~ ${sudahAda} permintaan ${MARKER} sudah ada, berhenti`);
    return;
  }

  const items = await prisma.item.findMany({
    select: { id: true, kode: true, nama: true, unit: true },
    orderBy: { id: "asc" },
  });
  if (items.length === 0) {
    throw new Error("Master Item kosong. Jalankan prisma/seed-item.ts dulu.");
  }

  const divisiRows = await prisma.divisi.findMany({ select: { id: true, nama: true } });
  const divisiId = new Map(divisiRows.map((d) => [d.nama, d.id]));
  for (const nama of DIVISI) {
    if (!divisiId.has(nama)) {
      throw new Error(`Divisi "${nama}" tidak ada. Jalankan seed utama dulu.`);
    }
  }

  const saldo = await getSaldoBulk(items.map((item) => item.id));
  const sisaStok = new Map<number, number>(items.map((item) => [item.id, saldo[item.id] ?? 0]));

  // Sisa stok divisi per (divisi, item) = jumlahSisa catatan pemakaian terakhir,
  // sama seperti resolveSisaSebelumnya di model pemakaian material.
  const sisaDivisi = new Map<string, number>();
  const riwayat = await prisma.pemakaianMaterialItem.findMany({
    where: { itemId: { not: null } },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: { itemId: true, jumlahSisa: true, pemakaian: { select: { divisiId: true } } },
  });
  for (const row of riwayat) {
    const key = pairKey(row.pemakaian.divisiId, row.itemId!);
    if (!sisaDivisi.has(key)) sisaDivisi.set(key, Number(row.jumlahSisa));
  }

  const rnd = mulberry32(20261017);
  const rentangHari = Math.round((TANGGAL_SELESAI.getTime() - TANGGAL_MULAI.getTime()) / HARI_MS);
  let totalPermintaan = 0;
  let totalDisetujui = 0;
  let totalBaris = 0;
  let totalKeluar = 0;

  // Semua (divisi, tanggal) diurut tanggal supaya urutan createdAt dokumen
  // sama dengan urutan tanggal di daftar pemakaian.
  const pekerjaan = DIVISI.flatMap((namaDivisi, idxDivisi) =>
    Array.from({ length: JUMLAH_TANGGAL_PER_DIVISI }, (_, i) => ({
      namaDivisi,
      idDivisi: divisiId.get(namaDivisi)!,
      tanggal: new Date(
        TANGGAL_MULAI.getTime() +
          Math.min(rentangHari, Math.floor((i * rentangHari) / JUMLAH_TANGGAL_PER_DIVISI) + (idxDivisi % 5)) * HARI_MS,
      ),
    })),
  ).sort((a, b) => a.tanggal.getTime() - b.tanggal.getTime());

  for (const { namaDivisi, idDivisi, tanggal } of pekerjaan) {
    const kandidat = items.filter((item) => (sisaStok.get(item.id) ?? 0) > 0);
    const dipilih: { id: number; nama: string; unit: string; jumlah: number }[] = [];
    const terpakai = new Set<number>();
    const targetBaris = 1 + Math.floor(rnd() * 4);

    for (let n = 0; n < targetBaris; n++) {
      const pilih = kandidat[Math.floor(rnd() * kandidat.length)];
      if (!pilih || terpakai.has(pilih.id)) continue;
      terpakai.add(pilih.id);
      const sisa = sisaStok.get(pilih.id) ?? 0;
      dipilih.push({
        id: pilih.id,
        nama: pilih.nama,
        unit: pilih.unit,
        jumlah: Math.min(sisa, 1 + Math.floor(rnd() * 20)),
      });
    }
    if (dipilih.length === 0) continue;

    const permintaan = await createPermintaan({
      tanggal,
      departemen: namaDivisi,
      namaPeminta: NAMA_PEMINTA[Math.floor(rnd() * NAMA_PEMINTA.length)],
      kebutuhanUntuk: "Produksi",
      prioritas: PRIORITAS[Math.floor(rnd() * PRIORITAS.length)],
      tanggalDibutuhkan: null,
      alasan: `Kebutuhan material rutin ${namaDivisi} ${MARKER}`,
      items: dipilih.map((item) => ({
        itemId: item.id,
        nama: item.nama,
        spesifikasi: null,
        jumlah: item.jumlah,
        satuan: item.unit,
      })),
    });
    totalPermintaan += 1;
    totalBaris += dipilih.length;

    // Sebagian dibiarkan BELUM_DISETUJUI supaya halaman punya dua status.
    if (rnd() > PELUANG_DISETUJUI) continue;

    // Tanpa keputusan eksplisit: model menyetujui min(jumlah, saldo).
    const hasil = await setApproval(permintaan.id, "DISETUJUI", [], null);
    if (!hasil) continue;

    const disetujui = hasil.items.filter(
      (item) => item.statusKeputusan === "DISETUJUI" && item.itemId && (item.jumlahDisetujui ?? 0) > 0,
    );
    if (disetujui.length === 0) continue;
    totalDisetujui += 1;

    for (const item of disetujui) {
      const jumlah = item.jumlahDisetujui ?? 0;
      sisaStok.set(item.itemId!, (sisaStok.get(item.itemId!) ?? 0) - jumlah);
      totalKeluar += jumlah;
    }

    // Approval membuat pemakaian otomatis (sisa = jumlah disetujui). Tanggal dan
    // angka pakainya ditimpa supaya tersebar dan berantai: diterima = sisa
    // sebelumnya, sisa = diterima - dipakai. updatedAt disamakan dengan tanggal
    // dokumen supaya board stok divisi (urutan updatedAt) ikut urut tanggal.
    const pemakaian = await prisma.pemakaianMaterial.findFirst({
      where: { permintaanId: permintaan.id },
      select: { id: true, items: { select: { id: true, itemId: true, jumlahSisa: true } } },
    });
    if (!pemakaian) continue;

    const tanggalPemakaian = new Date(tanggal.getTime() + (1 + Math.floor(rnd() * 3)) * HARI_MS);

    for (const row of pemakaian.items) {
      const key = pairKey(idDivisi, row.itemId!);
      const diterima = sisaDivisi.get(key) ?? Number(row.jumlahSisa);
      const roll = rnd();
      const dipakai =
        roll < 0.25
          ? 0
          : roll < 0.5
            ? diterima
            : Math.min(diterima, 1 + Math.floor(rnd() * diterima));
      const sisa = diterima - dipakai;
      sisaDivisi.set(key, sisa);
      await prisma.pemakaianMaterialItem.update({
        where: { id: row.id },
        data: { jumlahDiterima: diterima, jumlahDipakai: dipakai, jumlahSisa: sisa, updatedAt: tanggalPemakaian },
      });
    }

    await prisma.pemakaianMaterial.update({
      where: { id: pemakaian.id },
      data: { tanggal: tanggalPemakaian, keterangan: `Pemakaian harian ${namaDivisi}`, updatedAt: tanggalPemakaian },
    });
  }

  console.log(
    `✓ ${totalPermintaan} permintaan (${totalDisetujui} disetujui, ${totalPermintaan - totalDisetujui} belum), ${totalBaris} baris item`,
  );
  console.log(`✓ ${totalKeluar} pcs keluar tambahan`);

  // Self-check: ledger tidak boleh minus setelah pemakaian baru.
  const saldoAkhir = await getSaldoBulk(items.map((item) => item.id));
  const minus = items.filter((item) => (saldoAkhir[item.id] ?? 0) < 0);
  if (minus.length > 0) {
    throw new Error(`Saldo negatif: ${minus.map((item) => item.kode).join(", ")}`);
  }
  console.log(`✓ Saldo ${items.length} item tidak ada yang minus`);

  console.log("\n✅ Seeding permintaan + pemakaian selesai.");
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
