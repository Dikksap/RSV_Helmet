import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../src/model/permintaanBarang/permintaanBarang.js", () => {
  class PermintaanTerkunciError extends Error {
    readonly code = "PERMINTAAN_TERKUNCI";
    constructor() {
      super("Permintaan sudah disetujui, tidak dapat diubah.");
      this.name = "PermintaanTerkunciError";
    }
  }
  class ItemTanpaMasterError extends Error {
      readonly code = "ITEM_TANPA_MASTER";
      constructor(readonly itemIds: number[]) {
        super("Item belum terdaftar di master.");
        this.name = "ItemTanpaMasterError";
      }
    }
    class KeputusanItemError extends Error {
      readonly code = "KEPUTUSAN_ITEM_INVALID";
      constructor(message: string) {
        super(message);
        this.name = "KeputusanItemError";
      }
    }
    class PermintaanOtomatisError extends Error {
      readonly code = "PERMINTAAN_OTOMATIS";
      constructor() {
        super("Permintaan otomatis hasil produksi tidak dapat diubah.");
        this.name = "PermintaanOtomatisError";
      }
    }
    class DivisiApprovalError extends Error {
      readonly code = "DIVISI_TIDAK_BERHAK";
      constructor(message = "Anda tidak berhak menyetujui permintaan untuk divisi ini.") {
        super(message);
        this.name = "DivisiApprovalError";
      }
    }
    class ItemDivisiError extends Error {
      readonly code = "ITEM_DIVISI_TIDAK_COCOK";
      constructor(namaItem: string) {
        super(`Item "${namaItem}" tidak berasal dari divisi approver permintaan ini.`);
        this.name = "ItemDivisiError";
      }
    }
    class DivisiPemintaError extends Error {
      readonly code = "DIVISI_PEMINTA_TIDAK_DITEMUKAN";
      constructor() {
        super("Divisi peminta tidak ditemukan; approval tidak dapat membuat WIP.");
        this.name = "DivisiPemintaError";
      }
    }
    class PemakaianDipakaiProduksiError extends Error {
      readonly code = "PEMAKAIAN_DIPAKAI_PRODUKSI";
      constructor() {
        super("Pemakaian material sudah dipakai produksi, approval tidak dapat dibatalkan.");
        this.name = "PemakaianDipakaiProduksiError";
      }
    }
    class PemakaianSudahTransferError extends Error {
      readonly code = "PEMAKAIAN_SUDAH_TRANSFER";
      constructor() {
        super("Pemakaian material sudah dipakai transfer WIP, approval tidak dapat dibatalkan.");
        this.name = "PemakaianSudahTransferError";
      }
    }
    class ItemSmGunakanWipError extends Error {
      readonly code = "ITEM_SM_GUNAKAN_WIP";
      constructor(readonly items: { kode: string; nama: string }[]) {
        super("Item SM tidak dapat diminta lewat gudang; gunakan Transfer WIP dari divisi pemilik.");
        this.name = "ItemSmGunakanWipError";
      }
    }
  return {
    PermintaanTerkunciError,
    ItemTanpaMasterError,
    KeputusanItemError,
    PermintaanOtomatisError,
    DivisiApprovalError,
    ItemDivisiError,
    DivisiPemintaError,
    PemakaianDipakaiProduksiError,
    PemakaianSudahTransferError,
    ItemSmGunakanWipError,
    createPermintaan: vi.fn(),
    listPermintaan: vi.fn(),
    getPermintaanById: vi.fn(),
    updatePermintaan: vi.fn(),
    setApproval: vi.fn(),
    petakanItemMaster: vi.fn(),
    deletePermintaan: vi.fn(),
  };
});

let currentAccess: {
  role: string;
  permissions: string[];
  statusView: null;
  divisiId: number | null;
} = {
  role: "user",
  permissions: ["KELOLA_ITEM"],
  statusView: null,
  divisiId: 3,
};

vi.mock("../src/middleware/auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/middleware/auth.js")>();
  return {
    ...actual,
    authenticate: (_req: any, _res: any, next: any) => next(),
    adminOnly: (_req: any, _res: any, next: any) => next(),
    requireRole: () => (_req: any, _res: any, next: any) => next(),
    authorize: (req: any, _res: any, next: any) => {
      req.access = currentAccess;
      next();
    },
  };
});

const setAccess = (permissions: string[], divisiId: number | null = 3) => {
  currentAccess = { role: "user", permissions, statusView: null, divisiId };
};

