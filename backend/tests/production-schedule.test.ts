import { describe, it, expect } from "vitest";
import { buildSchedule, defaultAnchors, endOfPeriode } from "../src/model/production-order/schedule.js";

const CAPS = [
  { stage: "PERSIAPAN (BUFFING + BASECOAT)", kapasitasWeekday: 288, kapasitasSabtu: 144, mulai: "2026-10-01", selesai: "2026-10-20" },
  { stage: "DECAL SOLID", kapasitasWeekday: 144, kapasitasSabtu: 72, mulai: "2026-10-02", selesai: "2026-10-21" },
  { stage: "DECAL MOTIF", kapasitasWeekday: 80, kapasitasSabtu: 40, mulai: "2026-10-02", selesai: "2026-10-30" },
  { stage: "TOP COAT + PERAKITAN", kapasitasWeekday: 288, kapasitasSabtu: 144, mulai: "2026-10-05", selesai: "2026-10-28" },
  { stage: "QC", kapasitasWeekday: 288, kapasitasSabtu: 144, mulai: "2026-10-06", selesai: "2026-10-29" },
];

const ITEMS = [
  { variantId: 1, qty: 100, priority: 1, style: "Solid", color: "A", size: "MD", sizeUrutan: 2 },
  { variantId: 2, qty: 200, priority: 1, style: "Solid", color: "A", size: "LG", sizeUrutan: 1 },
  { variantId: 3, qty: 50, priority: 2, style: "Solid", color: "B", size: "MD", sizeUrutan: 2 },
];

const PREP = ["2026-10-01", "2026-10-02", "2026-10-03"];

describe("buildSchedule", () => {
  it("hari persiapan + LIBUR Minggu sesuai contoh", () => {
    const { rows } = buildSchedule(ITEMS, CAPS, PREP, []);
    const byDate = (t: string) => rows.filter((r) => r.tanggal === t);
    expect(byDate("2026-10-01")[0]).toMatchObject({ persiapan: 288, decalSolid: 0, item: "Persiapan", jumlah: 0, jam: 7 });
    // Demand fixture: total 350, solid 300, motif 0 → fallback total.
    expect(byDate("2026-10-02")[0]).toMatchObject({ persiapan: 62, decalSolid: 144, decalMotif: 80, item: "Persiapan + Decal" });
    expect(byDate("2026-10-03")[0]).toMatchObject({ persiapan: 0, decalSolid: 72, decalMotif: 40, jam: 3.5 });
    expect(byDate("2026-10-04")[0]).toMatchObject({ item: "LIBUR", jam: 0, persiapan: 0, jumlah: 0 });
  });

  it("alokasi ikut TopCoat, urut priority lalu sizeUrutan", () => {
    const { rows, meta } = buildSchedule(ITEMS, CAPS, PREP, []);
    const day5 = rows.filter((r) => r.tanggal === "2026-10-05");
    expect(day5[0]).toMatchObject({ topCoat: 288, perakitan: 288 });
    // Solid A LG (urutan 1) dulu 200, lalu MD 88 dari 288
    expect(day5.map((r) => [r.size, r.jumlah])).toEqual([["LG", 200], ["MD", 88]]);
    expect(day5[0].item).toBe("Solid A");
    expect(meta).toMatchObject({ dialokasikan: 350, sisa: 0 });
  });

  it("hari QC fixed tanpa alokasi", () => {
    const { rows } = buildSchedule(ITEMS, CAPS, PREP, ["2026-10-06"]);
    expect(rows.filter((r) => r.tanggal === "2026-10-06")).toHaveLength(1);
    expect(rows.find((r) => r.tanggal === "2026-10-06")).toMatchObject({ item: "QC & Packing", jumlah: 0 });
  });
});

