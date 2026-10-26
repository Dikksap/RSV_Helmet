import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    item: { findMany: vi.fn() },
    divisi: { findMany: vi.fn() },
    productionRouting: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
  };
  return {
    tx,
    prisma: {
      $transaction: vi.fn(),
    },
  };
});

vi.mock("../src/lib/prisma.js", () => ({ default: mocks.prisma }));

import { saveProductionRouting } from "../src/model/quality/routing.js";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tx.item.findMany.mockResolvedValue([
    { id: 10, kode: "RAW", nama: "Bahan awal", divisiId: 1, jenis: "RAW" },
    { id: 11, kode: "SM1", nama: "Hasil tahap satu", divisiId: 1, jenis: "SM" },
    { id: 13, kode: "SM3", nama: "Hasil tahap tambahan", divisiId: 1, jenis: "SM" },
    { id: 12, kode: "SM2", nama: "Hasil tahap dua", divisiId: 2, jenis: "SM" },
  ]);
  mocks.tx.divisi.findMany.mockResolvedValue([{ id: 1, nama: "Produksi A" }, { id: 2, nama: "Produksi B" }]);
  mocks.tx.productionRouting.findFirst.mockResolvedValue(null);
  mocks.tx.productionRouting.updateMany.mockResolvedValue({ count: 0 });
  mocks.tx.productionRouting.create.mockResolvedValue({ id: 1, version: 1 });
  mocks.prisma.$transaction.mockImplementation((callback: (tx: typeof mocks.tx) => Promise<unknown>) => callback(mocks.tx));
});

describe("production routing global multi-item", () => {
  it("menyimpan tahap global dengan beberapa item input dan output", async () => {
    await saveProductionRouting({
      stages: [
        { stage: "Persiapan khusus", divisiId: 1, inputItemIds: [10], outputItemIds: [11, 13] },
        { stage: "Perakitan akhir", divisiId: 2, inputItemIds: [11, 13], outputItemIds: [12] },
      ],
    });

    expect(mocks.tx.productionRouting.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        stages: {
          create: [
            {
              stage: "Persiapan khusus",
              sequence: 0,
              divisiId: 1,
              inputItems: { create: [{ itemId: 10 }] },
              outputItems: { create: [{ itemId: 11 }, { itemId: 13 }] },
            },
            {
              stage: "Perakitan akhir",
              sequence: 1,
              divisiId: 2,
              inputItems: { create: [{ itemId: 11 }, { itemId: 13 }] },
              outputItems: { create: [{ itemId: 12 }] },
            },
          ],
        },
      }),
    }));
  });

  it("menolak routing yang item input tahapnya tidak menyambung dengan output sebelumnya", async () => {
    await expect(saveProductionRouting({
      stages: [
        { stage: "Persiapan", divisiId: 1, inputItemIds: [10], outputItemIds: [11] },
        { stage: "Penyelesaian", divisiId: 2, inputItemIds: [10], outputItemIds: [12] },
      ],
    })).rejects.toMatchObject({ code: "ROUTING_INVALID" });

    expect(mocks.tx.productionRouting.create).not.toHaveBeenCalled();
  });
});
