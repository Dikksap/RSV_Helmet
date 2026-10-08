import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../src/lib/redis.js", () => ({
  default: {
    incr: vi.fn(),
    zadd: vi.fn(),
    expire: vi.fn(),
    zremrangebyscore: vi.fn(),
    zcard: vi.fn(),
    zremrangebyrank: vi.fn(),
    zrevrange: vi.fn(),
    del: vi.fn(),
  },
}));

import redis from "../src/lib/redis.js";
import {
  pushNotif,
  listNotifs,
  clearNotifs,
  NOTIF_TTL_SECONDS,
} from "../src/lib/notificationCache.js";
import notificationsRouter from "../src/routes/notifications.js";

const m = {
  incr: vi.mocked(redis.incr),
  zadd: vi.mocked(redis.zadd),
  expire: vi.mocked(redis.expire),
  zremrangebyscore: vi.mocked(redis.zremrangebyscore),
  zcard: vi.mocked(redis.zcard),
  zremrangebyrank: vi.mocked(redis.zremrangebyrank),
  zrevrange: vi.mocked(redis.zrevrange),
  del: vi.mocked(redis.del),
};

const app = express();
app.use(express.json());
app.use("/api/notifications", notificationsRouter);

const member = (id: number, ts: number, type = "barang.generated") =>
  JSON.stringify({ id, type, message: `pesan ${id}`, data: { id }, ts });

beforeEach(() => {
  vi.clearAllMocks();
  m.incr.mockResolvedValue(1);
  m.zadd.mockResolvedValue(1);
  m.expire.mockResolvedValue(1);
  m.zremrangebyscore.mockResolvedValue(0);
  m.zcard.mockResolvedValue(0);
  m.zremrangebyrank.mockResolvedValue(0);
  m.zrevrange.mockResolvedValue([]);
  m.del.mockResolvedValue(1);
});

// =============================================
// pushNotif
// =============================================

describe("pushNotif", () => {
  it("mengembalikan id dari counter dan menyimpan skor timestamp", async () => {
    m.incr.mockResolvedValue(42);

    const id = await pushNotif({
      type: "product.created",
      message: "Produk dibuat",
      data: { id: 7 },
    });

    expect(id).toBe(42);
    expect(m.incr).toHaveBeenCalledWith("notif:seq");

    const [key, score, raw] = m.zadd.mock.calls[0];
    expect(key).toBe("notif:list");
    expect(typeof score).toBe("number");
    expect(score).toBeLessThanOrEqual(Date.now());
    expect(JSON.parse(raw as string)).toEqual({
      id: 42,
      type: "product.created",
      message: "Produk dibuat",
      data: { id: 7 },
      ts: score,
    });
  });

  it("memasang TTL 24 jam pada key daftar", async () => {
    await pushNotif({ type: "t", message: "m", data: null });

    expect(m.expire).toHaveBeenCalledWith("notif:list", NOTIF_TTL_SECONDS);
    expect(NOTIF_TTL_SECONDS).toBe(86400);
  });

  it("fail-open: mengembalikan null saat Redis error", async () => {
    m.incr.mockRejectedValue(new Error("Redis down"));

    await expect(
      pushNotif({ type: "t", message: "m", data: null }),
    ).resolves.toBeNull();
  });
});

// =============================================
// listNotifs
// =============================================

describe("listNotifs", () => {
  it("membuang item yang umurnya lewat 24 jam", async () => {
    const before = Date.now();
    await listNotifs();
    const after = Date.now();

    const [key, min, max] = m.zremrangebyscore.mock.calls[0];
    expect(key).toBe("notif:list");
    expect(min).toBe(0);
    expect(max as number).toBeGreaterThanOrEqual(before - 86400 * 1000);
    expect(max as number).toBeLessThanOrEqual(after - 86400 * 1000);
  });

  it("mengembalikan item terbaru dulu dan maksimal 20", async () => {
    const now = Date.now();
    m.zrevrange.mockResolvedValue([member(3, now), member(2, now - 1), member(1, now - 2)]);

    const items = await listNotifs();

    expect(m.zrevrange).toHaveBeenCalledWith("notif:list", 0, 19);
    expect(items.map((i) => i.id)).toEqual([3, 2, 1]);
    expect(items[0].type).toBe("barang.generated");
  });

  it("memangkas riwayat melebihi batas penyimpanan", async () => {
    m.zcard.mockResolvedValue(150);

    await listNotifs();

    expect(m.zremrangebyrank).toHaveBeenCalledWith("notif:list", 0, -101);
  });

  it("tidak memangkas saat masih di bawah batas", async () => {
    m.zcard.mockResolvedValue(100);

    await listNotifs();

    expect(m.zremrangebyrank).not.toHaveBeenCalled();
  });

  it("mengabaikan member yang tidak bisa dipakai", async () => {
    const now = Date.now();
    m.zrevrange.mockResolvedValue([
      member(1, now),
      "{rusak",
      JSON.stringify({ message: "tanpa id", ts: now }),
    ]);

    const items = await listNotifs();

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(1);
  });

  it("fail-open: mengembalikan [] saat Redis error", async () => {
    m.zremrangebyscore.mockRejectedValue(new Error("Redis down"));

    await expect(listNotifs()).resolves.toEqual([]);
  });
});

// =============================================
// clearNotifs
// =============================================

describe("clearNotifs", () => {
  it("menghapus key daftar sehingga hilang di semua device", async () => {
    await clearNotifs();

    expect(m.del).toHaveBeenCalledWith("notif:list");
  });

  it("fail-open: tidak melempar saat Redis error", async () => {
    m.del.mockRejectedValue(new Error("Redis down"));

    await expect(clearNotifs()).resolves.toBeUndefined();
  });
});

// =============================================
// GET + DELETE /api/notifications
// =============================================

describe("GET /api/notifications", () => {
  it("200 + items dari Redis", async () => {
    const now = Date.now();
    m.zrevrange.mockResolvedValue([member(5, now)]);

    const res = await request(app).get("/api/notifications");

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe(5);
  });

  it("200 + items kosong saat Redis mati", async () => {
    m.zremrangebyscore.mockRejectedValue(new Error("Redis down"));

    const res = await request(app).get("/api/notifications");

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });
});

describe("DELETE /api/notifications", () => {
  it("200 + riwayat dibersihkan", async () => {
    const res = await request(app).delete("/api/notifications");

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Notifikasi dibersihkan");
    expect(m.del).toHaveBeenCalledWith("notif:list");
  });
});
