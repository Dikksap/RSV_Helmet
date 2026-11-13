import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const tx = {
    gudang: {
      create: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    inventoryLocation: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  return {
    tx,
    $transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
  };
});

vi.mock("../src/lib/prisma.js", () => ({ default: prismaMock }));

import { createGudang, updateGudang } from "../src/model/gudang/gudang.js";

describe("warehouse master model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a linked warehouse inventory location transactionally", async () => {
    prismaMock.tx.gudang.create.mockResolvedValue({
      id: 8,
      kode: "WH8",
      name: "Gudang Baru",
      isActive: true,
    });
    prismaMock.tx.inventoryLocation.create.mockResolvedValue({ id: 12 });
    prismaMock.tx.gudang.findUniqueOrThrow.mockResolvedValue({
      id: 8,
      kode: "WH8",
      name: "Gudang Baru",
      isActive: true,
      _count: { barang: 0 },
      jenisItems: [],
    });

    await createGudang({ kode: "WH8", name: "Gudang Baru" });

    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
    expect(prismaMock.tx.inventoryLocation.create).toHaveBeenCalledWith({
      data: {
        code: "WH-8",
        name: "Gudang Baru",
        type: "WAREHOUSE",
        gudangId: 8,
        isActive: true,
      },
    });
  });

  it("synchronizes the linked inventory location when a warehouse changes", async () => {
    prismaMock.tx.gudang.update.mockResolvedValue({
      id: 8,
      kode: "WH8",
      name: "Gudang Diperbarui",
      isActive: false,
    });
    prismaMock.tx.inventoryLocation.findUnique.mockResolvedValue({ id: 12 });
    prismaMock.tx.gudang.findUniqueOrThrow.mockResolvedValue({
      id: 8,
      kode: "WH8",
      name: "Gudang Diperbarui",
      isActive: false,
      _count: { barang: 0 },
      jenisItems: [],
    });

    await updateGudang(8, { name: "Gudang Diperbarui", isActive: false });

    expect(prismaMock.tx.inventoryLocation.update).toHaveBeenCalledWith({
      where: { id: 12 },
      data: { name: "Gudang Diperbarui", isActive: false },
    });
  });
});
