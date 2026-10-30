import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  inventoryLocation: { findMany: vi.fn() },
  item: { findMany: vi.fn(), findUnique: vi.fn() },
  stokItemMutasi: { groupBy: vi.fn() },
  stockBalance: { findMany: vi.fn() },
  inventoryMovement: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  $queryRaw: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({ default: prismaMock }));

import {
  getInventoryBalances,
  listInventoryMovements,
  listUnmappedLegacyItemBalances,
  postInventoryMovement,
  setItemDefaultInventoryLocation,
} from "../src/model/inventory/inventory.js";

const balances = [
  {
    itemId: 12,
    barangId: null,
    locationId: 3,
    quantity: 7,
  },
  {
    itemId: 12,
    barangId: null,
    locationId: 8,
    quantity: 3,
  },
];

describe("getInventoryBalances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.stockBalance.findMany.mockImplementation(({ where }) =>
      Promise.resolve(balances.filter((row) =>
        (where.itemId === undefined || row.itemId === where.itemId) &&
        (where.barangId === undefined || row.barangId === where.barangId) &&
        (where.locationId === undefined || row.locationId === where.locationId),
      )),
    );
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
    await expect(
      getInventoryBalances({ itemId: 12, locationId: 8 }),
    ).resolves.toEqual([
      { itemId: 12, barangId: null, locationId: 8, quantity: 3 },
    ]);
    expect(prismaMock.stockBalance.findMany).toHaveBeenCalledWith({
      where: {
        itemId: 12,
        locationId: 8,
      },
      select: {
        itemId: true,
        barangId: true,
        locationId: true,
        quantity: true,
      },
    });
  });

  it("membatasi saldo gudang ke seluruh lokasi warehouse yang diizinkan", async () => {
    prismaMock.stockBalance.findMany.mockResolvedValue([
      { itemId: 12, barangId: null, locationId: 3, quantity: 7 },
      { itemId: 12, barangId: null, locationId: 8, quantity: 3 },
    ]);

    await expect(getInventoryBalances({ itemId: 12, locationIds: [3, 8] })).resolves.toEqual([
      { itemId: 12, barangId: null, locationId: 3, quantity: 7 },
      { itemId: 12, barangId: null, locationId: 8, quantity: 3 },
    ]);
    expect(prismaMock.stockBalance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          itemId: 12,
          locationId: { in: [3, 8] },
        },
      }),
    );
  });

  it("membatasi gerakan gudang ke lokasi warehouse yang diizinkan", async () => {
    prismaMock.inventoryMovement.findMany.mockResolvedValue([]);

    await listInventoryMovements({ locationIds: [3, 8], take: 100 });

    expect(prismaMock.inventoryMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { fromLocationId: { in: [3, 8] } },
            { toLocationId: { in: [3, 8] } },
          ],
        },
      }),
    );
  });

  it("menghitung saldo helm individual tanpa menggabungkannya sebagai item kuantitas", async () => {
    prismaMock.stockBalance.findMany.mockResolvedValue([
      {
        itemId: null,
        barangId: 77,
        locationId: 8,
        quantity: 1,
      },
    ]);
    await expect(getInventoryBalances({ barangId: 77 })).resolves.toEqual([
      { itemId: null, barangId: 77, locationId: 8, quantity: 1 },
    ]);
  });
});

describe("listUnmappedLegacyItemBalances", () => {
  it("mengembalikan saldo neto per item yang belum dipetakan", async () => {
    prismaMock.stokItemMutasi.groupBy.mockResolvedValue([
      { itemId: 12, tipe: "MASUK", _sum: { jumlah: 20 } },
      { itemId: 12, tipe: "KELUAR", _sum: { jumlah: 5 } },
      { itemId: 13, tipe: "KELUAR", _sum: { jumlah: 3 } },
    ]);
    prismaMock.item.findMany.mockResolvedValue([
      { id: 12, kode: "RAW001", nama: "Resin", unit: "kg", jenis: "RAW MATERIAL" },
      { id: 13, kode: "SM001", nama: "Submaterial", unit: "pcs", jenis: "SM" },
    ]);

    await expect(listUnmappedLegacyItemBalances()).resolves.toEqual([
      {
        id: 12,
        kode: "RAW001",
        nama: "Resin",
        unit: "kg",
        jenis: "RAW MATERIAL",
        legacyBalance: 15,
      },
      {
        id: 13,
        kode: "SM001",
        nama: "Submaterial",
        unit: "pcs",
        jenis: "SM",
        legacyBalance: -3,
      },
    ]);
    expect(prismaMock.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: [12, 13] },
          defaultInventoryLocationId: null,
        },
        orderBy: { kode: "asc" },
      }),
    );
  });
});

describe("setItemDefaultInventoryLocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts the legacy balance once before assigning its default location", async () => {
    const tx = {
      $queryRaw: vi.fn(),
      item: {
        findUnique: vi.fn().mockResolvedValue({
          id: 12,
          kode: "RAW001",
          defaultInventoryLocationId: null,
        }),
        update: vi.fn().mockResolvedValue({
          id: 12,
          kode: "RAW001",
          defaultInventoryLocationId: 3,
        }),
      },
      inventoryLocation: {
        findUnique: vi.fn().mockResolvedValue({ id: 3, isActive: true }),
        findMany: vi.fn().mockResolvedValue([{ id: 3, isActive: true }]),
      },
      stokItemMutasi: {
        groupBy: vi.fn().mockResolvedValue([
          { tipe: "MASUK", _sum: { jumlah: 20 } },
          { tipe: "KELUAR", _sum: { jumlah: 5 } },
        ]),
      },
      stockBalance: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 1 }),
        update: vi.fn().mockResolvedValue({ id: 1 }),
      },
      inventoryMovement: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 50n }),
      },
    };
    prismaMock.$transaction.mockImplementation((operation) => operation(tx));

    await expect(setItemDefaultInventoryLocation(12, 3, 7)).resolves.toMatchObject({
      id: 12,
      defaultInventoryLocationId: 3,
    });

    expect(tx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          itemId: 12,
          toLocationId: 3,
          type: "OPENING",
          quantity: 15,
          idempotencyKey: "legacy-item-opening:12:3",
        }),
      }),
    );
    expect(tx.item.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 12 },
        data: { defaultInventoryLocationId: 3 },
      }),
    );
  });

  it("does not map an item with a negative legacy balance", async () => {
    const tx = {
      $queryRaw: vi.fn(),
      item: {
        findUnique: vi.fn().mockResolvedValue({
          id: 12,
          kode: "RAW001",
          defaultInventoryLocationId: null,
        }),
        update: vi.fn(),
      },
      inventoryLocation: {
        findUnique: vi.fn().mockResolvedValue({ id: 3, isActive: true }),
      },
      stokItemMutasi: {
        groupBy: vi.fn().mockResolvedValue([
          { tipe: "MASUK", _sum: { jumlah: 2 } },
          { tipe: "KELUAR", _sum: { jumlah: 5 } },
        ]),
      },
      stockBalance: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
      inventoryMovement: { findUnique: vi.fn(), create: vi.fn() },
    };
    prismaMock.$transaction.mockImplementation((operation) => operation(tx));

    await expect(setItemDefaultInventoryLocation(12, 3, 7)).rejects.toMatchObject({
      code: "INVALID_MOVEMENT",
    });
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
    expect(tx.item.update).not.toHaveBeenCalled();
  });
});

describe("postInventoryMovement", () => {
  it("menerima transfer langsung dari lokasi asal ke tujuan", async () => {
    const balancesByKey = new Map([
      ["I:12:0:0:3", { id: 1, quantity: 10 }],
    ]);
    const tx = {
      $queryRaw: vi.fn(),
      inventoryLocation: {
        findMany: vi.fn().mockResolvedValue([
          { id: 3, isActive: true },
          { id: 8, isActive: true },
        ]),
      },
      item: { findUnique: vi.fn().mockResolvedValue({ id: 12 }) },
      stockBalance: {
        findUnique: vi.fn(({ where }) => balancesByKey.get(where.balanceKey) ?? null),
        create: vi.fn(({ data }) => {
          const created = { id: balancesByKey.size + 1, quantity: data.quantity };
          balancesByKey.set(data.balanceKey, created);
          return created;
        }),
        findUniqueOrThrow: vi.fn(({ where }) => {
          const row = balancesByKey.get(where.balanceKey);
          if (!row) throw new Error("Missing stock balance");
          return row;
        }),
        update: vi.fn(({ where, data }) => {
          const row = balancesByKey.get(where.balanceKey);
          if (!row) throw new Error("Missing stock balance");
          row.quantity += data.quantity.increment;
          return row;
        }),
      },
      inventoryMovement: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi
          .fn()
          .mockResolvedValue([
            { quantity: 10, fromLocationId: null, toLocationId: 3 },
          ]),
        create: vi.fn().mockResolvedValue({ id: 1 }),
      },
    };
    prismaMock.$transaction.mockImplementation((operation) => operation(tx));

    await expect(
      postInventoryMovement({
        itemId: 12,
        fromLocationId: 3,
        toLocationId: 8,
        type: "TRANSFER",
        quantity: 4,
        idempotencyKey: "transfer-001",
        sourceType: "MANUAL_TRANSFER",
        sourceId: "transfer-001",
        reason: "Pemindahan stok",
      }),
    ).resolves.toEqual({ id: 1 });
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromLocationId: 3,
          toLocationId: 8,
          type: "TRANSFER",
          groupUuid: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
          ),
        }),
      }),
    );
    expect(balancesByKey.get("I:12:0:0:3")?.quantity).toBe(6);
    expect(balancesByKey.get("I:12:0:0:8")?.quantity).toBe(4);
  });
});
