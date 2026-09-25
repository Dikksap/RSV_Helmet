// Sumber: sheet "PERHITUNGAN KAPASITAS PRODUKSI" Oktober 2026.
// totalKapasitas TIDAK di sini — dihitung seed dari demand master
// (decal ikut style-nya, sisanya total order).
export const PRODUCTION_CAPACITY_OKTOBER_2026 = [
  { stage: "BUFFING", kapasitasWeekday: 288, kapasitasSabtu: 144, mulai: "2026-10-01", selesai: "2026-10-20", hariKerja: 15, catatan: "4 rak", urutan: 1 },
  { stage: "BASE COAT", kapasitasWeekday: 288, kapasitasSabtu: 144, mulai: "2026-10-01", selesai: "2026-10-20", hariKerja: 15, catatan: "4 rak", urutan: 2 },
  { stage: "DECAL SOLID", kapasitasWeekday: 208, kapasitasSabtu: 104, mulai: "2026-10-02", selesai: "2026-10-21", hariKerja: 15, catatan: null, urutan: 3 },
  { stage: "DECAL MOTIF", kapasitasWeekday: 80, kapasitasSabtu: 40, mulai: "2026-10-02", selesai: "2026-10-31", hariKerja: 22, catatan: "3 orang", urutan: 4 },
  { stage: "TOP COAT", kapasitasWeekday: 288, kapasitasSabtu: 144, mulai: "2026-10-05", selesai: "2026-10-28", hariKerja: 18, catatan: null, urutan: 5 },
  { stage: "PERAKITAN", kapasitasWeekday: 288, kapasitasSabtu: 144, mulai: "2026-10-05", selesai: "2026-10-28", hariKerja: 18, catatan: null, urutan: 6 },
  { stage: "QC", kapasitasWeekday: 288, kapasitasSabtu: 144, mulai: "2026-10-06", selesai: "2026-11-03", hariKerja: 22, catatan: null, urutan: 7 },
];
