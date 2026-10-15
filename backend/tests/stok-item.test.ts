import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../src/model/stokItem/stokItem.js", () => ({
  catatMutasi: vi.fn(),
  getSaldo: vi.fn(),
  getSaldoBulk: vi.fn(),
  getRingkasanBulk: vi.fn(),
  listMutasiItem: vi.fn(),
  lockItem: vi.fn(),
  StokKurangError: class StokKurangError extends Error {
    readonly code = "STOK_KURANG";
    constructor(readonly itemId: number, readonly tersedia: number) {
      super(`Stok item ${itemId} tidak cukup (tersedia ${tersedia}).`);
    }
  },
}));

vi.mock("../src/model/item/item.js", () => ({
  getItemById: vi.fn(),
  listItems: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({
  default: {
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})),
  },
}));

vi.mock("../src/middleware/auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/middleware/auth.js")>();
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { id: 1, role: "admin" };
      next();
    },
    adminOnly: (_req: any, _res: any, next: any) => next(),
    authorize: (req: any, _res: any, next: any) => {
      req.access = { role: "user", permissions: ["KELOLA_ITEM"], statusView: null };
      next();
    },
  };
});

import itemRouter from "../src/routes/item.js";
import { catatMutasi, getSaldo, getSaldoBulk, getRingkasanBulk, listMutasiItem } from "../src/model/stokItem/stokItem.js";
import { getItemById } from "../src/model/item/item.js";

const mocked = {
  catatMutasi: vi.mocked(catatMutasi),
  getSaldo: vi.mocked(getSaldo),
  getSaldoBulk: vi.mocked(getSaldoBulk),
  getRingkasanBulk: vi.mocked(getRingkasanBulk),
  listMutasiItem: vi.mocked(listMutasiItem),
  getItemById: vi.mocked(getItemById),
};

const app = express();
app.use(express.json());
app.use("/api/items", itemRouter);

const item = { id: 1, kode: "MSK", nama: "Masker", unit: "pcs", divisi: null };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/items/:id/stok", () => {
  it("201 mencatat MASUK dan mengembalikan saldo baru", async () => {
    mocked.getItemById.mockResolvedValue(item as never);
    mocked.catatMutasi.mockResolvedValue({ id: 1, tipe: "MASUK", jumlah: 20 } as never);
    mocked.getSaldo.mockResolvedValue(25 as never);

    const res = await request(app).post("/api/items/1/stok").send({ jumlah: 20 });

    expect(res.status).toBe(201);
    expect(res.body.saldo).toBe(25);
    expect(mocked.catatMutasi).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ itemId: 1, tipe: "MASUK", jumlah: 20, userId: 1 }),
    );
  });

  it("400 jika jumlah 0, negatif, atau bukan bilangan bulat", async () => {
    expect((await request(app).post("/api/items/1/stok").send({ jumlah: 0 })).status).toBe(400);
    expect((await request(app).post("/api/items/1/stok").send({ jumlah: -3 })).status).toBe(400);
    expect((await request(app).post("/api/items/1/stok").send({ jumlah: 1.5 })).status).toBe(400);
    expect(mocked.catatMutasi).not.toHaveBeenCalled();
  });

  it("201 meneruskan tanggal transaksi kustom ke model", async () => {
    mocked.getItemById.mockResolvedValue(item as never);
    mocked.catatMutasi.mockResolvedValue({ id: 4, tipe: "MASUK", jumlah: 5 } as never);
    mocked.getSaldo.mockResolvedValue(30 as never);

    const res = await request(app).post("/api/items/1/stok").send({ jumlah: 5, tanggal: "2026-10-01" });

    expect(res.status).toBe(201);
    const input = mocked.catatMutasi.mock.calls[0][1] as { tanggal?: Date };
    expect(input.tanggal).toBeInstanceOf(Date);
    expect([input.tanggal?.getFullYear(), (input.tanggal?.getMonth() ?? 0) + 1, input.tanggal?.getDate()]).toEqual([2026, 10, 1]);
  });

  it("201 tanpa tanggal memakai default database", async () => {
    mocked.getItemById.mockResolvedValue(item as never);
    mocked.catatMutasi.mockResolvedValue({ id: 5, tipe: "MASUK", jumlah: 5 } as never);
    mocked.getSaldo.mockResolvedValue(35 as never);

    const res = await request(app).post("/api/items/1/stok").send({ jumlah: 5 });

    expect(res.status).toBe(201);
    const input = mocked.catatMutasi.mock.calls[0][1] as { tanggal?: Date };
    expect("tanggal" in input).toBe(false);
  });

  it("400 jika tanggal invalid atau melebihi hari ini", async () => {
    mocked.getItemById.mockResolvedValue(item as never);
    const besok = new Date();
    besok.setDate(besok.getDate() + 1);
    const isoBesok = `${besok.getFullYear()}-${String(besok.getMonth() + 1).padStart(2, "0")}-${String(besok.getDate()).padStart(2, "0")}`;

    expect((await request(app).post("/api/items/1/stok").send({ jumlah: 5, tanggal: "15-10-2026" })).status).toBe(400);
    expect((await request(app).post("/api/items/1/stok").send({ jumlah: 5, tanggal: isoBesok })).status).toBe(400);
    expect(mocked.catatMutasi).not.toHaveBeenCalled();
  });

  it("404 jika item tidak ada", async () => {
    mocked.getItemById.mockResolvedValue(null as never);
    const res = await request(app).post("/api/items/99/stok").send({ jumlah: 5 });
    expect(res.status).toBe(404);
    expect(mocked.catatMutasi).not.toHaveBeenCalled();
  });
});

