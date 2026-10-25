import { describe, expect, it } from "vitest";

import type { StokDivisiRecord } from "../../../api/pemakaianMaterial";
import { saldoWip } from "./wip";

const stok: StokDivisiRecord[] = [
  {
    divisiId: 1,
    divisiNama: "Buffing",
    materials: [
      {
        itemId: 20,
        key: "item:20",
        nama: "Batok",
        jenis: "Bahan",
        satuan: "pcs",
        diterima: 0,
        masuk: 10,
        dipakai: 3,
        sisa: 7,
      },
    ],
  },
];

describe("saldoWip", () => {
  it("mengambil saldo berdasarkan itemId", () => {
    expect(saldoWip(stok, 1, 20)).toBe(7);
  });

  it("tidak memakai nama item sebagai fallback", () => {
    expect(saldoWip(stok, 1, 99)).toBeNull();
  });

  it("mengembalikan null untuk item tanpa master atau divisi lain", () => {
    expect(saldoWip(stok, 1, null)).toBeNull();
    expect(saldoWip(stok, 2, 20)).toBeNull();
  });
});
