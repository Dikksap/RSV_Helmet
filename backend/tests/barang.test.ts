import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../src/model/barang/barang.js", () => ({
  VALID_STATUSES: ["REGISTER", "FINISHGOOD", "RETUR", "OUT", "BAD"],
  barangInclude: {},
  listBarang: vi.fn(),
  getBarangById: vi.fn(),
  getRiwayatByBarangId: vi.fn(),
  generateBarangBulk: vi.fn(),
  getGenerateInfo: vi.fn(),
  scanBarang: vi.fn(),
  updateBarangStatus: vi.fn(),
  bulkScanBarang: vi.fn(),
  getStatusSummary: vi.fn(),
  getBarangStats: vi.fn(),
  getBatchRentangTanggal: vi.fn(),
  getFinishgoodPerBulan: vi.fn(),
  searchBarangByKode: vi.fn(),
  bulkUpdateBarangStatus: vi.fn(),
}));

vi.mock("../src/websocket/socket.js", () => ({
  broadcast: vi.fn().mockResolvedValue(undefined),
}));

import barangRouter from "../src/routes/barang.js";
import {
  getGenerateInfo,
  generateBarangBulk,
  scanBarang,
  updateBarangStatus,
  bulkScanBarang,
  listBarang,
  getBarangById,
  getRiwayatByBarangId,
  getStatusSummary,
  getBarangStats,
  getBatchRentangTanggal,
  getFinishgoodPerBulan,
  searchBarangByKode,
  bulkUpdateBarangStatus,
} from "../src/model/barang/barang.js";
import { broadcast } from "../src/websocket/socket.js";
import type { AppEvent } from "../src/websocket/socket.js";

const mocked = {
  getGenerateInfo: vi.mocked(getGenerateInfo),
  generateBarangBulk: vi.mocked(generateBarangBulk),
  scanBarang: vi.mocked(scanBarang),
  updateBarangStatus: vi.mocked(updateBarangStatus),
  bulkScanBarang: vi.mocked(bulkScanBarang),
  listBarang: vi.mocked(listBarang),
  getBarangById: vi.mocked(getBarangById),
  getRiwayatByBarangId: vi.mocked(getRiwayatByBarangId),
  getStatusSummary: vi.mocked(getStatusSummary),
  getBarangStats: vi.mocked(getBarangStats),
  getBatchRentangTanggal: vi.mocked(getBatchRentangTanggal),
  getFinishgoodPerBulan: vi.mocked(getFinishgoodPerBulan),
  searchBarangByKode: vi.mocked(searchBarangByKode),
  bulkUpdateBarangStatus: vi.mocked(bulkUpdateBarangStatus),
  broadcast: vi.mocked(broadcast),
};

const app = express();
app.use(express.json());
app.use("/api/barang", barangRouter);

beforeEach(() => {
  vi.clearAllMocks();
  mocked.broadcast.mockResolvedValue(undefined);
});

// =============================================
// GET /generate-info
// =============================================

describe("GET /api/barang/generate-info", () => {
  it("400 jika variantId tidak ada / bukan angka", async () => {
    const res1 = await request(app).get("/api/barang/generate-info");
    const res2 = await request(app).get("/api/barang/generate-info?variantId=abc");

    expect(res1.status).toBe(400);
    expect(res2.status).toBe(400);
    expect(mocked.getGenerateInfo).not.toHaveBeenCalled();
  });

  it("200 kembalikan info", async () => {
    mocked.getGenerateInfo.mockResolvedValue({ variantId: 1, sisaKapasitas: 100 } as any);

    const res = await request(app).get("/api/barang/generate-info?variantId=1");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ variantId: 1, sisaKapasitas: 100 });
    expect(mocked.getGenerateInfo).toHaveBeenCalledWith(1);
  });

  it("404 jika error 'tidak ditemukan'", async () => {
    mocked.getGenerateInfo.mockRejectedValue(new Error("Variant tidak ditemukan"));

    const res = await request(app).get("/api/barang/generate-info?variantId=99");

    expect(res.status).toBe(404);
  });
});

