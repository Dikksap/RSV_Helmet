# TODO — Jadwal Distribusi (ScheduleTab + buildSchedule)

Tiga keluhan:
1. Jadwal hasil edit kadang tidak sesuai master produksi.
2. Selisih per tahap (Buffing, Base Coat, …) vs kapasitas produksi sebagai acuan target.
3. Tambah item di tanggal yang sama malah menambah row baru, harusnya masuk ke row tanggal itu.

Akar masalah #1 & #3: override ditambal **setelah** `buildSchedule` selesai
(`applyScheduleEdits`), bukan dipakai **saat** menyusun jadwal.

Keputusan:
- Pin manual = kurangi antrean auto (`sisa = qtyMaster − Σ pin`), total terjadwal selalu = master.
- Over-allocation (Σ pin > qtyMaster) → tolak `409`.
- Acuan selisih = `totalKapasitas` tersimpan di tab Kapasitas Produksi.

---

## Fase 1 — Backend: override dikonsumsi `buildSchedule`

- [x] **1. `backend/src/model/production-order/schedule.ts` — param `overrides`**
      Param ke-7 opsional: `overrides: { targets?: Map<string, number>;
      allocs?: Map<number, Map<string, number>> }` (key target = `tanggal|stage`).
      Default `{}` → semua call site lama tetap utuh.
      Selesai: `ScheduleOverrides` + param ke-7 ditambahkan; `npm run build` hijau.
      (Belum dipakai sampai poin 2–4 beres.)

- [x] **2. Target override masuk loop accrual (`schedule.ts:208-216`)**
      Nilai pin menggantikan `rate`, tetap `Math.min(rate, c.demand - c.cum)`
      → clamp ke sisa demand. `c.cum += t[c.key]` tetap berjalan normal.
      Selesai: loop accrual disatukan; pin dihormati kapan pun (Minggu /
      hari fixed / sebelum `mulai`) tanpa kehilangan aturan auto.
      `npm run build` hijau, 14 test lama hijau.

- [x] **3. Alloc pin: antrean auto dibangun dari sisa (`schedule.ts:175-177`)**
      `sisa = Math.max(0, qtyMaster − Σ pin variant)`.
      Variant sudah di-`allocateTakes` skip lewat `q.sisa > 0`.
      Selesai: antrean TopCoat dipotong pin (total = master, tanpa kelebihan);
      `stageQueues` sengaja tetap qty penuh agar rincian tahap SPK tak kekurangan
      unit yang dipin. `npm run build` + 14 test hijau.

- [x] **4. Alloc pin: sisipkan baris per tanggal, di dalam loop hari**
      Format sama seperti baris lanjutan (`:278-283`): stage semua 0,
      `size`/`item` dari meta variant, `jumlah = qty pin`, `variantId` benar.
      Tanggal yang belum punya baris sama sekali → sintesis head
      (pindahkan logika `controller/production-order.ts:272-284` ke sini).
      Jumlah pin ikut `allocatedToday` supaya `stall` / `hariProduksi` benar.
      Selesai: pass sisip **setelah** loop + ekor bulan, lalu `rows.sort`
      stabil (pin tanggal di awal rentang tidak menabrak urutan).
      Semantik pin = **set eksklusif**: `allocateTakes` sekarang menerima
      `blocked(tanggal)` sehingga auto dilarang menaruh variant yang dipin di
      tanggal itu (kalau tidak hasilnya numpuk dua kali), dan pin qty 0 = 1 hari
      tanpa variant itu → dialokasikan ke hari lain, bukan menghilang.

- [x] **5. Fix `hariProduksi++` ganda (`schedule.ts:269` vs `:276`)**
      Hapus `hariProduksi++` di `:276` (yang di `:269` sudah cukup).
      Saat ini hari produksi dihitung 2×.
      Selesai: bukan lagi penghitung inkremental. `hariProduksi` dihitung dari
      rows akhir (`tanggal` unik dengan `jumlah > 0`) — sekaligus menghitung
      hari pin yang jatuh di luar loop, dan tak lagi menghitung hari "Selesai".
      `npm run build` + 14 test hijau untuk poin 2–5.

- [x] **6. `backend/src/controller/production-order/production-order.ts` — `getScheduleHandler`**
      Susun Map dari `targetEdits` / `allocEdits` lalu umpan ke `buildSchedule`.
      Selesai: `toOverrides(targetEdits, allocEdits)` (key `tanggal|stage`, dan
      variantId → tanggal → qty) diambil **sebelum** `buildSchedule`.

- [x] **7. Hapus `applyScheduleEdits` (`:253-295`)**
      Bersama: hapus blok recompute meta (`:226-232`) dan `HARI_ID` (`:248`)
      kalau sudah tak terpakai. Meta + `rincian` kini benar by construction
      → tab SPK otomatis sinkron dengan tabel Jadwal.
      Selesai: `applyScheduleEdits` + `HARI_ID` + recompute meta dihapus;
      meta datang langsung dari `buildSchedule`.
      Bonus: budget alokasi dipisah dari rencana tahap (`topCoatCap` per hari).
      Dulu budget = `t.topCoat` yang sudah diakru duluan → unit yang diblok pin
      menghabiskan budget dan sisa antrean tak pernah terpakai (dialokasikan
      kurang dari master). Tahap tanpa baris kapasitas juga tetap baca pin-nya.
      `npm run build` + 103 test hijau (test endpoint override disesuaikan:
      pin memindahkan alokasi, bukan menguranginya → meta 10/0).

