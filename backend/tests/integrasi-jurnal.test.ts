import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../src/lib/mekari.js", () => ({
  mekariConfigured: vi.fn(),
  mekariGet: vi.fn(),
}));

import integrasiJurnalRouter from "../src/routes/integrasi-jurnal.js";
import { mekariConfigured, mekariGet } from "../src/lib/mekari.js";

const app = express();
app.use(express.json());
app.use("/api/integrasi-jurnal", integrasiJurnalRouter);

beforeEach(() => vi.clearAllMocks());

describe("GET /api/integrasi-jurnal/products", () => {
  it("500 belum dikonfigurasi", async () => {
    vi.mocked(mekariConfigured).mockReturnValue(false);
    const res = await request(app).get("/api/integrasi-jurnal/products");
    expect(res.status).toBe(500);
    expect(vi.mocked(mekariGet)).not.toHaveBeenCalled();
  });
  it("200 teruskan data Mekari", async () => {
    vi.mocked(mekariConfigured).mockReturnValue(true);
    vi.mocked(mekariGet).mockResolvedValue({ status: 200, data: { products: [{ id: 1 }] } });
    const res = await request(app).get("/api/integrasi-jurnal/products");
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(vi.mocked(mekariGet)).toHaveBeenCalledWith("/public/jurnal/api/v1/products");
  });
  it("502 upstream error", async () => {
    vi.mocked(mekariConfigured).mockReturnValue(true);
    vi.mocked(mekariGet).mockRejectedValue({ code: "MEKARI_UPSTREAM", message: "Mekari API menjawab 401" });
    const res = await request(app).get("/api/integrasi-jurnal/products");
    expect(res.status).toBe(502);
  });
});