// =============================================
// POST /generate
// =============================================

describe("POST /api/barang/generate", () => {
  it("400 jika variantId tidak valid", async () => {
    const res = await request(app).post("/api/barang/generate").send({ jumlah: 10 });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("variantId");
  });

  it("400 jika jumlah < 1", async () => {
    const res = await request(app)
      .post("/api/barang/generate")
      .send({ variantId: 1, jumlah: 0 });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("jumlah");
  });

  it("400 jika jumlah > 50000", async () => {
    const res = await request(app)
      .post("/api/barang/generate")
      .send({ variantId: 1, jumlah: 50001 });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("maksimal 50000");
  });

  it("201 + broadcast barang.generated jika sukses", async () => {
    const result = { totalDibuat: 5, batches: [] as unknown[] };
    mocked.generateBarangBulk.mockResolvedValue(result as any);

    const res = await request(app)
      .post("/api/barang/generate")
      .send({ variantId: 1, jumlah: 5 });

    expect(res.status).toBe(201);
    expect(res.body.totalDibuat).toBe(5);
    expect(mocked.generateBarangBulk).toHaveBeenCalledWith(1, 5);
    expect(mocked.broadcast).toHaveBeenCalledTimes(1);

    const event = mocked.broadcast.mock.calls[0][0] as AppEvent;
    expect(event.type).toBe("barang.generated");
  });
});

// =============================================
// GET / (list)
// =============================================

describe("GET /api/barang", () => {
  it("400 jika status tidak valid", async () => {
    const res = await request(app).get("/api/barang?status=SALAH");

    expect(res.status).toBe(400);
    expect(mocked.listBarang).not.toHaveBeenCalled();
  });

  it("400 jika variantId bukan angka", async () => {
    const res = await request(app).get("/api/barang?variantId=x");

    expect(res.status).toBe(400);
  });

  it("400 jika batchId bukan angka", async () => {
    const res = await request(app).get("/api/barang?batchId=x");

    expect(res.status).toBe(400);
  });

  it("200 dengan meta pagination", async () => {
    mocked.listBarang.mockResolvedValue({
      data: [],
      meta: { page: 2, limit: 20, total: 0, totalPages: 1 },
    } as any);

    const res = await request(app).get("/api/barang?page=2&limit=20&status=OUT");

    expect(res.status).toBe(200);
    expect(res.body.meta.page).toBe(2);
    expect(mocked.listBarang).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 20, status: "OUT" })
    );
  });

  it("200 dengan filter tanggalAwal dan tanggalAkhir", async () => {
    mocked.listBarang.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
    } as any);

    const res = await request(app).get(
      "/api/barang?tanggalAwal=2026-01-01&tanggalAkhir=2026-03-31"
    );

    expect(res.status).toBe(200);
    expect(mocked.listBarang).toHaveBeenCalledWith(
      expect.objectContaining({
        tanggalAwal: expect.any(Date),
        tanggalAkhir: expect.any(Date),
      })
    );
  });

  it("400 jika tanggalAwal tidak valid", async () => {
    const res = await request(app).get("/api/barang?tanggalAwal=not-a-date");

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("tanggalAwal");
  });

  it("400 jika tanggalAkhir tidak valid", async () => {
    const res = await request(app).get("/api/barang?tanggalAkhir=not-a-date");

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("tanggalAkhir");
  });
});

// =============================================
// GET /scan/:kodeBarang
// =============================================

describe("GET /api/barang/scan/:kodeBarang", () => {
  it("200 kembalikan barang", async () => {
    mocked.scanBarang.mockResolvedValue({ id: 1, kodeBarang: "BC001-V1" } as any);

    const res = await request(app).get("/api/barang/scan/BC001-V1");

    expect(res.status).toBe(200);
    expect(res.body.kodeBarang).toBe("BC001-V1");
    expect(mocked.scanBarang).toHaveBeenCalledWith("BC001-V1");
  });

  it("404 jika tidak ditemukan", async () => {
    mocked.scanBarang.mockRejectedValue(new Error("Barang tidak ditemukan"));

    const res = await request(app).get("/api/barang/scan/XX");

    expect(res.status).toBe(404);
  });
});

