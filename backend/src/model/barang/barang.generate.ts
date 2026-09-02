import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";

export type GenerateBarangResult = {
  totalDibuat: number;
  batches: {
    kodeBatch: string;
    batchId: number;
    jumlah: number;
    barang: { kodeBarang: string; id: number }[];
  }[];
};

type TxClient = PrismaTransactionClient;
type CreatedBarangRow = { id: number; kodeBarang: string };

export const BATCH_KAPASITAS = 5000;

function formatDateForBarcode(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(2);
  return `${day}${month}${year}`;
}

function generateKodeBarang(
  nomorBatch: number,
  kodeVariant: string,
  date: Date,
  counter: number,
): string {
  const batchStr = `BC${String(nomorBatch).padStart(3, "0")}`;
  const dateStr = formatDateForBarcode(date);
  const counterStr = String(counter).padStart(4, "0");
  return `${batchStr}-${kodeVariant}-${dateStr}-${counterStr}`;
}

function isRetryableTxError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  if (code === "P2002" || code === "P2034") return true;
  const message = (error as { message?: string } | null)?.message ?? "";
  return message.includes("write conflict") || message.includes("deadlock");
}

async function getOrCreateActiveBatch(tx: TxClient): Promise<{
  id: number;
  nomorBatch: number;
  totalProduksi: number;
  kapasitas: number;
}> {
  const batch = await tx.productionBatch.findFirst({
    where: { status: "AKTIF" },
    orderBy: { nomorBatch: "desc" },
    select: {
      id: true,
      nomorBatch: true,
      totalProduksi: true,
      kapasitas: true,
    },
  });

  if (batch) return batch;

  return tx.productionBatch.create({
    data: {
      nomorBatch: 1,
      totalProduksi: 0,
      kapasitas: BATCH_KAPASITAS,
      status: "AKTIF",
    },
    select: {
      id: true,
      nomorBatch: true,
      totalProduksi: true,
      kapasitas: true,
    },
  });
}

async function createNextBatch(
  tx: TxClient,
  currentBatchId: number,
  currentNomorBatch: number,
): Promise<{
  id: number;
  nomorBatch: number;
  totalProduksi: number;
  kapasitas: number;
}> {
  await tx.productionBatch.update({
    where: { id: currentBatchId },
    data: { status: "SELESAI" },
  });

  const nextNomor = currentNomorBatch + 1;
  return tx.productionBatch.create({
    data: {
      nomorBatch: nextNomor,
      totalProduksi: 0,
      kapasitas: BATCH_KAPASITAS,
      status: "AKTIF",
    },
    select: {
      id: true,
      nomorBatch: true,
      totalProduksi: true,
      kapasitas: true,
    },
  });
}

async function allocateNomorUrut(
  tx: TxClient,
  batchId: number,
  variantId: number,
  dateOnly: Date,
  jumlah: number,
): Promise<number> {
  const rows = await tx.$queryRaw<{ currentCount: number }[]>`
    SELECT currentCount
    FROM BarangCounter
    WHERE batchId = ${batchId} AND variantId = ${variantId} AND tanggal = ${dateOnly}
    FOR UPDATE`;

  if (rows.length === 0) {
    await tx.barangCounter.create({
      data: { batchId, variantId, tanggal: dateOnly, currentCount: jumlah },
      select: { currentCount: true },
    });
    return 1;
  }

  const mulai = rows[0].currentCount + 1;
  await tx.barangCounter.update({
    where: {
      batchId_variantId_tanggal: { batchId, variantId, tanggal: dateOnly },
    },
    data: { currentCount: rows[0].currentCount + jumlah },
  });
  return mulai;
}

