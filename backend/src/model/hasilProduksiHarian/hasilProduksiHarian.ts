import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";
import { awalHariBisnis, tanggalBisnis } from "../../lib/tanggalBisnis.js";
import { Prisma } from "../../../generated/prisma/client.js";
import {
  SumberPemakaianMaterial,
  SumberPermintaanBarang,
  TipeHasilProduksiItem,
} from "../../../generated/prisma/enums.js";
import {
  createPermintaan,
  type PermintaanRecord,
} from "../permintaanBarang/permintaanBarang.js";
import { lockItem, StokKurangError } from "../stokItem/stokItem.js";
import {
  ensureDivisionInventoryLocation,
  getItemStockAtLocation,
  postInventoryMovementInTransaction,
} from "../inventory/inventory.js";
import { generateBarangBulkInTransaction } from "../barang/barang.generate.js";
import { BomError, resolveEffectiveBomForVariant } from "../bom/resolver.js";

export const DIVISI_TIDAK_DITEMUKAN = "DIVISI_TIDAK_DITEMUKAN";
export const ITEM_TIDAK_DITEMUKAN = "ITEM_TIDAK_DITEMUKAN";
export const INPUT_TIDAK_VALID = "INPUT_TIDAK_VALID";
export const ROUTING_INVALID = "ROUTING_INVALID";
export const IDEMPOTENCY_CONFLICT = "IDEMPOTENCY_CONFLICT";

export type HasilProduksiItemInput = {
  itemId?: number | null;
  productVariantId?: number | null;
  tipe: TipeHasilProduksiItem;
  jumlah: number;
  keterangan?: string | null;
};

