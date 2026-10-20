import { describe, expect, it } from "vitest";
import {
  batalKirim,
  catatKasusRepair,
  kirimBatok,
  putuskanQc,
  terimaBatok,
  ubahRepair,
  type AlurState,
  type HasilAlur,
  type RepairBaru,
} from "./alur";
import { gabungWip, totalRejectFinal, totalSelesai, totalTransit, totalWip, type PosisiWip } from "./data";

const posisi = (over: Partial<PosisiWip> = {}): PosisiWip => ({
  id: 1,
  itemKode: "ITM-BTK-PTH",
  itemNama: "Batok Putih",
  posisi: "Buffing",
  status: "Menunggu Proses Berikutnya",
  jenis: "NORMAL",
  jumlah: 100,
  sejak: "2026-10-20",
  ...over,
});

const state = (wip: PosisiWip[]): AlurState => ({ wip, transfers: [], repairs: [], keputusanQc: [] });

const harus = (res: HasilAlur): AlurState => {
  if (!res.state) throw new Error(res.error ?? "Mutasi gagal tanpa pesan.");
  return res.state;
};

const repairQc = (jumlah = 10): RepairBaru => ({
  tanggalPemeriksaan: "2026-10-20",
  itemKode: "ITM-BTK-PTH",
  itemNama: "Batok Putih",
  jenisCacat: "Cat belang",
  divisiPenyebab: "Base Coat",
  sumber: "QC",
  posisiAsal: "QC",
  jumlah,
  prosesDiulang: "Base Coat",
  catatan: "",
});

const repairInternal = (jumlah = 10): RepairBaru => ({
  ...repairQc(jumlah),
  divisiPenyebab: "Buffing",
  sumber: "INTERNAL",
  posisiAsal: "Buffing",
  prosesDiulang: "Buffing",
});

const keSelesai = (awal: AlurState, baik: number, reject: number) => {
  let s = awal;
  s = harus(ubahRepair(s, s.repairs[0].id, "SEDANG_REPAIR", 0, 0, "BELUM"));
  s = harus(ubahRepair(s, s.repairs[0].id, "MENUNGGU_QC", 0, 0, "BELUM"));
  s = harus(ubahRepair(s, s.repairs[0].id, "SELESAI", baik, reject, "BELUM"));
  return s;
};

describe("perpindahan", () => {
  it("1. kirim 100 Buffing → Base Coat tidak mengubah total WIP", () => {
    const awal = state([posisi({ jumlah: 100 })]);
    const s = harus(kirimBatok(awal, { tanggal: "2026-10-20", itemKode: "ITM-BTK-PTH", itemNama: "Batok Putih", asal: "Buffing", tujuan: "Base Coat", dikirim: 100, catatan: "" }));
    expect(totalWip(s.wip, s.transfers)).toBe(100);
    expect(totalTransit(s.transfers)).toBe(100);
    expect(totalWip(awal.wip, awal.transfers)).toBe(100);
  });

  it("2. menerima 100 unit memindahkan saldo ke tujuan tanpa menggandakan WIP", () => {
    const s0 = harus(kirimBatok(state([posisi()]), { tanggal: "2026-10-20", itemKode: "ITM-BTK-PTH", itemNama: "Batok Putih", asal: "Buffing", tujuan: "Base Coat", dikirim: 100, catatan: "" }));
    const s = harus(terimaBatok(s0, s0.transfers[0].id, 100));
    expect(totalWip(s.wip, s.transfers)).toBe(100);
    expect(totalTransit(s.transfers)).toBe(0);
    expect(gabungWip(s.wip).filter((w) => w.posisi === "Base Coat").reduce((n, w) => n + w.jumlah, 0)).toBe(100);
  });

  it("3. menerima dokumen yang sama dua kali ditolak", () => {
    const s0 = harus(kirimBatok(state([posisi()]), { tanggal: "2026-10-20", itemKode: "ITM-BTK-PTH", itemNama: "Batok Putih", asal: "Buffing", tujuan: "Base Coat", dikirim: 100, catatan: "" }));
    const s = harus(terimaBatok(s0, s0.transfers[0].id, 100));
    expect(terimaBatok(s, s.transfers[0].id, 100).error).toContain("sudah diproses");
    expect(totalWip(s.wip, s.transfers)).toBe(100);
  });

  it("4. membatalkan dokumen transit mengembalikan unit tepat satu kali", () => {
    const s0 = harus(kirimBatok(state([posisi()]), { tanggal: "2026-10-20", itemKode: "ITM-BTK-PTH", itemNama: "Batok Putih", asal: "Buffing", tujuan: "Base Coat", dikirim: 100, catatan: "" }));
    const s = harus(batalKirim(s0, s0.transfers[0].id));
    expect(totalWip(s.wip, s.transfers)).toBe(100);
    expect(gabungWip(s.wip).find((w) => w.posisi === "Buffing")?.jumlah).toBe(100);
    expect(batalKirim(s, s.transfers[0].id).error).toContain("hanya untuk dokumen transit");
    expect(totalWip(s.wip, s.transfers)).toBe(100);
  });

  it("10a. mengirim dua kali permintaan yang sama tidak memotong saldo dua kali", () => {
    const s0 = harus(kirimBatok(state([posisi()]), { tanggal: "2026-10-20", itemKode: "ITM-BTK-PTH", itemNama: "Batok Putih", asal: "Buffing", tujuan: "Base Coat", dikirim: 100, catatan: "" }));
    expect(kirimBatok(s0, { tanggal: "2026-10-20", itemKode: "ITM-BTK-PTH", itemNama: "Batok Putih", asal: "Buffing", tujuan: "Base Coat", dikirim: 100, catatan: "" }).error).toContain("tidak cukup");
    expect(totalWip(s0.wip, s0.transfers)).toBe(100);
  });
});

