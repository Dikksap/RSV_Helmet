import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../src/model/pemakaianMaterial/pemakaianMaterial.js", () => {
  class PemakaianError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "PemakaianError";
      this.code = code;
    }
  }
  return {
    PemakaianError,
    PERMINTAAN_TIDAK_DITEMUKAN: "PERMINTAAN_TIDAK_DITEMUKAN",
    DIVISI_TIDAK_DITEMUKAN: "DIVISI_TIDAK_DITEMUKAN",
    ITEM_PERMINTAAN_TIDAK_VALID: "ITEM_PERMINTAAN_TIDAK_VALID",
    PEMAKAIAN_DUPLIKAT_ITEM: "PEMAKAIAN_DUPLIKAT_ITEM",
    JUMLAH_PEMAKAIAN_INVALID: "JUMLAH_PEMAKAIAN_INVALID",
    createPemakaian: vi.fn(),
    listPemakaian: vi.fn(),
    getPemakaianById: vi.fn(),
    getStokPerDivisi: vi.fn(),
    updatePemakaian: vi.fn(),
    deletePemakaian: vi.fn(),
  };
});

vi.mock("../src/middleware/auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/middleware/auth.js")>();
  return {
    ...actual,
    authenticate: (_req: any, _res: any, next: any) => next(),
    adminOnly: (_req: any, _res: any, next: any) => next(),
  };
});

import pemakaianMaterialRouter from "../src/routes/pemakaian-material.js";
import {
  createPemakaian,
  getStokPerDivisi,
} from "../src/model/pemakaianMaterial/pemakaianMaterial.js";

const mocked = {
  createPemakaian: vi.mocked(createPemakaian),
  getStokPerDivisi: vi.mocked(getStokPerDivisi),
};

const app = express();
app.use(express.json());
app.use("/api/pemakaian-material", pemakaianMaterialRouter);

const record = (over: Record<string, unknown> = {}) => ({
  id: 1,
  nomor: "PM-20261006-0001",
  permintaanId: 1,
  divisiId: 1,
  tanggal: new Date("2026-10-06T00:00:00"),
  userId: null,
  keterangan: null,
  createdAt: new Date("2026-10-06T03:00:00"),
  updatedAt: new Date("2026-10-06T03:00:00"),
  items: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/pemakaian-material", () => {
  it("201 hanya dengan jumlahSisa per item", async () => {
    mocked.createPemakaian.mockResolvedValue(record() as never);
    const res = await request(app)
      .post("/api/pemakaian-material")
      .send({
        permintaanId: 1,
        divisiId: 1,
        items: [{ permintaanBarangItemId: 17, jumlahSisa: 40 }],
      });
    expect(res.status).toBe(201);
    const input = mocked.createPemakaian.mock.calls[0][0] as {
      items: Array<Record<string, unknown>>;
    };
    expect(input.items).toHaveLength(1);
    expect(input.items[0].jumlahSisa).toBe(40);
    expect(input.items[0].jumlahDiterima).toBeUndefined();
    expect(input.items[0].jumlahDipakai).toBeUndefined();
  });

  it("400 jika jumlahSisa tidak dikirim", async () => {
    const res = await request(app)
      .post("/api/pemakaian-material")
      .send({
        permintaanId: 1,
        divisiId: 1,
        items: [{ permintaanBarangItemId: 17 }],
      });
    expect(res.status).toBe(400);
    expect(mocked.createPemakaian).not.toHaveBeenCalled();
  });

  it("400 jika jumlahSisa negatif", async () => {
    const res = await request(app)
      .post("/api/pemakaian-material")
      .send({
        permintaanId: 1,
        divisiId: 1,
        items: [{ permintaanBarangItemId: 17, jumlahSisa: -1 }],
      });
    expect(res.status).toBe(400);
    expect(mocked.createPemakaian).not.toHaveBeenCalled();
  });
});

describe("GET /api/pemakaian-material/stok-divisi", () => {
  it("200 dan tidak tertangkap route /:id", async () => {
    mocked.getStokPerDivisi.mockResolvedValue([
      {
        divisiId: 1,
        divisiNama: "Produksi",
        materials: [
          { itemId: 5, key: "item:5", nama: "Kertas A4", satuan: "rim", diterima: 100, dipakai: 30, sisa: 70 },
        ],
      },
    ]);
    const res = await request(app).get("/api/pemakaian-material/stok-divisi");
    expect(res.status).toBe(200);
    expect(res.body.data[0].divisiNama).toBe("Produksi");
    expect(res.body.data[0].materials[0].sisa).toBe(70);
    expect(mocked.getStokPerDivisi).toHaveBeenCalledTimes(1);
  });

  it("meneruskan rentang tanggal ke model", async () => {
    mocked.getStokPerDivisi.mockResolvedValue([]);
    const res = await request(app).get(
      "/api/pemakaian-material/stok-divisi?dari=2026-10-01&sampai=2026-10-31",
    );
    expect(res.status).toBe(200);
    expect(mocked.getStokPerDivisi).toHaveBeenCalledWith({
      dari: new Date(2026, 9, 1),
      sampai: new Date(2026, 9, 31),
    });
  });

  it("400 jika tanggal invalid atau rentang terbalik", async () => {
    const invalid = await request(app).get(
      "/api/pemakaian-material/stok-divisi?dari=2026-13-01",
    );
    expect(invalid.status).toBe(400);

    const terbalik = await request(app).get(
      "/api/pemakaian-material/stok-divisi?dari=2026-10-31&sampai=2026-10-01",
    );
    expect(terbalik.status).toBe(400);
    expect(mocked.getStokPerDivisi).not.toHaveBeenCalled();
  });
});
