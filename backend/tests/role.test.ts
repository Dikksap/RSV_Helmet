import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../src/model/role/role.js", () => ({
  ADMIN_ROLE: "admin",
  getAllRoles: vi.fn(),
  getAllPermissions: vi.fn(),
  getRoleById: vi.fn(),
  createRole: vi.fn(),
  getStatusBarangKodes: vi.fn(),
  setRolePermissions: vi.fn(),
  setRoleBarangStatus: vi.fn(),
  getRoleAccess: vi.fn(),
  getRoleKodes: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({
  default: {},
}));

import roleRouter from "../src/routes/role.js";
import barangRouter from "../src/routes/barang.js";
import {
  getAllRoles,
  getAllPermissions,
  getRoleById,
  createRole,
  getStatusBarangKodes,
  setRolePermissions,
  setRoleBarangStatus,
} from "../src/model/role/role.js";
import { listBarang, getBarangById, searchBarangByKode, getStatusSummary } from "../src/model/barang/barang.js";

vi.mock("../src/model/barang/barang.js", () => ({
  listBarang: vi.fn(),
  getBarangById: vi.fn(),
  searchBarangByKode: vi.fn(),
  getStatusSummary: vi.fn(),
  getBarangStats: vi.fn(),
  getBatchRentangTanggal: vi.fn(),
  getFinishgoodPerBulan: vi.fn(),
  getRiwayatByBarangId: vi.fn(),
  generateBarangBulk: vi.fn(),
  getGenerateInfo: vi.fn(),
  scanBarang: vi.fn(),
  updateBarangStatus: vi.fn(),
  bulkScanBarang: vi.fn(),
  bulkUpdateBarangStatus: vi.fn(),
  isTransitionAllowed: vi.fn(),
  clearBarangCache: vi.fn(),
  barangInclude: {},
}));

vi.mock("../src/controller/barang/helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/controller/barang/helpers.js")>();
  const VALID = ["REGISTER", "FINISHGOOD", "RETUR", "OUT", "BAD"];
  return {
    ...actual,
    isValidStatus: vi.fn(async (s: unknown) => typeof s === "string" && VALID.includes(s.trim().toUpperCase())),
    getValidStatusList: vi.fn(async () => VALID.join(", ")),
  };
});

vi.mock("../src/websocket/socket.js", () => ({
  broadcast: vi.fn().mockResolvedValue(undefined),
}));

const mocked = {
  getAllRoles: vi.mocked(getAllRoles),
  getAllPermissions: vi.mocked(getAllPermissions),
  getRoleById: vi.mocked(getRoleById),
  createRole: vi.mocked(createRole),
  getStatusBarangKodes: vi.mocked(getStatusBarangKodes),
  setRolePermissions: vi.mocked(setRolePermissions),
  setRoleBarangStatus: vi.mocked(setRoleBarangStatus),
  listBarang: vi.mocked(listBarang),
  getBarangById: vi.mocked(getBarangById),
  searchBarangByKode: vi.mocked(searchBarangByKode),
  getStatusSummary: vi.mocked(getStatusSummary),
};

const app = express();
app.use(express.json());
app.use("/api/roles", roleRouter);
app.use("/api/barang", barangRouter);

const ALL_PERMISSIONS = ["BARANG_LIHAT", "BARANG_STATISTIK_LIHAT", "BARANG_SCAN", "BARANG_UBAH_STATUS", "BARANG_GENERATE", "BARANG_KELOLA", "ROLE_KELOLA", "KELOLA_ITEM"];

/** Stub authorize: role + permission + scope status sesuai tes. */
const adminToken = "admin-token";
const gudangToken = "gudang-token";

