import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx } = vi.hoisted(() => {
  const tx = {
    divisi: { findUnique: vi.fn() },
    permintaanBarang: { findUnique: vi.fn() },
    permintaanBarangItem: { findUnique: vi.fn() },
    pemakaianMaterial: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    pemakaianMaterialItem: { findFirst: vi.fn(), count: vi.fn() },
    stockBalance: { aggregate: vi.fn() },
  };
  return { tx };
});

const inventoryMock = vi.hoisted(() => ({
  ensureDivisionInventoryLocation: vi.fn(),
  receiveItemToDivision: vi.fn(),
  postInventoryMovementInTransaction: vi.fn(),
  InventoryError: class InventoryError extends Error {
    constructor(public readonly code: string, message: string) {
      super(message);
      this.name = "InventoryError";
    }
  },
}));

vi.mock("../src/lib/prisma.js", () => ({
  default: {
    $transaction: (fn: (client: typeof tx) => unknown) => fn(tx),
  },
}));

vi.mock("../src/model/inventory/inventory.js", () => inventoryMock);

import { createPemakaian } from "../src/model/pemakaianMaterial/pemakaianMaterial.js";

beforeEach(() => {
  vi.clearAllMocks();
  tx.divisi.findUnique.mockResolvedValue({ id: 2, nama: "Buffing" });
  tx.permintaanBarang.findUnique.mockResolvedValue({
    id: 1,
    approval: "DISETUJUI",
    departemen: "Buffing",
    divisiPemintaId: 2,
  });
  tx.permintaanBarangItem.findUnique.mockResolvedValue({
    id: 7,
    itemId: 5,
    nama: "Batok",
    satuan: "pcs",
    jumlah: 100,
    jumlahDisetujui: 100,
    item: { id: 5, kode: "RAW020", nama: "Batok", unit: "pcs", defaultInventoryLocationId: 3 },
    permintaan: { approval: "DISETUJUI", departemen: "Buffing" },
  });
  tx.pemakaianMaterialItem.findFirst.mockResolvedValue(null);
  tx.pemakaianMaterialItem.count.mockResolvedValue(0);
  tx.pemakaianMaterial.findFirst.mockResolvedValue(null);
  tx.pemakaianMaterial.create.mockResolvedValue({
    id: 1,
    items: [
      {
        id: 11,
        itemId: 5,
        jumlahDiterima: 100,
        jumlahDipakai: 30,
        item: { defaultInventoryLocationId: 3 },
      },
    ],
  });
  tx.pemakaianMaterial.findUniqueOrThrow.mockResolvedValue({ id: 1, items: [] });
  tx.stockBalance.aggregate.mockResolvedValue({ _sum: { quantity: 100 } });

  inventoryMock.ensureDivisionInventoryLocation.mockResolvedValue({ id: 9, isActive: true });
  inventoryMock.receiveItemToDivision.mockResolvedValue({});
  inventoryMock.postInventoryMovementInTransaction.mockResolvedValue({});
});

const input = {
  permintaanId: 1,
  divisiId: 2,
  items: [{ permintaanBarangItemId: 7, jumlahSisa: 70 }],
};

describe("penerimaan material divisi di ledger lokasi", () => {
  it("catatan pertama: kredit lokasi divisi sebesar saldo diterima, lalu debit pemakaian manual", async () => {
    await createPemakaian(input, 4);

    expect(inventoryMock.receiveItemToDivision).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        itemId: 5,
        fromLocationId: 3,
        toLocationId: 9,
        pemakaianMaterialItemId: 11,
        quantity: 100,
        idempotencyKey: "pemakaian-receipt:11",
        sourceType: "PEMAKAIAN_MATERIAL",
      }),
    );
    expect(inventoryMock.postInventoryMovementInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        itemId: 5,
        fromLocationId: 9,
        type: "ADJUSTMENT",
        quantity: 30,
        idempotencyKey: "pemakaian-usage:11",
        sourceType: "PEMAKAIAN_MATERIAL_USAGE",
      }),
    );
  });

  it("catatan berikutnya TIDAK mengkredit ulang (jumlahDiterima = saldo berjalan)", async () => {
    tx.pemakaianMaterialItem.count.mockResolvedValue(2);
    tx.pemakaianMaterial.create.mockResolvedValue({
      id: 2,
      items: [
        {
          id: 12,
          itemId: 5,
          jumlahDiterima: 70,
          jumlahDipakai: 20,
          item: { defaultInventoryLocationId: 3 },
        },
      ],
    });

    await createPemakaian(input, 4);

    expect(inventoryMock.receiveItemToDivision).not.toHaveBeenCalled();
    expect(inventoryMock.postInventoryMovementInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ quantity: 20, idempotencyKey: "pemakaian-usage:12" }),
    );
  });
});
