import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../src/model/hasilProduksiHarian/hasilProduksiHarian.js", () => {
  class HasilProduksiError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "HasilProduksiError";
      this.code = code;
    }
  }
  class WipKurangError extends Error {
    readonly code = "WIP_KURANG";
    permintaanBarang: unknown = null;
    permintaanError: string | null = null;
    constructor(readonly dataKekurangan: unknown) {
      super("WIP kurang");
      this.name = "WipKurangError";
    }
  }
  return {
    HasilProduksiError,
    WipKurangError,
    DIVISI_TIDAK_DITEMUKAN: "DIVISI_TIDAK_DITEMUKAN",
    ITEM_TIDAK_DITEMUKAN: "ITEM_TIDAK_DITEMUKAN",
    INPUT_TIDAK_VALID: "INPUT_TIDAK_VALID",
    createHasilProduksi: vi.fn(),
    getHasilProduksiById: vi.fn(),
    getRekapHasilProduksi: vi.fn(),
    getWipPerItem: vi.fn(),
    listHasilProduksi: vi.fn(),
  };
});

vi.mock("../src/model/stokItem/stokItem.js", () => ({
  catatMutasi: vi.fn(),
  getSaldo: vi.fn(),
  lockItem: vi.fn(),
  StokKurangError: class StokKurangError extends Error {
    readonly code = "STOK_KURANG";
    constructor(readonly itemId: number, readonly tersedia: number) {
      super(`Stok item ${itemId} tidak cukup (tersedia ${tersedia}).`);
    }
  },
}));

vi.mock("../src/lib/prisma.js", () => ({
  default: { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})) },
}));

const authState = vi.hoisted(() => ({
  authorizeCalls: 0,
  permissionChecks: [] as string[],
  access: null as null | {
    role: string;
    permissions: string[];
    statusView: string[] | null;
    divisiId?: number | null;
  },
}));

vi.mock("../src/middleware/auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/middleware/auth.js")>();
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { id: 42, role: "admin" };
      next();
    },
    authorize: (req: any, _res: any, next: any) => {
      authState.authorizeCalls += 1;
      if (authState.access) req.access = authState.access;
      next();
    },
    requirePermission: (...allowed: string[]) => (_req: any, _res: any, next: any) => {
      authState.permissionChecks.push(...allowed);
      next();
    },
  };
});

import hasilProduksiHarianRouter from "../src/routes/hasil-produksi-harian.js";
import {
  createHasilProduksi,
  getHasilProduksiById,
  getRekapHasilProduksi,
  getWipPerItem,
  listHasilProduksi,
  HasilProduksiError,
  WipKurangError,
  DIVISI_TIDAK_DITEMUKAN,
  ITEM_TIDAK_DITEMUKAN,
} from "../src/model/hasilProduksiHarian/hasilProduksiHarian.js";
import { StokKurangError } from "../src/model/stokItem/stokItem.js";

const mocked = {
  createHasilProduksi: vi.mocked(createHasilProduksi),
  getHasilProduksiById: vi.mocked(getHasilProduksiById),
  getRekapHasilProduksi: vi.mocked(getRekapHasilProduksi),
  getWipPerItem: vi.mocked(getWipPerItem),
  listHasilProduksi: vi.mocked(listHasilProduksi),
};

const app = express();
app.use(express.json());
app.use("/api/hasil-produksi-harian", hasilProduksiHarianRouter);

const record = (over: Record<string, unknown> = {}) => ({
  id: 10,
  nomor: "HP-20261020-0001",
  tanggalProduksi: new Date(2026, 9, 20),
  divisiId: 1,
  keterangan: null,
  divisi: { id: 1, nama: "Buffing" },
  items: [],
  ...over,
});

const bodyValid = (over: Record<string, unknown> = {}) => ({
  divisiId: 1,
  items: [{ itemId: 1, tipe: "HASIL", jumlah: 5 }],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  authState.authorizeCalls = 0;
  authState.permissionChecks = [];
  authState.access = null;
});

