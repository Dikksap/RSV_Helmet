import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";
import { awalHariBisnis, tanggalBisnis } from "../../lib/tanggalBisnis.js";
import { Prisma } from "../../../generated/prisma/client.js";
import {
  SumberPemakaianMaterial,
  SumberPermintaanBarang,
  TipeHasilProduksiItem,
  TipeStokItem,
} from "../../../generated/prisma/enums.js";
import {
  createPermintaan,
  type PermintaanRecord,
} from "../permintaanBarang/permintaanBarang.js";
import { catatMutasi, getSaldo, lockItem, StokKurangError } from "../stokItem/stokItem.js";
import { getWipRows } from "../wip/wip.js";
import {
  ensureDivisionInventoryLocation,
  postInventoryMovementInTransaction,
} from "../inventory/inventory.js";

export const DIVISI_TIDAK_DITEMUKAN = "DIVISI_TIDAK_DITEMUKAN";
export const ITEM_TIDAK_DITEMUKAN = "ITEM_TIDAK_DITEMUKAN";
export const INPUT_TIDAK_VALID = "INPUT_TIDAK_VALID";

export type HasilProduksiItemInput = {
  itemId: number;
  tipe: TipeHasilProduksiItem;
  jumlah: number;
  keterangan?: string | null;
};

export type HasilProduksiInput = {
  nomor?: string | null;
  tanggalProduksi?: Date | null;
  divisiId: number;
  productionWorkOrderId?: number;
  keterangan?: string | null;
  items: HasilProduksiItemInput[];
};

export class HasilProduksiError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "HasilProduksiError";
    this.code = code;
  }
}

export type WipKurangData = {
  divisiId: number;
  divisiNama: string;
  itemId: number;
  itemKode: string;
  itemNama: string;
  unit: string;
  jumlahMasuk: number;
  wipTersedia: number;
  kekurangan: number;
};

export class WipKurangError extends Error {
  readonly code = "WIP_KURANG";
  permintaanBarang: PermintaanRecord | null = null;
  permintaanError: string | null = null;

  constructor(
    readonly dataKekurangan: WipKurangData,
    readonly tanggalProduksi: Date,
    readonly namaPeminta: string,
    readonly itemDivisiId: number | null,
    readonly jenis: string | null,
    readonly itemDivisiNama: string | null,
  ) {
    const data = dataKekurangan;
    super(
      `WIP ${data.itemNama} di divisi ${data.divisiNama} kurang: tersedia ${data.wipTersedia}, dibutuhkan ${data.jumlahMasuk}, kurang ${data.kekurangan}.`,
    );
    this.name = "WipKurangError";
  }

  get saranTransfer() {
    if (this.jenis !== "SM") return null;
    return {
      itemId: this.dataKekurangan.itemId,
      kode: this.dataKekurangan.itemKode,
      nama: this.dataKekurangan.itemNama,
      unit: this.dataKekurangan.unit,
      kekurangan: this.dataKekurangan.kekurangan,
      divisiAsalId: this.itemDivisiId,
      divisiAsalNama: this.itemDivisiNama,
    };
  }
}

const itemSelect = {
  id: true,
  kode: true,
  nama: true,
  unit: true,
  jenis: true,
} as const;

