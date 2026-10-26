import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  bom: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  bomItem: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({ default: prismaMock }));

import { createBom } from "../src/model/bom/bom.js";

describe("createBom", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback) => callback({
      bom: {
        update: vi.fn().mockResolvedValue({ id: 12 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 12, subassemblyId: 7 }),
      },
      bomItem: {
        deleteMany: vi.fn().mockResolvedValue(undefined),
        createMany: vi.fn().mockResolvedValue(undefined),
      },
    }));
  });

  it("memperbarui BOM subassembly yang sudah ada setelah benturan output dan versi", async () => {
    const conflict = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    prismaMock.bom.create.mockRejectedValue(conflict);
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
    })).resolves.toEqual({ id: 12, subassemblyId: 7 });

    expect(prismaMock.bom.findFirst).toHaveBeenCalledWith({
      where: { subassemblyId: 7, version: "1.0" },
      select: { id: true },
    });
    expect(prismaMock.$transaction).toHaveBeenCalledOnce();
  });

  it("tidak mengubah BOM lain jika benturan bukan output dan versi yang sama", async () => {
    const conflict = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    prismaMock.bom.create.mockRejectedValue(conflict);
    prismaMock.bom.findFirst.mockResolvedValue(null);
    prismaMock.bom.findUnique.mockResolvedValue(null);

    await expect(createBom({
      nama: "Rakitan",
      version: "1.0",
      subassemblyId: 7,
      items: [{ itemId: 3, quantity: 2 }],
    })).rejects.toBe(conflict);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("menyimpan BOM tanpa kode bila kode unik sudah dimiliki output lain", async () => {
    const conflict = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    prismaMock.bom.create
      .mockRejectedValueOnce(conflict)
      .mockResolvedValueOnce({ id: 13, productVariantId: 9, kode: null });
    prismaMock.bom.findFirst.mockResolvedValue(null);
    prismaMock.bom.findUnique.mockResolvedValue({ id: 12 });

    await expect(createBom({
      kode: "KODE-SAMA",
      nama: "Produk baru",
      version: "1.0",
      productVariantId: 9,
      items: [{ itemId: 3, quantity: 2 }],
    })).resolves.toEqual({ id: 13, productVariantId: 9, kode: null });

    expect(prismaMock.bom.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({ kode: undefined }),
    }));
  });
});
