import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  stokItemMutasi: { findMany: vi.fn() },
  inventoryMovement: { findMany: vi.fn() },
}));

const inventoryMock = vi.hoisted(() => {
  class InventoryError extends Error {
    constructor(public readonly code: string, message: string) {
      super(message);
      this.name = "InventoryError";
    }
  }
  return {
    InventoryError,
    postInventoryMovementInTransaction: vi.fn(),
    getItemStockTotal: vi.fn(),
    getItemStockAtLocation: vi.fn(),
    getInventoryItemTotals: vi.fn(),
    getInventoryItemSummary: vi.fn(),
    getItemWarehouseBalances: vi.fn(),
    getWarehouseItemBalances: vi.fn(),
    transferItemBetweenWarehouses: vi.fn(),
  };
});

const stokMock = vi.hoisted(() => {
  class StokKurangError extends Error {
    readonly code = "STOK_KURANG";
    constructor(readonly itemId: number, readonly tersedia: number) {
      super(`Stok item ${itemId} tidak cukup (tersedia ${tersedia}).`);
    }
  }
  return { lockItem: vi.fn(), StokKurangError };
});

vi.mock("../src/model/item/item.js", () => ({
  getItemById: vi.fn(),
  listItems: vi.fn(),
}));

vi.mock("../src/model/inventory/inventory.js", () => inventoryMock);
vi.mock("../src/model/stokItem/stokItem.js", () => stokMock);

vi.mock("../src/lib/prisma.js", () => ({ default: prismaMock }));

vi.mock("../src/middleware/auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/middleware/auth.js")>();
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { id: 1, role: "admin" };
      next();
    },
    adminOnly: (_req: any, _res: any, next: any) => next(),
    authorize: (req: any, _res: any, next: any) => {
      req.access = { role: "admin", permissions: ["KELOLA_ITEM"], statusView: null };
      next();
    },
  };
});

import itemRouter from "../src/routes/item.js";
import { getItemById } from "../src/model/item/item.js";

const mocked = {
  getItemById: vi.mocked(getItemById),
  getItemStockTotal: vi.mocked(inventoryMock.getItemStockTotal),
  getItemStockAtLocation: vi.mocked(inventoryMock.getItemStockAtLocation),
  postMovement: vi.mocked(inventoryMock.postInventoryMovementInTransaction),
  totals: vi.mocked(inventoryMock.getInventoryItemTotals),
  summary: vi.mocked(inventoryMock.getInventoryItemSummary),
  lockItem: vi.mocked(stokMock.lockItem),
};

const app = express();
app.use(express.json());
app.use("/api/items", itemRouter);

const item = {
  id: 1,
  kode: "MSK",
  nama: "Masker",
  unit: "pcs",
  divisi: null,
  defaultInventoryLocationId: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn({}));
  prismaMock.stokItemMutasi.findMany.mockResolvedValue([]);
  prismaMock.inventoryMovement.findMany.mockResolvedValue([]);
  mocked.getItemStockTotal.mockResolvedValue(25);
  mocked.postMovement.mockResolvedValue({
    id: 11,
    itemId: 1,
    fromLocationId: null,
    toLocationId: 3,
    quantity: 20,
    reason: null,
    userId: 1,
    occurredAt: new Date("2026-10-01T00:00:00.000Z"),
  });
});

