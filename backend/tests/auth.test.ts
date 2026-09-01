import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import bcrypt from "bcryptjs";

vi.mock("../src/model/user/user.js", () => ({
  findUserByEmail: vi.fn(),
}));

vi.mock("../src/lib/redis.js", () => ({
  default: {
    setex: vi.fn().mockResolvedValue("OK"),
    exists: vi.fn().mockResolvedValue(0),
  },
}));

import authRouter from "../src/routes/auth.js";
import { authenticate, adminOnly } from "../src/middleware/auth.js";
import { findUserByEmail } from "../src/model/user/user.js";
import { signToken, verifyToken, type TokenPayload } from "../src/lib/jwt.js";
import redis from "../src/lib/redis.js";

const mockedFindUserByEmail = vi.mocked(findUserByEmail);
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

// App terproteksi untuk test middleware
const protectedApp = express();
protectedApp.use(express.json());
protectedApp.use("/api/protected", authenticate, (_req, res) => {
  res.status(200).json({ user: (_req as any).user ?? null });
});

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

describe("Middleware adminOnly", () => {
  it("401 jika tanpa token", async () => {
    const res = await request(adminApp).get("/api/admin/dashboard");

    expect(res.status).toBe(401);
    expect(res.body.message).toContain("Token tidak ditemukan");
  });

  it("403 jika role bukan admin", async () => {
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