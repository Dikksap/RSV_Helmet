import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../src/model/user/user.js", () => ({
  getAllUsers: vi.fn(),
  getUserById: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  findUserByEmail: vi.fn(),
  getUserRole: vi.fn(),
}));

vi.mock("../src/model/role/role.js", () => ({
  getRoleKodes: vi.fn().mockResolvedValue(["admin", "user", "gudang", "produksi", "qc"]),
}));

vi.mock("../src/lib/redis.js", () => ({
  default: {
    setex: vi.fn().mockResolvedValue("OK"),
    exists: vi.fn().mockResolvedValue(0),
  },
}));

import userRouter from "../src/routes/user.js";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUserRole,
} from "../src/model/user/user.js";
import { signToken } from "../src/lib/jwt.js";

const mockedGetAll = vi.mocked(getAllUsers);
const mockedGetById = vi.mocked(getUserById);
const mockedCreate = vi.mocked(createUser);
const mockedUpdate = vi.mocked(updateUser);
const mockedDelete = vi.mocked(deleteUser);
const mockedGetRole = vi.mocked(getUserRole);

const app = express();
app.use(express.json());
app.use("/api/users", userRouter);

const adminToken = signToken({ id: 1, email: "admin@example.com", name: "Admin", role: "admin" });
const userToken = signToken({ id: 2, email: "budi@example.com", name: "Budi", role: "user" });

const sampleUser = {
  id: 2,
  name: "Budi",
  email: "budi@example.com",
  role: "user",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetRole.mockResolvedValue("admin");
});

describe("Auth guard /api/users", () => {
  it("401 tanpa token", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(401);
  });

  it("403 jika bukan admin", async () => {
    mockedGetRole.mockResolvedValue("user");
    const res = await request(app).get("/api/users").set("Authorization", `Bearer ${userToken}`);
    expect(res.status).toBe(403);
  });

  it("403 jika role gudang", async () => {
    mockedGetRole.mockResolvedValue("gudang");
    const res = await request(app).get("/api/users").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });
});

describe("GET /api/users", () => {
  it("200 list user", async () => {
    mockedGetAll.mockResolvedValue([sampleUser] as any);
    const res = await request(app).get("/api/users").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].password).toBeUndefined();
  });
});

describe("GET /api/users/:id", () => {
  it("400 id tidak valid", async () => {
    const res = await request(app).get("/api/users/abc").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it("404 tidak ditemukan", async () => {
    mockedGetById.mockResolvedValue(null);
    const res = await request(app).get("/api/users/99").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("200 detail user", async () => {
    mockedGetById.mockResolvedValue(sampleUser as any);
    const res = await request(app).get("/api/users/2").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("budi@example.com");
  });
});

describe("POST /api/users", () => {
  it("400 field wajib kurang", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "X" });
    expect(res.status).toBe(400);
  });

  it("400 role tidak valid", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "X", email: "x@y.com", password: "rahasia1", role: "superadmin" });
    expect(res.status).toBe(400);
  });

  it("201 sukses, password tidak dikembalikan", async () => {
    mockedCreate.mockResolvedValue(sampleUser as any);
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Budi", email: "budi@example.com", password: "rahasia1" });
    expect(res.status).toBe(201);
    expect(res.body.password).toBeUndefined();
    expect(mockedCreate).toHaveBeenCalledWith({
      name: "Budi",
      email: "budi@example.com",
      password: "rahasia1",
      role: "user",
    });
  });

  it("201 sukses dengan role gudang", async () => {
    mockedCreate.mockResolvedValue({ ...sampleUser, role: "gudang" } as any);
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Sari", email: "sari@y.com", password: "rahasia1", role: "gudang" });
    expect(res.status).toBe(201);
    expect(mockedCreate).toHaveBeenCalledWith({
      name: "Sari",
      email: "sari@y.com",
      password: "rahasia1",
      role: "gudang",
    });
  });

  it("201 role di-trim sebelum disimpan", async () => {
    mockedCreate.mockResolvedValue({ ...sampleUser, role: "gudang" } as any);
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Sari", email: "sari@y.com", password: "rahasia1", role: "  gudang  " });
    expect(res.status).toBe(201);
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({ role: "gudang" }),
    );
  });

  it("409 email duplikat", async () => {
    mockedCreate.mockRejectedValue({ code: "P2002" });
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Budi", email: "budi@example.com", password: "rahasia1" });
    expect(res.status).toBe(409);
  });
});

describe("PUT /api/users/:id", () => {
  it("400 tanpa field update", async () => {
    const res = await request(app)
      .put("/api/users/2")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("404 user tidak ada", async () => {
    mockedUpdate.mockRejectedValue({ code: "P2025" });
    const res = await request(app)
      .put("/api/users/99")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Baru" });
    expect(res.status).toBe(404);
  });

  it("200 update sukses", async () => {
    mockedUpdate.mockResolvedValue({ ...sampleUser, name: "Baru" } as any);
    const res = await request(app)
      .put("/api/users/2")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Baru" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Baru");
  });

  it("200 update role ke gudang", async () => {
    mockedUpdate.mockResolvedValue({ ...sampleUser, role: "gudang" } as any);
    const res = await request(app)
      .put("/api/users/2")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "gudang" });
    expect(res.status).toBe(200);
    expect(mockedUpdate).toHaveBeenCalledWith(2, { role: "gudang" });
  });
});

describe("DELETE /api/users/:id", () => {
  it("404 user tidak ada", async () => {
    mockedDelete.mockRejectedValue({ code: "P2025" });
    const res = await request(app).delete("/api/users/99").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("200 hapus sukses", async () => {
    mockedDelete.mockResolvedValue(undefined as any);
    const res = await request(app).delete("/api/users/2").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(mockedDelete).toHaveBeenCalledWith(2);
  });
});
