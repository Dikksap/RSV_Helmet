import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

vi.mock("../src/model/wipTransfer/wipTransfer.js", () => {
  class WipTransferError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "WipTransferError";
      this.code = code;
    }
  }
  class WipTransferKurangError extends WipTransferError {
    constructor(readonly dataKekurangan: unknown) {
      super("WIP_KURANG", "WIP asal tidak cukup untuk transfer.");
      this.name = "WipTransferKurangError";
    }
  }
  return {
    WipTransferError,
    WipTransferKurangError,
    WIP_TRANSFER_TIDAK_DITEMUKAN: "WIP_TRANSFER_TIDAK_DITEMUKAN",
    DIVISI_TIDAK_DITEMUKAN: "DIVISI_TIDAK_DITEMUKAN",
    DIVISI_TIDAK_TERHUBUNG: "DIVISI_TIDAK_TERHUBUNG",
    DIVISI_SAMA: "DIVISI_SAMA",
    ITEM_TIDAK_DITEMUKAN: "ITEM_TIDAK_DITEMUKAN",
    ITEM_TIDAK_AKTIF: "ITEM_TIDAK_AKTIF",
    ITEM_BUKAN_SM: "ITEM_BUKAN_SM",
    ITEM_DIVISI_TIDAK_COCOK: "ITEM_DIVISI_TIDAK_COCOK",
    ITEM_DUPLIKAT: "ITEM_DUPLIKAT",
    JUMLAH_TIDAK_VALID: "JUMLAH_TIDAK_VALID",
    TANGGAL_TIDAK_VALID: "TANGGAL_TIDAK_VALID",
    APPROVAL_TIDAK_VALID: "APPROVAL_TIDAK_VALID",
    STATUS_TIDAK_VALID: "STATUS_TIDAK_VALID",
    AKSES_DITOLAK: "AKSES_DITOLAK",
    ARAH_TIDAK_VALID: "ARAH_TIDAK_VALID",
    TRANSFER_TERKUNCI: "TRANSFER_TERKUNCI",
    createWipTransfer: vi.fn(),
    approveWipTransfer: vi.fn(),
    deleteWipTransfer: vi.fn(),
    getWipTransferById: vi.fn(),
    getWipTransferOpsi: vi.fn(),
    listWipTransfer: vi.fn(),
  };
});

vi.mock("../src/middleware/auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/middleware/auth.js")>();
  return {
    ...actual,
    authenticate: (req: any, _res: any, next: any) => {
      req.user = { id: 7, email: "operator@example.com", name: "Operator", role: "user" };
      next();
    },
    authorize: (req: any, _res: any, next: any) => {
      req.access = { role: "user", permissions: [], statusView: null, divisiId: 1 };
      next();
    },
  };
});

import wipTransferRouter from "../src/routes/wip-transfer.js";
import {
  AKSES_DITOLAK,
  approveWipTransfer,
  createWipTransfer,
  WipTransferError,
  WipTransferKurangError,
} from "../src/model/wipTransfer/wipTransfer.js";

const app = express();
app.use(express.json());
app.use("/api/wip-transfer", wipTransferRouter);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/wip-transfer", () => {
  it("membuat transfer dengan user dari sesi, bukan payload", async () => {
    vi.mocked(createWipTransfer).mockResolvedValue({ id: 1, nomor: "TW-20261023-0001" } as never);

    const res = await request(app)
      .post("/api/wip-transfer")
      .send({
        arah: "KIRIM",
        tanggal: "2026-10-23",
        divisiAsalId: 1,
        divisiTujuanId: 2,
        userId: 999,
        items: [{ itemId: 20, jumlah: 5 }],
      });

    expect(res.status).toBe(201);
    expect(createWipTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        divisiAsalId: 1,
        divisiTujuanId: 2,
        items: [{ itemId: 20, jumlah: 5 }],
      }),
      { userId: 7, admin: false, divisiId: 1 },
    );
    expect(vi.mocked(createWipTransfer).mock.calls[0][0]).not.toHaveProperty("userId");
  });

  it("mengembalikan 409 WIP_KURANG beserta data kekurangan", async () => {
    const dataKekurangan = {
      divisiAsalId: 1,
      items: [{ itemId: 20, kode: "SM0025", nama: "Batok Jadi", unit: "pcs", diminta: 10, tersedia: 4, kekurangan: 6 }],
    };
    vi.mocked(createWipTransfer).mockRejectedValue(new WipTransferKurangError(dataKekurangan));

    const res = await request(app)
      .post("/api/wip-transfer")
      .send({ arah: "KIRIM", divisiTujuanId: 2, items: [{ itemId: 20, jumlah: 10 }] });

    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ kode: "WIP_KURANG", dataKekurangan });
  });
});

describe("PATCH /api/wip-transfer/:id/approval", () => {
  it("meneruskan status dan jumlah disetujui", async () => {
    vi.mocked(approveWipTransfer).mockResolvedValue({ id: 5, status: "DISETUJUI" } as never);

    const res = await request(app)
      .patch("/api/wip-transfer/5/approval")
      .send({ status: "DISETUJUI", items: [{ id: 3, jumlahDisetujui: 2 }] });

    expect(res.status).toBe(200);
    expect(approveWipTransfer).toHaveBeenCalledWith(
      5,
      { status: "DISETUJUI", items: [{ id: 3, jumlahDisetujui: 2 }] },
      { userId: 7, admin: false, divisiId: 1 },
    );
  });

  it("memetakan AKSES_DITOLAK menjadi 403", async () => {
    vi.mocked(approveWipTransfer).mockRejectedValue(
      new WipTransferError(AKSES_DITOLAK, "Anda tidak berhak menyetujui transfer ini."),
    );

    const res = await request(app)
      .patch("/api/wip-transfer/5/approval")
      .send({ status: "DITOLAK" });

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ kode: AKSES_DITOLAK });
  });
});
