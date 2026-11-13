import { describe, it, expect, vi, beforeEach } from "vitest";

const tx = {
  stokOpnameSesi: { create: vi.fn(), findUniqueOrThrow: vi.fn() },
  stokOpnameBaris: { create: vi.fn() },
  item: { findUnique: vi.fn() },
  $queryRaw: vi.fn(),
};

vi.mock("../src/lib/prisma.js", () => ({
  default: {
    $transaction: vi.fn((fn: (t: unknown) => unknown) => fn(tx)),
  },
}));

const inventoryMock = vi.hoisted(() => ({
  getItemStockTotal: vi.fn(),
  postInventoryMovementInTransaction: vi.fn(),
}));

vi.mock("../src/model/inventory/inventory.js", () => inventoryMock);

vi.mock("../src/model/stokItem/stokItem.js", () => ({
  lockItem: vi.fn(),
}));

import { buatSesiOpname, OpnameError } from "../src/model/stokOpname/stokOpname.js";
import { lockItem } from "../src/model/stokItem/stokItem.js";

const mocked = {
  lockItem: vi.mocked(lockItem),
  getItemStockTotal: vi.mocked(inventoryMock.getItemStockTotal),
  postMovement: vi.mocked(inventoryMock.postInventoryMovementInTransaction),
};

beforeEach(() => {
  vi.clearAllMocks();
  tx.stokOpnameSesi.create.mockResolvedValue({ id: 9 });
  tx.stokOpnameSesi.findUniqueOrThrow.mockResolvedValue({ id: 9 });
  tx.stokOpnameBaris.create.mockImplementation(async (args: any) => ({ id: args.data.itemId * 10, ...args.data }));
  tx.item.findUnique.mockImplementation(async ({ where }: { where: { id: number } }) => ({
    id: where.id,
    kode: `ITM-${where.id}`,
    defaultInventoryLocationId: 3,
  }));
  // sistem: item 1 -> 100, item 2 -> 5, item 3 -> 7
  mocked.getItemStockTotal.mockImplementation(async (_tx: unknown, itemId: number) =>
    ({ 1: 100, 2: 5, 3: 7 })[itemId] ?? 0,
  );
});

describe("buatSesiOpname", () => {
  it("selisih + posting masuk, selisih - posting keluar, selisih 0 tanpa ledger", async () => {
    await buatSesiOpname(
      [
        { itemId: 1, stokFisik: 102 },
        { itemId: 2, stokFisik: 3 },
        { itemId: 3, stokFisik: 7 },
      ],
      null,
      4,
    );

    expect(tx.stokOpnameBaris.create).toHaveBeenCalledTimes(3);
    expect(tx.stokOpnameBaris.create).toHaveBeenCalledWith({
      data: { sesiId: 9, itemId: 1, stokSistem: 100, stokFisik: 102, selisih: 2 },
    });
    expect(tx.stokOpnameBaris.create).toHaveBeenCalledWith({
      data: { sesiId: 9, itemId: 3, stokSistem: 7, stokFisik: 7, selisih: 0 },
    });
    expect(mocked.postMovement).toHaveBeenCalledTimes(2);
    expect(mocked.postMovement).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        itemId: 1,
        toLocationId: 3,
        type: "ADJUSTMENT",
        quantity: 2,
        idempotencyKey: "stok-opname:9:10",
        sourceType: "STOK_OPNAME",
        sourceId: "9:10",
      }),
    );
    expect(mocked.postMovement).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ itemId: 2, fromLocationId: 3, quantity: 2, sourceId: "9:20" }),
    );
  });

  it("mengunci item terurut sebelum baca saldo", async () => {
    await buatSesiOpname(
      [
        { itemId: 2, stokFisik: 5 },
        { itemId: 1, stokFisik: 100 },
      ],
      "cek gudang",
      null,
    );

    expect(tx.stokOpnameSesi.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ keterangan: "cek gudang", userId: null }) }),
    );
    const lockIds = mocked.lockItem.mock.calls.map((call) => call[1]);
    expect(lockIds).toEqual([1, 2]);
  });

  it("menolak item tanpa lokasi default (tidak menebak lokasi)", async () => {
    tx.item.findUnique.mockResolvedValue({ id: 1, kode: "ITM-1", defaultInventoryLocationId: null });

    await expect(buatSesiOpname([{ itemId: 1, stokFisik: 10 }], null, 1)).rejects.toMatchObject({
      code: "LOKASI_DEFAULT_BELUM_DISET",
    });
    await expect(buatSesiOpname([{ itemId: 1, stokFisik: 10 }], null, 1)).rejects.toBeInstanceOf(
      OpnameError,
    );
    expect(mocked.postMovement).not.toHaveBeenCalled();
  });
});
