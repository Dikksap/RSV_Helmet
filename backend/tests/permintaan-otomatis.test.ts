import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  permintaanBarang: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
  },
  permintaanBarangItem: {
    updateMany: vi.fn(),
  },
}));

vi.mock("../src/lib/prisma.js", () => ({ default: prismaMock }));

import { createPermintaan } from "../src/model/permintaanBarang/permintaanBarang.js";

const input = {
  tanggal: new Date("2026-10-21T17:00:00.000Z"),
  tanggalDibutuhkan: new Date("2026-10-21T17:00:00.000Z"),
  departemen: "Buffing",
  divisiPemintaId: 1,
  divisiApproverId: 1,
  namaPeminta: "Budi",
  kebutuhanUntuk: "Produksi",
  prioritas: "Normal",
  alasan: "WIP kurang",
  sumber: "HASIL_PRODUKSI" as const,
  autoKey: "HP:1:1:1:2026-10-22",
  items: [
    { itemId: 1, nama: "Batok", spesifikasi: null, jumlah: 20, satuan: "pcs" },
  ],
};

const existing = {
  id: 9,
  noPermintaan: "PR-20261022-0009",
  approval: "BELUM_DISETUJUI",
  autoKey: input.autoKey,
  items: [{ id: 19, itemId: 1, jumlah: 20 }],
};

const tx = {
  $queryRaw: vi.fn(),
  permintaanBarang: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  permintaanBarangItem: {
    updateMany: vi.fn(),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.permintaanBarang.findFirst.mockResolvedValue({ id: 9 } as never);
  tx.$queryRaw.mockResolvedValue([] as never);
  tx.permintaanBarang.findUnique.mockResolvedValue({
    autoKey: input.autoKey,
    approval: "BELUM_DISETUJUI",
  } as never);
  tx.permintaanBarang.findUniqueOrThrow.mockResolvedValue(existing as never);
  tx.permintaanBarangItem.updateMany.mockResolvedValue({ count: 1 } as never);
  prismaMock.$transaction
    .mockRejectedValueOnce(Object.assign(new Error("duplicate"), { code: "P2002" }))
    .mockImplementation(async (fn: (client: unknown) => unknown) => fn(tx));
});

describe("createPermintaan otomatis", () => {
  it("menggunakan kembali request pending dan menyesuaikan jumlah kekurangan terbaru", async () => {
    const row = await createPermintaan(input);

    expect(row.id).toBe(9);
    expect(tx.permintaanBarangItem.updateMany).toHaveBeenCalledWith({
      where: { permintaanId: 9, itemId: 1 },
      data: { jumlah: 20 },
    });
    expect(tx.$queryRaw.mock.calls[0][0].join("")).toContain("FOR UPDATE");
  });
});
