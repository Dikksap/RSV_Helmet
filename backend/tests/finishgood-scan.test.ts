import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx, prismaMock } = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    barang: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    statusBarang: { findUnique: vi.fn() },
    riwayatBarang: { findFirst: vi.fn(), create: vi.fn() },
  };
  const prismaMock = {
    $transaction: vi.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
    statusTransition: { findMany: vi.fn() },
  };
  return { tx, prismaMock };
});

vi.mock("../src/lib/prisma.js", () => ({ default: prismaMock }));

import { updateBarangStatus, bulkUpdateBarangStatus } from "../src/model/barang/barang.status.js";

const barangRow = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  kodeBarang: "BC001-W001-251126-0001",
  status: "REGISTER",
  finishGoodAt: null,
  ...overrides,
});

const updatedRow = (overrides: Record<string, unknown> = {}) => ({
  ...barangRow(overrides),
  variant: { id: 2, kodeVariant: "V002" },
  batch: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  tx.$executeRaw.mockResolvedValue(1);
  tx.$queryRaw.mockResolvedValue([]);
  tx.statusBarang.findUnique.mockResolvedValue({ kode: "FINISHGOOD", isActive: true });
  tx.riwayatBarang.findFirst.mockResolvedValue(null);
  tx.riwayatBarang.create.mockResolvedValue({ id: 9 });
  tx.barang.findUnique.mockResolvedValue(barangRow());
  tx.barang.findUniqueOrThrow.mockResolvedValue(updatedRow({ status: "FINISHGOOD" }));
  tx.barang.update.mockImplementation(async ({ data }: any) => updatedRow(data));
  // tanpa baris transisi = semua transisi diizinkan
  prismaMock.statusTransition.findMany.mockResolvedValue([]);
});

describe("FINISHGOOD sebagai konfirmasi QC", () => {
  it("REGISTER → FINISHGOOD mengisi finishGoodAt dan menulis histori", async () => {
    const result = await updateBarangStatus(1, "FINISHGOOD", "lolos QC", { userId: 5 });

    expect(result.status).toBe("FINISHGOOD");
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.barang.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ status: "FINISHGOOD", finishGoodAt: expect.any(Date) }),
      }),
    );
    expect(tx.riwayatBarang.create).toHaveBeenCalledWith({
      data: {
        barangId: 1,
        status: "FINISHGOOD",
        keterangan: "lolos QC",
      },
    });
  });

  it("tidak membutuhkan QualityInspectionLine / QC PASS (tidak ada query QC sama sekali)", async () => {
    await updateBarangStatus(1, "FINISHGOOD", undefined, { userId: 5 });

    const calls = JSON.stringify([
      tx.barang.findUnique.mock.calls,
      tx.barang.update.mock.calls,
      tx.riwayatBarang.create.mock.calls,
    ]);
    expect(calls).not.toContain("qualityInspection");
  });

  it("scan ulang FINISHGOOD idempoten: tidak menulis ulang timestamp/histori", async () => {
    tx.barang.findUnique.mockResolvedValue(
      barangRow({ status: "FINISHGOOD", finishGoodAt: new Date("2026-11-01T03:00:00.000Z") }),
    );

    const result = await updateBarangStatus(1, "FINISHGOOD", undefined, { userId: 5 });

    expect(result.alreadyFinishGood).toBe(true);
    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.barang.update).not.toHaveBeenCalled();
    expect(tx.riwayatBarang.create).not.toHaveBeenCalled();
  });

  it("data legacy FINISHGOOD tanpa timestamp: isi timestamp sekali, histori tidak digandakan", async () => {
    tx.barang.findUnique.mockResolvedValue(barangRow({ status: "FINISHGOOD", finishGoodAt: null }));
    tx.riwayatBarang.findFirst.mockResolvedValue({ id: 3 });

    const result = await updateBarangStatus(1, "FINISHGOOD", undefined, { userId: 5 });

    expect(result.alreadyFinishGood).toBe(true);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.barang.update).toHaveBeenCalledTimes(1);
    expect(tx.riwayatBarang.create).not.toHaveBeenCalled();
  });

  it("status OUT tidak menyentuh finishGoodAt", async () => {
    tx.statusBarang.findUnique.mockResolvedValue({ kode: "OUT", isActive: true });

    await updateBarangStatus(1, "OUT", "keluar gudang", { userId: 5 });

    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.barang.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "OUT" } }),
    );
    expect(tx.riwayatBarang.create).toHaveBeenCalled();
  });

  it("menolak transisi yang tidak diizinkan", async () => {
    tx.barang.findUnique.mockResolvedValue(barangRow({ status: "OUT", finishGoodAt: new Date() }));
    prismaMock.statusTransition.findMany.mockResolvedValue([{ toKode: "BAD" }]);

    await expect(updateBarangStatus(1, "FINISHGOOD")).rejects.toThrow("tidak valid");
    expect(tx.barang.update).not.toHaveBeenCalled();
  });

  it("menolak status yang tidak terdaftar/tidak aktif", async () => {
    tx.statusBarang.findUnique.mockResolvedValue(null);
    await expect(updateBarangStatus(1, "FINISHGOOD")).rejects.toThrow("tidak valid");
  });

  it("menolak barang yang tidak ditemukan", async () => {
    tx.barang.findUnique.mockResolvedValue(null);
    await expect(updateBarangStatus(99, "FINISHGOOD")).rejects.toThrow("tidak ditemukan");
  });

  it("bulk scan memproses unit lain walau ada unit gagal dan melaporkan already FINISHGOOD", async () => {
    tx.barang.findUnique
      .mockResolvedValueOnce(barangRow({ id: 1 }))
      .mockResolvedValueOnce(barangRow({ id: 2, status: "FINISHGOOD", finishGoodAt: new Date() }))
      .mockResolvedValueOnce(null);

    const result = await bulkUpdateBarangStatus([
      { id: 1, status: "FINISHGOOD" },
      { id: 2, status: "FINISHGOOD" },
      { id: 3, status: "FINISHGOOD" },
    ]);

    expect(result.success).toHaveLength(2);
    expect(result.success[1].alreadyFinishGood).toBe(true);
    expect(result.failed).toEqual([{ id: 3, error: "Barang tidak ditemukan" }]);
  });
});
