import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/prisma.js", () => ({
  default: { pemakaianMaterialItem: { findMany: vi.fn() } },
}));

import prisma from "../src/lib/prisma.js";
import { getStokPerDivisi } from "../src/model/pemakaianMaterial/pemakaianMaterial.js";

const findMany = vi.mocked(prisma.pemakaianMaterialItem.findMany);

const row = (over: {
  nama: string;
  tanggal: string;
  diterima: number;
  dipakai: number;
  sisa: number;
  itemId?: number | null;
}) => ({
  itemId: over.itemId === undefined ? 1 : over.itemId,
  satuan: "pcs",
  jumlahDiterima: over.diterima,
  jumlahDipakai: over.dipakai,
  jumlahSisa: over.sisa,
  pemakaian: { tanggal: new Date(over.tanggal), divisi: { id: 1, nama: "Produksi" } },
  permintaanItem: { nama: over.nama, satuan: "pcs", item: { jenis: "RAW MATERIAL" } },
  item: null,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getStokPerDivisi", () => {
  it("tanpa rentang: pakai catatan terbaru per material", async () => {
    findMany.mockResolvedValue([
      row({ nama: "Kertas A4", tanggal: "2026-10-20", diterima: 90, dipakai: 20, sisa: 70 }),
      row({ nama: "Kertas A4", tanggal: "2026-10-01", diterima: 100, dipakai: 10, sisa: 90 }),
    ] as never);

    const hasil = await getStokPerDivisi();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      }),
    );
    expect(hasil).toHaveLength(1);
    expect(hasil[0].materials).toHaveLength(1);
    expect(hasil[0].materials[0]).toMatchObject({ diterima: 90, dipakai: 20, sisa: 70 });
  });

  it("dengan rentang: diterima = stok awal periode, dipakai dijumlahkan, sisa = akhir periode", async () => {
    findMany.mockResolvedValue([
      row({ nama: "Kertas A4", tanggal: "2026-10-05", diterima: 100, dipakai: 10, sisa: 90 }),
      row({ nama: "Kertas A4", tanggal: "2026-10-25", diterima: 90, dipakai: 20, sisa: 70 }),
      // material lain di divisi yang sama
      row({ nama: "Tinta", tanggal: "2026-10-20", diterima: 5, dipakai: 5, sisa: 0, itemId: 2 }),
    ] as never);

    const hasil = await getStokPerDivisi({
      dari: new Date(2026, 9, 1),
      sampai: new Date(2026, 9, 31),
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          pemakaian: {
            tanggal: { gte: new Date(2026, 9, 1), lt: new Date(2026, 10, 1) },
          },
        },
        orderBy: [{ pemakaian: { tanggal: "asc" } }, { id: "asc" }],
      }),
    );
    const perNama = Object.fromEntries(hasil[0].materials.map((m) => [m.nama, m]));
    expect(perNama["Kertas A4"]).toMatchObject({ diterima: 100, dipakai: 30, sisa: 70 });
    expect(perNama["Tinta"]).toMatchObject({ diterima: 5, dipakai: 5, sisa: 0 });
  });
});