// =============================================
// POST /scan/bulk
// =============================================

describe("POST /api/barang/scan/bulk", () => {
  it("400 jika kodeBarang bukan array", async () => {
    const res = await request(app)
      .post("/api/barang/scan/bulk")
      .send({ kodeBarang: "BC1", status: "OUT" });

    expect(res.status).toBe(400);
  });

  it("400 jika status tidak valid", async () => {
    const res = await request(app)
      .post("/api/barang/scan/bulk")
      .send({ kodeBarang: ["BC1"], status: "SALAH" });

    expect(res.status).toBe(400);
  });

  it("200 + broadcast per barang sukses", async () => {
    const success = [
      { id: 1, kodeBarang: "BC1" },
      { id: 2, kodeBarang: "BC2" },
    ];
    const failed = [{ kodeBarang: "BC3", alasan: "tidak ditemukan" }];
    mocked.bulkScanBarang.mockResolvedValue({ success, failed } as any);

    const res = await request(app)
      .post("/api/barang/scan/bulk")
      .send({ kodeBarang: ["BC1", "BC2", "BC3"], status: "OUT", keterangan: "test" });

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ total: 3, success: 2, failed: 1 });
    expect(mocked.bulkScanBarang).toHaveBeenCalledWith(["BC1", "BC2", "BC3"], "OUT", "test");
    expect(mocked.broadcast).toHaveBeenCalledTimes(2);

    const event = mocked.broadcast.mock.calls[0][0] as AppEvent;
    expect(event.type).toBe("barang.status_updated");
  });
});

// =============================================
// PATCH /:id/status
// =============================================

describe("PATCH /api/barang/:id/status", () => {
  it("400 jika id bukan angka", async () => {
    const res = await request(app)
      .patch("/api/barang/abc/status")
      .send({ status: "OUT" });

    expect(res.status).toBe(400);
  });

  it("400 jika status tidak valid", async () => {
    const res = await request(app)
      .patch("/api/barang/1/status")
      .send({ status: "SALAH" });

    expect(res.status).toBe(400);
  });

  it("200 + broadcast status_updated", async () => {
    mocked.updateBarangStatus.mockResolvedValue({ id: 1, kodeBarang: "BC1", status: "OUT" } as any);

    const res = await request(app)
      .patch("/api/barang/1/status")
      .send({ status: "OUT", keterangan: "keluar gudang" });

    expect(res.status).toBe(200);
    expect(mocked.updateBarangStatus).toHaveBeenCalledWith(1, "OUT", "keluar gudang");
    expect(mocked.broadcast).toHaveBeenCalledTimes(1);
  });

  it("400 jika transisi tidak valid", async () => {
    mocked.updateBarangStatus.mockRejectedValue(new Error("Transisi OUT ke FINISHGOOD tidak valid"));

    const res = await request(app)
      .patch("/api/barang/1/status")
      .send({ status: "FINISHGOOD" });

    expect(res.status).toBe(400);
  });
});

// =============================================
// GET /:id
// =============================================

describe("GET /api/barang/:id", () => {
  it("400 jika id bukan angka", async () => {
    const res = await request(app).get("/api/barang/abc");

    expect(res.status).toBe(400);
  });

  it("404 jika tidak ditemukan", async () => {
    mocked.getBarangById.mockResolvedValue(null);

    const res = await request(app).get("/api/barang/999");

    expect(res.status).toBe(404);
  });

  it("200 kembalikan detail", async () => {
    mocked.getBarangById.mockResolvedValue({ id: 1, kodeBarang: "BC1" } as any);

    const res = await request(app).get("/api/barang/1");

    expect(res.status).toBe(200);
    expect(res.body.kodeBarang).toBe("BC1");
    expect(mocked.getBarangById).toHaveBeenCalledWith(1);
  });
});

// =============================================
// GET /:id/riwayat
// =============================================

