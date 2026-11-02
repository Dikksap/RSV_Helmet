import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../src/model/gudang/gudang.js", () => ({
  createGudang: vi.fn(),
  deactivateGudang: vi.fn(),
  listGudang: vi.fn(),
  updateGudang: vi.fn(),
}));

const adminAccess = { role: "admin", permissions: ["BARANG_LIHAT"], statusView: null };

vi.mock("../src/middleware/auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/middleware/auth.js")>();
  return {
    ...actual,
    authenticate: (_req: any, _res: any, next: any) => next(),
    adminOnly: (_req: any, _res: any, next: any) => next(),
    authorize: (req: any, _res: any, next: any) => {
      req.access = adminAccess;
      next();
    },
  };
});

import gudangRouter from "../src/routes/gudang.js";
import {
  createGudang,
  deactivateGudang,
  listGudang,
  updateGudang,
} from "../src/model/gudang/gudang.js";

const mockedListGudang = vi.mocked(listGudang);
const mockedCreateGudang = vi.mocked(createGudang);
const mockedUpdateGudang = vi.mocked(updateGudang);
const mockedDeactivateGudang = vi.mocked(deactivateGudang);
const app = express();
app.use(express.json());
app.use("/api/gudang", gudangRouter);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("warehouse lookup API", () => {
  it("keeps the scoped warehouse list used by active warehouse flows", async () => {
    mockedListGudang.mockResolvedValue([
      { id: 1, kode: "GDA", name: "Gudang A", isActive: true, _count: { barang: 12 } },
    ] as any);

    const response = await request(app).get("/api/gudang");

    expect(response.status).toBe(200);
    expect(response.body[0]._count.barang).toBe(12);
    expect(mockedListGudang).toHaveBeenCalledWith(null);
  });

  it("creates a warehouse using normalized values", async () => {
    mockedCreateGudang.mockResolvedValue({
      id: 2, kode: "WH2", name: "Gudang Dua", isActive: true,
    } as any);

    const response = await request(app)
      .post("/api/gudang")
      .send({ kode: " wh2 ", name: " Gudang Dua " });

    expect(response.status).toBe(201);
    expect(mockedCreateGudang).toHaveBeenCalledWith({ kode: "WH2", name: "Gudang Dua", isActive: undefined });
  });

  it("rejects incomplete warehouse data", async () => {
    const response = await request(app).post("/api/gudang").send({ kode: "WH3" });

    expect(response.status).toBe(400);
    expect(mockedCreateGudang).not.toHaveBeenCalled();
  });

  it("updates warehouse details", async () => {
    mockedUpdateGudang.mockResolvedValue({
      id: 1, kode: "WH1", name: "Gudang Satu", isActive: true,
    } as any);

    const response = await request(app)
      .put("/api/gudang/1")
      .send({ name: " Gudang Satu " });

    expect(response.status).toBe(200);
    expect(mockedUpdateGudang).toHaveBeenCalledWith(1, { name: "Gudang Satu" });
  });

  it("deactivates instead of physically deleting a warehouse", async () => {
    mockedDeactivateGudang.mockResolvedValue({
      id: 1, kode: "WH1", name: "Gudang Satu", isActive: false,
    } as any);

    const response = await request(app).delete("/api/gudang/1");

    expect(response.status).toBe(200);
    expect(response.body.gudang.isActive).toBe(false);
    expect(mockedDeactivateGudang).toHaveBeenCalledWith(1);
  });
});
