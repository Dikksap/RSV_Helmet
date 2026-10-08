import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../src/model/barangGroup/barangGroup.js", () => ({
  getAllBarangGroup: vi.fn(),
  getBarangGroupById: vi.fn(),
  getBarangInGroup: vi.fn(),
  createBarangGroup: vi.fn(),
  updateBarangGroup: vi.fn(),
  deleteBarangGroup: vi.fn(),
  assignBarangToGroup: vi.fn(),
  unassignBarangFromGroup: vi.fn(),
}));

import barangGroupRouter from "../src/routes/barangGroup.js";
import {
  getAllBarangGroup,
  getBarangGroupById,
  getBarangInGroup,
  createBarangGroup,
  updateBarangGroup,
  deleteBarangGroup,
  assignBarangToGroup,
  unassignBarangFromGroup,
} from "../src/model/barangGroup/barangGroup.js";

const mocked = {
  getAllBarangGroup: vi.mocked(getAllBarangGroup),
  getBarangGroupById: vi.mocked(getBarangGroupById),
  getBarangInGroup: vi.mocked(getBarangInGroup),
  createBarangGroup: vi.mocked(createBarangGroup),
  updateBarangGroup: vi.mocked(updateBarangGroup),
  deleteBarangGroup: vi.mocked(deleteBarangGroup),
  assignBarangToGroup: vi.mocked(assignBarangToGroup),
  unassignBarangFromGroup: vi.mocked(unassignBarangFromGroup),
};

const app = express();
app.use(express.json());
app.use("/api/barang-group", barangGroupRouter);

const prismaError = (code: string) => Object.assign(new Error(code), { code });

const sampleGroup = {
  id: 1,
  nama: "Gudang A",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  _count: { barang: 3 },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/barang-group", () => {
  it("200 kembalikan list", async () => {
    mocked.getAllBarangGroup.mockResolvedValue([sampleGroup as any]);

    const res = await request(app).get("/api/barang-group");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].nama).toBe("Gudang A");
  });
});

describe("GET /api/barang-group/:id", () => {
  it("400 jika id bukan angka bulat positif", async () => {
    const res = await request(app).get("/api/barang-group/abc");
    expect(res.status).toBe(400);
    expect(mocked.getBarangGroupById).not.toHaveBeenCalled();
  });

  it("404 jika tidak ditemukan", async () => {
    mocked.getBarangGroupById.mockResolvedValue(null);

    const res = await request(app).get("/api/barang-group/999");

    expect(res.status).toBe(404);
  });

  it("200 kembalikan detail", async () => {
    mocked.getBarangGroupById.mockResolvedValue(sampleGroup as any);

    const res = await request(app).get("/api/barang-group/1");

    expect(res.status).toBe(200);
    expect(res.body.nama).toBe("Gudang A");
    expect(mocked.getBarangGroupById).toHaveBeenCalledWith(1);
  });
});

describe("GET /api/barang-group/:id/barangs", () => {
  it("400 jika id bukan angka bulat positif", async () => {
    const res = await request(app).get("/api/barang-group/abc/barangs");
    expect(res.status).toBe(400);
    expect(mocked.getBarangInGroup).not.toHaveBeenCalled();
  });

  it("404 jika grup tidak ditemukan", async () => {
    mocked.getBarangGroupById.mockResolvedValue(null);

    const res = await request(app).get("/api/barang-group/999/barangs");

    expect(res.status).toBe(404);
    expect(mocked.getBarangInGroup).not.toHaveBeenCalled();
  });

  it("200 kembalikan isi grup", async () => {
    mocked.getBarangGroupById.mockResolvedValue(sampleGroup as any);
    mocked.getBarangInGroup.mockResolvedValue([
      {
        id: 1,
        kodeBarang: "BC001-W001-250826-0001",
        status: "FINISHGOOD",
        variant: {
          product: { nama: "Helm Pro" },
          style: { nama: "Stripe" },
          color: { nama: "Merah" },
          size: { nama: "L" },
        },
      },
    ]);

    const res = await request(app).get("/api/barang-group/1/barangs");

    expect(res.status).toBe(200);
    expect(res.body.group.nama).toBe("Gudang A");
    expect(res.body.barang).toHaveLength(1);
    expect(res.body.barang[0].kodeBarang).toBe("BC001-W001-250826-0001");
    expect(mocked.getBarangInGroup).toHaveBeenCalledWith(1);
  });
});