describe("GET /api/barang/:id/riwayat", () => {
  it("404 jika barang tidak ditemukan", async () => {
    mocked.getRiwayatByBarangId.mockResolvedValue(null);

    const res = await request(app).get("/api/barang/999/riwayat");

    expect(res.status).toBe(404);
  });

  it("200 kembalikan riwayat + summary", async () => {
    mocked.getRiwayatByBarangId.mockResolvedValue({
      data: [{ id: 1, statusLama: "REGISTER" }],
      summary: { kodeBarang: "BC1", currentStatus: "OUT", total: 1 },
    } as any);

    const res = await request(app).get("/api/barang/1/riwayat");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.summary.kodeBarang).toBe("BC1");
    expect(res.body.summary.total).toBe(1);
  });
});

// =============================================
// GET /status-summary
// =============================================

describe("GET /api/barang/status-summary", () => {
  it("200 kembalikan total + perStatus", async () => {
    mocked.getStatusSummary.mockResolvedValue({
      total: 100,
      perStatus: { REGISTER: 50, FINISHGOOD: 30, RETUR: 10, OUT: 8, BAD: 2 },
    } as any);

    const res = await request(app).get("/api/barang/status-summary");

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(100);
    expect(res.body.perStatus.REGISTER).toBe(50);
  });
});

// =============================================
// GET /stats
// =============================================

describe("GET /api/barang/stats", () => {
  it("400 jika variantId bukan angka", async () => {
    const res = await request(app).get("/api/barang/stats?variantId=x");

    expect(res.status).toBe(400);
    expect(mocked.getBarangStats).not.toHaveBeenCalled();
  });

  it("400 jika batchId bukan angka", async () => {
    const res = await request(app).get("/api/barang/stats?batchId=x");

    expect(res.status).toBe(400);
  });

  it("200 panggil getBarangStats dengan filter", async () => {
    mocked.getBarangStats.mockResolvedValue({
      total: 10,
      perStatus: { REGISTER: 5, FINISHGOOD: 5, RETUR: 0, OUT: 0, BAD: 0 },
      perVariant: [{ variantId: 1, kodeVariant: "V001", total: 10 }],
      perBatch: [{ batchId: 1, nomorBatch: "BC001", total: 10 }],
    } as any);

    const res = await request(app).get("/api/barang/stats?variantId=1&batchId=2");

    expect(res.status).toBe(200);
    expect(mocked.getBarangStats).toHaveBeenCalledWith({ variantId: 1, batchId: 2 });
  });
});

// =============================================
// GET /batch-rentang-tanggal
// =============================================

describe("GET /api/barang/batch-rentang-tanggal", () => {
  it("400 jika tanggalAwal tidak valid", async () => {
    const res = await request(app).get(
      "/api/barang/batch-rentang-tanggal?tanggalAwal=not-a-date",
    );

    expect(res.status).toBe(400);
    expect(mocked.getBatchRentangTanggal).not.toHaveBeenCalled();
  });

  it("400 jika tanggalAkhir tidak valid", async () => {
    const res = await request(app).get(
      "/api/barang/batch-rentang-tanggal?tanggalAkhir=not-a-date",
    );

    expect(res.status).toBe(400);
  });

  it("200 kembalikan selesai + aktif", async () => {
    mocked.getBatchRentangTanggal.mockResolvedValue({
      selesai: [
        {
          batchId: 1,
          nomorBatch: "BC001",
          jumlah: 5000,
          tanggalMulai: new Date("2026-01-01"),
          tanggalSelesai: new Date("2026-01-31"),
        },
      ],
      aktif: [
        {
          batchId: 2,
          nomorBatch: "BC002",
          jumlah: 1200,
          tanggalMulai: new Date("2026-08-01"),
          tanggalSelesai: new Date("2026-08-30"),
        },
      ],
    } as any);

    const res = await request(app).get("/api/barang/batch-rentang-tanggal");

    expect(res.status).toBe(200);
    expect(res.body.selesai).toHaveLength(1);
    expect(res.body.selesai[0].nomorBatch).toBe("BC001");
    expect(res.body.selesai[0].jumlah).toBe(5000);
    expect(res.body.aktif).toHaveLength(1);
    expect(res.body.aktif[0].nomorBatch).toBe("BC002");
    expect(res.body.aktif[0].jumlah).toBe(1200);
  });

  it("200 filter tanggal diteruskan ke model", async () => {
    mocked.getBatchRentangTanggal.mockResolvedValue({
      selesai: [],
      aktif: [],
    } as any);

    const res = await request(app).get(
      "/api/barang/batch-rentang-tanggal?tanggalAwal=2026-01-01&tanggalAkhir=2026-08-31",
    );

    expect(res.status).toBe(200);
    expect(mocked.getBatchRentangTanggal).toHaveBeenCalledWith({
      tanggalAwal: new Date("2026-01-01"),
      tanggalAkhir: new Date("2026-08-31"),
    });
  });
});

