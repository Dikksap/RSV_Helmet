import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../src/model/mutasiGudang/mutasiGudang.js", () => ({
  MutasiError: class MutasiError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.name = "MutasiError";
      this.status = status;
    }
  },
  catatMutasi: vi.fn(),
  catatMutasiBulk: vi.fn(),
  listMutasi: vi.fn(),
  getMutasiByBarang: vi.fn(),
  getMutasiByGudang: vi.fn(),
}));

vi.mock("../src/model/barang/barang.js", () => ({
  findBarangByKodeList: vi.fn(),
}));

let currentAccess: { role: string; permissions: string[]; statusView: string[] | null } = {
  role: "admin",
  permissions: ["BARANG_LIHAT", "MUTASI_GUDANG"],
  statusView: null,
};

vi.mock("../src/middleware/auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/middleware/auth.js")>();
  return {
    ...actual,
    authenticate: (_req: any, _res: any, next: any) => next(),
    adminOnly: (_req: any, _res: any, next: any) => next(),
    authorize: (req: any, _res: any, next: any) => {
      req.user = { id: 7, email: "op@example.com", name: "Op", role: "gudang" };
      req.access = currentAccess;
      next();
    },
  };
});

import mutasiRouter from "../src/routes/mutasiGudang.js";
import {
  MutasiError,
  catatMutasi,
  catatMutasiBulk,
  listMutasi,
  getMutasiByBarang,
  getMutasiByGudang,
} from "../src/model/mutasiGudang/mutasiGudang.js";
import { findBarangByKodeList } from "../src/model/barang/barang.js";

const mocked = {
  catatMutasi: vi.mocked(catatMutasi),
  catatMutasiBulk: vi.mocked(catatMutasiBulk),
  listMutasi: vi.mocked(listMutasi),
  getMutasiByBarang: vi.mocked(getMutasiByBarang),
  getMutasiByGudang: vi.mocked(getMutasiByGudang),
  findBarangByKodeList: vi.mocked(findBarangByKodeList),
};

const app = express();
app.use(express.json());
app.use("/api/mutasi-gudang", mutasiRouter);

const sampleMutasi = {
  id: 1,
  barangId: 10,
  gudangAsalId: null,
  gudangTujuanId: 3,
  jumlah: 1,
  tanggal: new Date("2026-10-01"),
  keterangan: "masuk awal",
  userId: 1,
  barang: { id: 10, kodeBarang: "BC001-W001-261001-0001", status: "FINISHGOOD" },
  gudangAsal: null,
  gudangTujuan: { id: 3, kode: "GDA", name: "Gudang A" },
  user: { id: 1, name: "Admin", email: "admin@example.com" },
};

beforeEach(() => {
  vi.clearAllMocks();
  currentAccess = { role: "admin", permissions: ["BARANG_LIHAT", "MUTASI_GUDANG"], statusView: null };
});