import permintaanBarangRouter from "../src/routes/permintaan-barang.js";
import {
  createPermintaan,
  listPermintaan,
  getPermintaanById,
  updatePermintaan,
  setApproval,
  petakanItemMaster,
  deletePermintaan,
  PermintaanTerkunciError,
  ItemTanpaMasterError,
  KeputusanItemError,
  PermintaanOtomatisError,
  DivisiApprovalError,
  ItemDivisiError,
  DivisiPemintaError,
  PemakaianDipakaiProduksiError,
} from "../src/model/permintaanBarang/permintaanBarang.js";

const mocked = {
  createPermintaan: vi.mocked(createPermintaan),
  listPermintaan: vi.mocked(listPermintaan),
  getPermintaanById: vi.mocked(getPermintaanById),
  updatePermintaan: vi.mocked(updatePermintaan),
  setApproval: vi.mocked(setApproval),
  petakanItemMaster: vi.mocked(petakanItemMaster),
  deletePermintaan: vi.mocked(deletePermintaan),
};

const app = express();
app.use(express.json());
app.use("/api/permintaan-barang", permintaanBarangRouter);

const record = (over: Record<string, unknown> = {}) => ({
  id: 1,
  noPermintaan: "PR-20261006-0001",
  tanggal: new Date("2026-10-06T00:00:00"),
  departemen: "Produksi",
  namaPeminta: "Budi",
  kebutuhanUntuk: "Produksi",
  prioritas: "Normal",
  tanggalDibutuhkan: null,
  alasan: "Kebutuhan lini",
  approval: "BELUM_DISETUJUI",
  divisiPemintaId: 2,
  divisiApproverId: 3,
  sumber: "MANUAL",
  createdAt: new Date("2026-10-06T03:00:00"),
  updatedAt: new Date("2026-10-06T03:00:00"),
  items: [{ id: 1, permintaanId: 1, nama: "Kertas A4", spesifikasi: "80gsm", jumlah: 5, satuan: "rim", createdAt: new Date(), updatedAt: new Date() }],
  ...over,
});

const validBody = () => ({
  tanggal: "2026-10-06",
  departemen: "Produksi",
  namaPeminta: "Budi",
  alasan: "Kebutuhan lini",
  items: [{ nama: "Kertas A4", spesifikasi: "80gsm", jumlah: 5, satuan: "rim" }],
});

beforeEach(() => {
  vi.clearAllMocks();
  setAccess(["KELOLA_ITEM"]);
});