describe("POST /api/items/:id/stok/keluar", () => {
  it("201 mencatat KELUAR jika saldo cukup", async () => {
    mocked.getItemById.mockResolvedValue(item as never);
    mocked.getSaldo.mockResolvedValueOnce(10 as never).mockResolvedValueOnce(7 as never);
    mocked.catatMutasi.mockResolvedValue({ id: 2, tipe: "KELUAR", jumlah: 3 } as never);

    const res = await request(app).post("/api/items/1/stok/keluar").send({ jumlah: 3, keterangan: "produksi batch 2" });

    expect(res.status).toBe(201);
    expect(res.body.saldo).toBe(7);
    expect(mocked.catatMutasi).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ itemId: 1, tipe: "KELUAR", jumlah: 3, keterangan: "produksi batch 2", userId: 1 }),
    );
  });

  it("201 keterangan opsional, default 'Keluar manual'", async () => {
    mocked.getItemById.mockResolvedValue(item as never);
    mocked.getSaldo.mockResolvedValueOnce(5 as never).mockResolvedValueOnce(2 as never);
    mocked.catatMutasi.mockResolvedValue({ id: 3 } as never);

    const res = await request(app).post("/api/items/1/stok/keluar").send({ jumlah: 3 });

    expect(res.status).toBe(201);
    expect(mocked.catatMutasi).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ keterangan: "Keluar manual" }),
    );
  });

  it("201 keluar bertanggal lama tetap memakai cek saldo total saat ini", async () => {
    mocked.getItemById.mockResolvedValue(item as never);
    mocked.getSaldo.mockResolvedValueOnce(10 as never).mockResolvedValueOnce(7 as never);
    mocked.catatMutasi.mockResolvedValue({ id: 6, tipe: "KELUAR", jumlah: 3 } as never);

    const res = await request(app).post("/api/items/1/stok/keluar").send({ jumlah: 3, tanggal: "2026-10-01" });

    expect(res.status).toBe(201);
    const input = mocked.catatMutasi.mock.calls[0][1] as { tanggal?: Date };
    expect([input.tanggal?.getFullYear(), (input.tanggal?.getMonth() ?? 0) + 1, input.tanggal?.getDate()]).toEqual([2026, 10, 1]);
  });

  it("400 jika tanggal keluar invalid atau melebihi hari ini", async () => {
    mocked.getItemById.mockResolvedValue(item as never);
    const besok = new Date();
    besok.setDate(besok.getDate() + 1);
    const isoBesok = `${besok.getFullYear()}-${String(besok.getMonth() + 1).padStart(2, "0")}-${String(besok.getDate()).padStart(2, "0")}`;

    expect((await request(app).post("/api/items/1/stok/keluar").send({ jumlah: 1, tanggal: "kemarin" })).status).toBe(400);
    expect((await request(app).post("/api/items/1/stok/keluar").send({ jumlah: 1, tanggal: isoBesok })).status).toBe(400);
    expect(mocked.catatMutasi).not.toHaveBeenCalled();
  });

  it("409 jika jumlah melebihi saldo, tanpa mencatat", async () => {
    mocked.getItemById.mockResolvedValue(item as never);
    mocked.getSaldo.mockResolvedValue(2 as never);

    const res = await request(app).post("/api/items/1/stok/keluar").send({ jumlah: 3 });

    expect(res.status).toBe(409);
    expect(res.body.tersedia).toBe(2);
    expect(mocked.catatMutasi).not.toHaveBeenCalled();
  });

  it("400 jika jumlah invalid", async () => {
    expect((await request(app).post("/api/items/1/stok/keluar").send({ jumlah: 0 })).status).toBe(400);
    expect((await request(app).post("/api/items/1/stok/keluar").send({ jumlah: 2.5 })).status).toBe(400);
    expect(mocked.catatMutasi).not.toHaveBeenCalled();
  });

  it("404 jika item tidak ada", async () => {
    mocked.getItemById.mockResolvedValue(null as never);
    expect((await request(app).post("/api/items/99/stok/keluar").send({ jumlah: 1 })).status).toBe(404);
    expect(mocked.catatMutasi).not.toHaveBeenCalled();
  });
});

