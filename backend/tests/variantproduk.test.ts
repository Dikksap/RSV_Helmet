import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../src/model/variantproduk/variantproduk.js", () => ({
  getVariantProduk: vi.fn(),
  getVariantProdukById: vi.fn(),
  createVariant: vi.fn(),
  updateVariant: vi.fn(),
  deleteVariant: vi.fn(),
}));

vi.mock("../src/websocket/socket.js", () => ({
  broadcast: vi.fn().mockResolvedValue(undefined),
}));

import variantProdukRouter from "../src/routes/variant-produk.js";
import {
  getVariantProduk,
  getVariantProdukById,
  createVariant,
  updateVariant,
  deleteVariant,
} from "../src/model/variantproduk/variantproduk.js";
import { broadcast } from "../src/websocket/socket.js";

const mocked = {
  getVariantProduk: vi.mocked(getVariantProduk),
  getVariantProdukById: vi.mocked(getVariantProdukById),
  createVariant: vi.mocked(createVariant),
  updateVariant: vi.mocked(updateVariant),
  deleteVariant: vi.mocked(deleteVariant),
  broadcast: vi.mocked(broadcast),
};

const app = express();
app.use(express.json());
app.use("/api/variant-produk", variantProdukRouter);

const sampleRow = {
  id: 1,
  kodeVariant: "W001",
  productId: 1,
  namaProduk: "Windbreaker",
  styleId: 1,
  namaStyle: "Motif",
  colorId: 1,
  namaColor: "BOB",
  sizeId: 1,
  namaSize: "LG",
  urutanSize: 1,
  tanggal: new Date("2026-01-01"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocked.broadcast.mockResolvedValue(undefined);
});

// =============================================
// GET /api/variant-produk
// =============================================

describe("GET /api/variant-produk", () => {
  it("400 jika filter bukan angka bulat positif", async () => {
    for (const q of ["styleId=x", "productId=0", "colorId=1.5"]) {
      const res = await request(app).get(`/api/variant-produk?${q}`);
      expect(res.status).toBe(400);
      expect(res.body.message).toContain("angka bulat positif");
    }
    expect(mocked.getVariantProduk).not.toHaveBeenCalled();
  });

  it("200 kembalikan rows", async () => {
    mocked.getVariantProduk.mockResolvedValue([sampleRow as any]);

    const res = await request(app).get("/api/variant-produk?productId=1");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(mocked.getVariantProduk).toHaveBeenCalledWith({ productId: 1 });
  });
});

// =============================================
// GET /api/variant-produk/:id
// =============================================

describe("GET /api/variant-produk/:id", () => {
  it("400 jika id bukan angka", async () => {
    const res = await request(app).get("/api/variant-produk/abc");

    expect(res.status).toBe(400);
    expect(mocked.getVariantProdukById).not.toHaveBeenCalled();
  });

  it("404 jika tidak ditemukan", async () => {
    mocked.getVariantProdukById.mockResolvedValue(null);

    const res = await request(app).get("/api/variant-produk/999");

    expect(res.status).toBe(404);
  });

  it("200 kembalikan detail", async () => {
    mocked.getVariantProdukById.mockResolvedValue(sampleRow as any);

    const res = await request(app).get("/api/variant-produk/1");

    expect(res.status).toBe(200);
    expect(res.body.kodeVariant).toBe("W001");
    expect(mocked.getVariantProdukById).toHaveBeenCalledWith(1);
  });
});

// =============================================
// POST /api/variant-produk
// =============================================

