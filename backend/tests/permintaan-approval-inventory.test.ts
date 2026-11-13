import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  permintaanBarang: { findUnique: vi.fn(), update: vi.fn() },
  permintaanBarangItem: { update: vi.fn(), updateMany: vi.fn() },
  stockBalance: { groupBy: vi.fn() },
  inventoryLocation: { findUnique: vi.fn() },
  inventoryMovement: { findMany: vi.fn() },
  user: { findUnique: vi.fn() },
  $queryRaw: vi.fn(),
};

const inventoryMock = vi.hoisted(() => ({
  ensureDivisionInventoryLocation: vi.fn().mockResolvedValue({ id: 3, isActive: true }),
  getItemStockAtLocation: vi.fn(),
  consumeItemAtLocation: vi.fn().mockResolvedValue(0),
  postInventoryMovementInTransaction: vi.fn().mockResolvedValue({}),
}));

vi.mock("../src/lib/prisma.js", () => ({
  default: { $transaction: vi.fn((operation: (transaction: typeof tx) => unknown) => operation(tx)) },
}));
vi.mock("../src/model/inventory/inventory.js", () => inventoryMock);

import { KeputusanItemError, setApproval } from "../src/model/permintaanBarang/permintaanBarang.js";

function makeRequest(quantity = 10) {
  return {
    id: 1,
    noPermintaan: "PR-20261013-0001",
    departemen: "Produksi",
    divisiPemintaId: 1,
    divisiApproverId: 1,
    sumber: "MANUAL",
    approval: "BELUM_DISETUJUI",
    autoKey: null,
    updatedAt: new Date("2026-10-13T00:00:00.000Z"),
    items: [{
      id: 10,
      itemId: 7,
      nama: "Resin",
      jumlah: quantity,
      jumlahDisetujui: null,
      statusKeputusan: "MENUNGGU",
      item: { id: 7, divisiId: 1, defaultInventoryLocationId: null },
    }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  tx.$queryRaw.mockResolvedValue([]);
  tx.permintaanBarang.findUnique.mockResolvedValue(makeRequest());
  tx.permintaanBarang.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    ...makeRequest(),
    ...data,
  }));
  tx.permintaanBarangItem.update.mockResolvedValue({});
  tx.permintaanBarangItem.updateMany.mockResolvedValue({ count: 1 });
  tx.stockBalance.groupBy.mockResolvedValue([{ locationId: 5, _sum: { quantity: 20 } }]);
  tx.inventoryLocation.findUnique.mockResolvedValue({ id: 10, type: "WAREHOUSE", isActive: true });
  tx.inventoryMovement.findMany.mockResolvedValue([]);
  tx.user.findUnique.mockResolvedValue({ role: "admin", divisiId: null });
  inventoryMock.ensureDivisionInventoryLocation.mockResolvedValue({ id: 3, isActive: true });
  inventoryMock.getItemStockAtLocation.mockResolvedValue(0);
  inventoryMock.consumeItemAtLocation.mockResolvedValue(0);
  inventoryMock.postInventoryMovementInTransaction.mockResolvedValue({});
});

describe("approval permintaan dari Inventory", () => {
  it("admin dapat approve dan mengurangi stok gudang", async () => {
    const result = await setApproval(1, "DISETUJUI", [{ id: 10, jumlahDisetujui: 8 }], 99, 10);

    expect(result).toMatchObject({ approval: "DISETUJUI" });
    expect(inventoryMock.consumeItemAtLocation).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ itemId: 7, locationId: 5, quantity: 8 }),
    );
    expect(inventoryMock.postInventoryMovementInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ itemId: 7, toLocationId: 10, quantity: 8 }),
    );
  });

  it("membagi approval lintas gudang saat satu gudang tidak cukup", async () => {
    tx.stockBalance.groupBy.mockResolvedValue([
      { locationId: 5, _sum: { quantity: 6 } },
      { locationId: 8, _sum: { quantity: 4 } },
    ]);

    await setApproval(1, "DISETUJUI", [{ id: 10, jumlahDisetujui: 9 }], 99, 10);

    expect(inventoryMock.consumeItemAtLocation).toHaveBeenNthCalledWith(
      1,
      tx,
      expect.objectContaining({ locationId: 5, quantity: 6 }),
    );
    expect(inventoryMock.consumeItemAtLocation).toHaveBeenNthCalledWith(
      2,
      tx,
      expect.objectContaining({ locationId: 8, quantity: 3 }),
    );
    expect(inventoryMock.postInventoryMovementInTransaction).toHaveBeenCalledTimes(2);
    expect(inventoryMock.postInventoryMovementInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ toLocationId: 10 }),
    );
  });

  it("menolak jumlah yang melebihi total saldo semua gudang", async () => {
    tx.stockBalance.groupBy.mockResolvedValue([
      { locationId: 5, _sum: { quantity: 4 } },
      { locationId: 8, _sum: { quantity: 3 } },
    ]);

    await expect(setApproval(1, "DISETUJUI", [{ id: 10, jumlahDisetujui: 8 }], 99, 10))
      .rejects.toBeInstanceOf(KeputusanItemError);
    expect(inventoryMock.consumeItemAtLocation).not.toHaveBeenCalled();
  });

  it("mewajibkan target berupa gudang aktif", async () => {
    tx.inventoryLocation.findUnique.mockResolvedValue({ id: 10, type: "DIVISION", isActive: true });

    await expect(setApproval(1, "DISETUJUI", [{ id: 10, jumlahDisetujui: 8 }], 99, 10))
      .rejects.toBeInstanceOf(KeputusanItemError);
    expect(inventoryMock.consumeItemAtLocation).not.toHaveBeenCalled();
  });

  it("pembatalan mengembalikan transfer ke setiap gudang sumber", async () => {
    tx.permintaanBarang.findUnique.mockResolvedValue({
      ...makeRequest(),
      approval: "DISETUJUI",
      items: [{ ...makeRequest().items[0], jumlahDisetujui: 8, statusKeputusan: "DISETUJUI" }],
    });
    const sourceId = `permintaan-approve:1:10:${makeRequest().updatedAt.getTime()}:5`;
    tx.inventoryMovement.findMany.mockResolvedValue([
      { sourceId, fromLocationId: 5, toLocationId: null, quantity: 8 },
      { sourceId, fromLocationId: null, toLocationId: 10, quantity: 8 },
    ]);

    await setApproval(1, "BELUM_DISETUJUI", [], 99);

    expect(inventoryMock.consumeItemAtLocation).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ locationId: 10, quantity: 8 }),
    );
    expect(inventoryMock.postInventoryMovementInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ toLocationId: 5, quantity: 8 }),
    );
  });
});