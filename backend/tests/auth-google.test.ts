import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import bcrypt from "bcryptjs";

vi.mock("../src/model/user/user.js", () => ({
  findUserByEmail: vi.fn(),
  getUserRole: vi.fn(),
  getUserById: vi.fn(),
  getUserAvatarPath: vi.fn(),
  setUserAvatarPath: vi.fn(),
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

vi.mock("../src/lib/firebase.js", () => {
  class FirebaseConfigError extends Error {
    constructor(message = "Konfigurasi Firebase Admin tidak valid") {
      super(message);
      this.name = "FirebaseConfigError";
    }
  }
  class FirebaseTokenError extends Error {
    constructor(message = "Firebase ID Token tidak valid") {
      super(message);
      this.name = "FirebaseTokenError";
    }
  }
  return {
    verifyFirebaseIdToken: vi.fn(),
    FirebaseConfigError,
    FirebaseTokenError,
  };
});

import authRouter from "../src/routes/auth.js";
import { authenticate } from "../src/middleware/auth.js";
import { findUserByEmail } from "../src/model/user/user.js";
import {
  FirebaseConfigError,
  FirebaseTokenError,
  verifyFirebaseIdToken,
} from "../src/lib/firebase.js";
import { verifyToken, type TokenPayload } from "../src/lib/jwt.js";

const mockedFindUserByEmail = vi.mocked(findUserByEmail);
const mockedVerifyFirebaseIdToken = vi.mocked(verifyFirebaseIdToken);

const app = express();
app.use(express.json());
app.use("/api/auth", authRouter);

// App terproteksi untuk membuktikan JWT hasil login Google diterima middleware RSV.
const protectedApp = express();
protectedApp.use(express.json());
protectedApp.get("/api/protected", authenticate, (req, res) => {
  res.status(200).json({ user: req.user ?? null });
});

const seedUser = {
  id: 7,
  name: "Budi",
  email: "budi@example.com",
  password: bcrypt.hashSync("rahasia123", 10),
  avatarPath: null,
  role: "gudang",
  isActive: true,
  divisiId: 2,
  divisi: { id: 2, nama: "Gudang" },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const googleIdentity = {
  uid: "firebase-uid-1",
  email: "budi@example.com",
  emailVerified: true,
  signInProvider: "google.com",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedVerifyFirebaseIdToken.mockResolvedValue(googleIdentity);
  mockedFindUserByEmail.mockResolvedValue(seedUser as never);
});

// =============================================
// POST /api/auth/google
// =============================================

describe("POST /api/auth/google", () => {
  it("400 jika idToken tidak dikirim", async () => {
    const res = await request(app).post("/api/auth/google").send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("idToken");
    expect(mockedVerifyFirebaseIdToken).not.toHaveBeenCalled();
  });

  it("400 jika idToken bukan string", async () => {
    const res = await request(app).post("/api/auth/google").send({ idToken: 123 });

    expect(res.status).toBe(400);
    expect(mockedVerifyFirebaseIdToken).not.toHaveBeenCalled();
  });

  it("200 + JWT RSV + user database saat token Google valid", async () => {
    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "  token-google  " });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Login berhasil");
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.split(".")).toHaveLength(3);

    expect(res.body.user).toEqual({
      id: 7,
      name: "Budi",
      email: "budi@example.com",
      role: "gudang",
      divisiId: 2,
      divisi: { id: 2, nama: "Gudang" },
      avatarUrl: null,
    });
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.user.isActive).toBeUndefined();

    expect(mockedVerifyFirebaseIdToken).toHaveBeenCalledWith("token-google");
    expect(mockedFindUserByEmail).toHaveBeenCalledWith("budi@example.com");

    const payload = verifyToken(res.body.token) as TokenPayload;
    expect(payload.id).toBe(7);
    expect(payload.email).toBe("budi@example.com");
    expect(payload.name).toBe("Budi");
    expect(payload.role).toBe("gudang");
  });

  it("JWT RSV hasil login Google dapat mengakses API protected", async () => {
    const login = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "token-google" });

    expect(login.status).toBe(200);

    const res = await request(protectedApp)
      .get("/api/protected")
      .set("Authorization", `Bearer ${login.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(7);
    expect(res.body.user.email).toBe("budi@example.com");
    expect(res.body.user.role).toBe("gudang");
  });

  it("normalisasi email Google (trim + lowercase) sebelum mencari user", async () => {
    mockedVerifyFirebaseIdToken.mockResolvedValue({
      ...googleIdentity,
      email: "  BUDI@Example.COM ",
    });

    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "token-google" });

    expect(res.status).toBe(200);
    expect(mockedFindUserByEmail).toHaveBeenCalledWith("budi@example.com");
  });

  it("role/permission tidak bisa disisipkan dari body request", async () => {
    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "token-google", role: "admin", permissions: ["ROLE_KELOLA"] });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("gudang");

    const payload = verifyToken(res.body.token) as TokenPayload;
    expect(payload.role).toBe("gudang");
  });

  it("401 jika Firebase ID Token tidak valid", async () => {
    mockedVerifyFirebaseIdToken.mockRejectedValue(
      new FirebaseTokenError("Firebase ID Token ditolak (auth/argument-error)"),
    );

    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "token-palsu" });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Token Google tidak valid atau kedaluwarsa");
    expect(mockedFindUserByEmail).not.toHaveBeenCalled();
  });

  it("401 jika Firebase ID Token kedaluwarsa", async () => {
    mockedVerifyFirebaseIdToken.mockRejectedValue(
      new FirebaseTokenError("Firebase ID Token ditolak (auth/id-token-expired)"),
    );

    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "token-expired" });

    expect(res.status).toBe(401);
    expect(mockedFindUserByEmail).not.toHaveBeenCalled();
  });

  it("403 jika email Google belum terverifikasi", async () => {
    mockedVerifyFirebaseIdToken.mockResolvedValue({
      ...googleIdentity,
      email: "budi@example.com",
      emailVerified: false,
    });

    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "token-google" });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Email Google belum terverifikasi");
    expect(mockedFindUserByEmail).not.toHaveBeenCalled();
  });

  it("403 jika token Google tidak membawa email", async () => {
    mockedVerifyFirebaseIdToken.mockResolvedValue({
      ...googleIdentity,
      email: null,
    });

    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "token-google" });

    expect(res.status).toBe(403);
    expect(mockedFindUserByEmail).not.toHaveBeenCalled();
  });

  it("403 jika token bukan dari provider Google", async () => {
    mockedVerifyFirebaseIdToken.mockResolvedValue({
      ...googleIdentity,
      signInProvider: "password",
    });

    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "token-google" });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("Google");
    expect(mockedFindUserByEmail).not.toHaveBeenCalled();
  });

  it("403 jika email Google belum terdaftar di database RSV (tanpa auto-register)", async () => {
    mockedFindUserByEmail.mockResolvedValue(null);

    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "token-google" });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("belum terdaftar");
    expect(res.body.token).toBeUndefined();
  });

  it("403 jika akun RSV tidak aktif", async () => {
    mockedFindUserByEmail.mockResolvedValue({ ...seedUser, isActive: false } as never);

    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "token-google" });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("tidak aktif");
    expect(res.body.token).toBeUndefined();
  });

  it("503 dengan pesan generik jika Firebase Admin belum dikonfigurasi", async () => {
    mockedVerifyFirebaseIdToken.mockRejectedValue(
      new FirebaseConfigError("FIREBASE_SERVICE_ACCOUNT_PATH belum diatur"),
    );

    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "token-google" });

    expect(res.status).toBe(503);
    expect(res.body.message).toBe("Login Google belum dapat digunakan. Hubungi administrator.");
    expect(JSON.stringify(res.body)).not.toContain("FIREBASE_SERVICE_ACCOUNT_PATH");
    expect(JSON.stringify(res.body)).not.toContain("private_key");
  });

  it("500 tanpa detail internal jika terjadi error tak terduga", async () => {
    mockedVerifyFirebaseIdToken.mockRejectedValue(new Error("database connection lost"));

    const res = await request(app)
      .post("/api/auth/google")
      .send({ idToken: "token-google" });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Gagal login dengan Google");
    expect(JSON.stringify(res.body)).not.toContain("database connection lost");
  });
});

// =============================================
// Regresi login email/password
// =============================================

describe("POST /api/auth/login dengan status akun", () => {
  it("tetap 200 untuk user aktif", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "budi@example.com", password: "rahasia123" });

    expect(res.status).toBe(200);
    expect(res.body.token.split(".")).toHaveLength(3);
    expect(res.body.user.role).toBe("gudang");
  });

  it("403 jika akun tidak aktif", async () => {
    mockedFindUserByEmail.mockResolvedValue({ ...seedUser, isActive: false } as never);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "budi@example.com", password: "rahasia123" });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("tidak aktif");
    expect(res.body.token).toBeUndefined();
  });
});