describe("POST /api/variant-produk", () => {
  const validBody = { productId: 1, styleId: 2, colorId: 3, sizeId: 4 };

  it("400 jika field wajib kosong / invalid", async () => {
    for (const body of [
      {},
      { ...validBody, productId: undefined },
      { ...validBody, styleId: 0 },
      { ...validBody, colorId: "x" },
    ]) {
      const res = await request(app).post("/api/variant-produk").send(body);
      expect(res.status).toBe(400);
    }
    expect(mocked.createVariant).not.toHaveBeenCalled();
  });

  it("400 jika tanggal tidak valid", async () => {
    const res = await request(app)
      .post("/api/variant-produk")
      .send({ ...validBody, tanggal: "bukan-tanggal" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("tanggal");
  });

  it("404 jika produk tidak ditemukan saat generate kode", async () => {
    mocked.createVariant.mockRejectedValue(new Error("Produk tidak ditemukan"));

    const res = await request(app).post("/api/variant-produk").send(validBody);

    expect(res.status).toBe(404);
  });

  it("409 jika kombinasi duplikat (P2002)", async () => {
    mocked.createVariant.mockRejectedValue({ code: "P2002" });

    const res = await request(app).post("/api/variant-produk").send(validBody);

    expect(res.status).toBe(409);
  });

  it("201 + broadcast variant.created jika sukses", async () => {
    mocked.createVariant.mockResolvedValue({ id: 99, kodeVariant: "WB034" } as any);

    const res = await request(app)
      .post("/api/variant-produk")
      .send({ ...validBody, tanggal: "2026-08-01" });

    expect(res.status).toBe(201);
    expect(mocked.createVariant).toHaveBeenCalledWith({
      productId: 1,
      styleId: 2,
      colorId: 3,
      sizeId: 4,
      tanggal: new Date("2026-08-01"),
    });

    expect(mocked.broadcast).toHaveBeenCalledTimes(1);
    expect(mocked.broadcast.mock.calls[0][0]).toMatchObject({ type: "variant.created" });
  });
});

// =============================================
// PUT /api/variant-produk/:id
// =============================================

describe("PUT /api/variant-produk/:id", () => {
  it("400 jika id bukan angka", async () => {
    const res = await request(app).put("/api/variant-produk/abc").send({ sizeId: 1 });

    expect(res.status).toBe(400);
  });

  it("400 jika tidak ada field yang dikirim", async () => {
    const res = await request(app).put("/api/variant-produk/1").send({});

    expect(res.status).toBe(400);
    expect(mocked.updateVariant).not.toHaveBeenCalled();
  });

  it("400 jika field tidak valid", async () => {
    const res = await request(app).put("/api/variant-produk/1").send({ sizeId: "besar" });

    expect(res.status).toBe(400);
  });

  it("404 jika variant tidak ada (null dari model)", async () => {
    mocked.updateVariant.mockResolvedValue(null);

    const res = await request(app).put("/api/variant-produk/999").send({ sizeId: 2 });

    expect(res.status).toBe(404);
  });

  it("409 jika update menyebabkan duplikat", async () => {
    mocked.updateVariant.mockRejectedValue({ code: "P2002" });

    const res = await request(app).put("/api/variant-produk/1").send({ sizeId: 2 });

    expect(res.status).toBe(409);
  });

  it("200 + broadcast variant.updated jika sukses", async () => {
    mocked.updateVariant.mockResolvedValue({ id: 1, kodeVariant: "W001" } as any);

    const res = await request(app)
      .put("/api/variant-produk/1")
      .send({ sizeId: 2, tanggal: "2026-08-10" });

    expect(res.status).toBe(200);
    expect(mocked.updateVariant).toHaveBeenCalledWith(1, {
      sizeId: 2,
      tanggal: new Date("2026-08-10"),
    });

    expect(mocked.broadcast.mock.calls[0][0]).toMatchObject({ type: "variant.updated" });
  });
});

// =============================================
// DELETE /api/variant-produk/:id
// =============================================

describe("DELETE /api/variant-produk/:id", () => {
  it("400 jika id bukan angka", async () => {
    const res = await request(app).delete("/api/variant-produk/abc");

    expect(res.status).toBe(400);
  });

  it("404 jika variant tidak ada", async () => {
    mocked.deleteVariant.mockResolvedValue(false);

    const res = await request(app).delete("/api/variant-produk/999");

    expect(res.status).toBe(404);
  });

  it("200 + broadcast variant.deleted jika sukses", async () => {
    mocked.deleteVariant.mockResolvedValue(true);

    const res = await request(app).delete("/api/variant-produk/5");

    expect(res.status).toBe(200);
    expect(mocked.deleteVariant).toHaveBeenCalledWith(5);

    expect(mocked.broadcast.mock.calls[0][0]).toMatchObject({
      type: "variant.deleted",
      data: { id: 5 },
    });
  });
});
