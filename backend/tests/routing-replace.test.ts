import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const tx = {
    productionRouting: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
  };
  return {
    tx,
    divisi: { findMany: vi.fn() },
    item: { findMany: vi.fn() },
    productionRouting: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
});

vi.mock("../src/lib/prisma.js", () => ({ default: prismaMock }));

import { replaceActiveRouting } from "../src/model/quality/routing.js";

const stages = [
  { stage: "BUFFING", divisiId: 1, inputItemIds: [10], outputItemIds: [11] },
  { stage: "TOP_COAT", divisiId: 5, inputItemIds: [11], outputItemIds: [12] },
];

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.divisi.findMany.mockResolvedValue([{ id: 1 }, { id: 5 }]);
  prismaMock.item.findMany.mockResolvedValue([{ id: 10 }, { id: 11 }, { id: 12 }]);
  prismaMock.productionRouting.findUnique.mockResolvedValue({ id: 7 });
  prismaMock.tx.productionRouting.findFirst.mockResolvedValue({ version: 3 });
  prismaMock.tx.productionRouting.update.mockResolvedValue({ id: 7 });
  prismaMock.tx.productionRouting.updateMany.mockResolvedValue({ count: 2 });
  prismaMock.tx.productionRouting.create.mockResolvedValue({ id: 21, version: 4, stages: [] });
  prismaMock.$transaction.mockImplementation(async (fn: (client: typeof prismaMock.tx) => unknown) =>
    fn(prismaMock.tx),
  );
});

describe("replaceActiveRouting", () => {
  it("dengan routingId: hanya menonaktifkan routing tersebut dan membuat versi baru", async () => {
    const hasil = await replaceActiveRouting(stages, 7);

    expect(prismaMock.tx.productionRouting.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { isActive: false },
    });
    expect(prismaMock.tx.productionRouting.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.tx.productionRouting.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          version: 4,
          isActive: true,
          stages: { create: expect.arrayContaining([expect.objectContaining({ stage: "BUFFING", sequence: 0 })]) },
        }),
      }),
    );
    expect(hasil).toMatchObject({ id: 21, version: 4 });
  });

  it("tanpa routingId: perilaku lama, menonaktifkan seluruh routing aktif", async () => {
    await replaceActiveRouting(stages);

    expect(prismaMock.productionRouting.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.tx.productionRouting.update).not.toHaveBeenCalled();
    expect(prismaMock.tx.productionRouting.updateMany).toHaveBeenCalledWith({
      where: { isActive: true },
      data: { isActive: false },
    });
  });

  it("menolak routingId yang tidak ditemukan tanpa menulis apa pun", async () => {
    prismaMock.productionRouting.findUnique.mockResolvedValue(null);

    await expect(replaceActiveRouting(stages, 99)).rejects.toMatchObject({
      code: "ROUTING_TIDAK_DITEMUKAN",
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.tx.productionRouting.create).not.toHaveBeenCalled();
  });

  it("menolak routingId tidak valid dan stages kosong", async () => {
    await expect(replaceActiveRouting(stages, 0)).rejects.toMatchObject({ code: "ROUTING_TIDAK_VALID" });
    await expect(replaceActiveRouting([])).rejects.toMatchObject({ code: "ROUTING_TIDAK_VALID" });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