describe("POST /api/permintaan-barang", () => {
  it("201 dengan nomor dari backend", async () => {
    mocked.createPermintaan.mockResolvedValue(record() as never);
    const res = await request(app).post("/api/permintaan-barang").send(validBody());
    expect(res.status).toBe(201);
    expect(res.body.noPermintaan).toBe("PR-20261006-0001");
    const input = mocked.createPermintaan.mock.calls[0][0] as { items: unknown[] };
    expect(input.items).toHaveLength(1);
  });

  it("400 jika items kosong", async () => {
    const res = await request(app)
      .post("/api/permintaan-barang")
      .send({ ...validBody(), items: [] });
    expect(res.status).toBe(400);
    expect(mocked.createPermintaan).not.toHaveBeenCalled();
  });

  it("400 jika jumlah 0 atau negatif", async () => {
    const res = await request(app)
      .post("/api/permintaan-barang")
      .send({ ...validBody(), items: [{ nama: "Kertas", jumlah: 0 }] });
    expect(res.status).toBe(400);
  });

  it("400 jika alasan kosong", async () => {
    const res = await request(app)
      .post("/api/permintaan-barang")
      .send({ ...validBody(), alasan: "   " });
    expect(res.status).toBe(400);
  });

  it("400 jika prioritas tidak dikenal", async () => {
    const res = await request(app)
      .post("/api/permintaan-barang")
      .send({ ...validBody(), prioritas: "Super" });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/permintaan-barang", () => {
  it("200 mengembalikan data + meta", async () => {
    mocked.listPermintaan.mockResolvedValue({ data: [record()], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } } as never);
    const res = await request(app).get("/api/permintaan-barang");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
    expect(mocked.listPermintaan).toHaveBeenCalledWith(
      expect.objectContaining({ divisiApproverId: 3 }),
    );
  });

  it("non-admin menolak filter divisi approver lain", async () => {
    const res = await request(app).get("/api/permintaan-barang?divisiApproverId=4");
    expect(res.status).toBe(403);
    expect(mocked.listPermintaan).not.toHaveBeenCalled();
  });

  it("non-admin tanpa divisi ditolak", async () => {
    setAccess(["KELOLA_ITEM"], null);
    const res = await request(app).get("/api/permintaan-barang");
    expect(res.status).toBe(403);
    expect(mocked.listPermintaan).not.toHaveBeenCalled();
  });

  it("filter approval diteruskan ke model", async () => {
    mocked.listPermintaan.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } } as never);
    await request(app).get("/api/permintaan-barang?approval=DISETUJUI");
    expect(mocked.listPermintaan).toHaveBeenCalledWith(expect.objectContaining({ approval: "DISETUJUI" }));
  });

  it("400 jika approval tidak valid", async () => {
    const res = await request(app).get("/api/permintaan-barang?approval=SALAH");
    expect(res.status).toBe(400);
  });

  it("filter divisi dan sumber diteruskan ke model", async () => {
    mocked.listPermintaan.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } } as never);
    const res = await request(app).get(
      "/api/permintaan-barang?divisiPemintaId=2&divisiApproverId=3&sumber=HASIL_PRODUKSI",
    );
    expect(res.status).toBe(200);
    expect(mocked.listPermintaan).toHaveBeenCalledWith(
      expect.objectContaining({
        divisiPemintaId: 2,
        divisiApproverId: 3,
        sumber: "HASIL_PRODUKSI",
      }),
    );
  });

  it("400 jika filter divisi bukan integer positif", async () => {
    const res = await request(app).get("/api/permintaan-barang?divisiApproverId=abc");
    expect(res.status).toBe(400);
    const res2 = await request(app).get("/api/permintaan-barang?divisiPemintaId=0");
    expect(res2.status).toBe(400);
  });

  it("rentang dari/sampai diteruskan ke model sebagai Date", async () => {
    mocked.listPermintaan.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } } as never);
    const res = await request(app).get("/api/permintaan-barang?dari=2026-10-01&sampai=2026-10-10");
    expect(res.status).toBe(200);
    expect(mocked.listPermintaan).toHaveBeenCalledWith(
      expect.objectContaining({
        dari: new Date("2026-10-01T00:00:00"),
        sampai: new Date("2026-10-10T00:00:00"),
      }),
    );
  });

  it("400 jika dari/sampai bukan tanggal valid", async () => {
    const res = await request(app).get("/api/permintaan-barang?dari=bukan-tanggal");
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/'dari'/);
    const res2 = await request(app).get("/api/permintaan-barang?sampai=2026-13-99");
    expect(res2.status).toBe(400);
  });
});

