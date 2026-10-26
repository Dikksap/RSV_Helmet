import { describe, expect, it } from "vitest";
import type { Item } from "../../../api/item";
import type { WipRow } from "../../../api/hasilProduksiHarian";
import {
  adaError,
  barisBaru,
  formatTanggal,
  formatWip,
  hitungKekuranganWip,
  kelompokkanItem,
  ringkasForm,
  ringkasItems,
  tampilkanBarisWip,
  tanggalJakarta,
  tanggalSaja,
  validasiInputProduksi,
  type BarisForm,
} from "./utils";

const baris = (over: Partial<BarisForm> = {}): BarisForm => ({
  ...barisBaru(),
  itemId: "1",
  jumlah: "10",
  ...over,
});

const item = (id: number, divisiId: number | null, nama = `Item ${id}`): Item => ({
  id,
  kode: `ITM-${id}`,
  nama,
  divisiId,
  unit: "pcs",
  jenis: null,
  isActive: true,
});

const wip = (over: Partial<WipRow> = {}): WipRow => ({
  itemId: 20,
  kode: "RAW020",
  nama: "Batok Mentah",
  unit: "pcs",
  jenis: "RAW",
  divisiId: 1,
  divisiNama: "Buffing",
  saldoAwal: 0,
  masuk: 0,
  keluar: 0,
  saldoAkhir: 0,
  ...over,
});

describe("validasiInputProduksi", () => {
  it("menolak form tanpa divisi dan tanpa input", () => {
    const errors = validasiInputProduksi(null, [], []);
    expect(errors.divisi).toBeTruthy();
    expect(errors.umum).toContain("minimal satu item input");
    expect(adaError(errors)).toBe(true);
  });

  it("menerima banyak input dan banyak output", () => {
    const errors = validasiInputProduksi(
      3,
      [baris({ jumlah: "10" }), baris({ itemId: "2", jumlah: "15" })],
      [baris({ jumlah: "20" }), baris({ itemId: "2", jumlah: "15" })],
    );
    expect(adaError(errors)).toBe(false);
  });

  it("menolak item yang sama dipilih berulang", () => {
    const rows = [baris(), baris({ itemId: "1" })];
    const errors = validasiInputProduksi(3, rows, [baris()]);
    expect(errors.input[rows[1]!.key]?.itemId).toContain("tidak boleh dipilih lebih dari sekali");
  });

  it("menolak form tanpa output", () => {
    const errors = validasiInputProduksi(3, [baris()], []);
    expect(errors.umum).toContain("hasil produksi");
  });

  it("memvalidasi jumlah tiap item tanpa membandingkan jumlah item berbeda", () => {
    const errors = validasiInputProduksi(3, [baris({ jumlah: "2" })], [baris({ jumlah: "20" })]);
    expect(adaError(errors)).toBe(false);
  });

  it("menolak jumlah nol, negatif, dan desimal", () => {
    for (const jumlah of ["0", "-2", "1.5", ""]) {
      const errors = validasiInputProduksi(3, [baris({ jumlah })], []);
      const key = Object.keys(errors.input)[0];
      expect(errors.input[key]?.jumlah).toBeTruthy();
    }
  });

  it("menolak baris tanpa item", () => {
    const row = baris({ itemId: "" });
    const errors = validasiInputProduksi(3, [], [row]);
    expect(errors.hasil[row.key]?.itemId).toBeTruthy();
  });

  it("mengabaikan baris yang masih kosong", () => {
    const errors = validasiInputProduksi(3, [baris()], [baris(), barisBaru()]);
    expect(adaError(errors)).toBe(false);
  });
});

describe("ringkasan", () => {
  it("menjumlahkan input dan hasil terpisah", () => {
    const input = [baris({ jumlah: "10" }), baris({ jumlah: "5" })];
    const hasil = [baris({ jumlah: "20" })];
    expect(ringkasForm(input, hasil)).toEqual({ input: 15, hasil: 20, selisih: 5 });
  });

  it("membaca jumlah Decimal yang dikirim sebagai string", () => {
    expect(
      ringkasItems([
        { tipe: "HASIL", jumlah: "12.000000" },
        { tipe: "KELUAR", jumlah: 4 },
      ]),
    ).toEqual({ hasil: 12, keluar: 4, masuk: 0 });
  });
});

describe("hitungKekuranganWip", () => {
  it("menghitung kekurangan dari total MASUK per item", () => {
    const rows = [baris({ itemId: "1", jumlah: "6" }), baris({ itemId: "1", jumlah: "5" })];
    expect(hitungKekuranganWip(rows, { 1: 10 })).toEqual([
      { itemId: 1, jumlah: 11, wip: 10, kekurangan: 1 },
    ]);
  });

  it("menganggap item tanpa saldo WIP sebagai nol", () => {
    expect(hitungKekuranganWip([baris({ itemId: "9", jumlah: "3" })], {})).toEqual([
      { itemId: 9, jumlah: 3, wip: 0, kekurangan: 3 },
    ]);
  });

  it("tidak mengembalikan item yang cukup", () => {
    expect(hitungKekuranganWip([baris({ itemId: "1", jumlah: "10" })], { 1: 10 })).toEqual([]);
  });

  it("memformat WIP dengan satuan", () => {
    expect(formatWip(1250, "pcs")).toBe("1.250 pcs");
    expect(formatWip(0, "kg")).toBe("0 kg");
  });
});

describe("kelompokkanItem", () => {
  it("memisahkan item divisi terpilih dari item lain", () => {
    const hasil = kelompokkanItem([item(2, 7), item(1, 7), item(3, 9), item(4, null)], 7);
    expect(hasil.utama.map((i) => i.id)).toEqual([1, 2]);
    expect(hasil.lain.map((i) => i.id)).toEqual([3, 4]);
  });

  it("tidak menyarankan item beda divisi sebagai output", () => {
    const hasil = kelompokkanItem([item(1, 7), item(2, 9), item(3, null)], 7);
    expect(hasil.utama.map((i) => i.id)).toEqual([1]);
  });

  it("menaruh semua item di daftar lain saat divisi belum dipilih", () => {
    const hasil = kelompokkanItem([item(2, 7), item(1, 7)], null);
    expect(hasil.utama).toEqual([]);
    expect(hasil.lain.map((i) => i.id)).toEqual([1, 2]);
  });
});

describe("tampilkanBarisWip", () => {
  it("menyembunyikan baris tanpa saldo dan mutasi saat item tidak dipilih", () => {
    expect(tampilkanBarisWip(wip(), null)).toBe(false);
  });

  it("menampilkan baris nol saat item dipilih eksplisit", () => {
    expect(tampilkanBarisWip(wip(), 20)).toBe(true);
  });

  it("tetap menampilkan baris dengan aktivitas walau saldo akhir nol", () => {
    expect(tampilkanBarisWip(wip({ saldoAwal: 5, keluar: 5 }), null)).toBe(true);
  });
});

describe("tanggal", () => {
  it("mengambil tanggal Jakarta dari ISO UTC", () => {
    expect(tanggalSaja("2026-10-21T17:00:00.000Z")).toBe("2026-10-22");
    expect(tanggalJakarta("2026-10-21T17:00:00.000Z")).toBe("2026-10-22");
  });

  it("memformat tanggal dengan zona waktu Jakarta", () => {
    expect(formatTanggal("2026-10-21T17:00:00.000Z")).toBe("22/10/2026");
  });
});