describe("POST /api/barang-group", () => {
  it("400 jika nama kosong", async () => {
    const res = await request(app).post("/api/barang-group").send({ nama: "  " });
    expect(res.status).toBe(400);
    expect(mocked.createBarangGroup).not.toHaveBeenCalled();
  });

  it("201 kembalikan row baru", async () => {
    mocked.createBarangGroup.mockResolvedValue(sampleGroup as any);

    const res = await request(app).post("/api/barang-group").send({ nama: " Gudang A " });

    expect(res.status).toBe(201);
    expect(mocked.createBarangGroup).toHaveBeenCalledWith({ nama: "Gudang A" });
  });
});

describe("PUT /api/barang-group/:id", () => {
  it("400 jika tidak ada field", async () => {
    const res = await request(app).put("/api/barang-group/1").send({});
    expect(res.status).toBe(400);
    expect(mocked.updateBarangGroup).not.toHaveBeenCalled();
  });

  it("404 jika tidak ditemukan", async () => {
    mocked.updateBarangGroup.mockRejectedValue(prismaError("P2025"));

    const res = await request(app).put("/api/barang-group/999").send({ nama: "Baru" });

    expect(res.status).toBe(404);
  });

  it("200 kembalikan row terupdate", async () => {
    mocked.updateBarangGroup.mockResolvedValue({ ...sampleGroup, nama: "Baru" } as any);

    const res = await request(app).put("/api/barang-group/1").send({ nama: " Baru " });

    expect(res.status).toBe(200);
    expect(mocked.updateBarangGroup).toHaveBeenCalledWith(1, { nama: "Baru" });
  });
});

describe("DELETE /api/barang-group/:id", () => {
  it("404 jika tidak ditemukan", async () => {
    mocked.deleteBarangGroup.mockRejectedValue(prismaError("P2025"));

    const res = await request(app).delete("/api/barang-group/999");

    expect(res.status).toBe(404);
  });

  it("200 hapus dus berisi barang (barang dilepas, bukan terhapus)", async () => {
    mocked.deleteBarangGroup.mockResolvedValue(undefined as any);

    const res = await request(app).delete("/api/barang-group/1");

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("berhasil dihapus");
  });

  it("200 sukses hapus", async () => {
    mocked.deleteBarangGroup.mockResolvedValue(undefined as any);

    const res = await request(app).delete("/api/barang-group/1");

    expect(res.status).toBe(200);
    expect(res.body.message).toContain("berhasil dihapus");
  });
});

describe("POST /api/barang-group/:id/assign", () => {
  it("400 jika barangIds kosong/invalid", async () => {
    for (const body of [{}, { barangIds: [] }, { barangIds: ["x"] }]) {
      const res = await request(app).post("/api/barang-group/1/assign").send(body);
      expect(res.status).toBe(400);
    }
    expect(mocked.assignBarangToGroup).not.toHaveBeenCalled();
  });

  it("404 jika grup tidak ada", async () => {
    mocked.getBarangGroupById.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/barang-group/999/assign")
      .send({ barangIds: [1, 2] });

    expect(res.status).toBe(404);
    expect(mocked.assignBarangToGroup).not.toHaveBeenCalled();
  });

  it("200 assign dan laporkan jumlah", async () => {
    mocked.getBarangGroupById.mockResolvedValue(sampleGroup as any);
    mocked.assignBarangToGroup.mockResolvedValue({ updated: 2, skipped: 1 });

    const res = await request(app)
      .post("/api/barang-group/1/assign")
      .send({ barangIds: [1, 2, 3] });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(2);
    expect(res.body.skipped).toBe(1);
    expect(mocked.assignBarangToGroup).toHaveBeenCalledWith(1, [1, 2, 3]);
  });
});

describe("POST /api/barang-group/:id/unassign", () => {
  it("400 jika barangIds invalid", async () => {
    const res = await request(app).post("/api/barang-group/1/unassign").send({ barangIds: [] });
    expect(res.status).toBe(400);
    expect(mocked.unassignBarangFromGroup).not.toHaveBeenCalled();
  });

  it("200 unassign dan laporkan jumlah", async () => {
    mocked.getBarangGroupById.mockResolvedValue(sampleGroup as any);
    mocked.unassignBarangFromGroup.mockResolvedValue({ updated: 1, skipped: 0 });

    const res = await request(app)
      .post("/api/barang-group/1/unassign")
      .send({ barangIds: [5] });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(1);
    expect(mocked.unassignBarangFromGroup).toHaveBeenCalledWith(1, [5]);
  });
});