describe("demand master + akhir bebas", () => {
  it("jalan lewat window sampai demand tercapai", () => {
    const caps = [
      { stage: "PERSIAPAN", kapasitasWeekday: 288, kapasitasSabtu: 144, mulai: "2026-10-01", selesai: "2026-10-02" },
      { stage: "TOP COAT + PERAKITAN", kapasitasWeekday: 288, kapasitasSabtu: 144, mulai: "2026-10-01", selesai: "2026-10-02" },
    ];
    const items = [{ variantId: 1, qty: 1000, priority: 1, style: "S", color: "C", size: "MD", sizeUrutan: 1 }];
    const { rows, meta } = buildSchedule(items, caps, [], []);
    // 1 Okt 288 + 2 Okt 288 + 3 Okt (Sabtu) 144 + 5 Okt 280 = 1000
    expect(rows.reduce((n, r) => n + r.topCoat, 0)).toBe(1000);
    expect(rows[rows.length - 1].tanggal).toBe("2026-10-05");
    expect(meta).toMatchObject({ dialokasikan: 1000, sisa: 0 });
  });

  it("decal ikut demand style master", () => {
    const caps = [
      { stage: "DECAL SOLID", kapasitasWeekday: 1000, kapasitasSabtu: 500, mulai: "2026-10-01", selesai: "2026-10-01" },
      { stage: "DECAL MOTIF", kapasitasWeekday: 1000, kapasitasSabtu: 500, mulai: "2026-10-01", selesai: "2026-10-01" },
      { stage: "TOP COAT + PERAKITAN", kapasitasWeekday: 10000, kapasitasSabtu: 5000, mulai: "2026-10-01", selesai: "2026-10-01" },
    ];
    const items = [
      { variantId: 1, qty: 100, priority: 1, style: "Solid", color: "A", size: "MD", sizeUrutan: 1 },
      { variantId: 2, qty: 50, priority: 2, style: "Motif", color: "B", size: "MD", sizeUrutan: 1 },
    ];
    const { rows } = buildSchedule(items, caps, [], []);
    expect(rows.reduce((n, r) => n + r.decalSolid, 0)).toBe(100);
    expect(rows.reduce((n, r) => n + r.decalMotif, 0)).toBe(50);
  });

  it("topcoat tidak diakru di hari fixed", () => {
    const caps = [
      { stage: "TOP COAT + PERAKITAN", kapasitasWeekday: 288, kapasitasSabtu: 144, mulai: "2026-10-01", selesai: "2026-10-10" },
    ];
    const items = [{ variantId: 1, qty: 5000, priority: 1, style: "S", color: "C", size: "MD", sizeUrutan: 1 }];
    const { rows } = buildSchedule(items, caps, [], ["2026-10-02"]);
    expect(rows.find((r) => r.tanggal === "2026-10-02")).toMatchObject({ item: "QC & Packing", topCoat: 0 });
  });
});

describe("defaultAnchors", () => {
  it("tanpa hari fixed (ikut kapasitas + mulaiProduksi)", () => {
    expect(defaultAnchors("2026-10")).toEqual({ prepDays: [], qcDays: [] });
    expect(defaultAnchors("xx")).toEqual({ prepDays: [], qcDays: [] });
  });
});

describe("ekor akhir bulan", () => {
  // Fixture ITEMS/CAPS selesai 2026-10-07 (demand 350).
  it("penyesuaian setelah selesai, tanggal terakhir QC & Packing", () => {
    const { rows, meta } = buildSchedule(ITEMS, CAPS, PREP, [], "2026-10-31");
    expect(rows[rows.length - 1]).toMatchObject({ tanggal: "2026-10-31", item: "QC & Packing", jumlah: 0 });
    expect(rows.find((r) => r.tanggal === "2026-10-12")).toMatchObject({ item: "Penyesuaian", jumlah: 0 });
    expect(rows.find((r) => r.tanggal === "2026-10-11")).toMatchObject({ item: "LIBUR", jumlah: 0 });
    expect(meta).toMatchObject({ dialokasikan: 350, sisa: 0 });
  });
  it("tanpa akhirBulan perilaku lama (berhenti saat selesai)", () => {
    const { rows } = buildSchedule(ITEMS, CAPS, PREP, []);
    expect(rows[rows.length - 1].tanggal).toBe("2026-10-07");
  });
  it("produksi meluber: ekor sampai akhir bulan berjalannya", () => {
    const { rows } = buildSchedule(ITEMS, CAPS, PREP, [], "2026-10-05");
    expect(rows[rows.length - 1]).toMatchObject({ tanggal: "2026-10-31", item: "QC & Packing" });
  });
});

describe("endOfPeriode", () => {
  it("tanggal terakhir bulan + null bila tak valid", () => {
    expect(endOfPeriode("2026-10")).toBe("2026-10-31");
    expect(endOfPeriode("2026-02")).toBe("2026-02-28");
    expect(endOfPeriode("xx")).toBeNull();
  });
});

describe("mulaiProduksi order", () => {
  const caps = [
    { stage: "TOP COAT + PERAKITAN", kapasitasWeekday: 100, kapasitasSabtu: 50, mulai: "2026-10-01", selesai: "2026-10-31" },
  ];
  const items = [
    { variantId: 1, qty: 100, priority: 1, style: "S", color: "A", size: "MD", sizeUrutan: 1 },
  ];
  it("alokasi menunggu sampai mulaiProduksi tiba", async () => {
    const mod = await import("../src/model/production-order/schedule.js");
    const { rows, meta } = mod.buildSchedule(items, caps, [], [], null, "2026-10-06");
    expect(rows.find((r) => r.tanggal === "2026-10-01")).toMatchObject({ item: "Menunggu", jumlah: 0 });
    const day6 = rows.filter((r) => r.tanggal === "2026-10-06" && r.jumlah > 0);
    expect(day6.length).toBeGreaterThan(0);
    expect(meta).toMatchObject({ dialokasikan: 100, sisa: 0 });
  });
  it("tanpa mulaiProduksi = perilaku lama", async () => {
    const mod = await import("../src/model/production-order/schedule.js");
    const { rows } = mod.buildSchedule(items, caps, [], []);
    expect(rows[0]).toMatchObject({ tanggal: "2026-10-01", jumlah: 100 });
  });
});
