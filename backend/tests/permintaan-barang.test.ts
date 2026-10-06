import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../src/model/permintaanBarang/permintaanBarang.js", () => {
  class PermintaanTerkunciError extends Error {
    readonly code = "PERMINTAAN_TERKUNCI";
    constructor() {
      super("Permintaan sudah disetujui, tidak dapat diubah.");
      this.name = "PermintaanTerkunciError";
    }
  }
  return {
    PermintaanTerkunciError,
    createPermintaan: vi.fn(),
    listPermintaan: vi.fn(),
    getPermintaanById: vi.fn(),
    updatePermintaan: vi.fn(),
    setApproval: vi.fn(),
    deletePermintaan: vi.fn(),
  };
});

import permintaanBarangRouter from "../src/routes/permintaan-barang.js";
import {
  createPermintaan,
  listPermintaan,
  getPermintaanById,
  updatePermintaan,
  setApproval,
  deletePermintaan,
  PermintaanTerkunciError,
} from "../src/model/permintaanBarang/permintaanBarang.js";

const mocked = {
  createPermintaan: vi.mocked(createPermintaan),
  listPermintaan: vi.mocked(listPermintaan),
  getPermintaanById: vi.mocked(getPermintaanById),
  updatePermintaan: vi.mocked(updatePermintaan),
  setApproval: vi.mocked(setApproval),
  deletePermintaan: vi.mocked(deletePermintaan),
};

const app = express();
app.use(express.json());
app.use("/api/permintaan-barang", permintaanBarangRouter);

const record = (over: Record<string, unknown> = {}) => ({
  id: 1,
  noPermintaan: "PR-20261006-0001",
  tanggal: new Date("2026-10-06T00:00:00"),
  departemen: "Produksi",
  namaPeminta: "Budi",
  kebutuhanUntuk: "Produksi",
  prioritas: "Normal",
  tanggalDibutuhkan: null,
  alasan: "Kebutuhan lini",
  approval: "BELUM_DISETUJUI",
  createdAt: new Date("2026-10-06T03:00:00"),
  updatedAt: new Date("2026-10-06T03:00:00"),
  items: [{ id: 1, permintaanId: 1, nama: "Kertas A4", spesifikasi: "80gsm", jumlah: 5, satuan: "rim", createdAt: new Date(), updatedAt: new Date() }],
  ...over,
});

const validBody = () => ({
  tanggal: "2026-10-06",
  departemen: "Produksi",
  namaPeminta: "Budi",
  alasan: "Kebutuhan lini",
  items: [{ nama: "Kertas A4", spesifikasi: "80gsm", jumlah: 5, satuan: "rim" }],
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/permintaan-barang", () => {
  it("201 dengan nomor dari backend", async () => {
    mocked.createPermintaan.mockResolvedValue(record() as never);
    const res = await request(app).post("/api/permintaan-barang").send(validBody());
    expect(res.status).toBe(201);
    expect(res.body.noPermintaan).toBe("PR-20261006-0001");
    const input = mocked.createPermintaan.mock.calls[0][0] as { items: unknown[] };
    expect(input.items).toHaveLength(1);
  });

  it("400 jika items kosong", async () => {
    const res = await request(app)
      .post("/api/permintaan-barang")
      .send({ ...validBody(), items: [] });
    expect(res.status).toBe(400);
    expect(mocked.createPermintaan).not.toHaveBeenCalled();
  });

  it("400 jika jumlah 0 atau negatif", async () => {
    const res = await request(app)
      .post("/api/permintaan-barang")
      .send({ ...validBody(), items: [{ nama: "Kertas", jumlah: 0 }] });
    expect(res.status).toBe(400);
  });

  it("400 jika alasan kosong", async () => {
    const res = await request(app)
      .post("/api/permintaan-barang")
      .send({ ...validBody(), alasan: "   " });
    expect(res.status).toBe(400);
  });

  it("400 jika prioritas tidak dikenal", async () => {
    const res = await request(app)
      .post("/api/permintaan-barang")
      .send({ ...validBody(), prioritas: "Super" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/permintaan-barang", () => {
  it("200 mengembalikan data + meta", async () => {
    mocked.listPermintaan.mockResolvedValue({ data: [record()], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } } as never);
    const res = await request(app).get("/api/permintaan-barang");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  it("filter approval diteruskan ke model", async () => {
    mocked.listPermintaan.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } } as never);
    await request(app).get("/api/permintaan-barang?approval=DISETUJUI");
    expect(mocked.listPermintaan).toHaveBeenCalledWith(expect.objectContaining({ approval: "DISETUJUI" }));
  });

  it("400 jika approval tidak valid", async () => {
    const res = await request(app).get("/api/permintaan-barang?approval=SALAH");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/permintaan-barang/:id", () => {
  it("404 jika tidak ditemukan", async () => {
    mocked.getPermintaanById.mockResolvedValue(null as never);
    const res = await request(app).get("/api/permintaan-barang/99");
    expect(res.status).toBe(404);
  });

  it("400 jika id bukan angka", async () => {
    const res = await request(app).get("/api/permintaan-barang/abc");
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/permintaan-barang/:id", () => {
  it("200 saat BELUM_DISETUJUI", async () => {
    mocked.updatePermintaan.mockResolvedValue(record() as never);
    const res = await request(app).put("/api/permintaan-barang/1").send(validBody());
    expect(res.status).toBe(200);
  });

  it("409 saat DISETUJUI", async () => {
    mocked.updatePermintaan.mockRejectedValue(new PermintaanTerkunciError());
    const res = await request(app).put("/api/permintaan-barang/1").send(validBody());
    expect(res.status).toBe(409);
  });

  it("404 jika tidak ditemukan", async () => {
    mocked.updatePermintaan.mockResolvedValue(null as never);
    const res = await request(app).put("/api/permintaan-barang/99").send(validBody());
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/permintaan-barang/:id/approval", () => {
  it("200 mengubah status dua arah", async () => {
    mocked.setApproval.mockResolvedValue(record({ approval: "DISETUJUI" }) as never);
    const res = await request(app).patch("/api/permintaan-barang/1/approval").send({ approval: "DISETUJUI" });
    expect(res.status).toBe(200);
    expect(res.body.approval).toBe("DISETUJUI");
  });

  it("400 jika approval tidak valid", async () => {
    const res = await request(app).patch("/api/permintaan-barang/1/approval").send({ approval: "MAYBE" });
    expect(res.status).toBe(400);
  });

  it("404 jika tidak ditemukan", async () => {
    mocked.setApproval.mockResolvedValue(null as never);
    const res = await request(app).patch("/api/permintaan-barang/99/approval").send({ approval: "DISETUJUI" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/permintaan-barang/:id", () => {
  it("200 jika berhasil", async () => {
    mocked.deletePermintaan.mockResolvedValue(true as never);
    const res = await request(app).delete("/api/permintaan-barang/1");
    expect(res.status).toBe(200);
  });

  it("409 saat DISETUJUI", async () => {
    mocked.deletePermintaan.mockRejectedValue(new PermintaanTerkunciError());
    const res = await request(app).delete("/api/permintaan-barang/1");
    expect(res.status).toBe(409);
  });

  it("404 jika tidak ditemukan", async () => {
    mocked.deletePermintaan.mockResolvedValue(false as never);
    const res = await request(app).delete("/api/permintaan-barang/99");
    expect(res.status).toBe(404);
  });
});