describe("POST /api/hasil-produksi-harian", () => {
  it("201 dan userId diambil dari token, bukan dari payload", async () => {
    mocked.createHasilProduksi.mockResolvedValue(record() as never);

    const res = await request(app)
      .post("/api/hasil-produksi-harian")
      .send(bodyValid({ userId: 999 }));

    expect(res.status).toBe(201);
    expect(mocked.createHasilProduksi).toHaveBeenCalledTimes(1);
    const [input, userId] = mocked.createHasilProduksi.mock.calls[0];
    expect(userId).toBe(42);
    expect(input).not.toHaveProperty("userId");
    expect((input as any).items[0]).toMatchObject({ itemId: 1, tipe: "HASIL", jumlah: 5 });
    expect(authState.authorizeCalls).toBe(1);
    expect(authState.permissionChecks).toContain("KELOLA_ITEM");
  });

  it("400 jika items kosong", async () => {
    const res = await request(app).post("/api/hasil-produksi-harian").send({ divisiId: 1, items: [] });
    expect(res.status).toBe(400);
    expect(mocked.createHasilProduksi).not.toHaveBeenCalled();
  });

  it("400 jika tipe tidak dikenal", async () => {
    const res = await request(app)
      .post("/api/hasil-produksi-harian")
      .send({ divisiId: 1, items: [{ itemId: 1, tipe: "SALAH", jumlah: 1 }] });
    expect(res.status).toBe(400);
    expect(mocked.createHasilProduksi).not.toHaveBeenCalled();
  });

  it("400 jika jumlah 0, negatif, atau desimal", async () => {
    for (const jumlah of [0, -1, 1.5]) {
      const res = await request(app)
        .post("/api/hasil-produksi-harian")
        .send({ divisiId: 1, items: [{ itemId: 1, tipe: "HASIL", jumlah }] });
      expect(res.status).toBe(400);
    }
    expect(mocked.createHasilProduksi).not.toHaveBeenCalled();
  });

  it("400 jika divisiId atau itemId tidak valid", async () => {
    const tanpaDivisi = await request(app)
      .post("/api/hasil-produksi-harian")
      .send({ items: [{ itemId: 1, tipe: "HASIL", jumlah: 1 }] });
    expect(tanpaDivisi.status).toBe(400);

    const itemIdNgawur = await request(app)
      .post("/api/hasil-produksi-harian")
      .send({ divisiId: 1, items: [{ itemId: 0, tipe: "HASIL", jumlah: 1 }] });
    expect(itemIdNgawur.status).toBe(400);

    expect(mocked.createHasilProduksi).not.toHaveBeenCalled();
  });

  it("400 jika tanggal tidak valid", async () => {
    const res = await request(app)
      .post("/api/hasil-produksi-harian")
      .send(bodyValid({ tanggalProduksi: "2026-02-30" }));
    expect(res.status).toBe(400);
    expect(mocked.createHasilProduksi).not.toHaveBeenCalled();
  });

  it("mengirim tanggal produksi sebagai awal hari Asia/Jakarta", async () => {
    mocked.createHasilProduksi.mockResolvedValue(record() as never);

    const res = await request(app)
      .post("/api/hasil-produksi-harian")
      .send(bodyValid({ tanggalProduksi: "2026-10-22" }));

    expect(res.status).toBe(201);
    const [input] = mocked.createHasilProduksi.mock.calls[0];
    expect((input as { tanggalProduksi: Date }).tanggalProduksi.toISOString()).toBe(
      "2026-10-21T17:00:00.000Z",
    );
  });

  it("404 jika divisi tidak ditemukan", async () => {
    mocked.createHasilProduksi.mockRejectedValue(
      new HasilProduksiError(DIVISI_TIDAK_DITEMUKAN, "Divisi tidak ditemukan"),
    );
    const res = await request(app).post("/api/hasil-produksi-harian").send(bodyValid());
    expect(res.status).toBe(404);
  });

  it("404 jika item tidak ditemukan", async () => {
    mocked.createHasilProduksi.mockRejectedValue(
      new HasilProduksiError(ITEM_TIDAK_DITEMUKAN, "Item tidak ditemukan: 1"),
    );
    const res = await request(app).post("/api/hasil-produksi-harian").send(bodyValid());
    expect(res.status).toBe(404);
  });

  it("409 jika nomor duplikat", async () => {
    mocked.createHasilProduksi.mockRejectedValue(
      Object.assign(new Error("duplicate"), { code: "P2002" }),
    );
    const res = await request(app).post("/api/hasil-produksi-harian").send(bodyValid());
    expect(res.status).toBe(409);
  });

  it("409 jika stok tidak cukup", async () => {
    mocked.createHasilProduksi.mockRejectedValue(new StokKurangError(1, 0));
    const res = await request(app).post("/api/hasil-produksi-harian").send(bodyValid());
    expect(res.status).toBe(409);
  });

  it("409 WIP kurang menyertakan kekurangan dan permintaan otomatis", async () => {
    const error = new WipKurangError({
      divisiId: 1,
      divisiNama: "Buffing",
      itemId: 1,
      itemKode: "RAW001",
      itemNama: "Batok Mentah",
      unit: "pcs",
      jumlahMasuk: 50,
      wipTersedia: 30,
      kekurangan: 20,
    });
    (error as any).permintaanBarang = {
      id: 9,
      noPermintaan: "PR-20261022-0009",
      approval: "BELUM_DISETUJUI",
      items: [{ id: 19, itemId: 1, nama: "Batok Mentah", jumlah: 20, satuan: "pcs" }],
    };
    mocked.createHasilProduksi.mockRejectedValue(error);

    const res = await request(app).post("/api/hasil-produksi-harian").send(bodyValid());

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({
      kode: "WIP_KURANG",
      dataKekurangan: { itemId: 1, jumlahMasuk: 50, wipTersedia: 30, kekurangan: 20 },
      permintaanBarang: {
        id: 9,
        nomor: "PR-20261022-0009",
        status: "BELUM_DISETUJUI",
        items: [{ itemId: 1, jumlah: 20 }],
      },
    });
  });

  it("500 untuk error tak terduga", async () => {
    mocked.createHasilProduksi.mockRejectedValue(new Error("boom"));
    const res = await request(app).post("/api/hasil-produksi-harian").send(bodyValid());
    expect(res.status).toBe(500);
  });
});

