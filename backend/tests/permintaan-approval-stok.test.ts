import { describe, it, expect, vi, beforeEach } from "vitest";

const tx = {
  permintaanBarang: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  permintaanBarangItem: {
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  stokItemMutasi: {
    groupBy: vi.fn(),
    create: vi.fn(),
  },
  $queryRaw: vi.fn(),
  findUniqueOrThrow: vi.fn(),
};

vi.mock("../src/lib/prisma.js", () => ({
  default: {
    $transaction: vi.fn((fn: (t: unknown) => unknown) => fn(tx)),
  },
}));

import { setApproval, ItemTanpaMasterError, KeputusanItemError } from "../src/model/permintaanBarang/permintaanBarang.js";

const saldoRows = (masuk: number, keluar: number) => [
  { tipe: "MASUK", _sum: { jumlah: masuk } },
  { tipe: "KELUAR", _sum: { jumlah: keluar } },
];

const permintaan = (items: unknown[], approval = "BELUM_DISETUJUI") => ({
  id: 1,
  noPermintaan: "PR-20261013-0001",
  approval,
  items,
});

beforeEach(() => {
  vi.clearAllMocks();
  tx.permintaanBarang.update.mockImplementation(async (args: any) => ({ id: 1, ...args.data }));
  tx.stokItemMutasi.create.mockResolvedValue({});
  tx.$queryRaw.mockResolvedValue([]);
});

describe("setApproval DISETUJUI", () => {
  it("default jumlahDisetujui = min(jumlah, stok) dan buat KELUAR", async () => {
    tx.permintaanBarang.findUnique.mockResolvedValue(
      permintaan([{ id: 10, itemId: 1, nama: "Pulpen", jumlah: 10, statusKeputusan: "MENUNGGU" }]) as never,
    );
    tx.stokItemMutasi.groupBy.mockResolvedValue(saldoRows(100, 0) as never);

    await setApproval(1, "DISETUJUI", [], 7);

    expect(tx.permintaanBarangItem.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { jumlahDisetujui: 10, statusKeputusan: "DISETUJUI" },
    });
    expect(tx.stokItemMutasi.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ itemId: 1, tipe: "KELUAR", jumlah: 10, sumberPermintaanItemId: 10, userId: 7 }),
    });
  });

  it("stok kurang: default dibatasi ke saldo", async () => {
    tx.permintaanBarang.findUnique.mockResolvedValue(
      permintaan([{ id: 11, itemId: 2, nama: "Masker", jumlah: 10, statusKeputusan: "MENUNGGU" }]) as never,
    );
    tx.stokItemMutasi.groupBy.mockResolvedValue(saldoRows(5, 0) as never);

    await setApproval(1, "DISETUJUI", [], null);

    expect(tx.stokItemMutasi.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tipe: "KELUAR", jumlah: 5 }),
    });
  });

  it("stok 0: item ditolak, permintaan tetap BELUM_DISETUJUI jika tidak ada item lain disetujui", async () => {
    tx.permintaanBarang.findUnique.mockResolvedValue(
      permintaan([{ id: 12, itemId: 3, nama: "Sarung tangan", jumlah: 4, statusKeputusan: "MENUNGGU" }]) as never,
    );
    tx.stokItemMutasi.groupBy.mockResolvedValue([] as never);

    await setApproval(1, "DISETUJUI", [], null);

    expect(tx.permintaanBarangItem.update).toHaveBeenCalledWith({
      where: { id: 12 },
      data: { jumlahDisetujui: 0, statusKeputusan: "DITOLAK" },
    });
    expect(tx.stokItemMutasi.create).not.toHaveBeenCalled();
    expect(tx.permintaanBarang.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { approval: "BELUM_DISETUJUI" } }),
    );
  });

  it("pulpen 10 disetujui penuh, masker diedit ke 5 (stok 5), permintaan DISETUJUI", async () => {
    tx.permintaanBarang.findUnique.mockResolvedValue(
      permintaan([
        { id: 20, itemId: 1, nama: "Pulpen", jumlah: 10, statusKeputusan: "MENUNGGU" },
        { id: 21, itemId: 2, nama: "Masker", jumlah: 10, statusKeputusan: "MENUNGGU" },
      ]) as never,
    );
    tx.stokItemMutasi.groupBy
      .mockResolvedValueOnce(saldoRows(100, 0) as never)
      .mockResolvedValueOnce(saldoRows(5, 0) as never);

    await setApproval(1, "DISETUJUI", [{ id: 21, jumlahDisetujui: 5 }], null);

    expect(tx.stokItemMutasi.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ itemId: 1, tipe: "KELUAR", jumlah: 10 }),
    });
    expect(tx.stokItemMutasi.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ itemId: 2, tipe: "KELUAR", jumlah: 5 }),
    });
    expect(tx.permintaanBarang.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { approval: "DISETUJUI" } }),
    );
  });

  it("jumlahDisetujui melebihi batas stok ditolak dengan KeputusanItemError", async () => {
    tx.permintaanBarang.findUnique.mockResolvedValue(
      permintaan([{ id: 30, itemId: 2, nama: "Masker", jumlah: 10, statusKeputusan: "MENUNGGU" }]) as never,
    );
    tx.stokItemMutasi.groupBy.mockResolvedValue(saldoRows(5, 0) as never);

    await expect(setApproval(1, "DISETUJUI", [{ id: 30, jumlahDisetujui: 8 }], null)).rejects.toBeInstanceOf(
      KeputusanItemError,
    );
    expect(tx.stokItemMutasi.create).not.toHaveBeenCalled();
  });

  it("item tanpa itemId ditolak dengan ItemTanpaMasterError", async () => {
    tx.permintaanBarang.findUnique.mockResolvedValue(
      permintaan([{ id: 40, itemId: null, nama: "Bahan bebas", jumlah: 2, statusKeputusan: "MENUNGGU" }]) as never,
    );

    await expect(setApproval(1, "DISETUJUI", [], null)).rejects.toBeInstanceOf(ItemTanpaMasterError);
    expect(tx.stokItemMutasi.create).not.toHaveBeenCalled();
  });
});