export async function generateBarangBulk(
  variantId: number,
  jumlah: number,
): Promise<GenerateBarangResult> {
  if (jumlah < 1 || jumlah > 50000) {
    throw new Error("Jumlah harus antara 1 dan 50000");
  }

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true, kodeVariant: true },
  });

  if (!variant) {
    throw new Error("Variant tidak ditemukan");
  }

  const today = new Date();
  const dateOnly = new Date(today);
  dateOnly.setHours(0, 0, 0, 0);
  const MAX_RETRIES = 5;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await prisma.$transaction(async (tx: TxClient) => {
        const batchGroups: GenerateBarangResult["batches"] = [];
        let remaining = jumlah;

        await tx.$executeRaw`SELECT id FROM ProductionBatch WHERE status = 'AKTIF' ORDER BY nomorBatch DESC LIMIT 1 FOR UPDATE`;

        let batch = await getOrCreateActiveBatch(tx);

        while (remaining > 0) {
          const sisaBatch = batch.kapasitas - batch.totalProduksi;
          const jumlahBatchIni = Math.min(remaining, sisaBatch);

          if (jumlahBatchIni <= 0) {
            batch = await createNextBatch(tx, batch.id, batch.nomorBatch);
            continue;
          }

          const mulai = await allocateNomorUrut(
            tx,
            batch.id,
            variantId,
            dateOnly,
            jumlahBatchIni,
          );
          const kodeList: string[] = [];

          for (let n = 0; n < jumlahBatchIni; n++) {
            kodeList.push(
              generateKodeBarang(
                batch.nomorBatch,
                variant.kodeVariant,
                today,
                mulai + n,
              ),
            );
          }

          await tx.barang.createMany({
            data: kodeList.map((kodeBarang) => ({
              kodeBarang,
              variantId,
              batchId: batch.id,
              tanggal: today,
              status: "REGISTER",
            })),
          });

          const createdRows: CreatedBarangRow[] = await tx.barang.findMany({
            where: { kodeBarang: { in: kodeList } },
            select: { id: true, kodeBarang: true },
          });

          await tx.riwayatBarang.createMany({
            data: createdRows.map((row) => ({
              barangId: row.id,
              status: "REGISTER",
              keterangan: "Barang dibuat",
            })),
          });

          await tx.productionBatch.update({
            where: { id: batch.id },
            data: { totalProduksi: { increment: jumlahBatchIni } },
          });

          const newTotal = batch.totalProduksi + jumlahBatchIni;
          if (newTotal >= batch.kapasitas) {
            await tx.productionBatch.update({
              where: { id: batch.id },
              data: { status: "SELESAI" },
            });
          }

          batchGroups.push({
            kodeBatch: `BC${String(batch.nomorBatch).padStart(3, "0")}`,
            batchId: batch.id,
            jumlah: jumlahBatchIni,
            barang: createdRows,
          });

          remaining -= jumlahBatchIni;

          if (remaining > 0) {
            if (newTotal >= batch.kapasitas) {
              batch = await tx.productionBatch.create({
                data: {
                  nomorBatch: batch.nomorBatch + 1,
                  totalProduksi: 0,
                  kapasitas: BATCH_KAPASITAS,
                  status: "AKTIF",
                },
                select: {
                  id: true,
                  nomorBatch: true,
                  totalProduksi: true,
                  kapasitas: true,
                },
              });
            } else {
              batch = await tx.productionBatch.findUniqueOrThrow({
                where: { id: batch.id },
                select: {
                  id: true,
                  nomorBatch: true,
                  totalProduksi: true,
                  kapasitas: true,
                },
              });
            }
          }
        }

        return {
          totalDibuat: jumlah,
          batches: batchGroups,
        } satisfies GenerateBarangResult;
      });

      return result;
    } catch (error: unknown) {
      if (isRetryableTxError(error) && attempt < MAX_RETRIES - 1) {
        await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }

  throw new Error("Gagal generate barang setelah beberapa percobaan");
}

export async function getGenerateInfo(variantId: number): Promise<{
  variantId: number;
  kodeVariant: string;
  tanggal: string;
  batch: {
    kodeBatch: string;
    totalProduksi: number;
    kapasitas: number;
    remaining: number;
  };
  nextNumber: number;
}> {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true, kodeVariant: true },
  });

  if (!variant) {
    throw new Error("Variant tidak ditemukan");
  }

  let batch = await prisma.productionBatch.findFirst({
    where: { status: "AKTIF" },
    orderBy: { nomorBatch: "desc" },
    select: {
      id: true,
      nomorBatch: true,
      totalProduksi: true,
      kapasitas: true,
    },
  });

  if (!batch) {
    batch = {
      id: 0,
      nomorBatch: 1,
      totalProduksi: 0,
      kapasitas: BATCH_KAPASITAS,
    };
  }

  const today = new Date();
  const dateOnly = new Date(today);
  dateOnly.setHours(0, 0, 0, 0);
  const tanggalStr = today.toISOString().split("T")[0];

  let nextNumber = 1;
  if (batch.id > 0) {
    const counter = await prisma.barangCounter.findUnique({
      where: {
        batchId_variantId_tanggal: {
          batchId: batch.id,
          variantId,
          tanggal: dateOnly,
        },
      },
      select: { currentCount: true },
    });
    nextNumber = (counter?.currentCount ?? 0) + 1;
  }

  return {
    variantId: variant.id,
    kodeVariant: variant.kodeVariant,
    tanggal: tanggalStr,
    batch: {
      kodeBatch: `BC${String(batch.nomorBatch).padStart(3, "0")}`,
      totalProduksi: batch.totalProduksi,
      kapasitas: batch.kapasitas,
      remaining: batch.kapasitas - batch.totalProduksi,
    },
    nextNumber,
  };
}
