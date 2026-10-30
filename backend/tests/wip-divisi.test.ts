import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/prisma.js", () => ({
  default: {
    pemakaianMaterialItem: { findMany: vi.fn() },
    hasilProduksiPemakaian: { findMany: vi.fn() },
    item: { findFirst: vi.fn() },
    divisi: { findUnique: vi.fn() },
  },
}));

import prisma from "../src/lib/prisma.js";
import { getWipRows } from "../src/model/wip/wip.js";
import { getStokPerDivisi } from "../src/model/pemakaianMaterial/pemakaianMaterial.js";

const pemakaianFindMany = vi.mocked(prisma.pemakaianMaterialItem.findMany);
const konsumsiFindMany = vi.mocked(prisma.hasilProduksiPemakaian.findMany);
const itemFindFirst = vi.mocked(prisma.item.findFirst);
const divisiFindUnique = vi.mocked(prisma.divisi.findUnique);

const item = (id: number, kode: string, nama: string, unit = "pcs") => ({
  id,
  kode,
  nama,
  unit,
  jenis: "RAW",
});

const pmi = (over: {
  id: number;
  itemId: number;
  kode: string;
  nama: string;
  divisiId: number;
  divisiNama: string;
  tanggal: string;
  diterima: number;
  dipakai: number;
  sisa: number;
  alokasi?: { jumlah: number; approvedAt: string }[];
  konsumsi?: { jumlah: number; tanggal: string }[];
}) => ({
  id: over.id,
  itemId: over.itemId,
  jumlahDiterima: over.diterima,
  jumlahDipakai: over.dipakai,
  jumlahSisa: over.sisa,
  pemakaian: {
    tanggal: new Date(over.tanggal),
    divisi: { id: over.divisiId, nama: over.divisiNama },
  },
  item: item(over.itemId, over.kode, over.nama),
  wipTransferAlokasi: (over.alokasi ?? []).map((alokasi) => ({
    jumlah: alokasi.jumlah,
    transferItem: { transfer: { approvedAt: new Date(alokasi.approvedAt) } },
  })),
  hasilProduksiPemakaian: (over.konsumsi ?? []).map((konsumsi) => ({
    jumlah: konsumsi.jumlah,
    hasilProduksiHarianItem: {
      hasilProduksiHarian: { tanggalProduksi: new Date(konsumsi.tanggal) },
    },
  })),
});

