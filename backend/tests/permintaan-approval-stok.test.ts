import { describe, it, expect, vi, beforeEach } from "vitest";

const tx = {
  permintaanBarang: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
  },
  permintaanBarangItem: {
    update: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
  stokItemMutasi: {
    groupBy: vi.fn(),
    create: vi.fn(),
  },
  pemakaianMaterial: {
    findFirst: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  hasilProduksiPemakaian: {
    findFirst: vi.fn(),
  },
  wipTransferAlokasi: {
    findFirst: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  divisi: {
    findMany: vi.fn(),
  },
  $queryRaw: vi.fn(),
};

const inventoryMock = vi.hoisted(() => ({
  ensureDivisionInventoryLocation: vi.fn().mockResolvedValue({ id: 3, isActive: true }),
  postInventoryMovementInTransaction: vi.fn().mockResolvedValue({}),
}));

vi.mock("../src/lib/prisma.js", () => ({
  default: {
    $transaction: vi.fn((fn: (t: unknown) => unknown) => fn(tx)),
  },
}));
vi.mock("../src/model/inventory/inventory.js", () => inventoryMock);

import {
  setApproval,
  DivisiApprovalError,
  DivisiPemintaError,
  ItemDivisiError,
  ItemTanpaMasterError,
  ItemSmGunakanWipError,
  KeputusanItemError,
  PemakaianDipakaiProduksiError,
  PemakaianSudahTransferError,
} from "../src/model/permintaanBarang/permintaanBarang.js";

const saldoRows = (masuk: number, keluar: number) => [
  { tipe: "MASUK", _sum: { jumlah: masuk } },
  { tipe: "KELUAR", _sum: { jumlah: keluar } },
];

const permintaan = (
  items: unknown[],
  approval = "BELUM_DISETUJUI",
  over: Record<string, unknown> = {},
) => ({
  id: 1,
  noPermintaan: "PR-20261013-0001",
  departemen: "Produksi",
  divisiPemintaId: 1,
  divisiApproverId: 1,
  sumber: "MANUAL",
  autoKey: null,
  approval,
  ...over,
  items: (items as Array<Record<string, unknown>>).map((item) => ({
    satuan: "pcs",
    ...item,
    item: item.item ?? (item.itemId ? { id: item.itemId, divisiId: 1 } : null),
  })),
});

beforeEach(() => {
  vi.clearAllMocks();
  tx.permintaanBarang.update.mockImplementation(async (args: any) => ({ id: 1, ...args.data }));
  tx.permintaanBarang.findUniqueOrThrow.mockImplementation(async () => permintaan([]));
  tx.permintaanBarangItem.findMany.mockResolvedValue([] as never);
  tx.stokItemMutasi.create.mockResolvedValue({});
  tx.$queryRaw.mockResolvedValue([]);
  tx.user.findUnique.mockResolvedValue({ role: "admin", divisiId: 1 } as never);
  tx.pemakaianMaterial.findFirst.mockResolvedValue(null as never);
  tx.pemakaianMaterial.create.mockImplementation(async ({ data }: any) => ({
    items: data.items.create.map((row: any, index: number) => ({
      id: 800 + index,
      itemId: row.itemId,
      jumlahDiterima: row.jumlahDiterima,
    })),
  }) as never);
  tx.pemakaianMaterial.deleteMany.mockResolvedValue({ count: 1 } as never);
  tx.hasilProduksiPemakaian.findFirst.mockResolvedValue(null as never);
  tx.wipTransferAlokasi.findFirst.mockResolvedValue(null as never);
  tx.divisi.findMany.mockResolvedValue([{ id: 1, nama: "Produksi" }] as never);
  inventoryMock.ensureDivisionInventoryLocation.mockResolvedValue({ id: 3, isActive: true });
  inventoryMock.postInventoryMovementInTransaction.mockResolvedValue({});
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
    expect(tx.pemakaianMaterial.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        permintaanId: 1,
        divisiId: 1,
        items: {
          create: [
            expect.objectContaining({
              itemId: 1,
              permintaanBarangItemId: 10,
              jumlahDiterima: 10,
              jumlahDipakai: 0,
              jumlahSisa: 10,
            }),
          ],
        },
      }),
      select: expect.any(Object),
    });
    expect(inventoryMock.postInventoryMovementInTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        itemId: 1,
        pemakaianMaterialItemId: 800,
        toLocationId: 3,
        type: "OPENING",
        quantity: 10,
        sourceType: "MATERIAL_ISSUE",
      }),
    );
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
      expect.objectContaining({ data: expect.objectContaining({ approval: "BELUM_DISETUJUI" }) }),
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
      expect.objectContaining({ data: expect.objectContaining({ approval: "DISETUJUI", autoKey: null }) }),
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

  it("item SM ditolak saat approval dan diarahkan ke Transfer WIP", async () => {
    tx.permintaanBarang.findUnique.mockResolvedValue(
      permintaan([
        {
          id: 41,
          itemId: 21,
          nama: "Batok WB Buffing",
          jumlah: 2,
          statusKeputusan: "MENUNGGU",
          item: { id: 21, kode: "SM0025", nama: "Batok WB Buffing", divisiId: 1, jenis: "SM" },
        },
      ]) as never,
    );

    await expect(setApproval(1, "DISETUJUI", [], null)).rejects.toBeInstanceOf(ItemSmGunakanWipError);
    expect(tx.stokItemMutasi.create).not.toHaveBeenCalled();
  });
});