export type HasilProduksiInput = {
  nomor?: string | null;
  tanggalProduksi?: Date | null;
  divisiId: number;
  productionWorkOrderId?: number;
  routingStageId?: number;
  bomId?: number;
  /** Wajib untuk mencegah double-submit dokumen produksi. */
  idempotencyKey?: string | null;
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
  routingStage: { select: { id: true, stage: true, sequence: true } },
  bom: { select: { id: true, version: true } },
  items: {
    orderBy: { id: "asc" as const },
    include: {
      item: { select: itemSelect },
      productVariant: {
        select: {
          id: true,
          kodeVariant: true,
          product: { select: { id: true, nama: true } },
          style: { select: { id: true, nama: true } },
          color: { select: { id: true, nama: true } },
          size: { select: { id: true, nama: true } },
        },
      },
      stokMutasi: { select: { id: true, tipe: true, jumlah: true, tanggal: true } },
      barangDihasilkan: { select: { id: true, kodeBarang: true, status: true, finishGoodAt: true } },
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

export type HasilProduksiRecord = ReturnType<typeof withWipMasuk>;

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

/**
 * Baris MASUK/KELUAR wajib punya itemId; hanya baris HASIL berbasis varian yang
 * boleh null. validasiInput() sudah menjamin ini, helper ini mempersempit tipe
 * sekaligus menjadi jaring pengaman bila createInTx dipanggil tanpa validasi.
 */
function wajibItemId(item: HasilProduksiItemInput): number {
  if (item.itemId == null) {
    throw new HasilProduksiError(
      INPUT_TIDAK_VALID,
      `Baris ${item.tipe} wajib memiliki itemId`,
    );
  }
  return item.itemId;
}

function isNomorUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; meta?: { target?: unknown } } | null;
  if (e?.code !== "P2002") return false;
  if (e.meta?.target === undefined) return true;
  return String(e.meta.target).includes("nomor");
}

function isIdempotencyUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; meta?: { target?: unknown } } | null;
  if (e?.code !== "P2002") return false;
  if (e.meta?.target === undefined) return false;
  return String(e.meta.target).includes("idempotencyKey");
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
  if (
    input.routingStageId !== undefined &&
    (!Number.isInteger(input.routingStageId) || input.routingStageId <= 0)
  ) {
    throw new HasilProduksiError(INPUT_TIDAK_VALID, "Field 'routingStageId' harus angka bulat positif");
  }
  if (input.bomId !== undefined && (!Number.isInteger(input.bomId) || input.bomId <= 0)) {
    throw new HasilProduksiError(INPUT_TIDAK_VALID, "Field 'bomId' harus angka bulat positif");
  }
  if (input.idempotencyKey !== undefined && input.idempotencyKey !== null) {
    const key = String(input.idempotencyKey).trim();
    if (key.length < 8 || key.length > 191) {
      throw new HasilProduksiError(
        INPUT_TIDAK_VALID,
        "Field 'idempotencyKey' wajib 8 sampai 191 karakter",
      );
    }
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
    if (!item) {
      throw new HasilProduksiError(INPUT_TIDAK_VALID, `items[${index}] tidak boleh kosong`);
    }
    const hasVariant = item.productVariantId !== undefined && item.productVariantId !== null;
    const isHasilVariant = item.tipe === TipeHasilProduksiItem.HASIL && hasVariant;
    if (!isHasilVariant) {
      if (!Number.isInteger(item.itemId) || (item.itemId ?? 0) <= 0) {
        throw new HasilProduksiError(INPUT_TIDAK_VALID, `items[${index}].itemId wajib angka bulat positif`);
      }
    } else if (item.itemId !== undefined && item.itemId !== null) {
      if (!Number.isInteger(item.itemId) || item.itemId <= 0) {
        throw new HasilProduksiError(INPUT_TIDAK_VALID, `items[${index}].itemId harus angka bulat positif jika diisi`);
      }
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
    if (item.productVariantId !== undefined && item.productVariantId !== null) {
      if (!Number.isInteger(item.productVariantId) || item.productVariantId <= 0) {
        throw new HasilProduksiError(
          INPUT_TIDAK_VALID,
          `items[${index}].productVariantId harus angka bulat positif`,
        );
      }
      if (item.tipe !== TipeHasilProduksiItem.HASIL) {
        throw new HasilProduksiError(
          INPUT_TIDAK_VALID,
          `items[${index}].productVariantId hanya boleh untuk baris HASIL`,
        );
      }
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

  const seenMasuk = new Set<number>();
  for (const row of barisMasuk) {
    if (row.itemId != null) {
      if (seenMasuk.has(row.itemId)) {
        throw new HasilProduksiError(INPUT_TIDAK_VALID, "Item MASUK yang sama tidak boleh dicatat lebih dari sekali");
      }
      seenMasuk.add(row.itemId);
    }
  }

  const seenHasil = new Set<string>();
  for (const row of barisHasil) {
    const key = row.productVariantId ? `variant:${row.productVariantId}` : `item:${row.itemId}`;
    if (seenHasil.has(key)) {
      throw new HasilProduksiError(INPUT_TIDAK_VALID, "Item HASIL yang sama tidak boleh dicatat lebih dari sekali");
    }
    seenHasil.add(key);
  }

  const variantIds = barisHasil
    .map((row) => row.productVariantId)
    .filter((id): id is number => id != null);
  if (new Set(variantIds).size !== variantIds.length) {
    throw new HasilProduksiError(
      INPUT_TIDAK_VALID,
      "Satu ProductVariant hanya boleh muncul pada satu baris HASIL",
    );
  }
  if (input.items.some((item) => item.tipe === TipeHasilProduksiItem.KELUAR)) {
    const tipePerItem = new Map<number, Set<TipeHasilProduksiItem>>();
    for (const item of input.items) {
      if (item.itemId != null) {
        const tipe = tipePerItem.get(item.itemId) ?? new Set<TipeHasilProduksiItem>();
        tipe.add(item.tipe);
        tipePerItem.set(item.itemId, tipe);
      }
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

type RoutingStageRow = {
  id: number;
  routingId: number;
  sequence: number;
  divisiId: number;
  stage: string;
  inputItems: { itemId: number }[];
  outputItems: { itemId: number }[];
};

/**
 * Resolusi tahap routing untuk posting produksi.
 * Satu divisi dapat memiliki lebih dari satu stage, jadi stage TIDAK boleh
 * disimpulkan dari nama divisi saja: input/output harus cocok dengan tepat
 * satu stage aktif.
 */
async function resolveRoutingStage(
  tx: PrismaTransactionClient,
  divisi: { id: number; nama: string },
  inputItemIds: number[],
  outputItemIds: number[],
  requestedStageId?: number,
): Promise<{ stage: RoutingStageRow; isLastStage: boolean }> {
  const stages = (await tx.productionRoutingStage.findMany({
    where: requestedStageId !== undefined
      ? { id: requestedStageId }
      : { divisiId: divisi.id, routing: { isActive: true } },
    include: {
      inputItems: { select: { itemId: true } },
      outputItems: { select: { itemId: true } },
      routing: { select: { id: true, isActive: true } },
    },
    orderBy: [{ routingId: "asc" }, { sequence: "asc" }],
  })) as unknown as Array<
    RoutingStageRow & { routing: { id: number; isActive: boolean } }
  >;

  if (stages.length === 0) {
    throw new HasilProduksiError(
      ROUTING_INVALID,
      `Routing produksi untuk divisi ${divisi.nama} belum dikonfigurasi`,
    );
  }

  const matches = stages.filter((stage) => {
    if (!stage.routing?.isActive) return false;
    if (stage.divisiId !== divisi.id) return false;
    const allowedInputs = new Set(stage.inputItems.map((row) => row.itemId));
    const allowedOutputs = new Set(stage.outputItems.map((row) => row.itemId));
    const inputOk = inputItemIds.every((itemId) => allowedInputs.has(itemId));
    const outputOk =
      allowedOutputs.size === 0
        ? outputItemIds.length === 0 || outputItemIds.every((itemId) => allowedOutputs.has(itemId))
        : outputItemIds.every((itemId) => allowedOutputs.has(itemId));
    return inputOk && outputOk;
  });

  if (matches.length === 0) {
    throw new HasilProduksiError(
      ROUTING_INVALID,
      `Input/output ${divisi.nama} tidak sesuai routing produksi aktif`,
    );
  }
  if (matches.length > 1) {
    throw new HasilProduksiError(
      ROUTING_INVALID,
      `Lebih dari satu tahap routing cocok untuk ${divisi.nama}; kirim routingStageId secara eksplisit`,
    );
  }

  const stage = matches[0];
  const siblings = await tx.productionRoutingStage.findMany({
    where: { routingId: stage.routingId },
    select: { sequence: true },
  });
  const maxSequence = siblings.reduce(
    (max, row) => (row.sequence > max ? row.sequence : max),
    stage.sequence,
  );
  const isLastStage = stage.sequence >= maxSequence || stage.outputItems.length === 0;
  return { stage, isLastStage };
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
        create: details.map((detail) => {
          const jumlah = Number(detail.jumlah);
          // Output yang sudah dikonversi menjadi unit Barang langsung habis
          // dipakai (sisa 0) agar tidak muncul sebagai WIP ganda.
          const terkonversi = detail.productVariantId !== null;
          return {
            itemId: detail.itemId,
            permintaanBarangItemId: null,
            hasilProduksiHarianItemId: detail.id,
            jumlahDiterima: jumlah,
            jumlahDipakai: terkonversi ? jumlah : 0,
            jumlahSisa: terkonversi ? 0 : jumlah,
            satuan: detail.item?.unit ?? "Pcs",
            keteranganSisa: null,
          };
        }),
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
    const detail = details.find((row) => row.id === lot.hasilProduksiHarianItemId);
    if (!detail) continue;
    // Output varian dikonversi menjadi unit Barang; stok item TIDAK ditambah
    // agar tidak terjadi pencatatan ganda antara item dan unit.
    if (detail.productVariantId !== null) continue;
    await postInventoryMovementInTransaction(tx, {
      itemId: lot.itemId,
      pemakaianMaterialItemId: lot.id,
      hasilProduksiHarianId: header.id,
      hasilProduksiHarianItemId: detail.id,
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

/**
 * Konversi output tahap akhir menjadi unit `Barang` + QR, lalu tautkan unit
 * ke baris produksi. Ini pemisahan yang benar: generate Barang membuat
 * identitas; FINISHGOOD nanti hanya mengonfirmasi lolos QC.
 */
async function createVariantUnits(
  tx: PrismaTransactionClient,
  header: HasilProduksiDetail,
  line: HasilProduksiDetailItem,
  userId: number | null,
): Promise<void> {
  const variantId = line.productVariantId;
  if (!variantId) return;
  const jumlah = Number(line.jumlah);
  if (!Number.isInteger(jumlah) || jumlah <= 0) {
    throw new HasilProduksiError(INPUT_TIDAK_VALID, "Jumlah output varian harus bilangan bulat positif");
  }
  const generated = await generateBarangBulkInTransaction(
    tx,
    variantId,
    jumlah,
    header.tanggalProduksi,
  );
  const barangIds = generated.batches.flatMap((batch) => batch.barang.map((barang) => barang.id));
  if (barangIds.length !== jumlah) {
    throw new HasilProduksiError(
      INPUT_TIDAK_VALID,
      "Jumlah unit Barang yang dihasilkan tidak sesuai jumlah output produksi",
    );
  }
  await tx.barang.updateMany({
    where: { id: { in: barangIds } },
    data: { hasilProduksiHarianItemId: line.id },
  });
  const location = await ensureDivisionInventoryLocation(tx, header.divisiId);
  for (const barangId of barangIds) {
    await postInventoryMovementInTransaction(tx, {
      barangId,
      toLocationId: location.id,
      type: "PRODUCTION",
      quantity: 1,
      idempotencyKey: `production-unit:${line.id}:${barangId}`,
      sourceType: "PRODUCTION_OUTPUT_UNIT",
      sourceId: `${header.id}:${line.id}`,
      hasilProduksiHarianId: header.id,
      hasilProduksiHarianItemId: line.id,
      reason: `Unit hasil produksi ${header.nomor}`,
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

function signatureOf(items: HasilProduksiItemInput[]): string {
  return items
    .map((item) => `${item.tipe}:${item.itemId ?? 0}:${item.productVariantId ?? 0}:${item.jumlah}`)
    .sort()
    .join("|");
}

function assertSameDocument(
  existing: HasilProduksiDetail,
  input: HasilProduksiInput,
  tanggal: Date,
): void {
  const existingItems: HasilProduksiItemInput[] = existing.items.map((item) => ({
    itemId: item.itemId,
    productVariantId: item.productVariantId,
    tipe: item.tipe,
    jumlah: Number(item.jumlah),
  }));
  const same =
    existing.divisiId === input.divisiId &&
    tanggalBisnis(existing.tanggalProduksi) === tanggalBisnis(tanggal) &&
    signatureOf(existingItems) === signatureOf(input.items) &&
    (input.bomId === undefined || existing.bomId === input.bomId) &&
    (input.routingStageId === undefined || existing.routingStageId === input.routingStageId);
  if (!same) {
    throw new HasilProduksiError(
      IDEMPOTENCY_CONFLICT,
      "idempotencyKey sudah dipakai untuk dokumen hasil produksi yang berbeda",
    );
  }
}

type WorkOrderRow = {
  id: number;
  orderId: number;
  routingStageId: number;
  status: string;
  routingStage: {
    id: number;
    divisiId: number;
    inputItems: { itemId: number }[];
    outputItems: { itemId: number }[];
  };
};

async function createInTx(
  tx: PrismaTransactionClient,
  input: HasilProduksiInput,
  userId: number | null,
  tanggal: Date,
) {
  let workOrder: WorkOrderRow | null = null;
  if (input.productionWorkOrderId !== undefined) {
    await tx.$queryRaw`SELECT id FROM ProductionWorkOrder WHERE id = ${input.productionWorkOrderId} FOR UPDATE`;
    const found = await tx.productionWorkOrder.findUnique({
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
    workOrder = (found as WorkOrderRow | null) ?? null;
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

  const itemIds = [
    ...new Set(input.items.map((item) => item.itemId).filter((id): id is number => id != null)),
  ];
  const items = itemIds.length > 0
    ? await tx.item.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, kode: true, nama: true, unit: true, divisiId: true, jenis: true, divisi: { select: { nama: true } } },
      })
    : [];
  if (items.length !== itemIds.length) {
    const ada = new Set(items.map((item) => item.id));
    const hilang = itemIds.filter((id) => !ada.has(id));
    throw new HasilProduksiError(ITEM_TIDAK_DITEMUKAN, `Item tidak ditemukan: ${hilang.join(", ")}`);
  }

  const barisMasuk = input.items.filter((item) => item.tipe === TipeHasilProduksiItem.MASUK);
  const barisHasil = input.items.filter((item) => item.tipe === TipeHasilProduksiItem.HASIL);
  const inputItemIds = barisMasuk
    .map((item) => item.itemId)
    .filter((id): id is number => id != null);
  const outputItemIds = barisHasil
    .map((item) => item.itemId)
    .filter((id): id is number => id != null);

  if (workOrder) {
    const allowedInputs = new Set(workOrder.routingStage.inputItems.map((row) => row.itemId));
    const allowedOutputs = new Set(workOrder.routingStage.outputItems.map((row) => row.itemId));
    if (
      inputItemIds.some((itemId) => !allowedInputs.has(itemId)) ||
      outputItemIds.some((itemId) => !allowedOutputs.has(itemId))
    ) {
      throw new HasilProduksiError(
        ROUTING_INVALID,
        "Input/output hasil produksi tidak sesuai dengan routing work order",
      );
    }
  }

  const { stage, isLastStage } = await resolveRoutingStage(
    tx,
    divisi,
    inputItemIds,
    outputItemIds,
    input.routingStageId ?? workOrder?.routingStageId,
  );

  // Output varian = konversi ke produk jadi, hanya boleh pada tahap terakhir.
  // Baris HASIL tanpa varian tetap sah sebagai output WIP/Item (mis. Top Coat
  // yang masih jenis SM), sehingga routing yang belum punya tahap perakitan
  // tidak dipaksa gagal.
  const varianDiTahapBukanTerakhir = !isLastStage && barisHasil.some((row) => row.productVariantId != null);
  if (varianDiTahapBukanTerakhir) {
    throw new HasilProduksiError(
      INPUT_TIDAK_VALID,
      `ProductVariant hanya boleh dicatat pada tahap terakhir routing (tahap ini: ${stage.stage})`,
    );
  }

  // Validasi varian benar-benar ada dan konsisten dengan output routing.
  const variantIds = [
    ...new Set(
      barisHasil
        .map((row) => row.productVariantId)
        .filter((id): id is number => id != null),
    ),
  ];
  if (variantIds.length > 0) {
    const variants = await tx.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, kodeVariant: true },
    });
    if (variants.length !== variantIds.length) {
      const ada = new Set(variants.map((row) => row.id));
      throw new HasilProduksiError(
        INPUT_TIDAK_VALID,
        `ProductVariant tidak ditemukan: ${variantIds.filter((id) => !ada.has(id)).join(", ")}`,
      );
    }
  }

  // BOM dibekukan pada dokumen: kebutuhan teoretis historis dapat direproduksi.
  let bomId: number | null = input.bomId ?? null;
  const resolvedBomIds = new Set<number>();
  for (const variantId of variantIds) {
    const bom = await resolveEffectiveBomForVariant(tx, variantId, tanggal);
    resolvedBomIds.add(bom.id);
  }
  if (input.bomId !== undefined) {
    if (!resolvedBomIds.has(input.bomId)) {
      throw new HasilProduksiError(
        "BOM_NOT_EFFECTIVE",
        "bomId yang dikirim tidak berlaku untuk varian/tanggal produksi ini",
      );
    }
  } else if (resolvedBomIds.size === 1) {
    bomId = [...resolvedBomIds][0];
  } else if (resolvedBomIds.size > 1) {
    // Satu header dengan beberapa BOM: jangan menebak satu referensi.
    bomId = null;
  }

  const keluarPerItem = new Map<number, number>();
  for (const item of input.items) {
    if (item.tipe !== TipeHasilProduksiItem.KELUAR) continue;
    const itemId = wajibItemId(item);
    keluarPerItem.set(itemId, (keluarPerItem.get(itemId) ?? 0) + item.jumlah);
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
    const inputItemId = wajibItemId(inputLine);
    const itemMasuk = items.find((item) => item.id === inputItemId)!;
    const wipRows = await lockWipRows(tx, input.divisiId, inputItemId);
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
    konsumsiPerInput.push({ itemId: inputItemId, jumlah: inputLine.jumlah, rows: alokasi });
  }

  // KELUAR = pengurangan stok pada lokasi divisi pelaksana.
  for (const itemId of [...keluarPerItem.keys()].sort((a, b) => a - b)) {
    const saldo = await getItemStockAtLocation(tx, itemId, divisionLocation.id);
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
      routingStageId: stage.id,
      bomId,
      ...(textOrNull(input.idempotencyKey) !== null
        ? { idempotencyKey: textOrNull(input.idempotencyKey) }
        : {}),
      keterangan: textOrNull(input.keterangan),
      items: {
        create: input.items.map((item) => ({
          itemId: item.itemId ?? null,
          productVariantId: item.productVariantId ?? null,
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
        hasilProduksiHarianItemId: detailMasuk.id,
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

  // Lot WIP untuk output: SM non-varian tetap tersedia; output varian
  // langsung dihabiskan karena dikonversi menjadi unit Barang.
  await createWipHasilProduksi(
    tx,
    header,
    header.items.filter(
      (detail) =>
        detail.tipe === TipeHasilProduksiItem.HASIL &&
        (detail.item?.jenis === "SM" || detail.productVariantId !== null),
    ),
    userId,
  );

  // Baris HASIL yang bukan output varian dan bukan SM → stok item biasa.
  for (const detail of header.items) {
    if (detail.tipe === TipeHasilProduksiItem.MASUK) continue;
    if (detail.tipe === TipeHasilProduksiItem.HASIL) {
      if (detail.productVariantId !== null) continue;
      if (detail.item?.jenis === "SM") continue;
    }
    if (!detail.itemId) continue;
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
      hasilProduksiHarianId: header.id,
      hasilProduksiHarianItemId: detail.id,
      reason: `Produksi ${nomor} - ${divisi.nama}`,
      userId,
      occurredAt: tanggal,
    });
  }

  // Konversi output tahap akhir menjadi unit + QR.
  for (const detail of header.items) {
    if (detail.tipe !== TipeHasilProduksiItem.HASIL) continue;
    if (detail.productVariantId === null) continue;
    await createVariantUnits(tx, header, detail, userId);
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
  const tanggal = awalHariBisnis(input.tanggalProduksi ?? new Date());
  const nomor = textOrNull(input.nomor);
  const idempotencyKey = textOrNull(input.idempotencyKey);
  const normalized: HasilProduksiInput = { ...input, tanggalProduksi: tanggal, nomor, idempotencyKey };

  if (idempotencyKey !== null) {
    const existing = await prisma.hasilProduksiHarian.findUnique({
      where: { idempotencyKey },
      include: detailInclude,
    });
    if (existing) {
      assertSameDocument(existing, normalized, tanggal);
      return withWipMasuk(existing);
    }
  }

  const maksPercobaan = nomor ? 1 : 5;
  for (let percobaan = 1; percobaan <= maksPercobaan; percobaan++) {
    try {
      return await prisma.$transaction((tx) => createInTx(tx, normalized, userId, tanggal));
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

      if (idempotencyKey !== null && isIdempotencyUniqueViolation(error)) {
        const existing = await prisma.hasilProduksiHarian.findUnique({
          where: { idempotencyKey },
          include: detailInclude,
        });
        if (existing) {
          assertSameDocument(existing, normalized, tanggal);
          return withWipMasuk(existing);
        }
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

export async function getHasilProduksiById(id: number) {
  const row = await prisma.hasilProduksiHarian.findUnique({
    where: { id },
    include: detailInclude,
  });
  return row ? withWipMasuk(row) : null;
}

export async function listHasilProduksi(filter: {
  page: number;
  limit: number;
  divisiId?: number;
  dari?: Date;
  sampai?: Date;
}) {
  const where: Prisma.HasilProduksiHarianWhereInput = {};
  if (filter.divisiId !== undefined) where.divisiId = filter.divisiId;
  if (filter.dari || filter.sampai) {
    where.tanggalProduksi = {};
    if (filter.dari) where.tanggalProduksi.gte = awalHariBisnis(filter.dari);
    if (filter.sampai) where.tanggalProduksi.lt = awalHariBisnis(new Date(filter.sampai.getTime() + 86_400_000));
  }
  const [total, rows] = await Promise.all([
    prisma.hasilProduksiHarian.count({ where }),
    prisma.hasilProduksiHarian.findMany({
      where,
      include: detailInclude,
      orderBy: [{ tanggalProduksi: "desc" }, { id: "desc" }],
      skip: (filter.page - 1) * filter.limit,
      take: filter.limit,
    }),
  ]);
  return {
    data: rows.map(withWipMasuk),
    meta: {
      page: filter.page,
      limit: filter.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filter.limit)),
    },
  };
}

export { BomError };