const konsumsi = (pmiId: number, jumlah: number, tanggal: string) => ({
  jumlah,
  pemakaianMaterialItemId: pmiId,
  hasilProduksiHarianItem: {
    hasilProduksiHarian: { tanggalProduksi: new Date(tanggal) },
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  pemakaianFindMany.mockResolvedValue([] as never);
  konsumsiFindMany.mockResolvedValue([] as never);
});

describe("getWipRows", () => {
  it("tanpa rentang: saldo akhir sama dengan total jumlahSisa per divisi/item", async () => {
    pemakaianFindMany.mockResolvedValue([
      pmi({ id: 1, itemId: 20, kode: "RAW020", nama: "Batok", divisiId: 1, divisiNama: "Buffing", tanggal: "2026-10-05T10:00:00+07:00", diterima: 100, dipakai: 45, sisa: 55 }),
      pmi({ id: 2, itemId: 20, kode: "RAW020", nama: "Batok", divisiId: 1, divisiNama: "Buffing", tanggal: "2026-10-07T10:00:00+07:00", diterima: 50, dipakai: 50, sisa: 0 }),
      pmi({ id: 3, itemId: 21, kode: "SM0025", nama: "Batok Jadi", divisiId: 2, divisiNama: "Base Coat", tanggal: "2026-10-08T10:00:00+07:00", diterima: 30, dipakai: 0, sisa: 30 }),
    ] as never);
    konsumsiFindMany.mockResolvedValue([
      konsumsi(1, 40, "2026-10-06T10:00:00+07:00"),
      konsumsi(2, 50, "2026-10-08T10:00:00+07:00"),
    ] as never);

    const rows = await getWipRows({});

    const batok = rows.find((row) => row.itemId === 20)!;
    expect(batok).toMatchObject({ saldoAwal: 0, masuk: 150, keluar: 95, saldoAkhir: 55 });
    const hasil = rows.find((row) => row.itemId === 21)!;
    expect(hasil).toMatchObject({ saldoAwal: 0, masuk: 30, keluar: 0, saldoAkhir: 30 });
    expect(rows.reduce((total, row) => total + row.saldoAkhir, 0)).toBe(85);
  });

  it("dengan rentang: saldo awal, masuk, keluar, dan saldo akhir per tanggal dokumen", async () => {
    pemakaianFindMany.mockResolvedValue([
      pmi({ id: 1, itemId: 20, kode: "RAW020", nama: "Batok", divisiId: 1, divisiNama: "Buffing", tanggal: "2026-10-05T10:00:00+07:00", diterima: 100, dipakai: 50, sisa: 50 }),
      pmi({ id: 2, itemId: 20, kode: "RAW020", nama: "Batok", divisiId: 1, divisiNama: "Buffing", tanggal: "2026-10-15T10:00:00+07:00", diterima: 40, dipakai: 30, sisa: 10 }),
      pmi({ id: 3, itemId: 20, kode: "RAW020", nama: "Batok", divisiId: 1, divisiNama: "Buffing", tanggal: "2026-11-02T10:00:00+07:00", diterima: 25, dipakai: 0, sisa: 25 }),
    ] as never);
    konsumsiFindMany.mockResolvedValue([
      konsumsi(1, 30, "2026-10-05T10:00:00+07:00"),
      konsumsi(2, 20, "2026-10-20T10:00:00+07:00"),
      konsumsi(3, 25, "2026-11-03T10:00:00+07:00"),
    ] as never);

    const [row] = await getWipRows({
      dari: new Date("2026-10-10T00:00:00+07:00"),
      sampai: new Date("2026-10-31T00:00:00+07:00"),
    });

    expect(row).toMatchObject({ saldoAwal: 50, masuk: 40, keluar: 30, saldoAkhir: 60 });
  });

  it("memisahkan divisi dan item yang berbeda", async () => {
    pemakaianFindMany.mockResolvedValue([
      pmi({ id: 1, itemId: 20, kode: "RAW020", nama: "Batok", divisiId: 1, divisiNama: "Buffing", tanggal: "2026-10-05T10:00:00+07:00", diterima: 10, dipakai: 0, sisa: 10 }),
      pmi({ id: 2, itemId: 20, kode: "RAW020", nama: "Batok", divisiId: 2, divisiNama: "Base Coat", tanggal: "2026-10-06T10:00:00+07:00", diterima: 20, dipakai: 0, sisa: 20 }),
      pmi({ id: 3, itemId: 21, kode: "SM0025", nama: "Batok Jadi", divisiId: 1, divisiNama: "Buffing", tanggal: "2026-10-07T10:00:00+07:00", diterima: 30, dipakai: 0, sisa: 30 }),
    ] as never);

    const rows = await getWipRows({});

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => [row.divisiId, row.itemId, row.saldoAkhir])).toEqual([
      [2, 20, 20],
      [1, 20, 10],
      [1, 21, 30],
    ]);
  });

  it("item eksplisit tanpa WIP menghasilkan baris nol; tanpa itemId tidak menambah baris nol", async () => {
    itemFindFirst.mockResolvedValue({
      id: 99,
      kode: "SM9999",
      nama: "Item Baru",
      unit: "pcs",
      jenis: "FG",
      divisi: { id: 3, nama: "Packaging" },
    } as never);

    const rows = await getWipRows({ itemId: 99 });

    expect(rows).toEqual([
      expect.objectContaining({
        itemId: 99,
        divisiId: 3,
        divisiNama: "Packaging",
        saldoAwal: 0,
        masuk: 0,
        keluar: 0,
        saldoAkhir: 0,
      }),
    ]);
    expect(itemFindFirst).toHaveBeenCalledTimes(1);
  });

  it("tanpa itemId tidak menampilkan baris nol untuk semua item", async () => {
    const rows = await getWipRows({ divisiId: 1 });

    expect(rows).toEqual([]);
    expect(itemFindFirst).not.toHaveBeenCalled();
  });

  it("meneruskan filter divisi/item dan tidak memakai StokItemMutasi", async () => {
    await getWipRows({ divisiId: 2, itemId: 21 });

    expect(pemakaianFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          itemId: 21,
          pemakaian: { divisiId: 2 },
        },
      }),
    );
    expect(konsumsiFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          pemakaianMaterialItem: {
            itemId: 21,
            pemakaian: { divisiId: 2 },
          },
        },
      }),
    );
    expect((prisma as unknown as Record<string, unknown>).stokItemMutasi).toBeUndefined();
  });

  it("getStokPerDivisi memberi angka yang sama dengan getWipRows", async () => {
    pemakaianFindMany.mockResolvedValue([
      pmi({ id: 1, itemId: 20, kode: "RAW020", nama: "Batok", divisiId: 1, divisiNama: "Buffing", tanggal: "2026-10-05T10:00:00+07:00", diterima: 100, dipakai: 50, sisa: 50 }),
      pmi({ id: 2, itemId: 20, kode: "RAW020", nama: "Batok", divisiId: 1, divisiNama: "Buffing", tanggal: "2026-10-15T10:00:00+07:00", diterima: 40, dipakai: 30, sisa: 10 }),
    ] as never);
    konsumsiFindMany.mockResolvedValue([
      konsumsi(1, 30, "2026-10-05T10:00:00+07:00"),
      konsumsi(2, 20, "2026-10-20T10:00:00+07:00"),
    ] as never);

    const params = {
      dari: new Date("2026-10-10T00:00:00+07:00"),
      sampai: new Date("2026-10-31T00:00:00+07:00"),
    };
    const [wip] = await getWipRows(params);
    const [stok] = await getStokPerDivisi(params);

    expect(stok.divisiId).toBe(wip.divisiId);
    expect(stok.materials[0]).toMatchObject({
      nama: wip.nama,
      diterima: wip.saldoAwal,
      masuk: wip.masuk,
      dipakai: wip.keluar,
      sisa: wip.saldoAkhir,
    });
  });
});