describe("repair dari QC", () => {
  it("5. unit masuk repair tidak dihitung di dua posisi", () => {
    const awal = state([posisi({ posisi: "QC", status: "Menunggu Pemeriksaan", jumlah: 10 })]);
    const s = harus(catatKasusRepair(awal, repairQc(10)));
    expect(totalWip(s.wip, s.transfers)).toBe(10);
    expect(gabungWip(s.wip).filter((w) => w.posisi === "QC").length).toBe(0);
    expect(gabungWip(s.wip).filter((w) => w.posisi === "Base Coat" && w.jenis === "REPAIR").reduce((n, w) => n + w.jumlah, 0)).toBe(10);
  });

  it("6. hasil baik + reject akhir tidak boleh melebihi jumlah repair", () => {
    const s = harus(catatKasusRepair(state([posisi({ posisi: "QC", status: "Menunggu Pemeriksaan", jumlah: 10 })]), repairQc(10)));
    const besar = ubahRepair(harus(ubahRepair(harus(ubahRepair(s, 1, "SEDANG_REPAIR", 0, 0, "BELUM")), 1, "MENUNGGU_QC", 0, 0, "BELUM")), 1, "SELESAI", 9, 2, "BELUM");
    expect(besar.error).toContain("tidak boleh melebihi");
  });

  it("7-8. 8 unit baik menunggu QC ulang tetap WIP, lalu lulus keluar dari WIP dan jadi hasil selesai", () => {
    const s0 = harus(catatKasusRepair(state([posisi({ posisi: "QC", status: "Menunggu Pemeriksaan", jumlah: 10 })]), repairQc(10)));
    const s1 = keSelesai(s0, 8, 2);
    expect(totalWip(s1.wip, s1.transfers)).toBe(8);
    expect(gabungWip(s1.wip).find((w) => w.status === "Menunggu QC Ulang")?.jumlah).toBe(8);

    const s2 = harus(ubahRepair(s1, 1, "SELESAI", 8, 2, "LULUS"));
    expect(totalWip(s2.wip, s2.transfers)).toBe(0);
    expect(totalSelesai(s2.keputusanQc)).toBe(8);
    expect(totalRejectFinal(s2.keputusanQc, s2.repairs, s2.transfers)).toBe(2);
  });

  it("9. QC ulang reject mengeluarkan unit dari WIP dan menambah reject final", () => {
    const s0 = harus(catatKasusRepair(state([posisi({ posisi: "QC", status: "Menunggu Pemeriksaan", jumlah: 10 })]), repairQc(10)));
    const s1 = keSelesai(s0, 8, 2);
    const s2 = harus(ubahRepair(s1, 1, "SELESAI", 8, 2, "REJECT"));
    expect(totalWip(s2.wip, s2.transfers)).toBe(0);
    expect(totalSelesai(s2.keputusanQc)).toBe(0);
    expect(totalRejectFinal(s2.keputusanQc, s2.repairs, s2.transfers)).toBe(10);
  });

  it("10b. menyimpan status yang sama berulang tidak memutasi saldo", () => {
    const s0 = harus(catatKasusRepair(state([posisi({ posisi: "QC", status: "Menunggu Pemeriksaan", jumlah: 10 })]), repairQc(10)));
    const s1 = harus(ubahRepair(s0, 1, "SEDANG_REPAIR", 0, 0, "BELUM"));
    const s2 = harus(ubahRepair(s1, 1, "SEDANG_REPAIR", 0, 0, "BELUM"));
    expect(totalWip(s2.wip, s2.transfers)).toBe(totalWip(s1.wip, s1.transfers));
    expect(ubahRepair(s2, 1, "MENUNGGU_QC", 0, 0, "BELUM").error).toBeNull();

    const akhir = keSelesai(s0, 8, 2);
    const lulus = harus(ubahRepair(akhir, 1, "SELESAI", 8, 2, "LULUS"));
    const ulang = harus(ubahRepair(lulus, 1, "SELESAI", 8, 2, "LULUS"));
    expect(totalWip(ulang.wip, ulang.transfers)).toBe(0);
    expect(totalSelesai(ulang.keputusanQc)).toBe(8);
  });

  it("menolak transisi status yang tidak valid dan perubahan kuantitas setelah diproses", () => {
    const s0 = harus(catatKasusRepair(state([posisi({ posisi: "QC", status: "Menunggu Pemeriksaan", jumlah: 10 })]), repairQc(10)));
    expect(ubahRepair(s0, 1, "SELESAI", 10, 0, "BELUM").error).toContain("tidak valid");
    const s1 = keSelesai(s0, 8, 2);
    expect(ubahRepair(s1, 1, "SELESAI", 7, 3, "LULUS").error).toContain("sudah diproses");
  });
});

