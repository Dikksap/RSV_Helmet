import { describe, it, expect, vi, beforeEach } from "vitest";

const { tx } = vi.hoisted(() => ({
  tx: {
    pemakaianMaterial: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    pemakaianMaterialItem: { findFirst: vi.fn() },
    wipTransferAlokasi: { findFirst: vi.fn() },
  },
}));

vi.mock("../src/lib/prisma.js", () => ({
  default: {
    $transaction: (fn: (client: typeof tx) => unknown) => fn(tx),
  },
}));

import {
  deletePemakaian,
  updatePemakaian,
  PEMAKAIAN_DIPAKAI_PRODUKSI,
  PEMAKAIAN_SUMBER_INTERNAL,
  PEMAKAIAN_SUDAH_TRANSFER,
} from "../src/model/pemakaianMaterial/pemakaianMaterial.js";

const input = {
  permintaanId: 1,
  divisiId: 1,
  items: [{ permintaanBarangItemId: 1, jumlahSisa: 0 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  tx.pemakaianMaterial.findUnique.mockResolvedValue({ id: 1, sumber: "PERMINTAAN_BARANG" });
  tx.pemakaianMaterialItem.findFirst.mockResolvedValue({ id: 5 });
  tx.wipTransferAlokasi.findFirst.mockResolvedValue(null);
});

describe("guard pemakaian yang sudah dipakai produksi", () => {
  it("menolak update tanpa menghapus item", async () => {
    await expect(updatePemakaian(1, input)).rejects.toMatchObject({
      code: PEMAKAIAN_DIPAKAI_PRODUKSI,
    });

    expect(tx.pemakaianMaterialItem.findFirst).toHaveBeenCalledWith({
      where: { pemakaianId: 1, hasilProduksiPemakaian: { some: {} } },
      select: { id: true },
    });
    expect(tx.pemakaianMaterial.update).not.toHaveBeenCalled();
  });

  it("menolak delete tanpa menghapus header", async () => {
    await expect(deletePemakaian(1)).rejects.toMatchObject({
      code: PEMAKAIAN_DIPAKAI_PRODUKSI,
    });

    expect(tx.pemakaianMaterial.delete).not.toHaveBeenCalled();
  });

  it("tetap menghapus pemakaian yang belum dipakai produksi", async () => {
    tx.pemakaianMaterialItem.findFirst.mockResolvedValue(null);

    await expect(deletePemakaian(1)).resolves.toBe(true);
    expect(tx.pemakaianMaterial.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it("menolak edit/delete pemakaian internal WIP", async () => {
    tx.pemakaianMaterial.findUnique.mockResolvedValue({ id: 1, sumber: "HASIL_PRODUKSI" });

    await expect(updatePemakaian(1, input)).rejects.toMatchObject({
      code: PEMAKAIAN_SUMBER_INTERNAL,
    });
    expect(tx.pemakaianMaterial.update).not.toHaveBeenCalled();
  });

  it("menolak edit/delete pemakaian yang sudah dialokasikan transfer", async () => {
    tx.wipTransferAlokasi.findFirst.mockResolvedValue({ id: 9 });

    await expect(deletePemakaian(1)).rejects.toMatchObject({
      code: PEMAKAIAN_SUDAH_TRANSFER,
    });
    expect(tx.pemakaianMaterial.delete).not.toHaveBeenCalled();
  });
});
