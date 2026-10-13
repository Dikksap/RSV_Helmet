import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../src/model/gudang/gudang.js", () => ({
  listGudang: vi.fn(),
  getGudangById: vi.fn(),
  createGudang: vi.fn(),
  updateGudang: vi.fn(),
  deleteGudang: vi.fn(),
}));

const adminAccess = { role: "admin", permissions: ["BARANG_LIHAT"], statusView: null };

vi.mock("../src/middleware/auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/middleware/auth.js")>();
  return {
    ...actual,
    authenticate: (_req: any, _res: any, next: any) => next(),
    adminOnly: (_req: any, _res: any, next: any) => next(),
    authorize: (req: any, _res: any, next: any) => {
      req.access = adminAccess;
      next();
    },
  };
});

import gudangRouter from "../src/routes/gudang.js";
import {
  listGudang,
  getGudangById,
  createGudang,
  updateGudang,
  deleteGudang,
} from "../src/model/gudang/gudang.js";

const mocked = {
  listGudang: vi.mocked(listGudang),
  getGudangById: vi.mocked(getGudangById),
  createGudang: vi.mocked(createGudang),
  updateGudang: vi.mocked(updateGudang),
  deleteGudang: vi.mocked(deleteGudang),
};

const app = express();
app.use(express.json());
app.use("/api/gudang", gudangRouter);

const sample = {
  id: 1, kode: "GDA", name: "Gudang A", isActive: true,
  _count: { barang: 12 },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/gudang", () => {
  it("200 list + scope diteruskan", async () => {
    mocked.listGudang.mockResolvedValue([sample as any]);
    const res = await request(app).get("/api/gudang");
    expect(res.status).toBe(200);
    expect(res.body[0]._count.barang).toBe(12);
    expect(mocked.listGudang).toHaveBeenCalledWith(null);
  });
});

describe("GET /api/gudang/:id", () => {
  it("400 id invalid", async () => {
    const res = await request(app).get("/api/gudang/abc");
    expect(res.status).toBe(400);
  });

  it("404 tidak ditemukan", async () => {
    mocked.getGudangById.mockResolvedValue(null);
    const res = await request(app).get("/api/gudang/99");
    expect(res.status).toBe(404);
  });

  it("200 detail", async () => {
    mocked.getGudangById.mockResolvedValue(sample as any);
    const res = await request(app).get("/api/gudang/1");
    expect(res.status).toBe(200);
    expect(mocked.getGudangById).toHaveBeenCalledWith(1, null);
  });
});

describe("POST /api/gudang", () => {
  it("400 kode/name wajib", async () => {
    const res1 = await request(app).post("/api/gudang").send({ name: "X" });
    const res2 = await request(app).post("/api/gudang").send({ kode: "GDX" });
    expect(res1.status).toBe(400);
    expect(res2.status).toBe(400);
    expect(mocked.createGudang).not.toHaveBeenCalled();
  });

  it("201 kode di-uppercase", async () => {
    mocked.createGudang.mockResolvedValue(sample as any);
    const res = await request(app).post("/api/gudang").send({ kode: "gda", name: "Gudang A" });
    expect(res.status).toBe(201);
    expect(mocked.createGudang).toHaveBeenCalledWith(
      expect.objectContaining({ kode: "GDA", name: "Gudang A" }),
    );
  });

  it("409 kode duplikat", async () => {
    mocked.createGudang.mockRejectedValue({ code: "P2002" });
    const res = await request(app).post("/api/gudang").send({ kode: "GDA", name: "X" });
    expect(res.status).toBe(409);
  });
});

describe("PUT /api/gudang/:id", () => {
  it("400 tanpa field", async () => {
    const res = await request(app).put("/api/gudang/1").send({});
    expect(res.status).toBe(400);
    expect(mocked.updateGudang).not.toHaveBeenCalled();
  });

  it("200 update nama", async () => {
    mocked.updateGudang.mockResolvedValue({ ...sample, name: "Gudang A1" } as any);
    const res = await request(app).put("/api/gudang/1").send({ name: "Gudang A1" });
    expect(res.status).toBe(200);
    expect(mocked.updateGudang).toHaveBeenCalledWith(1, { name: "Gudang A1" });
  });

  it("404 tidak ditemukan", async () => {
    mocked.updateGudang.mockRejectedValue({ code: "P2025" });
    const res = await request(app).put("/api/gudang/99").send({ name: "X" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/gudang/:id", () => {
  it("200 hapus sukses (barang ikut SetNull di DB)", async () => {
    mocked.deleteGudang.mockResolvedValue(undefined as any);
    const res = await request(app).delete("/api/gudang/1");
    expect(res.status).toBe(200);
    expect(mocked.deleteGudang).toHaveBeenCalledWith(1);
  });

  it("404 tidak ditemukan", async () => {
    mocked.deleteGudang.mockRejectedValue({ code: "P2025" });
    const res = await request(app).delete("/api/gudang/99");
    expect(res.status).toBe(404);
  });
});
