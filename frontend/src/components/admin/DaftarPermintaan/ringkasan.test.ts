import { describe, expect, it } from "vitest";

import type {
  PermintaanBarangRecord,
  PermintaanItemRecord,
} from "../../../api/permintaanBarang";
import {
  kelompokkanPerDivisi,
  ringkasItem,
  TANPA_DIVISI,
} from "./ringkasan";

const item = (
  over: Partial<PermintaanItemRecord> = {},
): PermintaanItemRecord => ({
  id: 1,
  permintaanId: 1,
  itemId: null,
  nama: "Batok",
  statusKeputusan: "MENUNGGU",
  jumlahDisetujui: null,
  spesifikasi: null,
  jumlah: 5,
  satuan: "pcs",
  item: null,
  ...over,
});

const record = (
  over: Partial<PermintaanBarangRecord> = {},
): PermintaanBarangRecord => ({
  id: 1,
  noPermintaan: "PR-20261023-0001",
  tanggal: "2026-10-23",
  departemen: "Produksi",
  divisiPemintaId: null,
  divisiApproverId: null,
  divisiPeminta: null,
  divisiApprover: null,
  namaPeminta: "Budi",
  kebutuhanUntuk: "",
  prioritas: "Normal",
  tanggalDibutuhkan: null,
  alasan: "stok",
  approval: "BELUM_DISETUJUI",
  sumber: "MANUAL",
  autoKey: null,
  createdAt: "2026-10-23T00:00:00.000Z",
  updatedAt: "2026-10-23T00:00:00.000Z",
  items: [item()],
  ...over,
});

describe("kelompokkanPerDivisi", () => {
  it("mengelompokkan per divisi peminta dan menaruh tanpa divisi di akhir", () => {
    const rows = [
      record({ id: 1, divisiPeminta: null }),
      record({ id: 2, divisiPeminta: { id: 2, nama: "Buffing" } }),
      record({ id: 3, divisiPeminta: { id: 1, nama: "Assembly" } }),
      record({ id: 4, divisiPeminta: { id: 2, nama: "Buffing" } }),
    ];

    const hasil = kelompokkanPerDivisi(rows);

    expect(hasil.map((g) => g.nama)).toEqual([
      "Assembly",
      "Buffing",
      TANPA_DIVISI,
    ]);
    expect(hasil[1].permintaan.map((r) => r.id)).toEqual([2, 4]);
    expect(hasil[2].permintaan.map((r) => r.id)).toEqual([1]);
  });
});

describe("ringkasItem", () => {
  it("menjumlahkan qty disetujui dan belum per nama/spesifikasi/satuan", () => {
    const rows = [
      record({
        id: 1,
        approval: "DISETUJUI",
        items: [
          item({ id: 1, jumlah: 10, jumlahDisetujui: 8 }),
          item({ id: 2, jumlah: 3 }),
        ],
      }),
      record({
        id: 2,
        approval: "BELUM_DISETUJUI",
        items: [item({ id: 3, jumlah: 4 })],
      }),
    ];

    expect(ringkasItem(rows)).toEqual([
      {
        kunci: "Batok||||pcs",
        nama: "Batok",
        spesifikasi: "",
        satuan: "pcs",
        disetujui: 11,
        belum: 4,
        total: 15,
      },
    ]);
  });

  it("memakai jumlah diminta saat jumlah disetujui kosong dan melewati item ditolak", () => {
    const rows = [
      record({
        id: 1,
        approval: "DISETUJUI",
        items: [
          item({ id: 1, jumlah: 6, jumlahDisetujui: null }),
          item({
            id: 2,
            nama: "Lem",
            jumlah: 9,
            statusKeputusan: "DITOLAK",
          }),
        ],
      }),
    ];

    const hasil = ringkasItem(rows);

    expect(hasil).toHaveLength(1);
    expect(hasil[0]).toMatchObject({ nama: "Batok", disetujui: 6, total: 6 });
  });

  it("memisahkan satuan berbeda dan mengurutkan nama", () => {
    const rows = [
      record({
        items: [
          item({ id: 1, nama: "Lem", jumlah: 2, satuan: "kg" }),
          item({ id: 2, nama: "Batok", jumlah: 2, satuan: "pcs" }),
          item({ id: 3, nama: "Batok", jumlah: 1, satuan: "lusin" }),
        ],
      }),
    ];

    expect(ringkasItem(rows).map((r) => `${r.nama}/${r.satuan}`)).toEqual([
      "Batok/lusin",
      "Batok/pcs",
      "Lem/kg",
    ]);
  });
});
