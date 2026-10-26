import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  stokItemMutasi: { groupBy: vi.fn() },
  item: { findFirst: vi.fn(), findMany: vi.fn() },
  hasilProduksiHarian: { findUnique: vi.fn() },
}));

const stokMock = vi.hoisted(() => ({
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

const permintaanMock = vi.hoisted(() => ({
  createPermintaan: vi.fn(),
}));

const inventoryMock = vi.hoisted(() => ({
  ensureDivisionInventoryLocation: vi.fn().mockResolvedValue({ id: 3, isActive: true }),
  postInventoryMovementInTransaction: vi.fn().mockResolvedValue({}),
}));

vi.mock("../src/lib/prisma.js", () => ({ default: prismaMock }));
vi.mock("../src/model/stokItem/stokItem.js", () => stokMock);
vi.mock("../src/model/inventory/inventory.js", () => inventoryMock);
vi.mock("../src/model/permintaanBarang/permintaanBarang.js", () => ({
  createPermintaan: permintaanMock.createPermintaan,
}));

import {
  createHasilProduksi,
  getHasilProduksiById,
  HasilProduksiError,
  INPUT_TIDAK_VALID,
  WipKurangError,
} from "../src/model/hasilProduksiHarian/hasilProduksiHarian.js";

const item = (id: number) => ({
  id,
  kode: `ITM-${id}`,
  nama: `Item ${id}`,
  unit: "pcs",
  jenis: id === 2 ? "SM" : null,
  divisiId: 1,
  divisi: { id: 1, nama: "Buffing" },
});

let wipRows: Array<{ id: number; jumlahSisa: unknown; jumlahDipakai: unknown }> = [];
let wipRowsByItem = new Map<number, Array<{ id: number; jumlahSisa: unknown; jumlahDipakai: unknown }>>();
let routingStages: Array<{
  inputItems: Array<{ itemId: number }>;
  outputItems: Array<{ itemId: number }>;
}> = [];
let updateCount = 1;
let tx: ReturnType<typeof buatTx>;

function buatTx() {
  let urut = 1;
  return {
    divisi: {
      findUnique: vi.fn().mockResolvedValue({ id: 1, nama: "Buffing" }),
    },
    item: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: number[] } } }) =>
        where.id.in.filter((id) => id >= 1 && id <= 4).map(item),
      ),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ name: "Budi" }),
    },
    $queryRaw: vi.fn(async (...args: unknown[]) => wipRowsByItem.get(Number(args[2])) ?? wipRows),
    pemakaianMaterialItem: {
      updateMany: vi.fn(async () => ({ count: updateCount })),
    },
    pemakaianMaterial: {
      create: vi.fn(async ({ data }: { data: any }) => ({
        id: 500,
        items: data.items.create.map((row: any, index: number) => ({
          id: 501 + index,
          itemId: row.itemId,
          jumlahDiterima: row.jumlahDiterima,
          hasilProduksiHarianItemId: row.hasilProduksiHarianItemId,
        })),
      })),
    },
    productionRoutingStage: {
      findMany: vi.fn(async () => routingStages),
    },
    hasilProduksiPemakaian: {
      create: vi.fn().mockResolvedValue({}),
    },
    hasilProduksiHarian: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(async ({ data }: { data: any }) => ({
        id: 10,
        nomor: data.nomor,
        tanggalProduksi: data.tanggalProduksi,
        divisiId: data.divisiId,
        divisi: { id: 1, nama: "Buffing" },
        items: data.items.create.map((row: any) => ({
          id: 100 + urut++,
          ...row,
          item: item(row.itemId),
          stokMutasi: null,
        })),
      })),
      findUniqueOrThrow: vi.fn(async () => ({
        id: 10,
        nomor: "HP-20261022-0001",
        tanggalProduksi: new Date("2026-10-21T17:00:00.000Z"),
        divisi: { id: 1, nama: "Buffing" },
        items: [],
      })),
    },
  };
}

