import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

// ── Controller test: mock model penuh ───────────────────────────────
vi.mock("../src/model/stokOpname/stokOpname.js", () => ({
  buatSesiOpname: vi.fn(),
  listSesiOpname: vi.fn(),
  getSesiOpnameById: vi.fn(),
  OPNAME_MAKS_BARIS: 200,
}));

vi.mock("../src/middleware/auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/middleware/auth.js")>();
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { id: 1, role: "admin" };
      next();
    },
    authorize: (req: any, _res: any, next: any) => {
      req.access = { role: "admin", permissions: ["KELOLA_ITEM"], statusView: null };
      next();
    },
  };
});

import stokOpnameRouter from "../src/routes/stokOpname.js";
import { buatSesiOpname as buatSesiMock, listSesiOpname, getSesiOpnameById } from "../src/model/stokOpname/stokOpname.js";

const mockedApi = {
  buatSesiOpname: vi.mocked(buatSesiMock),
  listSesiOpname: vi.mocked(listSesiOpname),
  getSesiOpnameById: vi.mocked(getSesiOpnameById),
};

const app = express();
app.use(express.json());
app.use("/api/stok-opname", stokOpnameRouter);

describe("POST /api/stok-opname", () => {
  beforeEach(() => vi.clearAllMocks());

  it("201 menyimpan sesi", async () => {
    mockedApi.buatSesiOpname.mockResolvedValue({ id: 1 } as never);
    const res = await request(app)
      .post("/api/stok-opname")
      .send({ items: [{ itemId: 1, stokFisik: 10 }], keterangan: "rutin" });
    expect(res.status).toBe(201);
    expect(mockedApi.buatSesiOpname).toHaveBeenCalledWith([{ itemId: 1, stokFisik: 10 }], "rutin", 1);
  });

  it("400 jika items kosong, fisik negatif, atau duplikat", async () => {
    expect((await request(app).post("/api/stok-opname").send({ items: [] })).status).toBe(400);
    expect(
      (await request(app).post("/api/stok-opname").send({ items: [{ itemId: 1, stokFisik: -1 }] })).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post("/api/stok-opname")
          .send({ items: [{ itemId: 1, stokFisik: 2 }, { itemId: 1, stokFisik: 3 }] })
      ).status,
    ).toBe(400);
    expect(mockedApi.buatSesiOpname).not.toHaveBeenCalled();
  });

  it("404 jika item tidak ada (P2003)", async () => {
    mockedApi.buatSesiOpname.mockRejectedValue({ code: "P2003" });
    const res = await request(app).post("/api/stok-opname").send({ items: [{ itemId: 99, stokFisik: 1 }] });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/stok-opname", () => {
  beforeEach(() => vi.clearAllMocks());

  it("200 list + 404 detail tak ada", async () => {
    mockedApi.listSesiOpname.mockResolvedValue({ data: [{ id: 1 }], meta: {} } as never);
    mockedApi.getSesiOpnameById.mockResolvedValue(null as never);
    expect((await request(app).get("/api/stok-opname")).status).toBe(200);
    expect((await request(app).get("/api/stok-opname/99")).status).toBe(404);
  });
});
