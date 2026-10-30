import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../src/model/gudang/gudang.js", () => ({
  listGudang: vi.fn(),
}));

const adminAccess = { role: "admin", permissions: ["BARANG_LIHAT"], statusView: null };

vi.mock("../src/middleware/auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/middleware/auth.js")>();
  return {
    ...actual,
    authenticate: (_req: any, _res: any, next: any) => next(),
    authorize: (req: any, _res: any, next: any) => {
      req.access = adminAccess;
      next();
    },
  };
});

import gudangRouter from "../src/routes/gudang.js";
import { listGudang } from "../src/model/gudang/gudang.js";

const mockedListGudang = vi.mocked(listGudang);
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

  it.each([
    ["GET", "/api/gudang/1"],
    ["POST", "/api/gudang"],
    ["PUT", "/api/gudang/1"],
    ["DELETE", "/api/gudang/1"],
  ])("does not expose retired warehouse-admin endpoint %s %s", async (method, path) => {
    const response = method === "GET" ? await request(app).get(path)
      : method === "POST" ? await request(app).post(path)
        : method === "PUT" ? await request(app).put(path)
          : await request(app).delete(path);
    expect(response.status).toBe(404);
  });
});