describe("setApproval guard divisi", () => {
  const item = { id: 70, itemId: 5, nama: "Bahan A", jumlah: 5, statusKeputusan: "MENUNGGU" };

  it("non-admin dari divisi lain ditolak sebelum mutasi", async () => {
    tx.user.findUnique.mockResolvedValue({ role: "gudang", divisiId: 2 } as never);
    tx.permintaanBarang.findUnique.mockResolvedValue(permintaan([item]) as never);

    await expect(setApproval(1, "DISETUJUI", [], 7)).rejects.toBeInstanceOf(DivisiApprovalError);
    expect(tx.stokItemMutasi.create).not.toHaveBeenCalled();
  });

  it("non-admin tanpa divisi ditolak", async () => {
    tx.user.findUnique.mockResolvedValue({ role: "gudang", divisiId: null } as never);
    tx.permintaanBarang.findUnique.mockResolvedValue(permintaan([item]) as never);

    await expect(setApproval(1, "DISETUJUI", [], 7)).rejects.toBeInstanceOf(DivisiApprovalError);
  });

  it("non-admin approver divisi yang sama boleh approve item satu divisi", async () => {
    tx.user.findUnique.mockResolvedValue({ role: "gudang", divisiId: 1 } as never);
    tx.permintaanBarang.findUnique.mockResolvedValue(permintaan([item]) as never);
    tx.stokItemMutasi.groupBy.mockResolvedValue(saldoRows(10, 0) as never);

    await setApproval(1, "DISETUJUI", [], 7);

    expect(tx.pemakaianMaterial.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ divisiId: 1 }),
      select: expect.any(Object),
    });
  });

  it("non-admin menolak item dari divisi lain", async () => {
    tx.user.findUnique.mockResolvedValue({ role: "gudang", divisiId: 1 } as never);
    tx.permintaanBarang.findUnique.mockResolvedValue(
      permintaan([{ ...item, item: { id: 5, divisiId: 2 } }]) as never,
    );

    await expect(setApproval(1, "DISETUJUI", [], 7)).rejects.toBeInstanceOf(ItemDivisiError);
    expect(tx.stokItemMutasi.create).not.toHaveBeenCalled();
  });

  it("admin boleh approve item campuran divisi", async () => {
    tx.user.findUnique.mockResolvedValue({ role: "admin", divisiId: null } as never);
    tx.permintaanBarang.findUnique.mockResolvedValue(
      permintaan([{ ...item, item: { id: 5, divisiId: 2 } }]) as never,
    );
    tx.stokItemMutasi.groupBy.mockResolvedValue(saldoRows(10, 0) as never);

    await setApproval(1, "DISETUJUI", [], 7);

    expect(tx.stokItemMutasi.create).toHaveBeenCalled();
  });

  it("divisi peminta null dan tidak bisa di-resolve ditolak", async () => {
    tx.permintaanBarang.findUnique.mockResolvedValue(
      permintaan([item], "BELUM_DISETUJUI", { divisiPemintaId: null }) as never,
    );
    tx.divisi.findMany.mockResolvedValue([] as never);

    await expect(setApproval(1, "DISETUJUI", [], null)).rejects.toBeInstanceOf(DivisiPemintaError);
    expect(tx.stokItemMutasi.create).not.toHaveBeenCalled();
  });

  it("request tanpa approver hanya boleh di-approve admin", async () => {
    tx.user.findUnique.mockResolvedValue({ role: "gudang", divisiId: 1 } as never);
    tx.permintaanBarang.findUnique.mockResolvedValue(
      permintaan([item], "BELUM_DISETUJUI", { divisiApproverId: null }) as never,
    );

    await expect(setApproval(1, "DISETUJUI", [], 7)).rejects.toBeInstanceOf(DivisiApprovalError);
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
    expect(tx.pemakaianMaterial.deleteMany).toHaveBeenCalledWith({ where: { permintaanId: 1 } });
    expect(tx.permintaanBarang.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ autoKey: null }) }),
    );
  });

  it("menolak pembatalan jika pemakaian sudah dipakai produksi", async () => {
    tx.permintaanBarang.findUnique.mockResolvedValue(
      permintaan(
        [{ id: 52, itemId: 1, nama: "Pulpen", jumlah: 10, jumlahDisetujui: 10, statusKeputusan: "DISETUJUI" }],
        "DISETUJUI",
      ) as never,
    );
    tx.hasilProduksiPemakaian.findFirst.mockResolvedValue({ id: 1 } as never);

    await expect(setApproval(1, "BELUM_DISETUJUI", [], null)).rejects.toBeInstanceOf(
      PemakaianDipakaiProduksiError,
    );
    expect(tx.stokItemMutasi.create).not.toHaveBeenCalled();
    expect(tx.pemakaianMaterial.deleteMany).not.toHaveBeenCalled();
  });

  it("menolak pembatalan jika pemakaian sudah ditransfer WIP", async () => {
    tx.permintaanBarang.findUnique.mockResolvedValue(
      permintaan(
        [{ id: 53, itemId: 1, nama: "Pulpen", jumlah: 10, jumlahDisetujui: 10, statusKeputusan: "DISETUJUI" }],
        "DISETUJUI",
      ) as never,
    );
    tx.wipTransferAlokasi.findFirst.mockResolvedValue({ id: 1 } as never);

    await expect(setApproval(1, "BELUM_DISETUJUI", [], null)).rejects.toBeInstanceOf(
      PemakaianSudahTransferError,
    );
    expect(tx.stokItemMutasi.create).not.toHaveBeenCalled();
    expect(tx.pemakaianMaterial.deleteMany).not.toHaveBeenCalled();
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

    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(String(tx.$queryRaw.mock.calls[0][0])).toContain("PermintaanBarang");
    expect(String(tx.$queryRaw.mock.calls[1][0])).toContain("Item");
    const lockOrder = tx.$queryRaw.mock.invocationCallOrder[0];
    const saldoOrder = tx.stokItemMutasi.groupBy.mock.invocationCallOrder[0];
    expect(lockOrder).toBeLessThan(saldoOrder);
  });
});
