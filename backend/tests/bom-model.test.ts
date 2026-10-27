import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => {
  const tx = {
    bom: {
      create: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    bomItem: {
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  return {
    tx,
    bom: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  };
});

vi.mock("../src/lib/prisma.js", () => ({ default: prismaMock }));

import { createBom } from "../src/model/bom/bom.js";

describe("createBom", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    let nextItemId = 100;
    prismaMock.tx.bom.create.mockResolvedValue({ id: 12 });
    prismaMock.tx.bom.update.mockResolvedValue({ id: 12 });
    prismaMock.tx.bom.findUniqueOrThrow.mockResolvedValue({ id: 12, subassemblyId: 7, items: [] });
    prismaMock.tx.bomItem.create.mockImplementation(async () => ({ id: nextItemId++ }));
    prismaMock.tx.bomItem.deleteMany.mockResolvedValue(undefined);
    prismaMock.$transaction.mockImplementation(async (callback) => callback(prismaMock.tx));
  });

  it("memperbarui BOM subassembly yang sudah ada setelah benturan output dan versi", async () => {
    const conflict = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    prismaMock.tx.bom.create.mockRejectedValue(conflict);
    prismaMock.bom.findFirst.mockResolvedValue({ id: 12 });
    prismaMock.bom.findUnique.mockResolvedValue({
      id: 12,
      productVariantId: null,
      subassemblyId: 7,
      items: [],
    });

    await expect(createBom({
      nama: "Rakitan",
      version: "1.0",
      subassemblyId: 7,
      items: [{ itemId: 3, quantity: 2 }],
    })).resolves.toEqual(expect.objectContaining({ id: 12, subassemblyId: 7, items: [] }));

    expect(prismaMock.bom.findFirst).toHaveBeenCalledWith({
      where: { subassemblyId: 7, version: "1.0" },
      select: { id: true },
    });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
    expect(prismaMock.tx.bomItem.deleteMany).toHaveBeenCalledWith({
      where: { bomId: 12, parentBomItemId: null },
    });
  });

  it("tidak mengubah BOM lain jika benturan bukan output dan versi yang sama", async () => {
    const conflict = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    prismaMock.tx.bom.create.mockRejectedValue(conflict);
    prismaMock.bom.findFirst.mockResolvedValue(null);
    prismaMock.bom.findUnique.mockResolvedValue(null);

    await expect(createBom({
      nama: "Rakitan",
      version: "1.0",
      subassemblyId: 7,
      items: [{ itemId: 3, quantity: 2 }],
    })).rejects.toBe(conflict);
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it("menyimpan BOM tanpa kode bila kode unik sudah dimiliki output lain", async () => {
    const conflict = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    prismaMock.tx.bom.create
      .mockRejectedValueOnce(conflict)
      .mockResolvedValueOnce({ id: 13 });
    prismaMock.bom.findFirst.mockResolvedValue(null);
    prismaMock.bom.findUnique.mockResolvedValue({ id: 12 });
    prismaMock.tx.bom.findUniqueOrThrow.mockResolvedValue({ id: 13, productVariantId: 9, kode: null, items: [] });

    await expect(createBom({
      kode: "KODE-SAMA",
      nama: "Produk baru",
      version: "1.0",
      productVariantId: 9,
      items: [{ itemId: 3, quantity: 2 }],
    })).resolves.toEqual(expect.objectContaining({ id: 13, productVariantId: 9, kode: null, items: [] }));

    expect(prismaMock.tx.bom.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({ kode: undefined }),
    }));
  });

  it("menyimpan level komponen dan relasi parent-child dalam satu BOM", async () => {
    prismaMock.tx.bom.create.mockResolvedValue({ id: 20 });
    prismaMock.tx.bom.findUniqueOrThrow.mockResolvedValue({
      id: 20,
      items: [
        { id: 101, bomId: 20, parentBomItemId: null, level: 1, subassemblyId: 7 },
        { id: 102, bomId: 20, parentBomItemId: 101, level: 2, itemId: 3 },
      ],
    });

    const bom = await createBom({
      nama: "Rakitan bertingkat",
      version: "1.0",
      productVariantId: 9,
      items: [{
        subassemblyId: 7,
        quantity: 1,
        children: [{ itemId: 3, quantity: 2 }],
      }],
    });

    expect(prismaMock.tx.bomItem.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({ bomId: 20, parentBomItemId: null, level: 1, subassemblyId: 7 }),
    }));
    expect(prismaMock.tx.bomItem.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({ bomId: 20, parentBomItemId: 100, level: 2, itemId: 3 }),
    }));
    expect(bom.items[0].children[0]).toEqual(expect.objectContaining({ id: 102, level: 2 }));
  });
});
