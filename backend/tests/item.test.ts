import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../src/model/item/item.js", () => ({
  listItems: vi.fn(),
  getItemById: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  bulkUpdateItems: vi.fn(),
  DivisiTidakDikenalError: class DivisiTidakDikenalError extends Error {
    readonly code = "DIVISI_TIDAK_DIKENAL";
  },
}));

let currentAccess = { role: "user", permissions: ["BARANG_LIHAT", "KELOLA_ITEM"], statusView: null };

vi.mock("../src/middleware/auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/middleware/auth.js")>();
  return {
    ...actual,
    authenticate: (_req: any, _res: any, next: any) => next(),
    adminOnly: (_req: any, _res: any, next: any) => next(),
    authorize: (req: any, _res: any, next: any) => {
      req.access = currentAccess;
      next();
    },
  };
});

export const __setItemTestAccess = (permissions: string[]) => {
  currentAccess = { role: "user", permissions, statusView: null };
};

import itemRouter from "../src/routes/item.js";
import {
  listItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  bulkUpdateItems,
} from "../src/model/item/item.js";

const mocked = {
  listItems: vi.mocked(listItems),
  getItemById: vi.mocked(getItemById),
  createItem: vi.mocked(createItem),
  updateItem: vi.mocked(updateItem),
  deleteItem: vi.mocked(deleteItem),
  bulkUpdateItems: vi.mocked(bulkUpdateItems),
};

const app = express();
app.use(express.json());
app.use("/api/items", itemRouter);

const sample = {
  id: 1, kode: "BRG-001", nama: "Baut M8", divisiId: 2, unit: "pcs", jenis: "RAW MATERIAL", isActive: true,
  divisi: { id: 2, nama: "Perakitan" },
};

beforeEach(() => {
  vi.clearAllMocks();
  __setItemTestAccess(["BARANG_LIHAT", "KELOLA_ITEM"]);
});

