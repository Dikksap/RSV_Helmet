import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../src/model/bom/bom.js", () => ({
  listBoms: vi.fn(),
  getBomById: vi.fn(),
  createBom: vi.fn(),
  updateBom: vi.fn(),
  deleteBom: vi.fn(),
  BomTidakDitemukanError: class BomTidakDitemukanError extends Error {
    readonly code = "BOM_TIDAK_DITEMUKAN";
  },
  BomSiklikusError: class BomSiklikusError extends Error {
    readonly code = "BOM_SIKLIKUS";
  },
}));

let currentAccess = { role: "user", permissions: ["BOM_KELOLA"], statusView: null };

vi.mock("../src/middleware/auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/middleware/auth.js")>();
  return {
    ...actual,
    authenticate: (_req: any, _res: any, next: any) => next(),
    adminOnly: (_req: any, _res: any, next: any) => next(),
    authorize: (req: any, _res: any, next: any) => {
      req.access = currentAccess;
      next();
    },
  };
});

export const __setBomTestAccess = (permissions: string[]) => {
  currentAccess = { role: "user", permissions, statusView: null };
};

import bomRouter from "../src/routes/bom.js";
import { listBoms, getBomById, createBom, updateBom, deleteBom } from "../src/model/bom/bom.js";

const mocked = {
  listBoms: vi.mocked(listBoms),
  getBomById: vi.mocked(getBomById),
  createBom: vi.mocked(createBom),
  updateBom: vi.mocked(updateBom),
  deleteBom: vi.mocked(deleteBom),
};

const app = express();
app.use(express.json());
app.use("/api/bom", bomRouter);

const sample = {
  id: 1,
  nama: "Batok Keseluruhan",
  version: "1.0",
  productVariantId: 1,
  subassemblyId: null,
  items: [{ id: 1, itemId: 2, quantity: 1 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  __setBomTestAccess(["BOM_KELOLA"]);
});

describe("GET /api/bom", () => {
  it("200 list", async () => {
    mocked.listBoms.mockResolvedValue([sample as any]);
    const res = await request(app).get("/api/bom");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe("POST /api/bom", () => {
  it("403 tanpa permission BOM_KELOLA", async () => {
    __setBomTestAccess([]);
    const res = await request(app).post("/api/bom").send({ nama: "X", version: "1", subassemblyId: 2, items: [{ itemId: 3, quantity: 1 }] });
    expect(res.status).toBe(403);
    expect(mocked.createBom).not.toHaveBeenCalled();
  });

  it("201 create BOM subassembly", async () => {
    mocked.createBom.mockResolvedValue(sample as any);
    const payload = { nama: "X", version: "1.0", subassemblyId: 2, items: [{ itemId: 3, quantity: 1 }] };
    const res = await request(app).post("/api/bom").send(payload);
    expect(res.status).toBe(201);
    expect(mocked.createBom).toHaveBeenCalledWith(expect.objectContaining({
      nama: "X",
      version: "1.0",
      subassemblyId: 2,
    }));
  });

  it("400 output tidak tepat satu", async () => {
    const res = await request(app).post("/api/bom").send({ nama: "X", version: "1", items: [{ itemId: 3, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(mocked.createBom).not.toHaveBeenCalled();
  });
});

describe("GET /api/bom/:id", () => {
  it("404 jika tidak ditemukan", async () => {
    mocked.getBomById.mockResolvedValue(null);
    const res = await request(app).get("/api/bom/99");
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/bom/:id", () => {
  it("200 delete", async () => {
    mocked.deleteBom.mockResolvedValue(undefined as any);
    const res = await request(app).delete("/api/bom/1");
    expect(res.status).toBe(200);
  });
});

describe("PUT /api/bom/:id", () => {
  it("404 jika tidak ditemukan", async () => {
    mocked.getBomById.mockResolvedValue(null);
    const res = await request(app).put("/api/bom/1").send({ nama: "X" });
    expect(res.status).toBe(404);
    expect(mocked.updateBom).not.toHaveBeenCalled();
  });
});