describe("POST /api/items/:id/stok (ledger lokasi)", () => {
  it("201 mencatat MASUK pada ledger inventory dan mengembalikan saldo proyeksi", async () => {
    mocked.getItemById.mockResolvedValue(item as never);

    const res = await request(app).post("/api/items/1/stok").send({ jumlah: 20 });

    expect(res.status).toBe(201);
    expect(res.body.saldo).toBe(25);
    expect(res.body.mutasi).toMatchObject({ tipe: "MASUK", jumlah: 20, sumber: "INVENTORY" });
    expect(res.body.mutasi.id).toBeLessThan(0);
    expect(mocked.postMovement).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        itemId: 1,
        toLocationId: 3,
        type: "OPENING",
        quantity: 20,
        userId: 1,
        sourceType: "MANUAL_ITEM_IN",
      }),
    );
  });

  it("409 jika item belum punya lokasi default (tidak menebak lokasi)", async () => {
    mocked.getItemById.mockResolvedValue({ ...item, defaultInventoryLocationId: null } as never);

    const res = await request(app).post("/api/items/1/stok").send({ jumlah: 5 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("LOCATION_NOT_FOUND");
    expect(mocked.postMovement).not.toHaveBeenCalled();
  });

  it("400 jika jumlah 0, negatif, atau bukan bilangan bulat", async () => {
    expect((await request(app).post("/api/items/1/stok").send({ jumlah: 0 })).status).toBe(400);
    expect((await request(app).post("/api/items/1/stok").send({ jumlah: -3 })).status).toBe(400);
    expect((await request(app).post("/api/items/1/stok").send({ jumlah: 1.5 })).status).toBe(400);
    expect(mocked.postMovement).not.toHaveBeenCalled();
  });

  it("meneruskan tanggal bisnis kustom dan menolak tanggal masa depan", async () => {
    mocked.getItemById.mockResolvedValue(item as never);

    const ok = await request(app).post("/api/items/1/stok").send({ jumlah: 5, tanggal: "2026-10-01" });
    expect(ok.status).toBe(201);
    const input = mocked.postMovement.mock.calls[0][1] as { occurredAt?: Date };
    expect(input.occurredAt?.getTime()).toBe(new Date("2026-10-01T00:00:00+07:00").getTime());

    const besok = new Date();
    besok.setDate(besok.getDate() + 1);
    const isoBesok = `${besok.getFullYear()}-${String(besok.getMonth() + 1).padStart(2, "0")}-${String(besok.getDate()).padStart(2, "0")}`;
    expect((await request(app).post("/api/items/1/stok").send({ jumlah: 5, tanggal: isoBesok })).status).toBe(400);
    expect((await request(app).post("/api/items/1/stok").send({ jumlah: 5, tanggal: "15-10-2026" })).status).toBe(400);
  });

  it("404 jika item tidak ada", async () => {
    mocked.getItemById.mockResolvedValue(null as never);
    expect((await request(app).post("/api/items/99/stok").send({ jumlah: 5 })).status).toBe(404);
  });
});

describe("POST /api/items/:id/stok/keluar", () => {
  it("201 mencatat KELUAR jika saldo lokasi cukup", async () => {
    mocked.getItemById.mockResolvedValue(item as never);
    mocked.getItemStockAtLocation.mockResolvedValue(10);
    mocked.getItemStockTotal.mockResolvedValue(7);
    mocked.postMovement.mockResolvedValue({
      id: 12,
      itemId: 1,
      fromLocationId: 3,
      toLocationId: null,
      quantity: 3,
      reason: "produksi batch 2",
      userId: 1,
      occurredAt: new Date(),
    } as never);

    const res = await request(app).post("/api/items/1/stok/keluar").send({ jumlah: 3, keterangan: "produksi batch 2" });

    expect(res.status).toBe(201);
    expect(res.body.saldo).toBe(7);
    expect(res.body.mutasi.tipe).toBe("KELUAR");
    expect(mocked.postMovement).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ itemId: 1, fromLocationId: 3, type: "ADJUSTMENT", quantity: 3 }),
    );
  });

  it("409 jika jumlah melebihi saldo lokasi", async () => {
    mocked.getItemById.mockResolvedValue(item as never);
    mocked.getItemStockAtLocation.mockResolvedValue(2);

    const res = await request(app).post("/api/items/1/stok/keluar").send({ jumlah: 3 });

    expect(res.status).toBe(409);
    expect(res.body.tersedia).toBe(2);
    expect(mocked.postMovement).not.toHaveBeenCalled();
  });

  it("400 jika jumlah invalid", async () => {
    expect((await request(app).post("/api/items/1/stok/keluar").send({ jumlah: 0 })).status).toBe(400);
    expect((await request(app).post("/api/items/1/stok/keluar").send({ jumlah: 2.5 })).status).toBe(400);
    expect(mocked.postMovement).not.toHaveBeenCalled();
  });
});