describe("POST /api/mutasi-gudang", () => {
  it("403 tanpa permission MUTASI_GUDANG", async () => {
    currentAccess = { role: "gudang", permissions: ["BARANG_LIHAT"], statusView: ["FINISHGOOD"] };
    const res = await request(app).post("/api/mutasi-gudang").send({ barangId: 10, gudangTujuanId: 3 });
    expect(res.status).toBe(403);
    expect(mocked.catatMutasi).not.toHaveBeenCalled();
  });

  it("400 tanpa barangId/kodeBarang", async () => {
    const res = await request(app).post("/api/mutasi-gudang").send({ gudangTujuanId: 3 });
    expect(res.status).toBe(400);
  });

  it("404 kodeBarang tidak dikenal", async () => {
    mocked.findBarangByKodeList.mockResolvedValue([]);
    const res = await request(app).post("/api/mutasi-gudang").send({ kodeBarang: "XX", gudangTujuanId: 3 });
    expect(res.status).toBe(404);
    expect(mocked.catatMutasi).not.toHaveBeenCalled();
  });

  it("201 masuk gudang via kodeBarang (userId dari token)", async () => {
    mocked.findBarangByKodeList.mockResolvedValue([{ id: 10, kodeBarang: "BC1", status: "FINISHGOOD" } as any]);
    mocked.catatMutasi.mockResolvedValue(sampleMutasi as any);
    const res = await request(app)
      .post("/api/mutasi-gudang")
      .send({ kodeBarang: "BC1", gudangTujuanId: 3, keterangan: "masuk awal", userId: 99 });
    expect(res.status).toBe(201);
    expect(res.body.gudangTujuan.kode).toBe("GDA");
    expect(res.body.barang.kodeBarang).toBe("BC001-W001-261001-0001");
    // userId body diabaikan; controller memakai identitas token (id 7)
    expect(mocked.catatMutasi).toHaveBeenCalledWith(
      expect.objectContaining({ barangId: 10, gudangAsalId: null, gudangTujuanId: 3, userId: 7 }),
    );
  });

  it("409 asal tidak sesuai diteruskan dari model", async () => {
    mocked.catatMutasi.mockRejectedValue(new MutasiError("Gudang asal tidak sesuai lokasi barang saat ini", 409));
    const res = await request(app).post("/api/mutasi-gudang").send({ barangId: 10, gudangAsalId: 2, gudangTujuanId: 3 });
    expect(res.status).toBe(409);
  });

  it("400 mutasi asal==tujuan diteruskan dari model", async () => {
    mocked.catatMutasi.mockRejectedValue(new MutasiError("Gudang asal dan tujuan tidak boleh sama", 400));
    const res = await request(app).post("/api/mutasi-gudang").send({ barangId: 10, gudangAsalId: 3, gudangTujuanId: 3 });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/mutasi-gudang/bulk", () => {
  it("403 tanpa permission MUTASI_GUDANG", async () => {
    currentAccess = { role: "gudang", permissions: ["BARANG_LIHAT"], statusView: ["FINISHGOOD"] };
    const res = await request(app).post("/api/mutasi-gudang/bulk").send({ barangIds: [1, 2], gudangTujuanId: 3 });
    expect(res.status).toBe(403);
    expect(mocked.catatMutasiBulk).not.toHaveBeenCalled();
  });

  it("400 jika barangIds bukan array / kosong", async () => {
    const res1 = await request(app).post("/api/mutasi-gudang/bulk").send({ barangIds: "x", gudangTujuanId: 3 });
    const res2 = await request(app).post("/api/mutasi-gudang/bulk").send({ barangIds: [], gudangTujuanId: 3 });
    expect(res1.status).toBe(400);
    expect(res2.status).toBe(400);
    expect(mocked.catatMutasiBulk).not.toHaveBeenCalled();
  });

  it("400 jika barangIds > 500", async () => {
    const res = await request(app)
      .post("/api/mutasi-gudang/bulk")
      .send({ barangIds: Array.from({ length: 501 }, (_, i) => i + 1), gudangTujuanId: 3 });
    expect(res.status).toBe(400);
  });

  it("400 jika id bukan angka", async () => {
    const res = await request(app)
      .post("/api/mutasi-gudang/bulk")
      .send({ barangIds: [1, "abc"], gudangTujuanId: 3 });
    expect(res.status).toBe(400);
  });

  it("400 jika gudangTujuanId tidak dikirim", async () => {
    const res = await request(app).post("/api/mutasi-gudang/bulk").send({ barangIds: [1, 2] });
    expect(res.status).toBe(400);
  });

  it("201 + summary, userId dari token", async () => {
    mocked.catatMutasiBulk.mockResolvedValue({
      success: [sampleMutasi, { ...sampleMutasi, id: 2, barangId: 11 }],
      summary: { total: 2, success: 2, failed: 0 },
    } as any);
    const res = await request(app)
      .post("/api/mutasi-gudang/bulk")
      .send({ barangIds: [10, 11], gudangTujuanId: 3, keterangan: "pindah rak" });
    expect(res.status).toBe(201);
    expect(res.body.summary).toEqual({ total: 2, success: 2, failed: 0 });
    expect(mocked.catatMutasiBulk).toHaveBeenCalledWith(
      expect.objectContaining({ barangIds: [10, 11], gudangTujuanId: 3, keterangan: "pindah rak", userId: 7 }),
    );
  });

  it("201 keluarkan massal (tujuan null)", async () => {
    mocked.catatMutasiBulk.mockResolvedValue({ success: [], summary: { total: 1, success: 1, failed: 0 } } as any);
    const res = await request(app)
      .post("/api/mutasi-gudang/bulk")
      .send({ barangIds: [10], gudangTujuanId: null });
    expect(res.status).toBe(201);
    expect(mocked.catatMutasiBulk).toHaveBeenCalledWith(expect.objectContaining({ gudangTujuanId: null }));
  });

  it("404 id tak dikenal diteruskan dari model", async () => {
    mocked.catatMutasiBulk.mockRejectedValue(new MutasiError("Barang tidak ditemukan: 99", 404));
    const res = await request(app)
      .post("/api/mutasi-gudang/bulk")
      .send({ barangIds: [10, 99], gudangTujuanId: 3 });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/mutasi-gudang", () => {
  it("200 teruskan filter tanggal + gudang", async () => {
    mocked.listMutasi.mockResolvedValue({ data: [sampleMutasi], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } } as any);
    const res = await request(app).get("/api/mutasi-gudang?gudangId=3&dari=2026-10-01&sampai=2026-10-31");
    expect(res.status).toBe(200);
    expect(mocked.listMutasi).toHaveBeenCalledWith(
      expect.objectContaining({ gudangId: 3, dari: expect.any(Date), sampai: expect.any(Date) }),
    );
  });

  it("400 tanggal invalid", async () => {
    const res = await request(app).get("/api/mutasi-gudang?dari=bukan-tanggal");
    expect(res.status).toBe(400);
    expect(mocked.listMutasi).not.toHaveBeenCalled();
  });

  it("403 tanpa BARANG_LIHAT", async () => {
    currentAccess = { role: "x", permissions: [], statusView: [] };
    const res = await request(app).get("/api/mutasi-gudang");
    expect(res.status).toBe(403);
  });
});

describe("GET /api/mutasi-gudang/barang/:barangId & gudang/:gudangId", () => {
  it("400 id invalid", async () => {
    const res1 = await request(app).get("/api/mutasi-gudang/barang/abc");
    const res2 = await request(app).get("/api/mutasi-gudang/gudang/abc");
    expect(res1.status).toBe(400);
    expect(res2.status).toBe(400);
  });

  it("200 riwayat per barang", async () => {
    mocked.getMutasiByBarang.mockResolvedValue([sampleMutasi as any]);
    const res = await request(app).get("/api/mutasi-gudang/barang/10");
    expect(res.status).toBe(200);
    expect(mocked.getMutasiByBarang).toHaveBeenCalledWith(10);
  });

  it("200 riwayat per gudang", async () => {
    mocked.getMutasiByGudang.mockResolvedValue([sampleMutasi as any]);
    const res = await request(app).get("/api/mutasi-gudang/gudang/3");
    expect(res.status).toBe(200);
    expect(mocked.getMutasiByGudang).toHaveBeenCalledWith(3);
  });
});
