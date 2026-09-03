import prisma, { type PrismaTransactionClient } from "../../lib/prisma.js";
import { barangInclude } from "./barang.js";
import {
  VALID_STATUSES,
  VALID_TRANSITIONS,
  type StatusBarang,
} from "./barang.status.js";

const BATCH_KAPASITAS = 5000;

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

// =============================================
// Create
// =============================================

export interface CreateBarangInput {
  variantId: number;
  batchId?: number | null;
  kodeBarang?: string;
  tanggal?: Date;
  status?: StatusBarang;
  keterangan?: string;
}

export async function createBarang(input: CreateBarangInput) {
  const { variantId, batchId, kodeBarang, tanggal, status, keterangan } =
    input;

  if (!variantId || Number.isNaN(Number(variantId))) {
    throw new Error("Field 'variantId' wajib diisi dan berupa angka");
  }

  if (status && !VALID_STATUSES.includes(status as StatusBarang)) {
    throw new Error(
      "Field 'status' harus salah satu dari: REGISTER, FINISHGOOD, RETUR, OUT, BAD",
    );
  }

  const variant = await prisma.productVariant.findUnique({
    where: { id: Number(variantId) },
    select: { id: true, kodeVariant: true },
  });

  if (!variant) {
    throw new Error("Variant tidak ditemukan");
  }

  if (batchId !== undefined && batchId !== null) {
    const batch = await prisma.productionBatch.findUnique({
      where: { id: Number(batchId) },
    });
    if (!batch) throw new Error("Batch tidak ditemukan");
  }

  // Manual kodeBarang path — langsung create tanpa counter/batch auto
  if (kodeBarang && kodeBarang.trim().length > 0) {
    const kode = kodeBarang.trim();
    const exists = await prisma.barang.findUnique({
      where: { kodeBarang: kode },
    });
    if (exists) throw new Error("Kode barang sudah ada");

    const finalTanggal = tanggal ?? new Date();
    const finalStatus = (status as StatusBarang) ?? "REGISTER";

    return prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const barang = await tx.barang.create({
        data: {
          kodeBarang: kode,
          variantId: Number(variantId),
          batchId: batchId ? Number(batchId) : null,
          tanggal: finalTanggal,
          status: finalStatus,
        },
        include: barangInclude,
      });

      await tx.riwayatBarang.create({
        data: {
          barangId: barang.id,
          status: finalStatus,
          keterangan: keterangan ?? "Barang dibuat (manual)",
        },
      });

      if (batchId) {
        await tx.productionBatch.update({
          where: { id: Number(batchId) },
          data: { totalProduksi: { increment: 1 } },
        });
      }

      return barang;
    });
  }

  // Auto-generate kodeBarang (ikut counter + batch allocation)
  const finalTanggal = tanggal ?? new Date();
  const finalStatus = (status as StatusBarang) ?? "REGISTER";
  const dateOnly = new Date(finalTanggal);
  dateOnly.setHours(0, 0, 0, 0);

  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    let targetBatch: { id: number; nomorBatch: number; totalProduksi: number; kapasitas: number };

    if (batchId !== undefined && batchId !== null) {
      const b = await tx.productionBatch.findUnique({
        where: { id: Number(batchId) },
        select: { id: true, nomorBatch: true, totalProduksi: true, kapasitas: true },
      });
      if (!b) throw new Error("Batch tidak ditemukan");
      targetBatch = b;
    } else {
      // Reuse logic: cari batch AKTIF, kalau tidak ada buat baru
      await tx.$executeRaw`SELECT id FROM ProductionBatch WHERE status = 'AKTIF' ORDER BY nomorBatch DESC LIMIT 1 FOR UPDATE`;
      const existing = await tx.productionBatch.findFirst({
        where: { status: "AKTIF" },
        orderBy: { nomorBatch: "desc" },
        select: { id: true, nomorBatch: true, totalProduksi: true, kapasitas: true },
      });
      if (existing) {
        targetBatch = existing;
      } else {
        targetBatch = await tx.productionBatch.create({
          data: {
            nomorBatch: 1,
            totalProduksi: 0,
            kapasitas: BATCH_KAPASITAS,
            status: "AKTIF",
          },
          select: { id: true, nomorBatch: true, totalProduksi: true, kapasitas: true },
        });
      }

      // Jika batch aktif penuh, buat batch baru
      if (targetBatch.totalProduksi >= targetBatch.kapasitas) {
        await tx.productionBatch.update({
          where: { id: targetBatch.id },
          data: { status: "SELESAI" },
        });
        targetBatch = await tx.productionBatch.create({
          data: {
            nomorBatch: targetBatch.nomorBatch + 1,
            totalProduksi: 0,
            kapasitas: BATCH_KAPASITAS,
            status: "AKTIF",
          },
          select: { id: true, nomorBatch: true, totalProduksi: true, kapasitas: true },
        });
      }
    }

    // Allocate counter FOR UPDATE
    const rows = await tx.$queryRaw<{ currentCount: number }[]>`
      SELECT currentCount
      FROM BarangCounter
      WHERE batchId = ${targetBatch.id} AND variantId = ${Number(variantId)} AND tanggal = ${dateOnly}
      FOR UPDATE`;

    let nomorUrut: number;
    if (rows.length === 0) {
      await tx.barangCounter.create({
        data: {
          batchId: targetBatch.id,
          variantId: Number(variantId),
          tanggal: dateOnly,
          currentCount: 1,
        },
      });
      nomorUrut = 1;
    } else {
      nomorUrut = rows[0].currentCount + 1;
      await tx.barangCounter.update({
        where: {
          batchId_variantId_tanggal: {
            batchId: targetBatch.id,
            variantId: Number(variantId),
            tanggal: dateOnly,
          },
        },
        data: { currentCount: nomorUrut },
      });
    }

    const kode = generateKodeBarang(
      targetBatch.nomorBatch,
      variant.kodeVariant,
      finalTanggal,
      nomorUrut,
    );

    const barang = await tx.barang.create({
      data: {
        kodeBarang: kode,
        variantId: Number(variantId),
        batchId: targetBatch.id,
        tanggal: finalTanggal,
        status: finalStatus,
      },
      include: barangInclude,
    });

    await tx.riwayatBarang.create({
      data: {
        barangId: barang.id,
        status: finalStatus,
        keterangan: keterangan ?? "Barang dibuat",
      },
    });

    const newTotal = targetBatch.totalProduksi + 1;
    await tx.productionBatch.update({
      where: { id: targetBatch.id },
      data: {
        totalProduksi: { increment: 1 },
        ...(newTotal >= targetBatch.kapasitas ? { status: "SELESAI" } : {}),
      },
    });

    return barang;
  });
}