describe("GET /api/items/:id/stok", () => {
  it("200 menggabungkan riwayat legacy (L1) dan ledger inventory (L2)", async () => {
    mocked.getItemById.mockResolvedValue(item as never);
    mocked.getItemStockTotal.mockResolvedValue(15);
    prismaMock.stokItemMutasi.findMany.mockResolvedValue([
      {
        id: 1,
        itemId: 1,
        tipe: "KELUAR",
        jumlah: 5,
        sumberPermintaanItemId: null,
        keterangan: "legacy",
        userId: 1,
        tanggal: new Date("2026-10-01T00:00:00.000Z"),
      },
    ]);
    prismaMock.inventoryMovement.findMany.mockResolvedValue([
      {
        id: 9,
        itemId: 1,
        fromLocationId: null,
        toLocationId: 3,
        quantity: 20,
        reason: "ledger",
        userId: 1,
        occurredAt: new Date("2026-10-02T00:00:00.000Z"),
      },
    ]);

    const res = await request(app).get("/api/items/1/stok");

    expect(res.status).toBe(200);
    expect(res.body.saldo).toBe(15);
    expect(res.body.riwayat.data).toHaveLength(2);
    expect(res.body.riwayat.data[0]).toMatchObject({ id: -9, sumber: "INVENTORY", tipe: "MASUK" });
    expect(res.body.riwayat.data[1]).toMatchObject({ id: 1, sumber: "LEGACY", tipe: "KELUAR" });
  });

  it("400 jika format tanggal tidak valid atau dari lebih besar dari sampai", async () => {
    mocked.getItemById.mockResolvedValue(item as never);

    expect((await request(app).get("/api/items/1/stok?dari=2026-13-01")).status).toBe(400);
    expect((await request(app).get("/api/items/1/stok?sampai=15-10-2026")).status).toBe(400);
    expect((await request(app).get("/api/items/1/stok?dari=2026-10-16&sampai=2026-10-15")).status).toBe(400);
  });

  it("404 jika item tidak ada", async () => {
    mocked.getItemById.mockResolvedValue(null as never);
    const res = await request(app).get("/api/items/99/stok");
    expect(res.status).toBe(404);
  });

  it("sumber=LEGACY hanya membaca ledger legacy dan tidak menyentuh ledger lokasi", async () => {
    mocked.getItemById.mockResolvedValue(item as never);
    prismaMock.stokItemMutasi.findMany.mockResolvedValue([
      {
        id: 3,
        itemId: 1,
        tipe: "MASUK",
        jumlah: 7,
        sumberPermintaanItemId: null,
        keterangan: "legacy",
        userId: 1,
        tanggal: new Date("2026-10-01T00:00:00.000Z"),
      },
    ]);

    const res = await request(app).get("/api/items/1/stok?sumber=LEGACY");

    expect(res.status).toBe(200);
    expect(prismaMock.inventoryMovement.findMany).not.toHaveBeenCalled();
    expect(res.body.riwayat.data).toHaveLength(1);
    expect(res.body.riwayat.data[0]).toMatchObject({ id: 3, sumber: "LEGACY" });
  });

  it("sumber=INVENTORY hanya membaca ledger lokasi", async () => {
    mocked.getItemById.mockResolvedValue(item as never);
    prismaMock.inventoryMovement.findMany.mockResolvedValue([
      {
        id: 12,
        itemId: 1,
        fromLocationId: 3,
        toLocationId: null,
        quantity: 4,
        reason: "keluar",
        userId: 1,
        occurredAt: new Date("2026-10-02T00:00:00.000Z"),
      },
    ]);

    const res = await request(app).get("/api/items/1/stok?sumber=inventory");

    expect(res.status).toBe(200);
    expect(prismaMock.stokItemMutasi.findMany).not.toHaveBeenCalled();
    expect(res.body.riwayat.data[0]).toMatchObject({ id: -12, sumber: "INVENTORY", tipe: "KELUAR" });
  });

  it("400 jika sumber tidak dikenal", async () => {
    mocked.getItemById.mockResolvedValue(item as never);
    const res = await request(app).get("/api/items/1/stok?sumber=lainnya");
    expect(res.status).toBe(400);
  });
});

describe("saldo dan ringkasan memakai ledger lokasi", () => {
  it("POST /api/items/stok-saldo memakai total StockBalance", async () => {
    mocked.totals.mockResolvedValue({ 1: 100, 2: 5 } as never);
    const res = await request(app).post("/api/items/stok-saldo").send({ ids: [1, 2] });
    expect(res.status).toBe(200);
    expect(res.body.saldo).toEqual({ 1: 100, 2: 5 });
    expect(mocked.totals).toHaveBeenCalledWith([1, 2]);
  });

  it("POST /api/items/stok-ringkasan memakai ringkasan inventory", async () => {
    mocked.summary.mockResolvedValue({ 1: { masuk: 120, keluar: 50, net: 70 } } as never);

    const res = await request(app)
      .post("/api/items/stok-ringkasan")
      .send({ ids: [1], dari: "2026-10-01", sampai: "2026-10-15" });

    expect(res.status).toBe(200);
    expect(res.body.ringkasan).toEqual({ 1: { masuk: 120, keluar: 50, net: 70 } });
    expect(mocked.summary).toHaveBeenCalledWith([1], {
      from: expect.any(Date),
      until: expect.any(Date),
    });
  });
});