// =============================================
// GET /finishgood-per-bulan
// =============================================

describe("GET /api/barang/finishgood-per-bulan", () => {
  it("400 jika variantId bukan angka", async () => {
    const res = await request(app).get(
      "/api/barang/finishgood-per-bulan?variantId=x",
    );

    expect(res.status).toBe(400);
    expect(mocked.getFinishgoodPerBulan).not.toHaveBeenCalled();
  });

  it("400 jika productId bukan angka", async () => {
    const res = await request(app).get(
      "/api/barang/finishgood-per-bulan?productId=x",
    );

    expect(res.status).toBe(400);
    expect(mocked.getFinishgoodPerBulan).not.toHaveBeenCalled();
  });

  it("400 jika tanggalAwal tidak valid", async () => {
    const res = await request(app).get(
      "/api/barang/finishgood-per-bulan?tanggalAwal=not-a-date",
    );

    expect(res.status).toBe(400);
    expect(mocked.getFinishgoodPerBulan).not.toHaveBeenCalled();
  });

  it("400 jika tanggalAkhir tidak valid", async () => {
    const res = await request(app).get(
      "/api/barang/finishgood-per-bulan?tanggalAkhir=not-a-date",
    );

    expect(res.status).toBe(400);
  });

  it("200 panggil getFinishgoodPerBulan dengan filter", async () => {
    mocked.getFinishgoodPerBulan.mockResolvedValue({
      data: [
        {
          bulan: "2026-08",
          tahun: 2026,
          bulanAngka: 8,
          variantId: 1,
          productId: 1,
          jumlah: 30,
        },
      ],
      meta: { variantId: 1, productId: 1 },
    } as any);

    const res = await request(app).get(
      "/api/barang/finishgood-per-bulan?variantId=1&productId=1&tanggalAwal=2026-01-01&tanggalAkhir=2026-08-31",
    );

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].jumlah).toBe(30);
    expect(mocked.getFinishgoodPerBulan).toHaveBeenCalledWith({
      variantId: 1,
      productId: 1,
      tanggalAwal: new Date("2026-01-01"),
      tanggalAkhir: new Date("2026-08-31"),
    });
  });

  it("200 tanpa filter panggil getFinishgoodPerBulan kosong", async () => {
    mocked.getFinishgoodPerBulan.mockResolvedValue({
      data: [],
      meta: {},
    } as any);

    const res = await request(app).get("/api/barang/finishgood-per-bulan");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(mocked.getFinishgoodPerBulan).toHaveBeenCalledWith({});
  });
});

// =============================================
// GET /search
// =============================================

describe("GET /api/barang/search", () => {
  it("400 jika q kosong", async () => {
    const res1 = await request(app).get("/api/barang/search");
    const res2 = await request(app).get("/api/barang/search?q=");

    expect(res1.status).toBe(400);
    expect(res2.status).toBe(400);
    expect(mocked.searchBarangByKode).not.toHaveBeenCalled();
  });

  it("400 jika q > 100 karakter", async () => {
    const res = await request(app).get("/api/barang/search?q=" + "a".repeat(101));

    expect(res.status).toBe(400);
  });

  it("200 panggil searchBarangByKode", async () => {
    mocked.searchBarangByKode.mockResolvedValue({
      data: [{ id: 1, kodeBarang: "BC001-V001-250826-0001" }],
      meta: { q: "BC001", count: 1 },
    } as any);

    const res = await request(app).get("/api/barang/search?q=BC001&limit=5");

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(mocked.searchBarangByKode).toHaveBeenCalledWith({ q: "BC001", limit: 5 });
  });
});