// Ganti middleware authorize di kedua router dengan stub yang membaca token
// statis, supaya gate permission terevaluasi tanpa DB.
vi.mock("../src/middleware/auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/middleware/auth.js")>();
  const ACCESS: Record<string, { role: string; permissions: string[]; statusView: string[] | null }> = {
    "admin-token": {
      role: "admin",
      permissions: ["BARANG_LIHAT", "BARANG_STATISTIK_LIHAT", "BARANG_SCAN", "BARANG_UBAH_STATUS", "BARANG_GENERATE", "BARANG_KELOLA", "ROLE_KELOLA"],
      statusView: null,
    },
    "gudang-token": {
      role: "gudang",
      permissions: ["BARANG_LIHAT"],
      statusView: ["FINISHGOOD", "RETUR"],
    },
  };
  return {
    ...actual,
    authenticate: (req: any, res: any, next: any) => {
      const header = req.headers.authorization;
      if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Token tidak ditemukan" });
      }
      const access = ACCESS[header.slice("Bearer ".length).trim()];
      if (!access) return res.status(401).json({ message: "Token tidak valid atau kedaluwarsa" });
      req.user = { id: 1, email: "x@y.com", name: "X", role: access.role };
      req.access = access;
      next();
    },
    authorize: (_req: any, _res: any, next: any) => next(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mocked.getAllPermissions.mockResolvedValue(ALL_PERMISSIONS.map((kode, i) => ({ id: i + 1, kode, nama: kode, kelompok: "BARANG" })) as any);
  mocked.getRoleById.mockResolvedValue({ id: 3, kode: "gudang", nama: "Warehouse", permissions: [], barangStatus: [] } as any);
  mocked.getStatusBarangKodes.mockResolvedValue(["REGISTER", "FINISHGOOD", "RETUR", "OUT", "BAD"]);
  mocked.listBarang.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } } as any);
  mocked.getStatusSummary.mockResolvedValue({ total: 0, perStatus: {} } as any);
});

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("Auth gate /api/roles", () => {
  it("401 tanpa token", async () => {
    const res = await request(app).get("/api/roles");
    expect(res.status).toBe(401);
  });

  it("403 untuk role tanpa ROLE_KELOLA", async () => {
    const res = await request(app).get("/api/roles").set(auth(gudangToken));
    expect(res.status).toBe(403);
    expect(res.body.message).toContain("ROLE_KELOLA");
  });

  it("200 untuk admin", async () => {
    mocked.getAllRoles.mockResolvedValue([{ id: 1, kode: "admin", nama: "Administrator", permissions: [], barangStatus: [] }] as any);
    const res = await request(app).get("/api/roles").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body[0].kode).toBe("admin");
  });
});

describe("GET /api/roles/permissions", () => {
  it("200 daftar permission master", async () => {
    const res = await request(app).get("/api/roles/permissions").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.map((p: any) => p.kode)).toContain("BARANG_LIHAT");
  });
});

describe("POST /api/roles", () => {
  it("400 kode tidak valid", async () => {
    const res = await request(app)
      .post("/api/roles")
      .set(auth(adminToken))
      .send({ kode: "1INVALID", nama: "X" });
    expect(res.status).toBe(400);
  });

  it("201 kode dinormalisasi ke lowercase", async () => {
    mocked.createRole.mockResolvedValue({ id: 9, kode: "auditor", nama: "Auditor", createdAt: new Date(), updatedAt: new Date() } as any);
    const res = await request(app)
      .post("/api/roles")
      .set(auth(adminToken))
      .send({ kode: "AUDITOR", nama: " Auditor " });
    expect(res.status).toBe(201);
    expect(mocked.createRole).toHaveBeenCalledWith({ kode: "auditor", nama: "Auditor" });
  });

  it("409 kode duplikat", async () => {
    mocked.createRole.mockRejectedValue({ code: "P2002" });
    const res = await request(app)
      .post("/api/roles")
      .set(auth(adminToken))
      .send({ kode: "admin", nama: "Admin" });
    expect(res.status).toBe(409);
  });
});