describe("GET /api/items", () => {
  it("200 list + teruskan filter q/divisiId", async () => {
    mocked.listItems.mockResolvedValue([sample as any]);
    const res = await request(app).get("/api/items?q=baut&divisiId=2&aktif=true");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(mocked.listItems).toHaveBeenCalledWith({ q: "baut", divisiId: 2, aktif: true, jenis: undefined });
  });

  it("200 teruskan filter jenis", async () => {
    mocked.listItems.mockResolvedValue([sample as any]);
    const res = await request(app).get("/api/items?jenis=RAW%20MATERIAL");
    expect(res.status).toBe(200);
    expect(mocked.listItems).toHaveBeenCalledWith(
      expect.objectContaining({ jenis: "RAW MATERIAL" }),
    );
  });

  it("400 divisiId bukan angka", async () => {
    const res = await request(app).get("/api/items?divisiId=x");
    expect(res.status).toBe(400);
    expect(mocked.listItems).not.toHaveBeenCalled();
  });

  it("400 aktif invalid", async () => {
    const res = await request(app).get("/api/items?aktif=mungkin");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/items/:id", () => {
  it("400 id invalid", async () => {
    const res = await request(app).get("/api/items/abc");
    expect(res.status).toBe(400);
  });

  it("404 tidak ditemukan", async () => {
    mocked.getItemById.mockResolvedValue(null);
    const res = await request(app).get("/api/items/99");
    expect(res.status).toBe(404);
  });

  it("200 detail + divisi", async () => {
    mocked.getItemById.mockResolvedValue(sample as any);
    const res = await request(app).get("/api/items/1");
    expect(res.status).toBe(200);
    expect(res.body.divisi.nama).toBe("Perakitan");
  });
});

describe("POST /api/items", () => {
  it("400 kode/nama wajib", async () => {
    const res1 = await request(app).post("/api/items").send({ nama: "X" });
    const res2 = await request(app).post("/api/items").send({ kode: "BRG-1" });
    expect(res1.status).toBe(400);
    expect(res2.status).toBe(400);
    expect(mocked.createItem).not.toHaveBeenCalled();
  });

  it("400 divisiId invalid", async () => {
    const res = await request(app).post("/api/items").send({ kode: "BRG-1", nama: "X", divisiId: "x" });
    expect(res.status).toBe(400);
  });

  it("201 kode di-uppercase", async () => {
    mocked.createItem.mockResolvedValue(sample as any);
    const res = await request(app).post("/api/items").send({ kode: "brg-001", nama: "Baut M8", unit: "pcs" });
    expect(res.status).toBe(201);
    expect(mocked.createItem).toHaveBeenCalledWith(
      expect.objectContaining({ kode: "BRG-001", nama: "Baut M8", unit: "pcs" }),
    );
  });

  it("201 create dengan jenis bebas", async () => {
    mocked.createItem.mockResolvedValue(sample as any);
    const res = await request(app).post("/api/items").send({ kode: "BRG-001", nama: "Baut M8", jenis: "HABIS PAKAI" });
    expect(res.status).toBe(201);
    expect(mocked.createItem).toHaveBeenCalledWith(
      expect.objectContaining({ jenis: "HABIS PAKAI" }),
    );
  });

  it("400 jenis kosong / terlalu panjang", async () => {
    const res1 = await request(app).post("/api/items").send({ kode: "BRG-1", nama: "X", jenis: "  " });
    const res2 = await request(app).post("/api/items").send({ kode: "BRG-1", nama: "X", jenis: "a".repeat(51) });
    expect(res1.status).toBe(400);
    expect(res2.status).toBe(400);
    expect(mocked.createItem).not.toHaveBeenCalled();
  });

  it("409 kode duplikat", async () => {
    mocked.createItem.mockRejectedValue({ code: "P2002" });
    const res = await request(app).post("/api/items").send({ kode: "BRG-001", nama: "X" });
    expect(res.status).toBe(409);
  });

  it("400 divisi tidak ada (P2003)", async () => {
    mocked.createItem.mockRejectedValue({ code: "P2003" });
    const res = await request(app).post("/api/items").send({ kode: "BRG-9", nama: "X", divisiId: 99 });
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/items/:id", () => {
  it("400 tanpa field", async () => {
    const res = await request(app).put("/api/items/1").send({});
    expect(res.status).toBe(400);
    expect(mocked.updateItem).not.toHaveBeenCalled();
  });

  it("200 update parsial + divisiId null melepaskan divisi", async () => {
    mocked.updateItem.mockResolvedValue({ ...sample, divisiId: null } as any);
    const res = await request(app).put("/api/items/1").send({ divisiId: null, isActive: false });
    expect(res.status).toBe(200);
    expect(mocked.updateItem).toHaveBeenCalledWith(1, { divisiId: null, isActive: false });
  });

  it("200 update jenis + null mengosongkan jenis", async () => {
    mocked.updateItem.mockResolvedValue({ ...sample, jenis: null } as any);
    const res = await request(app).put("/api/items/1").send({ jenis: null });
    expect(res.status).toBe(200);
    expect(mocked.updateItem).toHaveBeenCalledWith(1, { jenis: null });
  });

  it("400 jenis invalid saat update", async () => {
    const res = await request(app).put("/api/items/1").send({ jenis: "  " });
    expect(res.status).toBe(400);
    expect(mocked.updateItem).not.toHaveBeenCalled();
  });

  it("404 tidak ditemukan", async () => {
    mocked.updateItem.mockRejectedValue({ code: "P2025" });
    const res = await request(app).put("/api/items/99").send({ nama: "X" });
    expect(res.status).toBe(404);
  });
});

describe("guard KELOLA_ITEM", () => {
  it("403 tulis tanpa permission (mis. hanya BARANG_LIHAT)", async () => {
    __setItemTestAccess(["BARANG_LIHAT"]);
    expect((await request(app).post("/api/items").send({ kode: "BRG-1", nama: "X" })).status).toBe(403);
    expect((await request(app).put("/api/items/1").send({ nama: "X" })).status).toBe(403);
    expect((await request(app).put("/api/items/bulk").send({ ids: [1], jenis: "SM" })).status).toBe(403);
    expect((await request(app).delete("/api/items/1")).status).toBe(403);
    expect(mocked.createItem).not.toHaveBeenCalled();
    expect(mocked.updateItem).not.toHaveBeenCalled();
    expect(mocked.bulkUpdateItems).not.toHaveBeenCalled();
    expect(mocked.deleteItem).not.toHaveBeenCalled();
  });

  it("201 tulis dengan KELOLA_ITEM (peran gudang)", async () => {
    __setItemTestAccess(["BARANG_LIHAT", "KELOLA_ITEM"]);
    mocked.createItem.mockResolvedValue(sample as any);
    const res = await request(app).post("/api/items").send({ kode: "BRG-001", nama: "Baut M8" });
    expect(res.status).toBe(201);
  });
});

describe("PUT /api/items/bulk", () => {
  it("200 set jenis massal + teruskan ids apa adanya", async () => {
    mocked.bulkUpdateItems.mockResolvedValue(2);
    const res = await request(app).put("/api/items/bulk").send({ ids: [1, 2, 2], jenis: "SM" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ requested: 2, updated: 2 });
    expect(mocked.bulkUpdateItems).toHaveBeenCalledWith([1, 2, 2], { jenis: "SM" });
  });

  it("200 set divisi + kosongkan jenis sekaligus", async () => {
    mocked.bulkUpdateItems.mockResolvedValue(1);
    const res = await request(app).put("/api/items/bulk").send({ ids: [1], jenis: null, divisiId: 3 });
    expect(res.status).toBe(200);
    expect(mocked.bulkUpdateItems).toHaveBeenCalledWith([1], { jenis: null, divisiId: 3 });
  });

  it("200 lepas divisi massal (divisiId null)", async () => {
    mocked.bulkUpdateItems.mockResolvedValue(1);
    const res = await request(app).put("/api/items/bulk").send({ ids: [1], divisiId: null });
    expect(res.status).toBe(200);
    expect(mocked.bulkUpdateItems).toHaveBeenCalledWith([1], { divisiId: null });
  });

  it("400 divisi tidak dikenal", async () => {
    mocked.bulkUpdateItems.mockRejectedValue({ code: "DIVISI_TIDAK_DIKENAL" });
    const res = await request(app).put("/api/items/bulk").send({ ids: [1], divisiId: 99 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Divisi tidak ditemukan");
  });

  it("400 tanpa field yang diubah", async () => {
    const res = await request(app).put("/api/items/bulk").send({ ids: [1] });
    expect(res.status).toBe(400);
    expect(mocked.bulkUpdateItems).not.toHaveBeenCalled();
  });

  it("400 ids kosong / invalid / melebihi 500", async () => {
    const r1 = await request(app).put("/api/items/bulk").send({ ids: [], jenis: "SM" });
    const r2 = await request(app).put("/api/items/bulk").send({ ids: [1, "x"], jenis: "SM" });
    const r3 = await request(app).put("/api/items/bulk").send({ ids: Array.from({ length: 501 }, (_, i) => i + 1), jenis: "SM" });
    expect(r1.status).toBe(400);
    expect(r2.status).toBe(400);
    expect(r3.status).toBe(400);
    expect(mocked.bulkUpdateItems).not.toHaveBeenCalled();
  });

  it("400 jenis / divisiId invalid", async () => {
    const r1 = await request(app).put("/api/items/bulk").send({ ids: [1], jenis: "  " });
    const r2 = await request(app).put("/api/items/bulk").send({ ids: [1], jenis: "a".repeat(51) });
    const r3 = await request(app).put("/api/items/bulk").send({ ids: [1], divisiId: "x" });
    expect(r1.status).toBe(400);
    expect(r2.status).toBe(400);
    expect(r3.status).toBe(400);
    expect(mocked.bulkUpdateItems).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/items/:id", () => {
  it("200 hapus sukses", async () => {
    mocked.deleteItem.mockResolvedValue(undefined as any);
    const res = await request(app).delete("/api/items/1");
    expect(res.status).toBe(200);
    expect(mocked.deleteItem).toHaveBeenCalledWith(1);
  });

  it("404 tidak ditemukan", async () => {
    mocked.deleteItem.mockRejectedValue({ code: "P2025" });
    const res = await request(app).delete("/api/items/99");
    expect(res.status).toBe(404);
  });
});
