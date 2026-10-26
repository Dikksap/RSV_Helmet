import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import bcrypt from "bcryptjs";

vi.mock("../src/model/user/user.js", () => ({
  findUserByEmail: vi.fn(),
  getUserRole: vi.fn(),
  getUserById: vi.fn(),
  findUserByIdWithPassword: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("../src/model/role/role.js", () => ({
  ADMIN_ROLE: "admin",
  getRoleAccess: vi.fn(),
  getRoleKodes: vi.fn(),
}));

vi.mock("../src/lib/redis.js", () => ({
  default: {
    setex: vi.fn().mockResolvedValue("OK"),
    exists: vi.fn().mockResolvedValue(0),
  },
}));

import authRouter from "../src/routes/auth.js";
import {
  authenticate,
  adminOnly,
  authorize,
  requirePermission,
  requireRole,
} from "../src/middleware/auth.js";
import { findUserByEmail, findUserByIdWithPassword, getUserById, getUserRole, updateUser } from "../src/model/user/user.js";
import { getRoleAccess } from "../src/model/role/role.js";
import { signToken, verifyToken, type TokenPayload } from "../src/lib/jwt.js";
import redis from "../src/lib/redis.js";

const mockedFindUserByEmail = vi.mocked(findUserByEmail);
const mockedGetUserRole = vi.mocked(getUserRole);
const mockedGetUserById = vi.mocked(getUserById);
const mockedFindUserByIdWithPassword = vi.mocked(findUserByIdWithPassword);
const mockedUpdateUser = vi.mocked(updateUser);
const mockedGetRoleAccess = vi.mocked(getRoleAccess);
const mockedRedis = {
  setex: vi.mocked(redis.setex),
  exists: vi.mocked(redis.exists),
};

const app = express();
app.use(express.json());
app.use("/api/auth", authRouter);

const adminApp = express();
adminApp.use(express.json());
adminApp.use("/api/admin", authenticate, adminOnly, (_req, res) => {
  res.status(200).json({ message: "Admin dashboard", user: (_req as any).user });
});

const operatorApp = express();
operatorApp.use(express.json());
operatorApp.use("/api/operator", authenticate, requireRole("admin", "user"), (_req, res) => {
  res.status(200).json({ message: "Operator ok", user: (_req as any).user });
});

// App terproteksi untuk test middleware
const protectedApp = express();
protectedApp.use(express.json());
protectedApp.use("/api/protected", authenticate, (_req, res) => {
  res.status(200).json({ user: (_req as any).user ?? null });
});

const permissionApp = express();
permissionApp.use(express.json());
permissionApp.get(
  "/api/quality/routings",
  authenticate,
  authorize,
  requirePermission("QUALITY_ROUTING_MANAGE"),
  (_req, res) => res.status(200).json({ data: [] }),
);

const seedUser = {
  id: 1,
  name: "Admin",
  email: "admin@example.com",
  password: bcrypt.hashSync("admin123", 10),
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedRedis.setex.mockResolvedValue("OK");
  mockedRedis.exists.mockResolvedValue(0);
  mockedGetUserRole.mockResolvedValue("admin");
  mockedGetUserById.mockResolvedValue({
    id: 1,
    name: "Admin",
    email: "admin@example.com",
    role: "admin",
    createdAt: seedUser.createdAt,
    updatedAt: seedUser.updatedAt,
  });
  mockedGetRoleAccess.mockResolvedValue({
    role: "admin",
    permissions: ["BARANG_LIHAT", "ROLE_KELOLA"],
    statusView: null,
  });
});

// =============================================
// POST /api/auth/login
// =============================================

describe("POST /api/auth/login", () => {
  it("400 jika email tidak ada", async () => {
    const res = await request(app).post("/api/auth/login").send({ password: "admin123" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("email");
  });

  it("400 jika password tidak ada", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@example.com" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("password");
  });

  it("401 jika email tidak dikenal", async () => {
    mockedFindUserByEmail.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "hacker@example.com", password: "admin123" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Email atau password salah");
  });

  it("401 jika password salah", async () => {
    mockedFindUserByEmail.mockResolvedValue(seedUser);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@example.com", password: "salah123" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Email atau password salah");
  });

  it("200 + token + user tanpa password jika sukses", async () => {
    mockedFindUserByEmail.mockResolvedValue(seedUser);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@example.com", password: "admin123" });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.split(".")).toHaveLength(3); // format JWT

    expect(res.body.user).toEqual({
      id: 1,
      name: "Admin",
      email: "admin@example.com",
      role: "admin",
      divisiId: null,
      divisi: null,
    });
    expect(res.body.user.password).toBeUndefined();

    expect(mockedFindUserByEmail).toHaveBeenCalledWith("admin@example.com");

    // Token harus bisa diverifikasi dan berisi payload benar
    const payload = verifyToken(res.body.token) as TokenPayload;
    expect(payload.id).toBe(1);
    expect(payload.email).toBe("admin@example.com");
    expect(payload.name).toBe("Admin");
    expect(payload.role).toBe("admin");
  });

  it("200 menyertakan divisi user", async () => {
    mockedFindUserByEmail.mockResolvedValue({
      ...seedUser,
      divisiId: 1,
      divisi: { id: 1, nama: "Buffing" },
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@example.com", password: "admin123" });

    expect(res.status).toBe(200);
    expect(res.body.user.divisiId).toBe(1);
    expect(res.body.user.divisi).toEqual({ id: 1, nama: "Buffing" });
  });
});

// =============================================
// Middleware authenticate
// =============================================

describe("Middleware authenticate", () => {
  it("401 jika header Authorization tidak ada", async () => {
    const res = await request(protectedApp).get("/api/protected/data");

    expect(res.status).toBe(401);
    expect(res.body.message).toContain("Token tidak ditemukan");
  });

  it("401 jika format bukan Bearer", async () => {
    const token = signToken({ id: 1, email: "admin@example.com", name: "Admin", role: "admin" });

    const res = await request(protectedApp)
      .get("/api/protected/data")
      .set("Authorization", token);

    expect(res.status).toBe(401);
  });

  it("401 jika token invalid", async () => {
    const res = await request(protectedApp)
      .get("/api/protected/data")
      .set("Authorization", "Bearer token-palsu");

    expect(res.status).toBe(401);
    expect(res.body.message).toContain("tidak valid");
  });

  it("next() + req.user terisi jika token valid", async () => {
    const token = signToken({ id: 1, email: "admin@example.com", name: "Admin", role: "user" });

    const res = await request(protectedApp)
      .get("/api/protected/data")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(1);
    expect(res.body.user.email).toBe("admin@example.com");
  });
});

// =============================================
// Middleware adminOnly
// =============================================

describe("Middleware adminOnly tanpa token", () => {
  it("401 jika tanpa token", async () => {
    const res = await request(adminApp).get("/api/admin/dashboard");

    expect(res.status).toBe(401);
    expect(res.body.message).toContain("Token tidak ditemukan");
  });
});

describe("Middleware requirePermission", () => {
    it("admin tetap punya akses meski permission baru belum terdaftar di database", async () => {
      const token = signToken({
        id: 1,
        email: "admin@example.com",
        name: "Admin",
        role: "admin",
      });
      mockedGetRoleAccess.mockResolvedValue({
        role: "admin",
        permissions: ["BARANG_LIHAT"],
        statusView: null,
      });

      const res = await request(permissionApp)
        .get("/api/quality/routings")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
    });

    it("tetap menolak role non-admin tanpa permission yang diperlukan", async () => {
      const token = signToken({
        id: 1,
        email: "operator@example.com",
        name: "Operator",
        role: "user",
      });
      mockedGetRoleAccess.mockResolvedValue({
        role: "user",
        permissions: ["BARANG_LIHAT"],
        statusView: null,
      });

      const res = await request(permissionApp)
        .get("/api/quality/routings")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain("QUALITY_ROUTING_MANAGE");
    });
});

describe("Middleware adminOnly", () => {
  it("403 jika role bukan admin", async () => {
    mockedGetUserRole.mockResolvedValue("user");
    const token = signToken({ id: 1, email: "user@example.com", name: "User", role: "user" });

    const res = await request(adminApp)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("Akses ditolak");
  });

  it("200 jika admin akses dashboard", async () => {
    const token = signToken({ id: 1, email: "admin@example.com", name: "Admin", role: "admin" });

    const res = await request(adminApp)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Admin dashboard");
    expect(res.body.user.id).toBe(1);
    expect(res.body.user.role).toBe("admin");
  });
});

// =============================================
// Middleware requireRole
// =============================================

describe("Middleware requireRole", () => {
  const call = (app: express.Express, role: string) =>
    request(app)
      .get("/api/operator")
      .set("Authorization", `Bearer ${signToken({ id: 1, email: "u@example.com", name: "U", role })}`);

  it("200 untuk role yang terdaftar di gate", async () => {
    mockedGetUserRole.mockResolvedValue("user");

    const res = await call(operatorApp, "user");

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("user");
  });

  it("403 untuk role di luar gate", async () => {
    mockedGetUserRole.mockResolvedValue("gudang");

    const res = await call(operatorApp, "gudang");

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("admin, user");
  });

  it("role basi di token ditimpa nilai database", async () => {
    mockedGetUserRole.mockResolvedValue("gudang");

    const res = await call(operatorApp, "admin");

    expect(res.status).toBe(403);
  });

  it("401 jika akun sudah dihapus", async () => {
    mockedGetUserRole.mockResolvedValue(null);

    const res = await call(operatorApp, "user");

    expect(res.status).toBe(401);
    expect(res.body.message).toContain("Akun tidak ditemukan");
  });

  it("500 jika query role gagal, bukan request menggantung", async () => {
    mockedGetUserRole.mockRejectedValue(new Error("DB down"));

    const res = await call(operatorApp, "user");

    expect(res.status).toBe(500);
    expect(res.body.message).toContain("Gagal memverifikasi role");
  });

  it("401 jika tanpa token", async () => {
    const res = await request(operatorApp).get("/api/operator");

    expect(res.status).toBe(401);
  });
});

// =============================================
// POST /api/auth/logout
// =============================================

describe("POST /api/auth/logout", () => {
  it("401 jika tanpa token", async () => {
    const res = await request(app).post("/api/auth/logout");

    expect(res.status).toBe(401);
    expect(mockedRedis.setex).not.toHaveBeenCalled();
  });

  it("200 + token masuk blacklist dengan TTL sisa umur", async () => {
    const token = signToken({ id: 1, email: "admin@example.com", name: "Admin", role: "admin" });

    const res = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Logout berhasil");

    expect(mockedRedis.setex).toHaveBeenCalledTimes(1);
    const [key, ttl, value] = mockedRedis.setex.mock.calls[0];
    expect(key.startsWith("blacklist:")).toBe(true);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(8 * 3600);
    expect(value).toBe("1");
  });

  it("401 saat request berikutnya pakai token yang sudah logout", async () => {
    const token = signToken({ id: 1, email: "admin@example.com", name: "Admin", role: "admin" });

    // Simulasi token sudah di-blacklist
    mockedRedis.exists.mockResolvedValue(1);

    const res = await request(protectedApp)
      .get("/api/protected/data")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toContain("sudah logout");
  });

  it("fail-open: request tetap lolos jika Redis error", async () => {
    const token = signToken({ id: 1, email: "admin@example.com", name: "Admin", role: "admin" });

    mockedRedis.exists.mockRejectedValue(new Error("Redis down"));

    const res = await request(protectedApp)
      .get("/api/protected/data")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("admin@example.com");
  });
});
// =============================================
// PUT /api/auth/me
// =============================================

describe("PUT /api/auth/me", () => {
  const token = () => signToken({ id: 1, email: "admin@example.com", name: "Admin", role: "admin" });
  const put = (body: unknown, withToken = true) => {
    const req = request(app).put("/api/auth/me").send(body as object);
    return withToken ? req.set("Authorization", `Bearer ${token()}`) : req;
  };
  const updated = (data: { name?: string; email?: string }) => ({
    id: 1,
    name: data.name ?? "Admin",
    email: data.email ?? "admin@example.com",
    role: "admin",
    createdAt: seedUser.createdAt,
    updatedAt: seedUser.updatedAt,
  });

  it("401 jika tanpa token", async () => {
    const res = await put({ name: "Baru" }, false);
    expect(res.status).toBe(401);
    expect(mockedUpdateUser).not.toHaveBeenCalled();
  });

  it("400 jika tidak ada field yang diubah", async () => {
    const res = await put({});
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Minimal satu field");
  });

  it("200 ganti nama tanpa menyentuh password", async () => {
    mockedUpdateUser.mockResolvedValue(updated({ name: "Admin Baru" }));

    const res = await put({ name: "  Admin Baru  " });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Profil diperbarui");
    expect(res.body.user.name).toBe("Admin Baru");
    expect(res.body.user.password).toBeUndefined();
    expect(mockedUpdateUser).toHaveBeenCalledWith(1, { name: "Admin Baru" });
  });

  it("409 jika email sudah dipakai user lain", async () => {
    mockedUpdateUser.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));

    const res = await put({ email: "dipakai@example.com" });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Email sudah terdaftar");
  });

  it("400 jika newPassword tanpa currentPassword", async () => {
    const res = await put({ newPassword: "baru123" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("currentPassword");
    expect(mockedUpdateUser).not.toHaveBeenCalled();
  });

  it("400 jika newPassword kurang dari 6 karakter", async () => {
    const res = await put({ currentPassword: "admin123", newPassword: "123" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("minimal 6 karakter");
  });

  it("400 jika password lama salah", async () => {
    mockedFindUserByIdWithPassword.mockResolvedValue(seedUser);

    const res = await put({ currentPassword: "salah123", newPassword: "baru123" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Password lama salah");
    expect(mockedUpdateUser).not.toHaveBeenCalled();
  });

  it("200 ganti password jika password lama benar", async () => {
    mockedFindUserByIdWithPassword.mockResolvedValue(seedUser);
    mockedUpdateUser.mockResolvedValue(updated({}));

    const res = await put({ currentPassword: "admin123", newPassword: "baru123" });

    expect(res.status).toBe(200);
    // hash dilakukan model, controller meneruskan password apa adanya
    expect(mockedUpdateUser).toHaveBeenCalledWith(1, { password: "baru123" });
  });

  it("500 jika update gagal karena error lain", async () => {
    mockedUpdateUser.mockRejectedValue(new Error("DB down"));

    const res = await put({ name: "Admin Baru" });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Gagal memperbarui profil");
  });
});

describe("GET /api/auth/me", () => {
  it("401 jika tanpa token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("200 + user jika token valid", async () => {
    const token = signToken({ id: 1, email: "admin@example.com", name: "Admin", role: "admin" });
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: 1,
      name: "Admin",
      email: "admin@example.com",
      role: "admin",
      divisiId: null,
      divisi: null,
    });
    expect(res.body.permissions).toEqual(["BARANG_LIHAT", "ROLE_KELOLA"]);
    expect(res.body.statusView).toBeNull();
    expect(typeof res.body.exp).toBe("number");
  });

  it("200 menyertakan divisi dari database", async () => {
    mockedGetUserById.mockResolvedValue({
      id: 1,
      name: "Admin",
      email: "admin@example.com",
      role: "admin",
      divisiId: 2,
      divisi: { id: 2, nama: "Base Coat" },
      createdAt: seedUser.createdAt,
      updatedAt: seedUser.updatedAt,
    });
    const token = signToken({ id: 1, email: "admin@example.com", name: "Admin", role: "admin" });
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.divisiId).toBe(2);
    expect(res.body.user.divisi).toEqual({ id: 2, nama: "Base Coat" });
  });

  it("401 jika akun sudah dihapus", async () => {
    mockedGetRoleAccess.mockResolvedValue(null);
    const token = signToken({ id: 1, email: "admin@example.com", name: "Admin", role: "admin" });
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toContain("Akun tidak ditemukan");
  });

  it("nama/email diambil dari database, bukan dari token basi", async () => {
    mockedGetUserById.mockResolvedValue({
      id: 1,
      name: "Nama Baru",
      email: "baru@example.com",
      role: "admin",
      createdAt: seedUser.createdAt,
      updatedAt: seedUser.updatedAt,
    });
    const token = signToken({ id: 1, email: "admin@example.com", name: "Admin", role: "admin" });

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe("Nama Baru");
    expect(res.body.user.email).toBe("baru@example.com");
  });

  it("statusView ikut dikembalikan untuk role terbatas", async () => {
    mockedGetRoleAccess.mockResolvedValue({ role: "gudang", permissions: ["BARANG_LIHAT"], statusView: ["FINISHGOOD", "RETUR"] });
    mockedGetUserById.mockResolvedValue({
      id: 3,
      name: "Gudang",
      email: "gudang@example.com",
      role: "gudang",
      createdAt: seedUser.createdAt,
      updatedAt: seedUser.updatedAt,
    });
    const token = signToken({ id: 3, email: "gudang@example.com", name: "Gudang", role: "gudang" });
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("gudang");
    expect(res.body.statusView).toEqual(["FINISHGOOD", "RETUR"]);
  });
});
