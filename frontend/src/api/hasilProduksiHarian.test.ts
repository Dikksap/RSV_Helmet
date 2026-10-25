import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./auth", () => ({
  authHeaders: () => ({}),
  redirectToLogin: vi.fn(),
}));

import {
  createHasilProduksiHarian,
  HasilProduksiApiError,
} from "./hasilProduksiHarian";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("hasilProduksiHarian API", () => {
  it("memetakan body 409 WIP_KURANG ke HasilProduksiApiError", async () => {
    const body = {
      message: "WIP Batok kurang.",
      kode: "WIP_KURANG",
      dataKekurangan: {
        divisiId: 1,
        divisiNama: "Buffing",
        itemId: 20,
        itemKode: "RAW020",
        itemNama: "Batok Mentah WB",
        unit: "pcs",
        jumlahMasuk: 50,
        wipTersedia: 40,
        kekurangan: 10,
      },
      permintaanBarang: {
        id: 9,
        nomor: "PR-20261022-0002",
        status: "BELUM_DISETUJUI",
        items: [
          { id: 12, itemId: 20, nama: "Batok Mentah WB", jumlah: 10, satuan: "pcs" },
        ],
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(body), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      createHasilProduksiHarian({
        divisiId: 1,
        items: [{ itemId: 20, tipe: "MASUK", jumlah: 50 }],
      }),
    ).rejects.toMatchObject({
      name: "HasilProduksiApiError",
      status: 409,
      kode: "WIP_KURANG",
      dataKekurangan: { kekurangan: 10 },
      permintaanBarang: { nomor: "PR-20261022-0002" },
    });
  });

  it("melempar instance HasilProduksiApiError untuk error non-409", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Divisi tidak ditemukan" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      createHasilProduksiHarian({
        divisiId: 99,
        items: [{ itemId: 20, tipe: "MASUK", jumlah: 1 }],
      }),
    ).rejects.toBeInstanceOf(HasilProduksiApiError);
  });
});