const detailInclude = {
  divisi: { select: { id: true, nama: true } },
  items: {
    orderBy: { id: "asc" as const },
    include: {
      item: { select: itemSelect },
      stokMutasi: { select: { id: true, tipe: true, jumlah: true, tanggal: true } },
      pemakaian: {
        select: {
          id: true,
          jumlah: true,
          pemakaianMaterialItem: {
            select: {
              id: true,
              pemakaian: {
                select: {
                  tanggal: true,
                  divisi: { select: { id: true, nama: true } },
                },
              },
            },
          },
        },
      },
      pemakaianMaterialItem: {
        select: {
          id: true,
          jumlahDiterima: true,
          jumlahDipakai: true,
          jumlahSisa: true,
          satuan: true,
          pemakaian: {
            select: {
              id: true,
              nomor: true,
              tanggal: true,
              sumber: true,
              divisi: { select: { id: true, nama: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.HasilProduksiHarianInclude;

type HasilProduksiDetail = Prisma.HasilProduksiHarianGetPayload<{ include: typeof detailInclude }>;
type HasilProduksiDetailItem = HasilProduksiDetail["items"][number];

function withWipMasuk(row: HasilProduksiDetail) {
  return {
    ...row,
    items: row.items.map(({ pemakaianMaterialItem, ...item }) => ({
      ...item,
      wipMasuk: pemakaianMaterialItem,
    })),
  };
}

function tanggalPrefix(date: Date): string {
  return `HP-${tanggalBisnis(date).split("-").join("")}-`;
}

function textOrNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function isTipeValid(value: unknown): value is TipeHasilProduksiItem {
  return (
    value === TipeHasilProduksiItem.MASUK ||
    value === TipeHasilProduksiItem.KELUAR ||
    value === TipeHasilProduksiItem.HASIL
  );
}

function isNomorUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; meta?: { target?: unknown } } | null;
  if (e?.code !== "P2002") return false;
  if (e.meta?.target === undefined) return true;
  return String(e.meta.target).includes("nomor");
}

async function validateConfiguredProcessRoute(
  tx: PrismaTransactionClient,
  divisi: { id: number; nama: string },
  inputItemIds: number[],
  outputItemIds: number[],
  routingStageId?: number,
) {
  const rows = await tx.productionRoutingStage.findMany({
    where: {
      divisiId: divisi.id,
      ...(routingStageId !== undefined
        ? { id: routingStageId }
        : { routing: { isActive: true } }),
    },
    include: {
      inputItems: { select: { itemId: true } },
      outputItems: { select: { itemId: true } },
    },
  });
  if (rows.length === 0) return;
  if (outputItemIds.length === 0) {
    throw new HasilProduksiError(
      INPUT_TIDAK_VALID,
      `Produksi ${divisi.nama} harus menghasilkan Item WIP sesuai routing aktif`,
    );
  }
  const routeMatches = rows.some((row) => {
    const allowedInputs = new Set(row.inputItems.map((item) => item.itemId));
    const allowedOutputs = new Set(row.outputItems.map((item) => item.itemId));
    return inputItemIds.every((itemId) => allowedInputs.has(itemId)) &&
      outputItemIds.every((itemId) => allowedOutputs.has(itemId));
  });
  if (!routeMatches) {
    throw new HasilProduksiError(
      INPUT_TIDAK_VALID,
      `Input/output ${divisi.nama} tidak sesuai routing produksi aktif`,
    );
  }
}

function validasiInput(input: HasilProduksiInput): void {
  if (!Number.isInteger(input.divisiId) || input.divisiId <= 0) {
    throw new HasilProduksiError(INPUT_TIDAK_VALID, "Field 'divisiId' wajib angka bulat positif");
  }
  if (
    input.productionWorkOrderId !== undefined &&
    (!Number.isInteger(input.productionWorkOrderId) || input.productionWorkOrderId <= 0)
  ) {
    throw new HasilProduksiError(
      INPUT_TIDAK_VALID,
      "Field 'productionWorkOrderId' harus angka bulat positif",
    );
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new HasilProduksiError(INPUT_TIDAK_VALID, "Field 'items' wajib diisi minimal 1 item");
  }
  if (input.nomor !== undefined && input.nomor !== null && String(input.nomor).trim().length > 191) {
    throw new HasilProduksiError(INPUT_TIDAK_VALID, "Field 'nomor' maksimal 191 karakter");
  }
  if (
    input.tanggalProduksi !== undefined &&
    input.tanggalProduksi !== null &&
    (!(input.tanggalProduksi instanceof Date) || Number.isNaN(input.tanggalProduksi.getTime()))
  ) {
    throw new HasilProduksiError(INPUT_TIDAK_VALID, "Field 'tanggalProduksi' harus tanggal valid");
  }
  input.items.forEach((item, index) => {
    if (!item || !Number.isInteger(item.itemId) || item.itemId <= 0) {
      throw new HasilProduksiError(INPUT_TIDAK_VALID, `items[${index}].itemId wajib angka bulat positif`);
    }
    if (!isTipeValid(item.tipe)) {
      throw new HasilProduksiError(INPUT_TIDAK_VALID, `items[${index}].tipe harus MASUK, KELUAR, atau HASIL`);
    }
    if (!Number.isInteger(item.jumlah) || item.jumlah <= 0) {
      throw new HasilProduksiError(INPUT_TIDAK_VALID, `items[${index}].jumlah harus bilangan bulat lebih dari 0`);
    }
    if (item.jumlah > 2147483647) {
      throw new HasilProduksiError(INPUT_TIDAK_VALID, `items[${index}].jumlah terlalu besar`);
    }
  });

  const barisMasuk = input.items.filter((item) => item.tipe === TipeHasilProduksiItem.MASUK);
  if (barisMasuk.length === 0) {
    throw new HasilProduksiError(INPUT_TIDAK_VALID, "Wajib ada minimal satu baris MASUK");
  }
  const barisHasil = input.items.filter((item) => item.tipe === TipeHasilProduksiItem.HASIL);
  if (barisHasil.length === 0) {
    throw new HasilProduksiError(INPUT_TIDAK_VALID, "Wajib ada minimal satu baris HASIL");
  }
  for (const [rows, label] of [[barisMasuk, "MASUK"], [barisHasil, "HASIL"]] as const) {
    const seen = new Set<number>();
    for (const row of rows) {
      if (seen.has(row.itemId)) {
        throw new HasilProduksiError(INPUT_TIDAK_VALID, `Item ${label} yang sama tidak boleh dicatat lebih dari sekali`);
      }
      seen.add(row.itemId);
    }
  }
  if (input.items.some((item) => item.tipe === TipeHasilProduksiItem.KELUAR)) {
    const tipePerItem = new Map<number, Set<TipeHasilProduksiItem>>();
    for (const item of input.items) {
      const tipe = tipePerItem.get(item.itemId) ?? new Set<TipeHasilProduksiItem>();
      tipe.add(item.tipe);
      tipePerItem.set(item.itemId, tipe);
    }
    for (const [itemId, tipe] of tipePerItem) {
      if (tipe.has(TipeHasilProduksiItem.MASUK) && tipe.has(TipeHasilProduksiItem.KELUAR)) {
        throw new HasilProduksiError(
          INPUT_TIDAK_VALID,
          `Item ${itemId} tidak boleh memiliki baris MASUK dan KELUAR sekaligus`,
        );
      }
    }
  }
}

async function generateNomor(tx: PrismaTransactionClient, date: Date): Promise<string> {
  const prefix = tanggalPrefix(date);
  const terakhir = await tx.hasilProduksiHarian.findFirst({
    where: { nomor: { startsWith: prefix } },
    orderBy: { nomor: "desc" },
    select: { nomor: true },
  });
  const urut = terakhir ? Number(terakhir.nomor.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(urut).padStart(4, "0")}`;
}

type WipLockRow = {
  id: number;
  jumlahSisa: unknown;
  jumlahDipakai: unknown;
};

// Kunci baris Item juga menjadi mutex saat WIP masih nol, sehingga approval
// yang sedang membuat WIP dan produksi tidak membaca saldo yang sama.
async function lockWipRows(
  tx: PrismaTransactionClient,
  divisiId: number,
  itemId: number,
): Promise<WipLockRow[]> {
  return tx.$queryRaw<WipLockRow[]>`
    SELECT pmi.id, pmi.jumlahSisa, pmi.jumlahDipakai
    FROM PemakaianMaterialItem pmi
    INNER JOIN PemakaianMaterial pm ON pm.id = pmi.pemakaianId
    WHERE pm.divisiId = ${divisiId} AND pmi.itemId = ${itemId}
    ORDER BY pm.tanggal ASC, pmi.id ASC
    FOR UPDATE
  `;
}

async function createWipHasilProduksi(
  tx: PrismaTransactionClient,
  header: HasilProduksiDetail,
  details: HasilProduksiDetailItem[],
  userId: number | null,
): Promise<void> {
  if (details.length === 0) return;

  const nomor = `WIP-${header.nomor}`;
  if (nomor.length > 191) {
    throw new HasilProduksiError(INPUT_TIDAK_VALID, "Nomor hasil produksi terlalu panjang untuk WIP");
  }

  const receipt = await tx.pemakaianMaterial.create({
    data: {
      nomor,
      permintaanId: null,
      divisiId: header.divisiId,
      tanggal: header.tanggalProduksi,
      userId,
      sumber: SumberPemakaianMaterial.HASIL_PRODUKSI,
      hasilProduksiHarianId: header.id,
      keterangan: `Hasil produksi ${header.nomor}`,
      items: {
        create: details.map((detail) => ({
          itemId: detail.itemId,
          permintaanBarangItemId: null,
          hasilProduksiHarianItemId: detail.id,
          jumlahDiterima: Number(detail.jumlah),
          jumlahDipakai: 0,
          jumlahSisa: Number(detail.jumlah),
          satuan: detail.item.unit,
          keteranganSisa: null,
        })),
      },
    },
    select: {
      items: {
        select: {
          id: true,
          itemId: true,
          jumlahDiterima: true,
          hasilProduksiHarianItemId: true,
        },
      },
    },
  });
  const location = await ensureDivisionInventoryLocation(tx, header.divisiId);
  for (const lot of receipt.items) {
    if (lot.itemId === null) continue;
    await postInventoryMovementInTransaction(tx, {
      itemId: lot.itemId,
      pemakaianMaterialItemId: lot.id,
      hasilProduksiHarianId: header.id,
      toLocationId: location.id,
      type: "PRODUCTION",
      quantity: Number(lot.jumlahDiterima),
      idempotencyKey: `production-wip:${header.id}:${lot.id}`,
      sourceType: "PRODUCTION_OUTPUT",
      sourceId: `${header.id}:${lot.hasilProduksiHarianItemId}`,
      reason: `WIP hasil produksi ${header.nomor}`,
      userId,
      occurredAt: header.tanggalProduksi,
    });
  }
}

async function buatPermintaanOtomatis(error: WipKurangError): Promise<PermintaanRecord> {
  const data = error.dataKekurangan;
  const tanggal = awalHariBisnis(error.tanggalProduksi);
  const tanggalKey = tanggalBisnis(tanggal);
  const divisiApproverId = error.itemDivisiId ?? data.divisiId;

  return createPermintaan({
    tanggal,
    tanggalDibutuhkan: tanggal,
    departemen: data.divisiNama,
    divisiPemintaId: data.divisiId,
    divisiApproverId,
    namaPeminta: error.namaPeminta,
    kebutuhanUntuk: "Produksi",
    prioritas: "Normal",
    alasan: `Kekurangan WIP ${data.itemNama} (${data.itemKode}): tersedia ${data.wipTersedia}, dibutuhkan ${data.jumlahMasuk}, kurang ${data.kekurangan}.`,
    sumber: SumberPermintaanBarang.HASIL_PRODUKSI,
    autoKey: `HP:${data.divisiId}:${divisiApproverId}:${data.itemId}:${tanggalKey}`,
    items: [
      {
        itemId: data.itemId,
        nama: data.itemNama,
        spesifikasi: null,
        jumlah: Math.ceil(data.kekurangan),
        satuan: data.unit,
      },
    ],
  });
}

async function createInTx(
  tx: PrismaTransactionClient,
  input: HasilProduksiInput,
  userId: number | null,
) {
  const tanggal = awalHariBisnis(input.tanggalProduksi ?? new Date());
  let workOrder: {
    id: number;
    orderId: number;
    routingStageId: number;
    status: string;
    routingStage: {
      divisiId: number;
      inputItems: { itemId: number }[];
      outputItems: { itemId: number }[];
    };
  } | null = null;
  if (input.productionWorkOrderId !== undefined) {
    await tx.$queryRaw`SELECT id FROM ProductionWorkOrder WHERE id = ${input.productionWorkOrderId} FOR UPDATE`;
    workOrder = await tx.productionWorkOrder.findUnique({
      where: { id: input.productionWorkOrderId },
      include: {
        routingStage: {
          include: {
            inputItems: { select: { itemId: true } },
            outputItems: { select: { itemId: true } },
          },
        },
      },
    });
    if (!workOrder) {
      throw new HasilProduksiError(INPUT_TIDAK_VALID, "Work order tidak ditemukan");
    }
    if (workOrder.status !== "IN_PROGRESS") {
      throw new HasilProduksiError(
        INPUT_TIDAK_VALID,
        "Hasil produksi hanya dapat dicatat untuk work order berstatus IN_PROGRESS",
      );
    }
    if (workOrder.routingStage.divisiId !== input.divisiId) {
      throw new HasilProduksiError(
        INPUT_TIDAK_VALID,
        "Divisi hasil produksi tidak sesuai dengan tahap work order",
      );
    }
  }

  const divisi = await tx.divisi.findUnique({
    where: { id: input.divisiId },
    select: { id: true, nama: true },
  });
  if (!divisi) {
    throw new HasilProduksiError(DIVISI_TIDAK_DITEMUKAN, "Divisi tidak ditemukan");
  }
  const divisionLocation = await ensureDivisionInventoryLocation(tx, divisi.id);

  const itemIds = [...new Set(input.items.map((item) => item.itemId))];
  const items = await tx.item.findMany({
    where: { id: { in: itemIds } },
    select: { id: true, kode: true, nama: true, unit: true, divisiId: true, jenis: true, divisi: { select: { nama: true } } },
  });
  if (items.length !== itemIds.length) {
    const ada = new Set(items.map((item) => item.id));
    const hilang = itemIds.filter((id) => !ada.has(id));
    throw new HasilProduksiError(ITEM_TIDAK_DITEMUKAN, `Item tidak ditemukan: ${hilang.join(", ")}`);
  }

  const barisMasuk = input.items.filter((item) => item.tipe === TipeHasilProduksiItem.MASUK);
  const inputItemIds = barisMasuk.map((item) => item.itemId);
  const hasilWipItemIds = input.items
    .filter((row) => row.tipe === TipeHasilProduksiItem.HASIL)
    .filter((row) => items.find((item) => item.id === row.itemId)?.jenis === "SM")
    .map((row) => row.itemId);
  if (workOrder) {
    const allowedInputs = new Set(workOrder.routingStage.inputItems.map((row) => row.itemId));
    const allowedOutputs = new Set(workOrder.routingStage.outputItems.map((row) => row.itemId));
    const actualOutputIds = input.items
      .filter((row) => row.tipe === TipeHasilProduksiItem.HASIL)
      .map((row) => row.itemId);
    if (
      inputItemIds.some((itemId) => !allowedInputs.has(itemId)) ||
      actualOutputIds.some((itemId) => !allowedOutputs.has(itemId))
    ) {
      throw new HasilProduksiError(
        INPUT_TIDAK_VALID,
        "Input/output hasil produksi tidak sesuai dengan routing work order",
      );
    }
  }
  await validateConfiguredProcessRoute(
    tx,
    divisi,
    inputItemIds,
    hasilWipItemIds,
    workOrder?.routingStageId,
  );

  const keluarPerItem = new Map<number, number>();
  for (const item of input.items) {
    if (item.tipe !== TipeHasilProduksiItem.KELUAR) continue;
    keluarPerItem.set(item.itemId, (keluarPerItem.get(item.itemId) ?? 0) + item.jumlah);
  }

  // Kunci semua item dengan urutan tetap supaya produksi dan approval tidak deadlock.
  const lockIds = [...new Set([...inputItemIds, ...keluarPerItem.keys()])].sort((a, b) => a - b);
  for (const itemId of lockIds) await lockItem(tx, itemId);

  const konsumsiPerInput: Array<{
    itemId: number;
    jumlah: number;
    rows: Array<{ id: number; sisa: number }>;
  }> = [];
  for (const inputLine of barisMasuk) {
    const itemMasuk = items.find((item) => item.id === inputLine.itemId)!;
    const wipRows = await lockWipRows(tx, input.divisiId, inputLine.itemId);
    const alokasi = wipRows.map((row) => {
      const sisa = Number(row.jumlahSisa);
      const dipakai = Number(row.jumlahDipakai);
      if (!Number.isFinite(sisa) || sisa < 0 || !Number.isFinite(dipakai) || dipakai < 0) {
        throw new Error(`Saldo WIP tidak valid untuk PemakaianMaterialItem ${row.id}`);
      }
      return { id: row.id, sisa };
    });
    const totalWip = alokasi.reduce((total, row) => total + row.sisa, 0);
    if (totalWip < inputLine.jumlah) {
      const peminta =
        userId === null
          ? null
          : await tx.user.findUnique({ where: { id: userId }, select: { name: true } });
      throw new WipKurangError(
        {
          divisiId: divisi.id,
          divisiNama: divisi.nama,
          itemId: itemMasuk.id,
          itemKode: itemMasuk.kode,
          itemNama: itemMasuk.nama,
          unit: itemMasuk.unit,
          jumlahMasuk: inputLine.jumlah,
          wipTersedia: totalWip,
          kekurangan: Math.ceil(inputLine.jumlah - totalWip),
        },
        tanggal,
        peminta?.name ?? "Sistem",
        itemMasuk.divisiId,
        itemMasuk.jenis,
        itemMasuk.divisi?.nama ?? null,
      );
    }
    konsumsiPerInput.push({ itemId: inputLine.itemId, jumlah: inputLine.jumlah, rows: alokasi });
  }

  // KELUAR = pengurangan stok. Total kebutuhan dicek sekali per item setelah
  // semua baris KELUAR item tersebut dijumlahkan.
  for (const itemId of [...keluarPerItem.keys()].sort((a, b) => a - b)) {
    const saldo = await getSaldo(itemId, tx);
    const butuh = keluarPerItem.get(itemId)!;
    if (butuh > saldo) throw new StokKurangError(itemId, saldo);
  }

  const nomor = textOrNull(input.nomor) ?? (await generateNomor(tx, tanggal));

  const header = await tx.hasilProduksiHarian.create({
    data: {
      nomor,
      tanggalProduksi: tanggal,
      divisiId: input.divisiId,
      orderId: workOrder?.orderId ?? null,
      productionWorkOrderId: workOrder?.id ?? null,
      keterangan: textOrNull(input.keterangan),
      items: {
        create: input.items.map((item) => ({
          itemId: item.itemId,
          tipe: item.tipe,
          jumlah: item.jumlah,
          keterangan: textOrNull(item.keterangan),
        })),
      },
    },
    include: detailInclude,
  });

  for (const input of konsumsiPerInput) {
    const detailMasuk = header.items.find((detail) =>
      detail.tipe === TipeHasilProduksiItem.MASUK && detail.itemId === input.itemId,
    );
    if (!detailMasuk) throw new Error(`Baris MASUK item ${input.itemId} tidak terbentuk`);
    const itemMasuk = items.find((item) => item.id === input.itemId)!;
    let sisaKonsumsi = input.jumlah;
    for (const row of input.rows) {
      if (sisaKonsumsi <= 0) break;
      if (row.sisa <= 0) continue;
      const pakai = Math.min(row.sisa, sisaKonsumsi);
      const terpakai = await tx.pemakaianMaterialItem.updateMany({
        where: { id: row.id, jumlahSisa: { gte: pakai } },
        data: {
          jumlahSisa: { decrement: pakai },
          jumlahDipakai: { increment: pakai },
        },
      });
      if (terpakai.count !== 1) {
        throw new Error(`Saldo WIP PemakaianMaterialItem ${row.id} berubah saat produksi disimpan`);
      }
      await tx.hasilProduksiPemakaian.create({
        data: {
          hasilProduksiHarianItemId: detailMasuk.id,
          pemakaianMaterialItemId: row.id,
          jumlah: pakai,
        },
      });
      await postInventoryMovementInTransaction(tx, {
        itemId: itemMasuk.id,
        pemakaianMaterialItemId: row.id,
        hasilProduksiHarianId: header.id,
        fromLocationId: divisionLocation.id,
        type: "PRODUCTION",
        quantity: pakai,
        idempotencyKey: `production-consume:${header.id}:${row.id}`,
        sourceType: "PRODUCTION_CONSUMPTION",
        sourceId: `${header.id}:${detailMasuk.id}:${row.id}`,
        reason: `Konsumsi WIP produksi ${nomor}`,
        userId,
        occurredAt: tanggal,
      });
      sisaKonsumsi -= pakai;
    }
    if (sisaKonsumsi !== 0) {
      throw new Error(`Konsumsi WIP tidak sama dengan jumlah input item ${itemMasuk.kode}`);
    }
  }

  // Hasil SM menjadi WIP divisi, bukan stok gudang. Satu dokumen WIP per
  // dokumen produksi, tetap dalam transaksi yang sama.
  await createWipHasilProduksi(
    tx,
    header,
    header.items.filter(
      (detail) => detail.tipe === TipeHasilProduksiItem.HASIL && detail.item.jenis === "SM",
    ),
    userId,
  );

  // MASUK hanya aktivitas input. Stok input sudah dikurangi approval/pemakaian
  // Permintaan Barang, jadi produksi tidak boleh membuat KELUAR kedua.
  for (const detail of header.items) {
    if (detail.tipe === TipeHasilProduksiItem.MASUK) continue;
    if (detail.tipe === TipeHasilProduksiItem.HASIL && detail.item.jenis === "SM") continue;
    await catatMutasi(tx, {
      itemId: detail.itemId,
      tipe: detail.tipe === TipeHasilProduksiItem.HASIL ? TipeStokItem.MASUK : TipeStokItem.KELUAR,
      jumlah: Number(detail.jumlah),
      sumberHasilProduksiItemId: detail.id,
      keterangan: `Produksi ${nomor} - ${divisi.nama}`,
      userId,
      tanggal,
    });
    await postInventoryMovementInTransaction(tx, {
      itemId: detail.itemId,
      ...(detail.tipe === TipeHasilProduksiItem.HASIL
        ? { toLocationId: divisionLocation.id }
        : { fromLocationId: divisionLocation.id }),
      type: "PRODUCTION",
      quantity: Number(detail.jumlah),
      idempotencyKey: `production-stock:${header.id}:${detail.id}`,
      sourceType: "PRODUCTION_ITEM",
      sourceId: `${header.id}:${detail.id}`,
      reason: `Produksi ${nomor} - ${divisi.nama}`,
      userId,
      occurredAt: tanggal,
    });
  }

  return withWipMasuk(
    await tx.hasilProduksiHarian.findUniqueOrThrow({
      where: { id: header.id },
      include: detailInclude,
    }),
  );
}

export async function createHasilProduksi(input: HasilProduksiInput, userId: number | null = null) {
  validasiInput(input);
  const nomor = textOrNull(input.nomor);
  const normalized: HasilProduksiInput = { ...input, nomor };
  const maksPercobaan = nomor ? 1 : 5;

  for (let percobaan = 1; percobaan <= maksPercobaan; percobaan++) {
    try {
      return await prisma.$transaction((tx) => createInTx(tx, normalized, userId));
    } catch (error) {
      if (error instanceof WipKurangError) {
        if (error.jenis === "SM") throw error;
        try {
          error.permintaanBarang = await buatPermintaanOtomatis(error);
        } catch (permintaanError) {
          error.permintaanError =
            permintaanError instanceof Error
              ? permintaanError.message
              : "Gagal membuat permintaan barang otomatis";
        }
        throw error;
      }

      // Nomor otomatis bisa bentrok saat dua request bersamaan. Nomor manual
      // tidak diulang supaya client tahu nomornya sudah dipakai.
      if (nomor || percobaan === maksPercobaan || !isNomorUniqueViolation(error)) {
        throw error;
      }
    }
  }

  throw new Error("Gagal membuat nomor hasil produksi");
}
