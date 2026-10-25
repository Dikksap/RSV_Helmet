import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  inventoryMovement: { findMany: vi.fn() },
}));

vi.mock("../src/lib/prisma.js", () => ({ default: prismaMock }));

import { getInventoryBalances } from "../src/model/inventory/inventory.js";

const history = [
  { itemId: 12, barangId: null, fromLocationId: null, toLocationId: 3, quantity: 10 },
  { itemId: 12, barangId: null, fromLocationId: 3, toLocationId: 8, quantity: 3 },
];

describe("getInventoryBalances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.inventoryMovement.findMany.mockResolvedValue(history);
  });

  it("menghitung saldo neto lokasi dari mutasi masuk dan keluar", async () => {
    await expect(getInventoryBalances({})).resolves.toEqual([
      { itemId: 12, barangId: null, locationId: 3, quantity: 7 },
      { itemId: 12, barangId: null, locationId: 8, quantity: 3 },
    ]);
  });

  it("filter lokasi tidak mengembalikan saldo lokasi lawan transfer", async () => {
    await expect(getInventoryBalances({ locationId: 3 })).resolves.toEqual([
      { itemId: 12, barangId: null, locationId: 3, quantity: 7 },
    ]);
  });

  it("menerapkan filter item dan lokasi secara bersamaan", async () => {
    await expect(getInventoryBalances({ itemId: 12, locationId: 8 })).resolves.toEqual([
      { itemId: 12, barangId: null, locationId: 8, quantity: 3 },
    ]);
    expect(prismaMock.inventoryMovement.findMany).toHaveBeenCalledWith({
      where: {
        itemId: 12,
        OR: [{ fromLocationId: 8 }, { toLocationId: 8 }],
      },
      select: {
        itemId: true,
        barangId: true,
        quantity: true,
        fromLocationId: true,
        toLocationId: true,
      },
    });
  });

  it("menghitung saldo helm individual tanpa menggabungkannya sebagai item kuantitas", async () => {
    prismaMock.inventoryMovement.findMany.mockResolvedValue([
      { itemId: null, barangId: 77, fromLocationId: null, toLocationId: 3, quantity: 1 },
      { itemId: null, barangId: 77, fromLocationId: 3, toLocationId: 8, quantity: 1 },
    ]);
    await expect(getInventoryBalances({ barangId: 77 })).resolves.toEqual([
      { itemId: null, barangId: 77, locationId: 8, quantity: 1 },
    ]);
  });
});
