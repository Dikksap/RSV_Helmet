import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../src/model/batch/batch.js", () => ({
  getAllBatch: vi.fn(),
  getBatchById: vi.fn(),
  createBatch: vi.fn(),
  updateBatch: vi.fn(),
  deleteBatch: vi.fn(),
}));

import batchRouter from "../src/routes/batch.js";
import {
  getAllBatch,
  getBatchById,
  createBatch,
  updateBatch,
  deleteBatch,
} from "../src/model/batch/batch.js";

const mocked = {
  getAllBatch: vi.mocked(getAllBatch),
  getBatchById: vi.mocked(getBatchById),
  createBatch: vi.mocked(createBatch),
  updateBatch: vi.mocked(updateBatch),
  deleteBatch: vi.mocked(deleteBatch),
};

const app = express();
app.use(express.json());
app.use("/api/batches", batchRouter);

const prismaError = (code: string) => Object.assign(new Error(code), { code });

const sample = {
  id: 1,
  nomorBatch: 1,
  totalProduksi: 5000,
  kapasitas: 5000,
  status: "SELESAI",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  _count: { barang: 5000 },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/batches", () => {
  it("200 kembalikan list", async () => {
    mocked.getAllBatch.mockResolvedValue([sample as any]);
    const res = await request(app).get("/api/batches");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].nomorBatch).toBe(1);
  });
});

describe("GET /api/batches/:id", () => {
  it("400 id invalid", async () => {
    const res = await request(app).get("/api/batches/abc");
    expect(res.status).toBe(400);
  });
  it("404 tidak ditemukan", async () => {
    mocked.getBatchById.mockResolvedValue(null);
    const res = await request(app).get("/api/batches/99");
    expect(res.status).toBe(404);
  });
  it("200 detail", async () => {
    mocked.getBatchById.mockResolvedValue(sample as any);
    const res = await request(app).get("/api/batches/1");
    expect(res.status).toBe(200);
    expect(res.body.nomorBatch).toBe(1);
  });
});

describe("POST /api/batches", () => {
  it("400 kapasitas negatif", async () => {
    const res = await request(app).post("/api/batches").send({ kapasitas: -1 });
    expect(res.status).toBe(400);
    expect(mocked.createBatch).not.toHaveBeenCalled();
  });
  it("201 sukses default kapasitas", async () => {
    mocked.createBatch.mockResolvedValue({ ...sample, id: 2, nomorBatch: 2 } as any);
    const res = await request(app).post("/api/batches").send({});
    expect(res.status).toBe(201);
    expect(mocked.createBatch).toHaveBeenCalledWith({});
  });
  it("201 sukses kapasitas custom", async () => {
    mocked.createBatch.mockResolvedValue({ ...sample, kapasitas: 1000 } as any);
    const res = await request(app).post("/api/batches").send({ kapasitas: 1000 });
    expect(res.status).toBe(201);
    expect(mocked.createBatch).toHaveBeenCalledWith({ kapasitas: 1000 });
  });
});

describe("PUT /api/batches/:id", () => {
  it("400 status invalid", async () => {
    const res = await request(app).put("/api/batches/1").send({ status: "X" });
    expect(res.status).toBe(400);
    expect(mocked.updateBatch).not.toHaveBeenCalled();
  });
  it("400 kapasitas negatif", async () => {
    const res = await request(app).put("/api/batches/1").send({ kapasitas: -5 });
    expect(res.status).toBe(400);
  });
  it("404 tidak ditemukan", async () => {
    mocked.updateBatch.mockRejectedValue(prismaError("P2025"));
    const res = await request(app).put("/api/batches/99").send({ status: "SELESAI" });
    expect(res.status).toBe(404);
  });
  it("200 sukses", async () => {
    mocked.updateBatch.mockResolvedValue(sample as any);
    const res = await request(app).put("/api/batches/1").send({ kapasitas: 5000, status: "SELESAI" });
    expect(res.status).toBe(200);
    expect(mocked.updateBatch).toHaveBeenCalledWith(1, { kapasitas: 5000, status: "SELESAI" });
  });
});

describe("DELETE /api/batches/:id", () => {
  it("404 tidak ditemukan", async () => {
    mocked.deleteBatch.mockRejectedValue(prismaError("P2025"));
    const res = await request(app).delete("/api/batches/99");
    expect(res.status).toBe(404);
  });
  it("409 batch masih berisi barang", async () => {
    mocked.deleteBatch.mockRejectedValue(
      Object.assign(new Error("Batch masih berisi barang dan tidak boleh dihapus"), { code: "E409" }),
    );
    const res = await request(app).delete("/api/batches/1");
    expect(res.status).toBe(409);
  });
  it("200 sukses", async () => {
    mocked.deleteBatch.mockResolvedValue(undefined as any);
    const res = await request(app).delete("/api/batches/1");
    expect(res.status).toBe(200);
  });
});