const permintaanOtomatis = {
  id: 9,
  noPermintaan: "PR-20261022-0009",
  approval: "BELUM_DISETUJUI",
  items: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  wipRows = [{ id: 10, jumlahSisa: 100, jumlahDipakai: 0 }];
  wipRowsByItem = new Map();
  routingStages = [];
  updateCount = 1;
  stokMock.getSaldo.mockResolvedValue(1_000);
  stokMock.catatMutasi.mockResolvedValue({});
  stokMock.lockItem.mockResolvedValue(undefined);
  inventoryMock.ensureDivisionInventoryLocation.mockResolvedValue({ id: 3, isActive: true });
  inventoryMock.postInventoryMovementInTransaction.mockResolvedValue({});
  permintaanMock.createPermintaan.mockResolvedValue(permintaanOtomatis);
  prismaMock.$transaction.mockImplementation(async (fn: (client: any) => unknown) => {
    tx = buatTx();
    return fn(tx);
  });
});

describe("createHasilProduksi", () => {
  it("mengonsumsi beberapa item input dari saldo WIP masing-masing dan mencatat beberapa hasil", async () => {
    routingStages = [{
      inputItems: [{ itemId: 1 }, { itemId: 3 }],
      outputItems: [{ itemId: 2 }],
    }];
    wipRowsByItem = new Map([
      [1, [{ id: 10, jumlahSisa: 10, jumlahDipakai: 0 }]],
      [3, [{ id: 30, jumlahSisa: 10, jumlahDipakai: 0 }]],
    ]);

    await createHasilProduksi({
      divisiId: 1,
      items: [
        { itemId: 1, tipe: "MASUK", jumlah: 5 },
        { itemId: 3, tipe: "MASUK", jumlah: 4 },
        { itemId: 2, tipe: "HASIL", jumlah: 4 },
        { itemId: 4, tipe: "HASIL", jumlah: 4 },
      ],
    });

    expect(tx.hasilProduksiHarian.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        items: {
          create: expect.arrayContaining([
            expect.objectContaining({ itemId: 1, tipe: "MASUK", jumlah: 5 }),
            expect.objectContaining({ itemId: 3, tipe: "MASUK", jumlah: 4 }),
            expect.objectContaining({ itemId: 2, tipe: "HASIL", jumlah: 4 }),
            expect.objectContaining({ itemId: 4, tipe: "HASIL", jumlah: 4 }),
          ]),
        },
      }),
    }));
    expect(tx.pemakaianMaterialItem.updateMany.mock.calls.map((call) => call[0].where.id)).toEqual([10, 30]);
    expect(tx.hasilProduksiPemakaian.create.mock.calls.map((call) => call[0].data)).toEqual([
      { hasilProduksiHarianItemId: 101, pemakaianMaterialItemId: 10, jumlah: 5 },
      { hasilProduksiHarianItemId: 102, pemakaianMaterialItemId: 30, jumlah: 4 },
    ]);
  });

  it("WIP cukup: HASIL SM masuk WIP, KELUAR tetap mutasi, konsumsi FIFO sesuai tiap MASUK", async () => {
    wipRows = [
      { id: 10, jumlahSisa: 30, jumlahDipakai: 5 },
      { id: 11, jumlahSisa: 20, jumlahDipakai: 0 },
    ];

    const hasil = await createHasilProduksi(
      {
        divisiId: 1,
        tanggalProduksi: new Date("2026-10-22T00:00:00+07:00"),
        items: [
          { itemId: 1, tipe: "MASUK", jumlah: 50 },
          { itemId: 2, tipe: "HASIL", jumlah: 45 },
          { itemId: 3, tipe: "KELUAR", jumlah: 2 },
        ],
      },
      42,
    );

    expect(hasil.id).toBe(10);
    expect(stokMock.catatMutasi).toHaveBeenCalledTimes(1);
    expect(stokMock.catatMutasi.mock.calls[0][1]).toMatchObject({
      itemId: 3,
      tipe: "KELUAR",
      jumlah: 2,
      sumberHasilProduksiItemId: 103,
    });
    expect(stokMock.catatMutasi.mock.calls.some((call) => call[1].itemId === 2)).toBe(false);
    expect(tx.pemakaianMaterial.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nomor: "WIP-HP-20261022-0001",
        permintaanId: null,
        divisiId: 1,
        sumber: "HASIL_PRODUKSI",
        hasilProduksiHarianId: 10,
        items: {
          create: [
            expect.objectContaining({
              itemId: 2,
              permintaanBarangItemId: null,
              hasilProduksiHarianItemId: 102,
              jumlahDiterima: 45,
              jumlahDipakai: 0,
              jumlahSisa: 45,
              satuan: "pcs",
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
        pemakaianMaterialItemId: 10,
        fromLocationId: 3,
        type: "PRODUCTION",
        quantity: 30,
      }),
    );

    expect(tx.pemakaianMaterialItem.updateMany.mock.calls.map((call) => call[0])).toEqual([
      {
        where: { id: 10, jumlahSisa: { gte: 30 } },
        data: { jumlahSisa: { decrement: 30 }, jumlahDipakai: { increment: 30 } },
      },
      {
        where: { id: 11, jumlahSisa: { gte: 20 } },
        data: { jumlahSisa: { decrement: 20 }, jumlahDipakai: { increment: 20 } },
      },
    ]);
    const links = tx.hasilProduksiPemakaian.create.mock.calls.map((call) => call[0].data);
    expect(links).toEqual([
      { hasilProduksiHarianItemId: 101, pemakaianMaterialItemId: 10, jumlah: 30 },
      { hasilProduksiHarianItemId: 101, pemakaianMaterialItemId: 11, jumlah: 20 },
    ]);
    expect(links.reduce((total, row) => total + row.jumlah, 0)).toBe(50);
  });

  it("HASIL non-SM tetap mencatat mutasi stok gudang", async () => {
    await createHasilProduksi({
      divisiId: 1,
      items: [
        { itemId: 1, tipe: "MASUK", jumlah: 5 },
        { itemId: 4, tipe: "HASIL", jumlah: 5 },
      ],
    });

    expect(stokMock.catatMutasi).toHaveBeenCalledTimes(1);
    expect(stokMock.catatMutasi.mock.calls[0][1]).toMatchObject({
      itemId: 4,
      tipe: "MASUK",
      jumlah: 5,
      sumberHasilProduksiItemId: 102,
    });
    expect(tx.pemakaianMaterial.create).not.toHaveBeenCalled();
  });

  it("WIP kurang: tidak menyimpan header/mutasi dan membuat request otomatis", async () => {
    wipRows = [{ id: 10, jumlahSisa: 3, jumlahDipakai: 0 }];

    await expect(
      createHasilProduksi(
        {
          divisiId: 1,
          tanggalProduksi: new Date("2026-10-22T00:00:00+07:00"),
          items: [
            { itemId: 1, tipe: "MASUK", jumlah: 5 },
            { itemId: 2, tipe: "HASIL", jumlah: 4 },
          ],
        },
        42,
      ),
    ).rejects.toMatchObject({
      code: "WIP_KURANG",
      dataKekurangan: {
        divisiId: 1,
        itemId: 1,
        jumlahMasuk: 5,
        wipTersedia: 3,
        kekurangan: 2,
      },
      permintaanBarang: permintaanOtomatis,
    });

    expect(tx.hasilProduksiHarian.create).not.toHaveBeenCalled();
    expect(stokMock.catatMutasi).not.toHaveBeenCalled();
    expect(tx.pemakaianMaterialItem.updateMany).not.toHaveBeenCalled();
    expect(permintaanMock.createPermintaan).toHaveBeenCalledWith(
      expect.objectContaining({
        tanggal: new Date("2026-10-21T17:00:00.000Z"),
        tanggalDibutuhkan: new Date("2026-10-21T17:00:00.000Z"),
        departemen: "Buffing",
        divisiPemintaId: 1,
        divisiApproverId: 1,
        namaPeminta: "Budi",
        sumber: "HASIL_PRODUKSI",
        autoKey: "HP:1:1:1:2026-10-22",
        items: [
          {
            itemId: 1,
            nama: "Item 1",
            spesifikasi: null,
            jumlah: 2,
            satuan: "pcs",
          },
        ],
      }),
    );
  });

  it("request otomatis gagal tetap tidak menyimpan produksi dan membawa pesan jelas", async () => {
    wipRows = [];
    permintaanMock.createPermintaan.mockRejectedValue(new Error("gudang menolak"));

    await expect(
      createHasilProduksi({
        divisiId: 1,
        items: [
          { itemId: 1, tipe: "MASUK", jumlah: 5 },
          { itemId: 2, tipe: "HASIL", jumlah: 4 },
        ],
      }),
    ).rejects.toMatchObject({
      code: "WIP_KURANG",
      permintaanBarang: null,
      permintaanError: "gudang menolak",
    });

    expect(tx.hasilProduksiHarian.create).not.toHaveBeenCalled();
  });

  it("menerima jumlah hasil yang tidak sebanding dengan jumlah input", async () => {
    await createHasilProduksi({
      divisiId: 1,
      items: [
        { itemId: 1, tipe: "MASUK", jumlah: 4 },
        { itemId: 2, tipe: "HASIL", jumlah: 5 },
      ],
    });

    expect(tx.hasilProduksiHarian.create).toHaveBeenCalled();
    expect(tx.pemakaianMaterialItem.updateMany).toHaveBeenCalledWith({
      where: { id: 10, jumlahSisa: { gte: 4 } },
      data: { jumlahSisa: { decrement: 4 }, jumlahDipakai: { increment: 4 } },
    });
  });

  it("menolak tanpa input atau tanpa output", async () => {
    const tanpaInput = createHasilProduksi({
      divisiId: 1,
      items: [{ itemId: 2, tipe: "HASIL", jumlah: 5 }],
    });
    const tanpaOutput = createHasilProduksi({
      divisiId: 1,
      items: [{ itemId: 1, tipe: "MASUK", jumlah: 5 }],
    });
    await expect(tanpaInput).rejects.toBeInstanceOf(HasilProduksiError);
    await expect(tanpaOutput).rejects.toBeInstanceOf(HasilProduksiError);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("menolak item yang sama punya baris MASUK dan KELUAR", async () => {
    await expect(
      createHasilProduksi({
        divisiId: 1,
        items: [
          { itemId: 1, tipe: "MASUK", jumlah: 4 },
          { itemId: 2, tipe: "HASIL", jumlah: 2 },
          { itemId: 1, tipe: "KELUAR", jumlah: 2 },
        ],
      }),
    ).rejects.toMatchObject({ code: INPUT_TIDAK_VALID });

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("mengunci item sebelum membaca WIP dan tidak memakai stok gudang", async () => {
    await createHasilProduksi({
      divisiId: 1,
      items: [
        { itemId: 1, tipe: "MASUK", jumlah: 5 },
        { itemId: 2, tipe: "HASIL", jumlah: 5 },
      ],
    });

    expect(stokMock.lockItem).toHaveBeenCalledWith(expect.anything(), 1);
    expect(stokMock.lockItem.mock.invocationCallOrder[0]).toBeLessThan(
      tx.$queryRaw.mock.invocationCallOrder[0],
    );
    expect(String(tx.$queryRaw.mock.calls[0][0])).toContain("FOR UPDATE");
    expect(stokMock.getSaldo).not.toHaveBeenCalled();
  });

  it("gagal jika saldo WIP berubah saat update dan tidak mencatat mutasi", async () => {
    updateCount = 0;

    await expect(
      createHasilProduksi({
        divisiId: 1,
        items: [
          { itemId: 1, tipe: "MASUK", jumlah: 5 },
          { itemId: 2, tipe: "HASIL", jumlah: 5 },
        ],
      }),
    ).rejects.toThrow("berubah saat produksi disimpan");

    expect(tx.hasilProduksiPemakaian.create).not.toHaveBeenCalled();
    expect(stokMock.catatMutasi).not.toHaveBeenCalled();
  });

  it("mengulang nomor otomatis saat P2002 nomor", async () => {
    let percobaan = 0;
    prismaMock.$transaction.mockImplementation(async (fn: (client: any) => unknown) => {
      percobaan += 1;
      if (percobaan === 1) {
        throw Object.assign(new Error("duplicate"), {
          code: "P2002",
          meta: { target: ["nomor"] },
        });
      }
      tx = buatTx();
      return fn(tx);
    });

    const hasil = await createHasilProduksi({
      divisiId: 1,
      items: [
        { itemId: 1, tipe: "MASUK", jumlah: 5 },
        { itemId: 2, tipe: "HASIL", jumlah: 5 },
      ],
    });

    expect(hasil.id).toBe(10);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
  });

  it("tidak mengulang nomor manual yang duplikat", async () => {
    prismaMock.$transaction.mockRejectedValue(
      Object.assign(new Error("duplicate"), { code: "P2002", meta: { target: ["nomor"] } }),
    );

    await expect(
      createHasilProduksi({
        nomor: "HP-20261022-0001",
        divisiId: 1,
        items: [
          { itemId: 1, tipe: "MASUK", jumlah: 5 },
          { itemId: 2, tipe: "HASIL", jumlah: 5 },
        ],
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it("menolak KELUAR jika saldo tidak cukup", async () => {
    stokMock.getSaldo.mockResolvedValue(1);

    await expect(
      createHasilProduksi({
        divisiId: 1,
        items: [
          { itemId: 1, tipe: "MASUK", jumlah: 5 },
          { itemId: 2, tipe: "HASIL", jumlah: 4 },
          { itemId: 3, tipe: "KELUAR", jumlah: 2 },
        ],
      }),
    ).rejects.toMatchObject({ code: "STOK_KURANG" });

    expect(tx.hasilProduksiHarian.create).not.toHaveBeenCalled();
    expect(stokMock.catatMutasi).not.toHaveBeenCalled();
  });
});

describe("getHasilProduksiById", () => {
  it("menyertakan konsumsi WIP pada detail produksi", async () => {
    prismaMock.hasilProduksiHarian.findUnique.mockResolvedValue(null);

    await getHasilProduksiById(10);

    const args = prismaMock.hasilProduksiHarian.findUnique.mock.calls[0][0] as {
      include: { items: { include: { pemakaian: unknown; pemakaianMaterialItem: unknown } } };
    };
    expect(args.include.items.include.pemakaian).toEqual({
      select: {
        id: true,
        jumlah: true,
        pemakaianMaterialItem: {
          select: {
            id: true,
            pemakaian: {
              select: {
                tanggal: true,
                divisi: { select: { id: true, nama: true } },
              },
            },
          },
        },
      },
    });
    expect(args.include.items.include.pemakaianMaterialItem).toEqual({
      select: {
        id: true,
        jumlahDiterima: true,
        jumlahDipakai: true,
        jumlahSisa: true,
        satuan: true,
        pemakaian: {
          select: {
            id: true,
            nomor: true,
            tanggal: true,
            sumber: true,
            divisi: { select: { id: true, nama: true } },
          },
        },
      },
    });
  });

  it("memetakan hasil WIP ke wipMasuk", async () => {
    const wipMasuk = {
      id: 50,
      jumlahDiterima: 5,
      jumlahDipakai: 0,
      jumlahSisa: 5,
      satuan: "pcs",
      pemakaian: {
        id: 9,
        nomor: "WIP-HP-20261022-0001",
        tanggal: new Date("2026-10-21T17:00:00.000Z"),
        sumber: "HASIL_PRODUKSI",
        divisi: { id: 1, nama: "Buffing" },
      },
    };
    prismaMock.hasilProduksiHarian.findUnique.mockResolvedValue({
      id: 10,
      nomor: "HP-20261022-0001",
      tanggalProduksi: new Date("2026-10-21T17:00:00.000Z"),
      divisiId: 1,
      keterangan: null,
      createdAt: new Date("2026-10-21T17:00:00.000Z"),
      updatedAt: new Date("2026-10-21T17:00:00.000Z"),
      divisi: { id: 1, nama: "Buffing" },
      items: [
        {
          id: 102,
          hasilProduksiHarianId: 10,
          itemId: 2,
          tipe: "HASIL",
          jumlah: 5,
          keterangan: null,
          createdAt: new Date("2026-10-21T17:00:00.000Z"),
          item: item(2),
          stokMutasi: null,
          pemakaian: [],
          pemakaianMaterialItem: wipMasuk,
        },
      ],
    });

    const result = await getHasilProduksiById(10);

    expect(result?.items[0]).toMatchObject({ wipMasuk });
    expect(result?.items[0]).not.toHaveProperty("pemakaianMaterialItem");
  });
});