describe("setApproval BELUM_DISETUJUI (batal)", () => {
  it("membalik KELUAR dengan MASUK dan reset keputusan", async () => {
    tx.permintaanBarang.findUnique.mockResolvedValue(
      permintaan(
        [{ id: 50, itemId: 1, nama: "Pulpen", jumlah: 10, jumlahDisetujui: 10, statusKeputusan: "DISETUJUI" }],
        "DISETUJUI",
      ) as never,
    );

    await setApproval(1, "BELUM_DISETUJUI", [], 9);

    expect(tx.stokItemMutasi.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ itemId: 1, tipe: "MASUK", jumlah: 10, sumberPermintaanItemId: 50, userId: 9 }),
    });
    expect(tx.permintaanBarangItem.updateMany).toHaveBeenCalledWith({
      where: { permintaanId: 1 },
      data: { statusKeputusan: "MENUNGGU", jumlahDisetujui: null },
    });
  });

  it("item DITOLAK tidak membuat MASUK pembalik", async () => {
    tx.permintaanBarang.findUnique.mockResolvedValue(
      permintaan(
        [{ id: 51, itemId: 2, nama: "Masker", jumlah: 10, jumlahDisetujui: 0, statusKeputusan: "DITOLAK" }],
        "DISETUJUI",
      ) as never,
    );

    await setApproval(1, "BELUM_DISETUJUI", [], null);

    expect(tx.stokItemMutasi.create).not.toHaveBeenCalled();
  });
});

describe("setApproval dengan lock per item", () => {
  it("mengunci tiap item sebelum membaca saldo", async () => {
    tx.permintaanBarang.findUnique.mockResolvedValue(
      permintaan([{ id: 60, itemId: 4, nama: "Lem", jumlah: 1, statusKeputusan: "MENUNGGU" }]) as never,
    );
    tx.stokItemMutasi.groupBy.mockResolvedValue(saldoRows(3, 0) as never);

    await setApproval(1, "DISETUJUI", [], null);

    expect(tx.$queryRaw).toHaveBeenCalled();
    const lockOrder = tx.$queryRaw.mock.invocationCallOrder[0];
    const saldoOrder = tx.stokItemMutasi.groupBy.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(saldoOrder);
  });
});
