import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/model/wip/wip.js", () => ({
  getWipRows: vi.fn(),
}));

import { getWipRows, type WipRow } from "../src/model/wip/wip.js";
import { getStokPerDivisi } from "../src/model/pemakaianMaterial/pemakaianMaterial.js";

const mockedGetWipRows = vi.mocked(getWipRows);

const wipRow = (over: Partial<WipRow>): WipRow => ({
  itemId: 1,
  kode: "RAW001",
  nama: "Kertas A4",
  unit: "rim",
  jenis: "RAW",
  divisiId: 1,
  divisiNama: "Produksi",
  saldoAwal: 0,
  masuk: 0,
  keluar: 0,
  saldoAkhir: 0,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getStokPerDivisi", () => {
  it("memakai angka helper WIP dan mengelompokkan per divisi", async () => {
    mockedGetWipRows.mockResolvedValue([
      wipRow({ itemId: 1, nama: "Kertas A4", saldoAwal: 100, masuk: 40, keluar: 70, saldoAkhir: 70 }),
      wipRow({ itemId: 2, nama: "Tinta", jenis: "CHEMICAL", saldoAwal: 5, masuk: 0, keluar: 5, saldoAkhir: 0 }),
      wipRow({ itemId: 3, nama: "Busa", unit: "pcs", divisiId: 2, divisiNama: "Buffing", saldoAwal: 10, masuk: 5, keluar: 0, saldoAkhir: 15 }),
    ]);

    const hasil = await getStokPerDivisi({
      dari: new Date(2026, 9, 1),
      sampai: new Date(2026, 9, 31),
    });

    expect(mockedGetWipRows).toHaveBeenCalledWith({
      dari: new Date(2026, 9, 1),
      sampai: new Date(2026, 9, 31),
    });
    expect(hasil.map((group) => group.divisiNama)).toEqual(["Buffing", "Produksi"]);
    const produksi = hasil.find((group) => group.divisiId === 1)!;
    expect(produksi.materials.map((material) => material.nama)).toEqual(["Kertas A4", "Tinta"]);
    expect(produksi.materials[0]).toMatchObject({
      itemId: 1,
      key: "item:1",
      diterima: 100,
      masuk: 40,
      dipakai: 70,
      sisa: 70,
      satuan: "rim",
      jenis: "RAW",
    });
  });

  it("melewati baris tanpa divisi", async () => {
    mockedGetWipRows.mockResolvedValue([
      wipRow({ divisiId: null, divisiNama: null, saldoAkhir: 9 }),
    ]);

    expect(await getStokPerDivisi()).toEqual([]);
  });
});