describe("PUT /api/roles/:id/permissions", () => {
  it("400 bukan array", async () => {
    const res = await request(app)
      .put("/api/roles/3/permissions")
      .set(auth(adminToken))
      .send({ permissions: "BARANG_LIHAT" });
    expect(res.status).toBe(400);
  });

  it("400 permission tidak dikenal", async () => {
    const res = await request(app)
      .put("/api/roles/3/permissions")
      .set(auth(adminToken))
      .send({ permissions: ["BARANG_LIHAT", "NGGAK_ADA"] });
    expect(res.status).toBe(400);
    expect(mocked.setRolePermissions).not.toHaveBeenCalled();
  });

  it("200 simpan grant (kode dinormalisasi ke uppercase, duplikat dibuang)", async () => {
    mocked.setRolePermissions.mockResolvedValue(["BARANG_LIHAT", "BARANG_SCAN"]);
    const res = await request(app)
      .put("/api/roles/3/permissions")
      .set(auth(adminToken))
      .send({ permissions: ["barang_lihat", "BARANG_LIHAT", "barng_scan"] });
    expect(res.status).toBe(400);
    expect(mocked.setRolePermissions).not.toHaveBeenCalled();
  });

  it("200 grant valid disimpan", async () => {
    mocked.setRolePermissions.mockResolvedValue(["BARANG_LIHAT", "BARANG_SCAN"]);
    const res = await request(app)
      .put("/api/roles/3/permissions")
      .set(auth(adminToken))
      .send({ permissions: ["barang_lihat", "BARANG_LIHAT", "BARANG_SCAN"] });
    expect(res.status).toBe(200);
    expect(mocked.setRolePermissions).toHaveBeenCalledWith(3, ["BARANG_LIHAT", "BARANG_SCAN"]);
  });

  it("404 role tidak ada", async () => {
    mocked.getRoleById.mockResolvedValueOnce(null);
    const res = await request(app)
      .put("/api/roles/99/permissions")
      .set(auth(adminToken))
      .send({ permissions: [] });
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/roles/:id/barang-status", () => {
  it("400 statusView bukan object", async () => {
    const res = await request(app)
      .put("/api/roles/3/barang-status")
      .set(auth(adminToken))
      .send({ statusView: ["FINISHGOOD"] });
    expect(res.status).toBe(400);
  });

  it("400 nilai bukan boolean", async () => {
    const res = await request(app)
      .put("/api/roles/3/barang-status")
      .set(auth(adminToken))
      .send({ statusView: { FINISHGOOD: "yes" } });
    expect(res.status).toBe(400);
  });

  it("400 status tidak dikenal", async () => {
    const res = await request(app)
      .put("/api/roles/3/barang-status")
      .set(auth(adminToken))
      .send({ statusView: { NGGAK_ADA: true } });
    expect(res.status).toBe(400);
    expect(mocked.setRoleBarangStatus).not.toHaveBeenCalled();
  });

  it("400 role admin terkunci (selalu lihat semua)", async () => {
    mocked.getRoleById.mockResolvedValueOnce({ id: 1, kode: "admin", nama: "Administrator", permissions: [], barangStatus: [] } as any);
    const res = await request(app)
      .put("/api/roles/1/barang-status")
      .set(auth(adminToken))
      .send({ statusView: { FINISHGOOD: false } });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("admin");
  });

  it("200 simpan matriks", async () => {
    mocked.setRoleBarangStatus.mockResolvedValue([
      { statusKode: "FINISHGOOD", canView: true },
      { statusKode: "OUT", canView: false },
    ]);
    const res = await request(app)
      .put("/api/roles/3/barang-status")
      .set(auth(adminToken))
      .send({ statusView: { FINISHGOOD: true, OUT: false } });
    expect(res.status).toBe(200);
    expect(mocked.setRoleBarangStatus).toHaveBeenCalledWith(3, { FINISHGOOD: true, OUT: false });
  });
});

describe("GET /api/barang filter status per role", () => {
  it("403 jika gudang minta status di luar scope", async () => {
    const res = await request(app).get("/api/barang?status=OUT").set(auth(gudangToken));
    expect(res.status).toBe(403);
    expect(res.body.message).toContain("OUT");
    expect(mocked.listBarang).not.toHaveBeenCalled();
  });

  it("200 + statusScope diteruskan ke model", async () => {
    const res = await request(app).get("/api/barang?status=FINISHGOOD").set(auth(gudangToken));
    expect(res.status).toBe(200);
    expect(mocked.listBarang).toHaveBeenCalledWith(
      expect.objectContaining({ status: "FINISHGOOD", statusScope: ["FINISHGOOD", "RETUR"] }),
    );
  });

  it("admin tanpa scope (null) dan tanpa status", async () => {
    const res = await request(app).get("/api/barang").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(mocked.listBarang).toHaveBeenCalledWith(expect.objectContaining({ statusScope: null }));
  });

  it("statusScope ikut diteruskan meski tanpa param status", async () => {
    await request(app).get("/api/barang").set(auth(gudangToken));
    expect(mocked.listBarang).toHaveBeenCalledWith(expect.objectContaining({ statusScope: ["FINISHGOOD", "RETUR"] }));
  });

  it("400 status invalid tetap 400 sebelum cek scope", async () => {
    const res = await request(app).get("/api/barang?status=NGGAK").set(auth(gudangToken));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/barang/:id dan search ter-scope", () => {
  it("403 detail barang di luar scope", async () => {
    mocked.getBarangById.mockResolvedValue({ id: 1, kodeBarang: "BC1", status: "OUT" } as any);
    const res = await request(app).get("/api/barang/1").set(auth(gudangToken));
    expect(res.status).toBe(403);
  });

  it("200 detail barang dalam scope", async () => {
    mocked.getBarangById.mockResolvedValue({ id: 1, kodeBarang: "BC1", status: "RETUR" } as any);
    const res = await request(app).get("/api/barang/1").set(auth(gudangToken));
    expect(res.status).toBe(200);
  });

  it("search kirim statusScope ke model", async () => {
    mocked.searchBarangByKode.mockResolvedValue({ data: [], meta: { q: "BC", count: 0 } } as any);
    const res = await request(app).get("/api/barang/search?q=BC").set(auth(gudangToken));
    expect(res.status).toBe(200);
    expect(mocked.searchBarangByKode).toHaveBeenCalledWith(
      expect.objectContaining({ q: "BC", statusScope: ["FINISHGOOD", "RETUR"] }),
    );
  });

  it("403 status-summary untuk role tanpa BARANG_STATISTIK_LIHAT", async () => {
    const res = await request(app).get("/api/barang/status-summary").set(auth(gudangToken));
    expect(res.status).toBe(403);
    expect(mocked.getStatusSummary).not.toHaveBeenCalled();
  });

  it("status-summary admin pakai scope null", async () => {
    const res = await request(app).get("/api/barang/status-summary").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(mocked.getStatusSummary).toHaveBeenCalledWith(null);
  });

  it("403 generate tanpa BARANG_GENERATE", async () => {
    const res = await request(app)
      .post("/api/barang/generate")
      .set(auth(gudangToken))
      .send({ variantId: 1, jumlah: 5 });
    expect(res.status).toBe(403);
    expect(res.body.message).toContain("BARANG_GENERATE");
  });

  it("403 ubah status tanpa BARANG_UBAH_STATUS", async () => {
    const res = await request(app)
      .patch("/api/barang/1/status")
      .set(auth(gudangToken))
      .send({ status: "OUT" });
    expect(res.status).toBe(403);
  });
});

describe("401 tanpa autentikasi di /api/barang", () => {
  it("401 list tanpa token", async () => {
    const res = await request(app).get("/api/barang");
    expect(res.status).toBe(401);
  });

  it("401 token tidak dikenal", async () => {
    const res = await request(app).get("/api/barang").set({ Authorization: "Bearer bogus" });
    expect(res.status).toBe(401);
  });
});
