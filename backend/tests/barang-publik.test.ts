import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../src/model/barang/barang.js", () => ({
  listBarang: vi.fn(),
  getBarangByKode: vi.fn(),
  getBarangRekapVariantPublic: vi.fn(),
}));

vi.mock("../src/controller/barang/helpers.js", () => ({
  isValidStatus: vi.fn(async (s: unknown) =>
    typeof s === "string" && ["REGISTER", "FINISHGOOD", "RETUR", "OUT", "BAD"].includes(s),
  ),
  getValidStatusList: vi.fn(async () => "REGISTER, FINISHGOOD, RETUR, OUT, BAD"),
}));

import barangPublikRouter from "../src/routes/barang-publik.js";
import { listBarang, getBarangByKode, getBarangRekapVariantPublic } from "../src/model/barang/barang.js";

const app = express();
app.use("/api/public/barang", barangPublikRouter);

describe("GET /api/public/barang", () => {
  beforeEach(() => {
    vi.mocked(listBarang).mockReset();
    vi.mocked(getBarangByKode).mockReset();
    vi.mocked(getBarangRekapVariantPublic).mockReset();
  });

  it("mengembalikan daftar tanpa auth", async () => {
    vi.mocked(listBarang).mockResolvedValue({
      data: [{ id: 1, kodeBarang: "RSV-001" }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    } as any);

    const res = await request(app).get("/api/public/barang");

    expect(res.status).toBe(200);
    expect(res.body.data[0].kodeBarang).toBe("RSV-001");
    expect(listBarang).toHaveBeenCalledWith({ page: 1, limit: 20, variantId: undefined, status: undefined });
  });

  it("menolak variantId tidak valid", async () => {
    const res = await request(app).get("/api/public/barang?variantId=abc");

    expect(res.status).toBe(400);
    expect(listBarang).not.toHaveBeenCalled();
  });

  it("menolak status tidak dikenal", async () => {
    const res = await request(app).get("/api/public/barang?status=NGASAL");

    expect(res.status).toBe(400);
    expect(listBarang).not.toHaveBeenCalled();
  });

  it("mengambil detail berdasarkan kode", async () => {
    vi.mocked(getBarangByKode).mockResolvedValue({ id: 1, kodeBarang: "RSV-001" } as any);

    const res = await request(app).get("/api/public/barang/RSV-001");

    expect(res.status).toBe(200);
    expect(res.body.kodeBarang).toBe("RSV-001");
    expect(getBarangByKode).toHaveBeenCalledWith("RSV-001");
  });

  it("404 bila kode tidak ada", async () => {
    vi.mocked(getBarangByKode).mockResolvedValue(null);

    const res = await request(app).get("/api/public/barang/TIDAK-ADA");

    expect(res.status).toBe(404);
  });
});

describe("GET /api/public/barang/rekap-variant", () => {
  beforeEach(() => {
    vi.mocked(getBarangByKode).mockReset();
    vi.mocked(getBarangRekapVariantPublic).mockReset();
  });

  it("mengembalikan rekap tanpa filter", async () => {
    vi.mocked(getBarangRekapVariantPublic).mockResolvedValue({
      data: [
        {
          tanggal: "2026-10-17",
          variantId: 1,
          kodeVariant: "W001",
          product: "RSV",
          style: "Full Face",
          color: "Hitam",
          size: "L",
          sizeUrutan: 3,
          perStatus: { REGISTER: 10, FINISHGOOD: 5 },
          total: 15,
        },
      ],
      statuses: ["REGISTER", "FINISHGOOD"],
      total: 15,
    });

    const res = await request(app).get("/api/public/barang/rekap-variant");

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(15);
    expect(res.body.data[0].perStatus.FINISHGOOD).toBe(5);
    expect(getBarangRekapVariantPublic).toHaveBeenCalledWith({});
    expect(getBarangByKode).not.toHaveBeenCalled();
  });

  it("meneruskan rentang tanggal sebagai Date", async () => {
    vi.mocked(getBarangRekapVariantPublic).mockResolvedValue({ data: [], statuses: [], total: 0 });

    const res = await request(app).get(
      "/api/public/barang/rekap-variant?tanggalAwal=2026-01-01&tanggalAkhir=2026-01-31",
    );

    expect(res.status).toBe(200);
    expect(getBarangRekapVariantPublic).toHaveBeenCalledWith({
      tanggalAwal: new Date("2026-01-01T00:00:00.000Z"),
      tanggalAkhir: new Date("2026-01-31T23:59:59.999Z"),
    });
  });

  it("menolak tanggal tidak valid", async () => {
    const res = await request(app).get(
      "/api/public/barang/rekap-variant?tanggalAwal=2026-13-01",
    );

    expect(res.status).toBe(400);
    expect(getBarangRekapVariantPublic).not.toHaveBeenCalled();
  });

  it("menolak rentang tanggal terbalik", async () => {
    const res = await request(app).get(
      "/api/public/barang/rekap-variant?tanggalAwal=2026-02-01&tanggalAkhir=2026-01-01",
    );

    expect(res.status).toBe(400);
    expect(getBarangRekapVariantPublic).not.toHaveBeenCalled();
  });
});