- [x] **8. `saveScheduleAllocEdit` — `mode: "set" | "add"`**
      File `backend/src/model/production-order/production-order.ts:387-414`.
      `set` (default) = `next = qty`; `add` = `next = pinExisting + qty`.
      Select `items: { variantId, qty }`; kalau
      `Σ pin variant lain + next > qtyMaster` → lempar error `409`
      (`Total alokasi X melebihi qty master Y`).
      Selesai: `mode` param ke-5 (default `"set"`), cek total pakai
      `aggregate` pin variant lain (tanggal ≠ hari ini) + `next`;
      error `code: "E409"`.

- [x] **9. `saveScheduleAllocHandler` — parse + validasi `mode`**
      Terima `mode` dari body, default `"set"`, tolak nilai di luar
      `"set" | "add"` dengan `400`.
      Selesai: `mode` undefined → `"set"`, selain itu wajib `set`/`add`
      (400), `E409` → 409 dengan pesan dari model.

- [x] **10. `saveScheduleTargetEdit` — pastikan aman untuk override**
      Kunci edit target = `tanggal|stage` tetap sama; cukup konfirmasi
      bentuk kunci yang dikirim `getScheduleHandler` identik dengan
      key Map yang dibuat di Fase 1.
      Selesai: `getScheduleTargetEdits` mengembalikan `dayKey(r.tanggal)`
      ("YYYY-MM-DD") + `stage` yang di-`validate` terhadap `SCHEDULE_STAGES`
      (nilai sama dengan `StageKey`); sama dengan kunci `${tanggal}|${c.key}`
      di loop accrual. Alloc pun sama (`dayKey` + `variantId`).

## Fase 2 — Frontend: selisih per tahap

- [x] **11. `frontend/src/components/PlanProduction/ScheduleTab.tsx` — fetch kapasitas**
      `reload()` masukkan `getProductionCapacities(orderId)` ke `Promise.all`
      → state `capacities` (type `ProductionCapacity`).
      Selesai: promise ke-3 ditambahkan, state `capacities`.

- [x] **12. `useMemo` `stageStats`**
      `acuan[stage] = Σ c.totalKapasitas` (mapping nama tahap → key kolom
      pakai `stageKeyOf` dari `components/PlanProduction/utils.ts:94`);
      `terjadwal[stage] = Σ r[stage]` atas seluruh rows (baris lanjutan
      stage-nya sudah 0, aman dijumlah); `selisih = terjadwal − acuan`.
      Selesai: `stageStats` = array per `STAGE_COLS` `{ acuan, terjadwal, delta }`.

- [x] **13. `<tfoot>` "Total · selisih vs kapasitas"**
      Per tahap tampilkan angka terjadwal + Δ berwarna:
      `Δ > 0` merah (melebihi kapasitas), `Δ < 0` sky (kapasitas menganggur),
      `Δ = 0` hijau.
      Selesai: footer 13 kolom (colSpan 3 + 7 tahap + colSpan 3), hanya dirender
      kalau `capacities.length > 0` (tanpa acuan, Δ tak ada artinya).

## Fase 3 — Frontend: tambah item merge ke row tanggal itu

- [x] **14. Hapus filter variant yang sudah ada (`ScheduleTab.tsx:476-480`)**
      Inline "+ Tambah item" harus bisa memilih variant yang sudah ada di
      tanggal itu, agar bisa menambah ke row yang sama.
      Selesai: `.filter(... !d.items.some(...))` dihapus dari select inline.

- [x] **15. `submitAddAlloc` + `submitAddExtra` kirim `mode: "add"`**
      EditableCell (edit sel jumlah) tetap tanpa `mode` = `"set"`.
      Selesai: dua form kirim `mode: "add"`; EditableCell + `removeAlloc`
      tetap tanpa mode (`set`).

- [x] **16. `frontend/src/api/productionOrders.ts` — `saveScheduleAlloc`**
      Body tambah `mode?: "set" | "add"`.
      Selesai: tipe body diperluas.

## Fase 4 — Tes & validasi

- [ ] **17. `backend/tests/production-schedule.test.ts`**
      Kasus baru (pure function, tanpa DB):
      - target override terpakai + clamp ke sisa demand;
      - alloc pin → variant tidak muncul 2× dan `Σ jumlah per variant == qtyMaster`;
      - pin di tanggal kosong → head baris disintesis;
      - `hariProduksi` == jumlah tanggal dengan `jumlah > 0` (tidak ke-dobel).
      Test lama wajib tetap hijau (signature lama tak berubah, default `{}`).

- [ ] **18. Tes model/endpoint alloc `mode`**
      `mode: "add"` menjumlah benar; over-allocation → `409`.
      Ikuti pola mock prisma test produksi order terdekat.

- [ ] **19. Validasi backend**
      `cd backend && npm run build && npm test`

- [ ] **20. Validasi frontend**
      `cd frontend && npx tsc -b`
      `cd frontend && npx eslint src/components/PlanProduction/ScheduleTab.tsx src/api/productionOrders.ts`

## Manual check (setelah server jalan)

- [ ] Edit master (qty/priority) setelah jadwal pernah di-edit → jumlah per
      variant di tabel Jadwal tetap = master, tak ada row ganda.
- [ ] Tambah item via inline + ext di tanggal yang sudah ada → qty **bertambah**,
      bukan menimpa, dan tetap satu row per (tanggal, variant).
- [ ] Footer selisih: totalkah tahap sama dengan Σ kolom di tabel.
- [ ] Tab SPK setelah edit target → angka per tahap ikut berubah.
- [ ] KPI "Hari produksi" = jumlah tanggal produksi, bukan 2×.