// =============================================
// GET /export
// =============================================

describe("GET /api/barang/export", () => {
  it("400 jika format tidak valid", async () => {
    const res = await request(app).get("/api/barang/export?format=xml");

    expect(res.status).toBe(400);
  });

  it("200 json dengan attachment header", async () => {
    mocked.listBarang.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 10000, total: 0, totalPages: 1 },
    } as any);

    const res = await request(app).get("/api/barang/export?format=json");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/json");
    expect(res.headers["content-disposition"]).toContain("attachment");
  });

  it("200 csv dengan header csv", async () => {
    mocked.listBarang.mockResolvedValue({
      data: [
        {
          id: 1,
          kodeBarang: "BC001-V001-250826-0001",
          status: "REGISTER",
          tanggal: new Date("2026-08-26"),
          variant: {
            id: 1,
            kodeVariant: "V001",
            product: { nama: "Produk A" },
            style: { nama: "Style A" },
            color: { nama: "Color A" },
            size: { nama: "Size A" },
          },
          batch: { id: 1, nomorBatch: 1 },
        },
      ],
      meta: { page: 1, limit: 10000, total: 1, totalPages: 1 },
    } as any);

    const res = await request(app).get("/api/barang/export?format=csv");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.text).toContain("kodeBarang");
    expect(res.text).toContain("BC001-V001-250826-0001");
    expect(res.text).toContain("BC001");
  });
});

// =============================================
// POST /bulk-status
// =============================================

describe("POST /api/barang/bulk-status", () => {
  it("400 jika items bukan array", async () => {
    const res = await request(app)
      .post("/api/barang/bulk-status")
      .send({ items: "bukan-array" });

    expect(res.status).toBe(400);
  });

  it("400 jika items kosong", async () => {
    const res = await request(app)
      .post("/api/barang/bulk-status")
      .send({ items: [] });

    expect(res.status).toBe(400);
  });

  it("400 jika items > 500", async () => {
    const items = Array.from({ length: 501 }, (_, i) => ({ id: i + 1, status: "OUT" }));
    const res = await request(app).post("/api/barang/bulk-status").send({ items });

    expect(res.status).toBe(400);
  });

  it("400 jika id bukan angka", async () => {
    const res = await request(app)
      .post("/api/barang/bulk-status")
      .send({ items: [{ id: "abc", status: "OUT" }] });

    expect(res.status).toBe(400);
  });

  it("400 jika status tidak valid", async () => {
    const res = await request(app)
      .post("/api/barang/bulk-status")
      .send({ items: [{ id: 1, status: "SALAH" }] });

    expect(res.status).toBe(400);
  });

  it("200 + broadcast per success", async () => {
    const success = [
      { id: 1, kodeBarang: "BC1", status: "OUT" },
      { id: 2, kodeBarang: "BC2", status: "OUT" },
    ];
    const failed = [{ id: 3, error: "Transisi tidak valid" }];
    mocked.bulkUpdateBarangStatus.mockResolvedValue({ success, failed } as any);

    const res = await request(app)
      .post("/api/barang/bulk-status")
      .send({
        items: [
          { id: 1, status: "OUT", keterangan: "kirim" },
          { id: 2, status: "OUT" },
          { id: 3, status: "FINISHGOOD" },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ total: 3, success: 2, failed: 1 });
    expect(mocked.bulkUpdateBarangStatus).toHaveBeenCalledWith([
      { id: 1, status: "OUT", keterangan: "kirim" },
      { id: 2, status: "OUT", keterangan: undefined },
      { id: 3, status: "FINISHGOOD", keterangan: undefined },
    ]);
    expect(mocked.broadcast).toHaveBeenCalledTimes(2);
  });
});
