import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../src/model/stokItem/stokItem.js", () => ({
  catatMutasi: vi.fn(),
  getSaldo: vi.fn(),
  getSaldoBulk: vi.fn(),
  listMutasiItem: vi.fn(),
  lockItem: vi.fn(),
}));

vi.mock("../src/model/item/item.js", () => ({
  getItemById: vi.fn(),
  listItems: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({
  default: {
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})),
  },
}));

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
      req.access = { role: "user", permissions: ["KELOLA_ITEM"], statusView: null };
      next();
    },
  };
});

import itemRouter from "../src/routes/item.js";
import { catatMutasi, getSaldo, getSaldoBulk, listMutasiItem } from "../src/model/stokItem/stokItem.js";
import { getItemById } from "../src/model/item/item.js";

const mocked = {
  catatMutasi: vi.mocked(catatMutasi),
  getSaldo: vi.mocked(getSaldo),
  getSaldoBulk: vi.mocked(getSaldoBulk),
  listMutasiItem: vi.mocked(listMutasiItem),
  getItemById: vi.mocked(getItemById),
};

const app = express();
app.use(express.json());
app.use("/api/items", itemRouter);

const item = { id: 1, kode: "MSK", nama: "Masker", unit: "pcs", divisi: null };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/items/:id/stok", () => {
  it("201 mencatat MASUK dan mengembalikan saldo baru", async () => {
    mocked.getItemById.mockResolvedValue(item as never);
    mocked.catatMutasi.mockResolvedValue({ id: 1, tipe: "MASUK", jumlah: 20 } as never);
    mocked.getSaldo.mockResolvedValue(25 as never);

    const res = await request(app).post("/api/items/1/stok").send({ jumlah: 20 });

    expect(res.status).toBe(201);
    expect(res.body.saldo).toBe(25);
    expect(mocked.catatMutasi).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ itemId: 1, tipe: "MASUK", jumlah: 20, userId: 1 }),
    );
  });

  it("400 jika jumlah 0, negatif, atau bukan bilangan bulat", async () => {
    expect((await request(app).post("/api/items/1/stok").send({ jumlah: 0 })).status).toBe(400);
    expect((await request(app).post("/api/items/1/stok").send({ jumlah: -3 })).status).toBe(400);
    expect((await request(app).post("/api/items/1/stok").send({ jumlah: 1.5 })).status).toBe(400);
    expect(mocked.catatMutasi).not.toHaveBeenCalled();
  });

  it("404 jika item tidak ada", async () => {
    mocked.getItemById.mockResolvedValue(null as never);
    const res = await request(app).post("/api/items/99/stok").send({ jumlah: 5 });
    expect(res.status).toBe(404);
    expect(mocked.catatMutasi).not.toHaveBeenCalled();
  });
});

describe("GET /api/items/:id/stok", () => {
  it("200 mengembalikan saldo + riwayat", async () => {
    mocked.getItemById.mockResolvedValue(item as never);
    mocked.getSaldo.mockResolvedValue(15 as never);
    mocked.listMutasiItem.mockResolvedValue({
      data: [{ id: 1, tipe: "KELUAR", jumlah: 5 }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    } as never);

    const res = await request(app).get("/api/items/1/stok");

    expect(res.status).toBe(200);
    expect(res.body.saldo).toBe(15);
    expect(res.body.riwayat.data).toHaveLength(1);
  });

  it("404 jika item tidak ada", async () => {
    mocked.getItemById.mockResolvedValue(null as never);
    const res = await request(app).get("/api/items/99/stok");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/items/stok-saldo", () => {
  it("200 mengembalikan map saldo satu query", async () => {
    mocked.getSaldoBulk.mockResolvedValue({ 1: 100, 2: 5 } as never);
    const res = await request(app).post("/api/items/stok-saldo").send({ ids: [1, 2] });
    expect(res.status).toBe(200);
    expect(res.body.saldo).toEqual({ 1: 100, 2: 5 });
    expect(mocked.getSaldoBulk).toHaveBeenCalledWith([1, 2]);
  });

  it("400 jika ids kosong atau invalid", async () => {
    expect((await request(app).post("/api/items/stok-saldo").send({ ids: [] })).status).toBe(400);
    expect((await request(app).post("/api/items/stok-saldo").send({ ids: [0] })).status).toBe(400);
    expect(mocked.getSaldoBulk).not.toHaveBeenCalled();
  });
});