describe("GET /api/permintaan-barang/:id", () => {
  it("404 jika tidak ditemukan", async () => {
    mocked.getPermintaanById.mockResolvedValue(null as never);
    const res = await request(app).get("/api/permintaan-barang/99");
    expect(res.status).toBe(404);
  });

  it("404 jika divisi approver berbeda", async () => {
    mocked.getPermintaanById.mockResolvedValue(record({ divisiApproverId: 4 }) as never);
    const res = await request(app).get("/api/permintaan-barang/1");
    expect(res.status).toBe(404);
  });

  it("400 jika id bukan angka", async () => {
    const res = await request(app).get("/api/permintaan-barang/abc");
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/permintaan-barang/:id", () => {
  it("200 saat BELUM_DISETUJUI", async () => {
    mocked.updatePermintaan.mockResolvedValue(record() as never);
    const res = await request(app).put("/api/permintaan-barang/1").send(validBody());
    expect(res.status).toBe(200);
  });

  it("409 saat DISETUJUI", async () => {
    mocked.updatePermintaan.mockRejectedValue(new PermintaanTerkunciError());
    const res = await request(app).put("/api/permintaan-barang/1").send(validBody());
    expect(res.status).toBe(409);
  });

  it("409 untuk request otomatis produksi", async () => {
    mocked.updatePermintaan.mockRejectedValue(new PermintaanOtomatisError());
    const res = await request(app).put("/api/permintaan-barang/1").send(validBody());
    expect(res.status).toBe(409);
    expect(res.body.kode).toBe("PERMINTAAN_OTOMATIS");
  });

  it("404 jika tidak ditemukan", async () => {
    mocked.updatePermintaan.mockResolvedValue(null as never);
    const res = await request(app).put("/api/permintaan-barang/99").send(validBody());
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/permintaan-barang/:id/approval", () => {
  it("200 mengubah status dua arah", async () => {
    mocked.setApproval.mockResolvedValue(record({ approval: "DISETUJUI" }) as never);
    const res = await request(app).patch("/api/permintaan-barang/1/approval").send({ approval: "DISETUJUI" });
    expect(res.status).toBe(200);
    expect(res.body.approval).toBe("DISETUJUI");
  });

  it("keputusan per item diteruskan ke model (id + jumlahDisetujui)", async () => {
    mocked.setApproval.mockResolvedValue(record({ approval: "DISETUJUI" }) as never);
    await request(app)
      .patch("/api/permintaan-barang/1/approval")
      .send({ approval: "DISETUJUI", items: [{ id: 3, jumlahDisetujui: 5 }, { id: 4, jumlahDisetujui: 0 }] });
    expect(mocked.setApproval).toHaveBeenCalledWith(
      1,
      "DISETUJUI",
      [{ id: 3, jumlahDisetujui: 5 }, { id: 4, jumlahDisetujui: 0 }],
      null,
    );
  });

  it("400 jika jumlahDisetujui negatif atau bukan bilangan bulat", async () => {
    const res = await request(app)
      .patch("/api/permintaan-barang/1/approval")
      .send({ approval: "DISETUJUI", items: [{ id: 3, jumlahDisetujui: -1 }] });
    expect(res.status).toBe(400);
    const res2 = await request(app)
      .patch("/api/permintaan-barang/1/approval")
      .send({ approval: "DISETUJUI", items: [{ id: 3, jumlahDisetujui: 1.5 }] });
    expect(res2.status).toBe(400);
    expect(mocked.setApproval).not.toHaveBeenCalled();
  });

  it("422 jika ada item belum terdaftar di master", async () => {
    mocked.setApproval.mockRejectedValue(new ItemTanpaMasterError([7]));
    const res = await request(app).patch("/api/permintaan-barang/1/approval").send({ approval: "DISETUJUI" });
    expect(res.status).toBe(422);
    expect(res.body.itemIds).toEqual([7]);
  });

  it("422 jika jumlah disetujui melebihi stok", async () => {
    mocked.setApproval.mockRejectedValue(new KeputusanItemError("melebihi batas"));
    const res = await request(app)
      .patch("/api/permintaan-barang/1/approval")
      .send({ approval: "DISETUJUI", items: [{ id: 3, jumlahDisetujui: 99 }] });
    expect(res.status).toBe(422);
  });

  it("403 jika user bukan approver divisi", async () => {
    mocked.setApproval.mockRejectedValue(new DivisiApprovalError());
    const res = await request(app).patch("/api/permintaan-barang/1/approval").send({ approval: "DISETUJUI" });
    expect(res.status).toBe(403);
    expect(res.body.kode).toBe("DIVISI_TIDAK_BERHAK");
  });

  it("409 jika divisi item tidak cocok atau divisi peminta tidak ditemukan", async () => {
    mocked.setApproval.mockRejectedValue(new ItemDivisiError("Bahan A"));
    const res = await request(app).patch("/api/permintaan-barang/1/approval").send({ approval: "DISETUJUI" });
    expect(res.status).toBe(409);
    expect(res.body.kode).toBe("ITEM_DIVISI_TIDAK_COCOK");

    mocked.setApproval.mockRejectedValue(new DivisiPemintaError());
    const res2 = await request(app).patch("/api/permintaan-barang/1/approval").send({ approval: "DISETUJUI" });
    expect(res2.status).toBe(409);
  });

  it("409 jika pemakaian sudah dipakai produksi saat pembatalan", async () => {
    mocked.setApproval.mockRejectedValue(new PemakaianDipakaiProduksiError());
    const res = await request(app)
      .patch("/api/permintaan-barang/1/approval")
      .send({ approval: "BELUM_DISETUJUI" });
    expect(res.status).toBe(409);
    expect(res.body.kode).toBe("PEMAKAIAN_DIPAKAI_PRODUKSI");
  });

  it("400 jika approval tidak valid", async () => {
    const res = await request(app).patch("/api/permintaan-barang/1/approval").send({ approval: "MAYBE" });
    expect(res.status).toBe(400);
  });

  it("404 jika tidak ditemukan", async () => {
    mocked.setApproval.mockResolvedValue(null as never);
    const res = await request(app).patch("/api/permintaan-barang/99/approval").send({ approval: "DISETUJUI" });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/permintaan-barang/:id/items/:barangItemId", () => {
  it("200 memetakan baris ke master", async () => {
    mocked.petakanItemMaster.mockResolvedValue({ id: 7, itemId: 3 } as never);
    const res = await request(app).patch("/api/permintaan-barang/1/items/7").send({ itemId: 3 });
    expect(res.status).toBe(200);
    expect(mocked.petakanItemMaster).toHaveBeenCalledWith(1, 7, 3);
  });

  it("400 jika itemId invalid", async () => {
    const res = await request(app).patch("/api/permintaan-barang/1/items/7").send({ itemId: 0 });
    expect(res.status).toBe(400);
    expect(mocked.petakanItemMaster).not.toHaveBeenCalled();
  });

  it("404 jika master tidak ada", async () => {
    mocked.petakanItemMaster.mockResolvedValue({ error: "NOT_FOUND_MASTER" } as never);
    const res = await request(app).patch("/api/permintaan-barang/1/items/7").send({ itemId: 99 });
    expect(res.status).toBe(404);
  });

  it("409 jika master beda divisi atau request otomatis", async () => {
    mocked.petakanItemMaster.mockRejectedValue(new ItemDivisiError("Bahan A"));
    const res = await request(app).patch("/api/permintaan-barang/1/items/7").send({ itemId: 3 });
    expect(res.status).toBe(409);
    expect(res.body.kode).toBe("ITEM_DIVISI_TIDAK_COCOK");

    mocked.petakanItemMaster.mockRejectedValue(new PermintaanOtomatisError());
    const res2 = await request(app).patch("/api/permintaan-barang/1/items/7").send({ itemId: 3 });
    expect(res2.status).toBe(409);
  });
});

describe("guard KELOLA_ITEM approval/petakan", () => {
  it("403 approval tanpa permission", async () => {
    setAccess(["BARANG_LIHAT"]);
    const res = await request(app).patch("/api/permintaan-barang/1/approval").send({ approval: "DISETUJUI" });
    expect(res.status).toBe(403);
    expect(mocked.setApproval).not.toHaveBeenCalled();
  });

  it("200 approval dengan KELOLA_ITEM (peran gudang)", async () => {
    setAccess(["BARANG_LIHAT", "KELOLA_ITEM"]);
    mocked.setApproval.mockResolvedValue(record({ approval: "DISETUJUI" }) as never);
    const res = await request(app).patch("/api/permintaan-barang/1/approval").send({ approval: "DISETUJUI" });
    expect(res.status).toBe(200);
  });

  it("403 petakan tanpa permission", async () => {
    setAccess(["BARANG_LIHAT"]);
    const res = await request(app).patch("/api/permintaan-barang/1/items/7").send({ itemId: 3 });
    expect(res.status).toBe(403);
    expect(mocked.petakanItemMaster).not.toHaveBeenCalled();
  });
});

describe("auth wiring", () => {
  it("POST public, sisanya di belakang authenticate", async () => {
    const { authenticate } = await import("../src/middleware/auth.js");
    const stack = (permintaanBarangRouter as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean> }; handle?: unknown }> }).stack;
    const idxAuth = stack.findIndex((l) => !l.route && l.handle === authenticate);
    const idxOf = (method: string, path: string) =>
      stack.findIndex((l) => l.route?.path === path && !!l.route?.methods?.[method]);
    expect(idxAuth).toBeGreaterThan(-1);
    expect(idxOf("post", "/")).toBeLessThan(idxAuth);
    expect(idxOf("get", "/")).toBeGreaterThan(idxAuth);
  });
});

describe("DELETE /api/permintaan-barang/:id", () => {
  it("200 jika berhasil", async () => {
    mocked.deletePermintaan.mockResolvedValue(true as never);
    const res = await request(app).delete("/api/permintaan-barang/1");
    expect(res.status).toBe(200);
  });

  it("409 saat DISETUJUI", async () => {
    mocked.deletePermintaan.mockRejectedValue(new PermintaanTerkunciError());
    const res = await request(app).delete("/api/permintaan-barang/1");
    expect(res.status).toBe(409);
  });

  it("404 jika tidak ditemukan", async () => {
    mocked.deletePermintaan.mockResolvedValue(false as never);
    const res = await request(app).delete("/api/permintaan-barang/99");
    expect(res.status).toBe(404);
  });
});