// =============================================
// Update
// =============================================

export interface UpdateBarangInput {
  variantId?: number;
  batchId?: number | null;
  kodeBarang?: string;
  tanggal?: Date;
  status?: StatusBarang;
  keterangan?: string;
}

export async function updateBarang(id: number, input: UpdateBarangInput) {
  if (Number.isNaN(id)) throw new Error("Parameter 'id' tidak valid");

  const existing = await prisma.barang.findUnique({ where: { id } });
  if (!existing) throw new Error("Barang tidak ditemukan");

  const data: Record<string, unknown> = {};
  let statusChanged = false;
  let newStatus: StatusBarang | undefined;

  if (input.variantId !== undefined) {
    const vId = Number(input.variantId);
    if (Number.isNaN(vId)) throw new Error("Field 'variantId' harus angka");
    const variant = await prisma.productVariant.findUnique({
      where: { id: vId },
    });
    if (!variant) throw new Error("Variant tidak ditemukan");
    data.variantId = vId;
  }

  if (input.batchId !== undefined) {
    if (input.batchId === null) {
      data.batchId = null;
    } else {
      const bId = Number(input.batchId);
      if (Number.isNaN(bId)) throw new Error("Field 'batchId' harus angka");
      const batch = await prisma.productionBatch.findUnique({
        where: { id: bId },
      });
      if (!batch) throw new Error("Batch tidak ditemukan");
      data.batchId = bId;
    }
  }

  if (input.kodeBarang !== undefined) {
    const kode = String(input.kodeBarang).trim();
    if (kode.length === 0) throw new Error("Field 'kodeBarang' tidak boleh kosong");
    const dup = await prisma.barang.findUnique({ where: { kodeBarang: kode } });
    if (dup && dup.id !== id) throw new Error("Kode barang sudah ada");
    data.kodeBarang = kode;
  }

  if (input.tanggal !== undefined) {
    const t = input.tanggal instanceof Date ? input.tanggal : new Date(input.tanggal as unknown as string);
    if (Number.isNaN(t.getTime())) throw new Error("Field 'tanggal' harus tanggal valid");
    data.tanggal = t;
  }

  if (input.status !== undefined) {
    if (!VALID_STATUSES.includes(input.status as StatusBarang)) {
      throw new Error(
        "Field 'status' harus salah satu dari: REGISTER, FINISHGOOD, RETUR, OUT, BAD",
      );
    }
    newStatus = input.status as StatusBarang;
    const current = existing.status as StatusBarang;
    const allowed = current === newStatus || VALID_TRANSITIONS[current]?.includes(newStatus);
    if (!allowed) {
      throw new Error(`Transisi status dari ${current} ke ${newStatus} tidak valid`);
    }
    if (current !== newStatus) {
      data.status = newStatus;
      statusChanged = true;
    }
  }

  if (Object.keys(data).length === 0) {
    throw new Error("Tidak ada field yang diupdate");
  }

  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    // Adjust batch totalProduksi jika batchId berpindah (perhatikan: null = lepas batch, jangan fallback via ??)
    const oldBatchId = existing.batchId;
    const newBatchId = data.batchId !== undefined ? (data.batchId as number | null) : oldBatchId;

    if (data.batchId !== undefined && oldBatchId !== newBatchId) {
      if (oldBatchId) {
        await tx.productionBatch.update({
          where: { id: oldBatchId },
          data: { totalProduksi: { decrement: 1 } },
        });
      }
      if (newBatchId) {
        await tx.productionBatch.update({
          where: { id: newBatchId as number },
          data: { totalProduksi: { increment: 1 } },
        });
      }
    }

    const updated = await tx.barang.update({
      where: { id },
      data,
      include: barangInclude,
    });

    if (statusChanged && newStatus) {
      await tx.riwayatBarang.create({
        data: {
          barangId: id,
          status: newStatus,
          keterangan: input.keterangan,
        },
      });
    }

    return updated;
  });
}

// =============================================
// Delete
// =============================================

export async function deleteBarang(id: number) {
  if (Number.isNaN(id)) throw new Error("Parameter 'id' tidak valid");

  const existing = await prisma.barang.findUnique({ where: { id } });
  if (!existing) throw new Error("Barang tidak ditemukan");

  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    await tx.riwayatBarang.deleteMany({ where: { barangId: id } });

    await tx.barang.delete({ where: { id } });

    if (existing.batchId) {
      await tx.productionBatch.update({
        where: { id: existing.batchId },
        data: { totalProduksi: { decrement: 1 } },
      });
    }

    return { id };
  });
}