describe("repair internal", () => {
  it("11. repair internal tidak membuat unit hilang atau dihitung ganda", () => {
    const awal = state([posisi({ jumlah: 100 })]);
    const s1 = harus(catatKasusRepair(awal, repairInternal(10)));
    expect(totalWip(s1.wip, s1.transfers)).toBe(100);
    expect(gabungWip(s1.wip).filter((w) => w.jenis === "REPAIR").reduce((n, w) => n + w.jumlah, 0)).toBe(10);

    const s2 = keSelesai(s1, 10, 0);
    expect(totalWip(s2.wip, s2.transfers)).toBe(100);
    expect(gabungWip(s2.wip).filter((w) => w.posisi === "Buffing" && w.jenis === "NORMAL").reduce((n, w) => n + w.jumlah, 0)).toBe(100);
    expect(totalSelesai(s2.keputusanQc)).toBe(0);
  });

  it("repair internal tidak memakai QC ulang", () => {
    const s1 = harus(catatKasusRepair(state([posisi({ jumlah: 100 })]), repairInternal(10)));
    const s2 = keSelesai(s1, 10, 0);
    expect(ubahRepair(s2, 1, "SELESAI", 10, 0, "LULUS").error).toContain("tidak memakai QC ulang");
  });
});

describe("QC akhir dan total WIP", () => {
  it("keputusan QC lulus/reject mengeluarkan unit dan mencatat hasil", () => {
    const awal = state([posisi({ posisi: "QC", status: "Menunggu Pemeriksaan", jumlah: 5 }), posisi({ id: 2, posisi: "Decal", jumlah: 3 })]);
    const s = harus(putuskanQc(awal, { tanggal: "2026-10-20", itemKode: "ITM-BTK-PTH", jumlah: 5, hasil: "SELESAI", catatan: "" }));
    expect(totalWip(s.wip, s.transfers)).toBe(3);
    expect(totalSelesai(s.keputusanQc)).toBe(5);
    expect(putuskanQc(s, { tanggal: "2026-10-20", itemKode: "ITM-BTK-PTH", jumlah: 5, hasil: "SELESAI", catatan: "" }).error).toContain("antrean pemeriksaan QC");
  });

  it("12. total WIP sama dengan jumlah posisi fisik aktif tanpa tumpang tindih", () => {
    const wip = [
      posisi({ jumlah: 40 }),
      posisi({ id: 2, itemKode: "ITM-BTK-HTM", itemNama: "Batok Hitam", posisi: "Decal", jumlah: 30 }),
      posisi({ id: 3, itemKode: "ITM-BTK-HTM", itemNama: "Batok Hitam", posisi: "QC", status: "Menunggu Pemeriksaan", jumlah: 5 }),
    ];
    const transfers = [
      { id: 1, nomor: "TRF-20261020-001", tanggal: "2026-10-20", itemKode: "ITM-BTK-PTH", itemNama: "Batok Putih", asal: "Base Coat", tujuan: "Decal", dikirim: 8, diterima: null, status: "TRANSIT" as const, catatan: "" },
    ];
    const s: AlurState = { wip, transfers, repairs: [], keputusanQc: [] };
    const manual = gabungWip(wip).reduce((n, w) => n + w.jumlah, 0) + transfers.reduce((n, t) => n + t.dikirim, 0);
    expect(totalWip(s.wip, s.transfers)).toBe(manual);
    expect(manual).toBe(83);
  });
});