describe("GET /api/items/:id/stok", () => {
  it("200 mengembalikan saldo + riwayat", async () => {
    mocked.getItemById.mockResolvedValue(item as never);
    mocked.getSaldo.mockResolvedValue(15 as never);
    mocked.listMutasiItem.mockResolvedValue({
      data: [{ id: 1, tipe: "KELUAR", jumlah: 5 }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    } as never);

    const res = await request(app).get("/api/items/1/stok");

    expect(res.status).toBe(200);
    expect(res.body.saldo).toBe(15);
    expect(res.body.riwayat.data).toHaveLength(1);
  });

  it("200 meneruskan rentang tanggal valid ke model", async () => {
    mocked.getItemById.mockResolvedValue(item as never);
    mocked.getSaldo.mockResolvedValue(15 as never);
    mocked.listMutasiItem.mockResolvedValue({
      data: [{ id: 1, tipe: "MASUK", jumlah: 5 }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    } as never);

    const res = await request(app).get("/api/items/1/stok?dari=2026-10-01&sampai=2026-10-15");

    expect(res.status).toBe(200);
    expect(mocked.listMutasiItem).toHaveBeenCalledWith(1, 1, 20, {
      dari: expect.any(Date),
      sampai: expect.any(Date),
    });
    const rentang = mocked.listMutasiItem.mock.calls[0][3] as { dari?: Date; sampai?: Date };
    expect([rentang.dari?.getFullYear(), (rentang.dari?.getMonth() ?? 0) + 1, rentang.dari?.getDate()]).toEqual([2026, 10, 1]);
    expect([rentang.sampai?.getFullYear(), (rentang.sampai?.getMonth() ?? 0) + 1, rentang.sampai?.getDate()]).toEqual([2026, 10, 15]);
  });

  it("400 jika format tanggal tidak valid atau dari lebih besar dari sampai", async () => {
    mocked.getItemById.mockResolvedValue(item as never);

    expect((await request(app).get("/api/items/1/stok?dari=2026-13-01")).status).toBe(400);
    expect((await request(app).get("/api/items/1/stok?sampai=15-10-2026")).status).toBe(400);
    expect((await request(app).get("/api/items/1/stok?dari=2026-10-16&sampai=2026-10-15")).status).toBe(400);
    expect(mocked.listMutasiItem).not.toHaveBeenCalled();
  });

  it("404 jika item tidak ada", async () => {
    mocked.getItemById.mockResolvedValue(null as never);
    const res = await request(app).get("/api/items/99/stok");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/items/stok-saldo", () => {
  it("200 mengembalikan map saldo satu query", async () => {
    mocked.getSaldoBulk.mockResolvedValue({ 1: 100, 2: 5 } as never);
    const res = await request(app).post("/api/items/stok-saldo").send({ ids: [1, 2] });
    expect(res.status).toBe(200);
    expect(res.body.saldo).toEqual({ 1: 100, 2: 5 });
    expect(mocked.getSaldoBulk).toHaveBeenCalledWith([1, 2]);
  });

  it("400 jika ids kosong atau invalid", async () => {
    expect((await request(app).post("/api/items/stok-saldo").send({ ids: [] })).status).toBe(400);
    expect((await request(app).post("/api/items/stok-saldo").send({ ids: [0] })).status).toBe(400);
    expect(mocked.getSaldoBulk).not.toHaveBeenCalled();
  });
});

describe("POST /api/items/stok-ringkasan", () => {
  it("200 mengembalikan ringkasan masuk/keluar/net per periode", async () => {
    mocked.getRingkasanBulk.mockResolvedValue({ 1: { masuk: 120, keluar: 50, net: 70 } } as never);

    const res = await request(app)
      .post("/api/items/stok-ringkasan")
      .send({ ids: [1], dari: "2026-10-01", sampai: "2026-10-15" });

    expect(res.status).toBe(200);
    expect(res.body.ringkasan).toEqual({ 1: { masuk: 120, keluar: 50, net: 70 } });
    expect(mocked.getRingkasanBulk).toHaveBeenCalledWith([1], {
      dari: expect.any(Date),
      sampai: expect.any(Date),
    });
  });

  it("400 jika ids, tanggal, atau rentang tidak valid", async () => {
    expect((await request(app).post("/api/items/stok-ringkasan").send({ ids: [] })).status).toBe(400);
    expect((await request(app).post("/api/items/stok-ringkasan").send({ ids: [1], dari: "2026-13-01" })).status).toBe(400);
    expect((await request(app).post("/api/items/stok-ringkasan").send({ ids: [1], sampai: "15-10-2026" })).status).toBe(400);
    expect((await request(app).post("/api/items/stok-ringkasan").send({ ids: [1], dari: "2026-10-16", sampai: "2026-10-15" })).status).toBe(400);
    expect(mocked.getRingkasanBulk).not.toHaveBeenCalled();
  });
});