describe("GET /api/hasil-produksi-harian", () => {
  it("200 dengan pagination dan filter diteruskan ke model", async () => {
    mocked.listHasilProduksi.mockResolvedValue({ data: [record()], meta: { page: 2, limit: 10, total: 1, totalPages: 1 } } as never);

    const res = await request(app)
      .get("/api/hasil-produksi-harian")
      .query({ page: 2, limit: 10, divisiId: 3, dari: "2026-10-01", sampai: "2026-10-31", q: "HP-2026" });

    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
    expect(mocked.listHasilProduksi).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      divisiId: 3,
      dari: new Date("2026-10-01T00:00:00+07:00"),
      sampai: new Date("2026-10-31T00:00:00+07:00"),
      q: "HP-2026",
    });
    expect(authState.authorizeCalls).toBe(1);
  });

  it("400 jika filter tanggal terbalik", async () => {
    const res = await request(app)
      .get("/api/hasil-produksi-harian")
      .query({ dari: "2026-10-31", sampai: "2026-10-01" });
    expect(res.status).toBe(400);
    expect(mocked.listHasilProduksi).not.toHaveBeenCalled();
  });
});

describe("GET /api/hasil-produksi-harian/rekap", () => {
  it("200 dan tidak tertangkap route /:id", async () => {
    mocked.getRekapHasilProduksi.mockResolvedValue({
      perTanggal: [],
      perDivisi: [],
      perItem: [],
      total: { masuk: 0, keluar: 0, hasil: 5 },
    } as never);

    const res = await request(app)
      .get("/api/hasil-produksi-harian/rekap")
      .query({ itemId: 1, divisiId: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data.total.hasil).toBe(5);
    expect(mocked.getRekapHasilProduksi).toHaveBeenCalledWith({ itemId: 1, divisiId: 2 });
    expect(mocked.getHasilProduksiById).not.toHaveBeenCalled();
  });
});

describe("GET /api/hasil-produksi-harian/wip", () => {
  it("200 dan tidak tertangkap route /:id", async () => {
    mocked.getWipPerItem.mockResolvedValue([
      { itemId: 1, kode: "RAW001", nama: "Busa", unit: "Pcs", jenis: "RAW", divisiId: 1, divisiNama: "Buffing", saldoAwal: 20, masuk: 5, keluar: 2, saldoAkhir: 23 },
    ]);

    const res = await request(app).get("/api/hasil-produksi-harian/wip").query({ itemId: 1 });

    expect(res.status).toBe(200);
    expect(res.body.data[0].saldoAkhir).toBe(23);
    expect(mocked.getWipPerItem).toHaveBeenCalledWith({ itemId: 1 });
    expect(mocked.getHasilProduksiById).not.toHaveBeenCalled();
  });
});

describe("GET /api/hasil-produksi-harian/:id", () => {
  it("400 untuk id tidak valid", async () => {
    const res = await request(app).get("/api/hasil-produksi-harian/abc");
    expect(res.status).toBe(400);
    expect(mocked.getHasilProduksiById).not.toHaveBeenCalled();
  });

  it("404 jika data tidak ditemukan", async () => {
    mocked.getHasilProduksiById.mockResolvedValue(null);
    const res = await request(app).get("/api/hasil-produksi-harian/99");
    expect(res.status).toBe(404);
  });

  it("200 dengan detail dan mutasi stok", async () => {
    mocked.getHasilProduksiById.mockResolvedValue(
      record({ items: [{ id: 100, itemId: 1, tipe: "HASIL", jumlah: 5, stokMutasi: { id: 7, tipe: "MASUK", jumlah: 5 } }] }) as never,
    );
    const res = await request(app).get("/api/hasil-produksi-harian/10");
    expect(res.status).toBe(200);
    expect(res.body.items[0].stokMutasi.tipe).toBe("MASUK");
  });
});

describe("pembatasan divisi non-admin", () => {
  const akses = (divisiId: number | null) => {
    authState.access = {
      role: "produksi",
      permissions: ["KELOLA_ITEM"],
      statusView: null,
      divisiId,
    };
  };

  it("GET list memaksa filter divisi user", async () => {
    akses(1);
    mocked.listHasilProduksi.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 1 },
    } as never);

    const res = await request(app).get("/api/hasil-produksi-harian");

    expect(res.status).toBe(200);
    expect(mocked.listHasilProduksi).toHaveBeenCalledWith(
      expect.objectContaining({ divisiId: 1 }),
    );
  });

  it("GET list menolak filter divisi lain", async () => {
    akses(1);
    const res = await request(app).get("/api/hasil-produksi-harian?divisiId=2");
    expect(res.status).toBe(403);
    expect(mocked.listHasilProduksi).not.toHaveBeenCalled();
  });

  it("GET list ditolak bila user belum punya divisi", async () => {
    akses(null);
    const res = await request(app).get("/api/hasil-produksi-harian");
    expect(res.status).toBe(403);
    expect(mocked.listHasilProduksi).not.toHaveBeenCalled();
  });

  it("GET rekap dan WIP menolak divisi lain", async () => {
    akses(1);
    const rekap = await request(app).get("/api/hasil-produksi-harian/rekap?divisiId=2");
    const wip = await request(app).get("/api/hasil-produksi-harian/wip?divisiId=2");
    expect(rekap.status).toBe(403);
    expect(wip.status).toBe(403);
    expect(mocked.getRekapHasilProduksi).not.toHaveBeenCalled();
    expect(mocked.getWipPerItem).not.toHaveBeenCalled();
  });

  it("POST menolak divisi lain tanpa memanggil model", async () => {
    akses(1);
    const res = await request(app)
      .post("/api/hasil-produksi-harian")
      .send(bodyValid({ divisiId: 2 }));
    expect(res.status).toBe(403);
    expect(mocked.createHasilProduksi).not.toHaveBeenCalled();
  });

  it("POST divisi sendiri diteruskan ke model", async () => {
    akses(1);
    mocked.createHasilProduksi.mockResolvedValue(record() as never);
    const res = await request(app).post("/api/hasil-produksi-harian").send(bodyValid());
    expect(res.status).toBe(201);
    expect(mocked.createHasilProduksi).toHaveBeenCalledTimes(1);
  });

  it("GET detail divisi lain ditolak", async () => {
    akses(2);
    mocked.getHasilProduksiById.mockResolvedValue(record({ divisiId: 1 }) as never);
    const res = await request(app).get("/api/hasil-produksi-harian/10");
    expect(res.status).toBe(403);
  });
});
