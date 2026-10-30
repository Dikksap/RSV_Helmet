import { describe, expect, it, vi } from "vitest";
import request from "supertest";

vi.mock("../src/model/divisi/divisi.js", () => ({
  getAllDivisi: vi.fn().mockResolvedValue([{ id: 1, nama: "Buffing" }]),
  getDivisiById: vi.fn(),
  createDivisi: vi.fn(),
  updateDivisi: vi.fn(),
  deleteDivisi: vi.fn(),
}));

import app from "../src/app.js";

describe("retired production and Divisi workspace APIs", () => {
  it.each([
    ["GET", "/api/hasil-produksi-harian"],
    ["POST", "/api/hasil-produksi-harian"],
    ["GET", "/api/hasil-produksi-harian/rekap"],
    ["GET", "/api/hasil-produksi-harian/wip"],
    ["GET", "/api/hasil-produksi-harian/1"],
    ["GET", "/api/wip-transfer"],
    ["POST", "/api/wip-transfer"],
    ["GET", "/api/wip-transfer/opsi"],
    ["PATCH", "/api/wip-transfer/1/approval"],
    ["GET", "/api/production-work-orders"],
    ["POST", "/api/production-work-orders"],
  ] as const)("returns 404 for %s %s", async (method, path) => {
    const response = method === "GET" ? await request(app).get(path)
      : method === "POST" ? await request(app).post(path)
        : await request(app).patch(path);
    expect(response.status).toBe(404);
  });

  it("keeps the Divisi master-data API available for admin and shared workflows", async () => {
    const response = await request(app).get("/api/divisi");
    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: 1, nama: "Buffing" }]);
  });
});
