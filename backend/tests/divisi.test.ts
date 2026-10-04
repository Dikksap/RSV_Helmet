import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../src/model/divisi/divisi.js", () => ({
  getAllDivisi: vi.fn(),
  getDivisiById: vi.fn(),
  createDivisi: vi.fn(),
  updateDivisi: vi.fn(),
  deleteDivisi: vi.fn(),
}));

import divisiRouter from "../src/routes/divisi.js";
import {
  getAllDivisi,
  getDivisiById,
  createDivisi,
  updateDivisi,
  deleteDivisi,
} from "../src/model/divisi/divisi.js";

const mocked = {
  getAllDivisi: vi.mocked(getAllDivisi),
  getDivisiById: vi.mocked(getDivisiById),
  createDivisi: vi.mocked(createDivisi),
  updateDivisi: vi.mocked(updateDivisi),
  deleteDivisi: vi.mocked(deleteDivisi),
};

const app = express();
app.use(express.json());
app.use("/api/divisi", divisiRouter);

const prismaError = (code: string) => Object.assign(new Error(code), { code });

const sample = {
  id: 1,
  nama: "Buffing",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  _count: { karyawan: 2 },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/divisi", () => {
  it("200 kembalikan list", async () => {
    mocked.getAllDivisi.mockResolvedValue([sample as any]);
    const res = await request(app).get("/api/divisi");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].nama).toBe("Buffing");
  });
});

describe("GET /api/divisi/:id", () => {
  it("400 id invalid", async () => {
    const res = await request(app).get("/api/divisi/abc");
    expect(res.status).toBe(400);
  });
  it("404 tidak ditemukan", async () => {
    mocked.getDivisiById.mockResolvedValue(null);
    const res = await request(app).get("/api/divisi/99");
    expect(res.status).toBe(404);
  });
  it("200 detail + karyawan", async () => {
    mocked.getDivisiById.mockResolvedValue({ ...sample, karyawan: [] } as any);
    const res = await request(app).get("/api/divisi/1");
    expect(res.status).toBe(200);
    expect(res.body.nama).toBe("Buffing");
  });
});

describe("POST /api/divisi", () => {
  it("400 nama kosong", async () => {
    const res = await request(app).post("/api/divisi").send({ nama: " " });
    expect(res.status).toBe(400);
    expect(mocked.createDivisi).not.toHaveBeenCalled();
  });
  it("409 nama duplikat", async () => {
    mocked.createDivisi.mockRejectedValue(prismaError("P2002"));
    const res = await request(app).post("/api/divisi").send({ nama: "Buffing" });
    expect(res.status).toBe(409);
  });
  it("201 sukses", async () => {
    mocked.createDivisi.mockResolvedValue(sample as any);
    const res = await request(app).post("/api/divisi").send({ nama: "Buffing" });
    expect(res.status).toBe(201);
    expect(mocked.createDivisi).toHaveBeenCalledWith({ nama: "Buffing" });
  });
});

describe("PUT /api/divisi/:id", () => {
  it("400 id invalid", async () => {
    const res = await request(app).put("/api/divisi/abc").send({ nama: "QC" });
    expect(res.status).toBe(400);
  });
  it("404 tidak ditemukan", async () => {
    mocked.updateDivisi.mockRejectedValue(prismaError("P2025"));
    const res = await request(app).put("/api/divisi/99").send({ nama: "QC" });
    expect(res.status).toBe(404);
  });
  it("200 sukses", async () => {
    mocked.updateDivisi.mockResolvedValue({ ...sample, nama: "QC" } as any);
    const res = await request(app).put("/api/divisi/1").send({ nama: "QC" });
    expect(res.status).toBe(200);
    expect(mocked.updateDivisi).toHaveBeenCalledWith(1, { nama: "QC" });
  });
});

describe("DELETE /api/divisi/:id", () => {
  it("404 tidak ditemukan", async () => {
    mocked.deleteDivisi.mockRejectedValue(prismaError("P2025"));
    const res = await request(app).delete("/api/divisi/99");
    expect(res.status).toBe(404);
  });
  it("200 sukses", async () => {
    mocked.deleteDivisi.mockResolvedValue(undefined as any);
    const res = await request(app).delete("/api/divisi/1");
    expect(res.status).toBe(200);
  });
});
