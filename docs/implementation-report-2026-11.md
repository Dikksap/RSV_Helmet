# Laporan Implementasi — Production Flow, Material Consumption & Finished Goods Traceability

**Project:** RSV_Helmet (backend)
**Tanggal:** 9 November 2026 (Asia/Jakarta)
**Branch:** `inventory_movement`
**Basis:** audit `docs/audit-material-traceability-2026-11.md` + verifikasi ulang kode aktual saat implementasi

> **Status eksekusi:** seluruh validasi dijalankan. Database development Docker (`backend-db-1`, `express_api`) **dapat dijangkau lewat container**; kedua migration **sudah diterapkan** (66/66, `migrate status` = up to date) setelah backup, Prisma Client di-generate ulang, API di-restart, dan alur end-to-end diuji pada data nyata (§9). Database produksi tidak disentuh.

---

## 1. Implemented Architecture

Alur final yang diterapkan:

```
ProductionOrder / ProductionOrderItem / schedule        (rencana, tidak menyentuh stok)
        │
        ▼
POST /api/hasil-produksi-harian                          (SATU jalur posting produksi)
  header: divisi, tanggal bisnis, routingStageId, bomId, idempotencyKey, orderId?
  baris MASUK : konsumsi lot WIP  → HasilProduksiPemakaian + InventoryMovement(out)
  baris HASIL : output WIP/Item   → lot baru + InventoryMovement(in)
                output varian     → lot sisa 0 + unit Barang + InventoryMovement per unit
        │
        ▼
InventoryMovement + StockBalance                          (SATU ledger tulis)
        │
        ▼
Barang (unit + QR) ──► scan/PATCH FINISHGOOD ──► konfirmasi lolos QC + finishGoodAt
        │
        ▼
GET /api/reports/{finished-goods/summary | material-consumption | traceability | reconciliation}
```

Perubahan arsitektur kunci:

1. **HP kanonik.** `HasilProduksiHarian` kembali diekspos sebagai satu-satunya jalur posting produksi. `ProduksiHarian` (PH) diblokir untuk posting baru, tetap dapat dibaca untuk histori, dan tabelnya tidak dihapus.
2. **Satu ledger tulis.** `InventoryMovement` + `StockBalance` menjadi satu-satunya ledger. `StokItemMutasi` dibekukan (read-only, tidak dihapus, tidak menerima penulisan baru dari kode aplikasi).
3. **Proyeksi `Item.stok` satu penulis.** `Item.stok` hanya digeser oleh gerakan **satu arah** di `createMovement` (masuk saja/keluar saja). Transfer dua lokasi tidak mengubah total. `catatMutasi` tidak lagi mengubah `Item.stok`.
4. **Lot WIP terlihat di ledger.** Penerimaan material ke divisi kini memposting debit gudang sumber + kredit lot WIP di lokasi divisi dalam satu transaksi (`receiveItemToDivision`), sehingga `PemakaianMaterialItem.jumlahSisa` dan `StockBalance` tidak lagi menjadi dua saldo paralel.
5. **FINISHGOOD = konfirmasi QC.** Scan/PATCH FINISHGOOD tidak memerlukan `QualityInspectionLine`/QC PASS, tidak mengonsumsi material, dan mengisi `Barang.finishGoodAt` sekali (write-once).
6. **Output varian pada HP.** Baris `HASIL` dapat membawa `productVariantId`; baris seperti itu menghasilkan unit `Barang` + QR yang tertaut ke baris produksi (`Barang.hasilProduksiHarianItemId`), dan lotnya dibuat dengan `jumlahSisa = 0` agar tidak ada stok ganda item vs unit.
7. **BOM dibekukan per transaksi.** HP menyimpan `bomId` dan `routingStageId`, sehingga kebutuhan teoretis historis dapat direproduksi setelah BOM berubah.

### Keputusan yang menyimpang dari draf (dan alasannya)

| Draf | Implementasi | Alasan |
|---|---|---|
| "Output tahap akhir **wajib** ProductVariant" | Varian **wajib berada di tahap terakhir** bila dikirim; baris HASIL tanpa varian tetap sah sebagai output WIP/Item (SM) | Routing seed berakhir di Top Coat yang masih menghasilkan item `SM`; memaksa varian akan memutus seluruh alur WIP yang ada. Kemampuan sudah tersedia, penerapannya bertahap lewat konfigurasi routing. |
| `itemId` dievaluasi menjadi nullable | `itemId` **tetap wajib** | Output varian tetap punya item fisik nyata (mis. Top Coat `SM0001`). Tidak ada Item dummy; membuat `itemId` nullable justru melemahkan integritas relasi tanpa manfaat. |
| Sediakan endpoint administrasi routing "jika perlu" | `GET`/`PUT /api/quality/routings` diaktifkan | HP menolak divisi tanpa routing; tanpa endpoint tulis, routing hanya bisa diubah lewat seed/DB. |
| Idempotency "semua endpoint posting" | Wajib pada `POST /api/hasil-produksi-harian`; movement-level idempotency untuk penerimaan/pemakaian/scan; PM belum punya kunci dokumen | PM belum punya kolom kunci; pengaman ganda dicegah lewat idempotency movement `pemakaian-receipt:<lotId>` + validasi saldo. |

---

## 2. Database Changes

Migration yang dibuat (aditif, tanpa `DROP`):

| Migration | Isi |
|---|---|
| `20261109120000_hp_canonical_and_fg_traceability` | kolom + index + FK baru + backfill `finishGoodAt` dari `RiwayatBarang` |
| `20261109130000_finishgood_view_uses_transition_date` | `ViewBarangFinishgoodPerBulan` memakai `finishGoodAt` (fallback `tanggal`) |

### Model & field baru

| Model | Field | Tipe | Tujuan |
|---|---|---|---|
| `HasilProduksiHarian` | `routingStageId` | `Int?` FK `ProductionRoutingStage` RESTRICT | identitas tahap (satu divisi bisa >1 stage) |
| | `bomId` | `Int?` FK `Bom` RESTRICT | BOM yang dipakai (histori teoretis) |
| | `idempotencyKey` | `String? @unique` | anti double-submit |
| `HasilProduksiHarianItem` | `productVariantId` | `Int?` FK `ProductVariant` RESTRICT | output tahap akhir |
| `Barang` | `hasilProduksiHarianItemId` | `Int?` FK `hasil_produksi_harian_item` RESTRICT | tautan unit → output produksi |
| | `finishGoodAt` | `DateTime?` | waktu pertama FINISHGOOD (write-once) |
| `InventoryMovement` | `hasilProduksiHarianItemId` | `Int?` FK RESTRICT | referensi baris HP pada ledger |

### Relasi dua arah yang ditambahkan

`ProductVariant.hasilProduksiItems`, `Bom.hasilProduksiHarian`, `ProductionRoutingStage.hasilProduksiRuns`, `HasilProduksiHarianItem.barangDihasilkan` + `inventoryMovements`, `Barang.hasilProduksiHarianItem`, `InventoryMovement.hasilProduksiHarianItem`.

### Index

`hasil_produksi_harian(idempotencyKey)` unique, `(routingStageId)`, `(bomId)`, `hasil_produksi_harian_item(productVariantId)`, `Barang(hasilProduksiHarianItemId)`, `Barang(finishGoodAt)`, `InventoryMovement(hasilProduksiHarianItemId)`, `Item(jenis)`, `RiwayatBarang(status, tanggal)`.

Index yang menopang FK memakai nama `_fkey` sesuai konvensi MariaDB agar tidak muncul sebagai drift.

### Backfill

`Barang.finishGoodAt` diisi dari `MIN(RiwayatBarang.tanggal)` untuk transisi `FINISHGOOD` pertama. Unit tanpa baris histori tetap `NULL` (legacy/unlinked) — **tidak** ditebak.

---

## 3. Backend Changes

### Route baru / diaktifkan

| Method | Endpoint | Auth | Handler |
|---|---|---|---|
| POST | `/api/hasil-produksi-harian` | role `produksi`/`admin`/`gudang` + `authorize` (scope divisi) | `createHasilProduksiHandler` |
| GET | `/api/hasil-produksi-harian` | idem | `listHasilProduksiHandler` |
| GET | `/api/hasil-produksi-harian/:id` | idem | `getHasilProduksiHandler` |
| GET | `/api/quality/routings` | `QUALITY_VIEW`/`QUALITY_INSPECT`/`BOM_KELOLA` | `listRoutingsHandler` |
| PUT | `/api/quality/routings` | `QUALITY_ROUTING_MANAGE`/`BOM_KELOLA` | `replaceRoutingHandler` |
| POST | `/api/inventory/movements/:id/reverse` | `INVENTORY_ADJUST` | `reverseInventoryMovementHandler` |
| GET | `/api/reports/finished-goods/summary` | `BARANG_STATISTIK_LIHAT`/`INVENTORY_VIEW`/`QUALITY_VIEW` | `getFinishedGoodsSummaryHandler` |
| GET | `/api/reports/material-consumption` | idem | `getMaterialConsumptionHandler` |
| GET | `/api/reports/traceability` | idem | `getTraceabilityHandler` |
| GET | `/api/reports/reconciliation` | idem | `getReconciliationHandler` |

Catatan tambahan (integrasi frontend): `PUT /api/quality/routings` menerima `routingId` opsional untuk memversionkan satu lineage routing saja (tanpa menonaktifkan routing aktif lain), dan `GET /api/items/:id/stok` menerima `sumber=LEGACY|INVENTORY` untuk memisahkan kartu histori legacy dari baris ledger lokasi.

File baru: `src/routes/hasil-produksi-harian.ts`, `src/routes/reports.ts`, `src/controller/hasilProduksiHarian/`, `src/controller/reports/`, `src/model/bom/resolver.ts`, `src/model/reports/{genealogy,reports}.ts`.

### Perubahan model/Service

| File | Perubahan |
|---|---|
| `model/hasilProduksiHarian/hasilProduksiHarian.ts` | ditulis ulang: routing resolver ketat, BOM snapshot, `productVariantId`, unit generation, idempotency, ledger-only (tanpa L1), `listHasilProduksi`/`getHasilProduksiById` |
| `model/produksiHarian/produksiHarian.ts` | posting baru diblokir (`PH_DINONAKTIFKAN`, 409) kecuali `PRODUKSI_HARIAN_POSTING=true`; baca tetap |
| `model/inventory/inventory.ts` | proyeksi `Item.stok` otomatis untuk gerakan satu arah; `receiveItemToDivision`; `getItemStockTotal`; guard reversal (`MOVEMENT_HAS_DEPENDENCY`) |
| `model/stokItem/stokItem.ts` | `catatMutasi` deprecasi (tidak lagi menulis `Item.stok`); `getSaldo` ditandai legacy |
| `model/stokOpname/stokOpname.ts` | opname memakai `StockBalance` + `InventoryMovement` ADJUSTMENT di lokasi default; menolak item tanpa lokasi default |
| `model/pemakaianMaterial/pemakaianMaterial.ts` | setiap lot baru langsung diposting ke ledger divisi (idempoten per lot); update/delete diblokir bila sudah punya ledger |
| `model/barang/barang.status.ts` | ditulis ulang: row lock, validasi status master, `finishGoodAt` write-once, idempoten, tanpa QC PASS |
| `model/barang/barang.ts` | `bulkScanBarang` memakai jalur status tunggal (tidak ada logika ganda) |
| `model/bom/bom.ts` | BOM yang sudah direferensikan transaksi produksi tidak boleh diubah item/versinya (`BOM_TERKUNCI`, 409); perbaikan tipe akibat relasi baru |
| `model/bom/resolver.ts` | **baru**: resolver BOM efektif (isActive + berlakuMulai/Selesai), anti-ambigu, ekspansi bertingkat + scrap, deteksi siklus |
| `model/quality/routing.ts` | resolver routing + `replaceActiveRouting` (versi baru, bukan update in-place) |
| `model/production-order/production-order.ts` | saran realisasi memakai `finishGoodAt` + status yang sah (OUT tidak diusulkan) |
| `controller/stokItem/stokItem.ts` | seluruh endpoint stok item memakai ledger lokasi; riwayat gabungan legacy+inventory (id negatif = inventory) |
| `controller/inventory/inventory.ts` | handler reversal |
| `controller/barang/{status,scan}.controller.ts` | meneruskan `userId` ke audit trail |

### Permission

Tidak ada permission baru yang dibuat. Endpoint HP memakai role yang sudah ada (`produksi`, `admin`, `gudang`) + `authorize` untuk scope divisi, konsisten dengan `/api/produksi-harian`. Endpoint laporan memakai permission yang sudah ada. Routing memakai `QUALITY_ROUTING_MANAGE` (sudah ada di tabel `Permission` dari migration lama) atau `BOM_KELOLA`.

---

## 4. Inventory Changes

- **Sumber kebenaran saldo:** `StockBalance` per `(item|barang × batch × lot × lokasi)`, dibentuk hanya oleh `InventoryMovement`.
- **L1 dibekukan:** tidak ada lagi pemanggil `catatMutasi` untuk ledger item (`StokItemMutasi`) di `src/`; kolom dan tabel tetap ada. `Item.stok` tidak lagi ditulis oleh L1.
- **Proyeksi:** `Item.stok` bergerak otomatis setiap gerakan satu arah (masuk/keluar) di `createMovement`; transfer tidak mengubah total. `GET /api/items/:id/stok` mengembalikan total `StockBalance` (bukan `Item.stok`).
- **Penerimaan material:** `POST /api/pemakaian-material` kini memposting penerimaan gudang → lokasi divisi (debit/kredit) **hanya pada catatan pertama per (divisi,item)** — karena `jumlahDiterima` adalah saldo berjalan, bukan kuantitas terima — lalu memposting pemakaian manual (`jumlahDipakai`) sebagai OUT di lokasi divisi. Idempotency per lot (`pemakaian-receipt:<lotId>`, `pemakaian-usage:<lotId>`). Setelah punya ledger, dokumen pemakaian tidak dapat diedit/dihapus (koreksi lewat reversal/adjustment).
- **WIP:** lot tetap `PemakaianMaterialItem`; konsumsi HP mengurangi `jumlahSisa` **dan** memposting movement keluar, jadi saldo lot dan ledger selalu bergerak bersama.
- **Reversal:** `POST /api/inventory/movements/:id/reverse` membuat movement `REVERSAL` (movement asli tidak dihapus), menolak double reverse (`reverse:<id>` + `reversalOfId` unik), menolak movement produksi/adjustment (`MOVEMENT_HAS_DEPENDENCY`).
- **Idempotency:** `InventoryMovement.idempotencyKey` unik (sudah ada) + `assertSameMovement`; HP memakai `production-consume:<header>:<lot>`, `production-wip:*`, `production-stock:*`, `production-unit:*`, `pemakaian-receipt:*`.

---

## 5. Production Flow (HP)

```
POST /api/hasil-produksi-harian
 1. validasi input (idempotencyKey wajib 8–191 char; item/tahun/tipe/jumlah)
 2. idempotency: cari header dengan key sama
      → payload sama: kembalikan dokumen lama (200/201, tanpa transaksi baru)
      → payload beda: 409 IDEMPOTENCY_CONFLICT
 3. transaksi:
    a. work order (opsional) → FOR UPDATE, harus IN_PROGRESS, divisi cocok
    b. divisi + lokasi divisi
    c. item & varian divalidasi
    d. routing: cocokkan input/output ke tepat satu stage aktif; simpan routingStageId
       (tidak ada routing / >1 kecocokan → ROUTING_INVALID)
    e. varian hanya boleh di stage terakhir
    f. BOM: resolve BOM efektif per varian pada tanggal bisnis; simpan bomId bila tunggal
       (tidak ada/tidak berlaku → BOM_NOT_FOUND / BOM_NOT_EFFECTIVE; ambigu → BOM_AMBIGU)
    g. lock item (urut) + lock baris lot WIP (FOR UPDATE)
    h. MASUK: validasi total jumlahSisa; potong FIFO; tulis HasilProduksiPemakaian + movement
    i. KELUAR: validasi saldo lokasi divisi; movement keluar
    j. create header + items
    k. HASIL SM non-varian: lot baru (sisa = jumlah) + movement masuk
       HASIL non-SM non-varian: movement masuk stok item
       HASIL varian: lot baru (dipakai = jumlah, sisa = 0) + generate unit Barang + movement per unit
```

Output: `HasilProduksiHarian` dengan `routingStageId`, `bomId`, `idempotencyKey`, `orderId?`; baris dengan `productVariantId` + `barangDihasilkan`.

---

## 6. Barang dan FINISHGOOD

- **Pembuatan Barang:** dua jalur — (a) otomatis dari HP untuk baris HASIL ber-varian, tertaut `hasilProduksiHarianItemId`; (b) `POST /api/barang/generate` untuk kebutuhan cetak label/legacy (tanpa tautan produksi).
- **QR:** tetap `kodeBarang` unik (`BC{batch}-{variant}-{DDMMYY}-{urut}`), `ProductionBatch` tetap batch label (bukan lot produksi).
- **Scan FINISHGOOD = konfirmasi QC:** `PATCH /api/barang/:id/status` dan `POST /api/barang/scan/bulk` memvalidasi barang+status master+transisi+authorization, mengunci baris, menulis `RiwayatBarang`, mengisi `finishGoodAt` bila kosong. **Tidak ada** query/ketergantungan QC PASS.
- **Scan berulang:** unit yang sudah FINISHGOOD mengembalikan `alreadyFinishGood: true` tanpa update, tanpa histori baru, tanpa mengubah `finishGoodAt`. Unit legacy FINISHGOOD tanpa timestamp diisi sekali tanpa menggandakan histori.
- **OUT/RETUR:** hanya mengubah status; `finishGoodAt` tidak dihapus/digeser sehingga laporan periode asal tetap benar.
- **Scan tidak** membuat Barang, mengonsumsi material, membuat lot, atau memposting movement konsumsi.

---

## 7. Reporting

| Endpoint | Sumber data | Catatan |
|---|---|---|
| `GET /api/reports/finished-goods/summary?from&to[&productId&variantId&orderId&status]` | output: `HasilProduksiHarianItem` HASIL; FG: `Barang.finishGoodAt`; reject/repair: `WipReject`/`WipRejectRepairAttempt` | `gapProductionVsFinishGood`; OUT/RETUR/BAD dilaporkan terpisah dan tidak mengurangi FG historis |
| `GET /api/reports/material-consumption?basis=FINISHGOOD\|PRODUKSI&...` | actual: genealogi lot (`HasilProduksiPemakaian`); theoretical: `explodeVariantBom` | variance + %, `comparisonStatus`, flag `LOT_TIDAK_LENGKAP`/`BOM_TIDAK_LENGKAP`/`BOM_NOT_FOUND` |
| `GET /api/reports/traceability?kodeBarang\|barangId\|(from&to)` | Barang → line HP → lot → material daun | `materialsPerUnit`, riwayat status, `LEGACY_UNLINKED`/`LOT_TIDAK_LENGKAP` |
| `GET /api/reports/reconciliation?from&to` | output vs Barang vs bucket status + WIP + legacy | bucket saling eksklusif; `produced`/`generated` sebagai pembanding, bukan penjumlahan |

**Alokasi (sesuai §9 brief):** untuk 1 lot output, konsumsi run dibagi proporsional terhadap total output run; unit FG yang tertaut ke lot mengalokasikan `unitLeaves × jumlah unit`. Unit yang belum/tidak FG tidak dialokasikan ke FG, tidak dihapus, dan masuk bucket WIP/reject/unscanned. Material setengah jadi yang diproduksi tidak pernah menjadi daun, sehingga tidak dihitung dua kali; laporan per tahap tetap tersedia lewat basis PRODUKSI.

---

## 8. Migration

| Migration | Dibuat | Diuji | Diterapkan |
|---|---|---|---|
| `20261109120000_hp_canonical_and_fg_traceability` | ✅ | ✅ pada DB development Docker (backup lebih dulu) | ✅ lokal (`backend-db-1`, `express_api`) |
| `20261109130000_finishgood_view_uses_transition_date` | ✅ | ✅ view di-query ulang | ✅ lokal |

Bukti: `prisma migrate status` → **66 migrations, Database schema is up to date**. Kolom baru terverifikasi lewat `information_schema`; backfill `finishGoodAt` mengisi **5.035 / 5.035** unit berstatus FINISHGOOD (sesuai 5.035 baris `RiwayatBarang` FINISHGOOD), dan `ViewBarangFinishgoodPerBulan` mengembalikan agregat per bulan.

`prisma migrate diff --from-schema prisma/schema.prisma --to-config-datasource` **tidak** melaporkan tabel/kolom baru sebagai selisih. Drift yang tersisa hanya index penopang FK lama (`InventoryMovement.userId`, `ProduksiHarian.userId`, `QualityRejectReason.createdById`, `StockAdjustment.batchId/locationId`, `StockBalance.locationId`) yang **sudah ada sebelum perubahan ini** dan bukan bagian dari migration baru.

**Database produksi tidak disentuh.**

---

## 9. Testing Results

Dijalankan pada environment ini:

| Validasi | Hasil |
|---|---|
| `npx prisma format` | ✅ |
| `npx prisma validate` | ✅ `The schema at prisma\schema.prisma is valid` |
| `npx prisma generate` | ✅ Prisma Client 7.9.1 (perlu akses penuh karena sandbox memblokir spawn engine) |
| `npm run build` (tsc) | ✅ tanpa error |
| `npm test` | **659 tes / 50 file: 633 lulus, 26 gagal** |
| `prisma migrate deploy` (DB development Docker) | ✅ 2 migration diterapkan, 66/66 up to date |
| Migration + backfill pada DB nyata | ✅ `finishGoodAt` 5.035/5.035 unit FINISHGOOD |
| `npm run verify:reports` (integrasi) | ✅ 4 laporan berjalan pada data nyata |
| `npm run verify:e2e` (integrasi) | ✅ HP → transfer → HP varian → Barang → FINISHGOOD → traceability |

**26 kegagalan adalah pre-existing** dan sudah ada sebelum perubahan: diukur pada baseline sebelum edit → **632 tes, 606 lulus, 26 gagal** di 3 file:
`tests/permintaan-approval-stok.test.ts` (15), `tests/permintaan-barang.test.ts` (10), `tests/inventory-model.test.ts` (1).
Tidak ada kegagalan baru; jumlah tes naik 632 → 659 (+27) dengan suite baru.

Test baru: `tests/bom-resolver.test.ts` (7), `tests/genealogy.test.ts` (7), `tests/finishgood-scan.test.ts` (9), `tests/pemakaian-receipt.test.ts` (2), `tests/routing-replace.test.ts` (4), `tests/hasil-produksi-harian-model.test.ts` (18, ditulis ulang), `tests/stok-item.test.ts` (16, ditulis ulang + filter `sumber`), `tests/stok-opname-model.test.ts` (3, ditulis ulang), `tests/bom-model.test.ts` (+1 kasus BOM terkunci). Test lama yang terdampak (`barang`, `retired-workspace-api`, `quality-routes`, `inventory-routes`, `pemakaian-guard-produksi`) diperbarui.

### Uji integrasi pada database development Docker

Dijalankan di `backend-api-1` terhadap `express_api` (bukan produksi):

| Uji | Hasil |
|---|---|
| `npm run verify:reports` (`scripts/smoke-reports.ts`) | ✅ 4 laporan berjalan pada data nyata: FG summary (produksi 476, FINISHGOOD-periode 615, REGISTER 105, legacy 125), konsumsi material basis FINISHGOOD (0 baris + warning `LEGACY_UNLINKED`/`LOT_TIDAK_LENGKAP` karena unit legacy tanpa tautan), basis PRODUKSI (12 baris material + variance), rekonsiliasi (bucket per varian, WIP 8 item, legacy 125), traceability (unit legacy → `LEGACY_UNLINKED`, unit baru → dokumen HP) |
| `npm run verify:e2e` (`scripts/e2e-hp-finishgood.ts`) | ✅ HP Decal Solid (stage 3) → 1 lot + 2 movement; idempotency mengembalikan dokumen yang sama; transfer WIP ke Top Coat; HP Top Coat (stage 4 akhir, `bomId=17`) → lot `sisa 0`, 1 unit `Barang` varian 17; scan FINISHGOOD → `finishGoodAt` terisi, scan kedua `alreadyFinishGood=true` dengan timestamp sama, histori FINISHGOOD tepat 1 baris; traceability unit → `E2E-HP-TOPCOAT-1`, stage `TOP_COAT`, BOM versi 1, material daun `RAW020 x2.17`, `SM0025 x0.015`, tanpa flag |
| Routing menolak kombinasi salah | ✅ percobaan `SM0029 → SM0001` (routing berbeda) ditolak `ROUTING_INVALID` |
| Backfill `finishGoodAt` | ✅ 5.035/5.035 unit FINISHGOOD terisi dari histori |
| Drift schema vs DB | ⚠️ hanya index FK lama (pra-perubahan); tabel/kolom baru tidak muncul sebagai selisih |

Catatan: `verify:e2e` menulis data uji berlabel `E2E-*` ke DB development (dokumen HP `E2E-HP-DECAL-1`, `E2E-HP-TOPCOAT-1`, transfer `TW-20261109-0001`, unit `Barang` id 5161) sebagai bukti; backup pra-migration tersimpan di `%TEMP%\express_api_pre_hp_20261109.sql`.

Yang **belum** diuji: konkurensi dua operator pada DB nyata, pemulihan backup, dan cutover produksi.

---

## 10. Remaining Issues

1. ~~Migration belum diterapkan~~ → **sudah diterapkan & diuji pada DB development Docker** (66/66). Database produksi belum disentuh dan cutover belum dilakukan.
2. **Saldo legacy belum direkonsiliasi.** `Item.stok` masih membawa selisih baseline lama (migration lama menetapkan `stok = L1 + WIP`); setelah cutover selisih itu konstan dan harus disetujui sebagai saldo pembuka. Belum ada opening movement otomatis. Smoke test menunjukkan akibatnya: 125 unit legacy `LEGACY_UNLINKED` dan laporan konsumsi basis FINISHGOOD belum dapat mengalokasikan unit lama.
3. **Seed lama tidak lagi cocok dengan alur baru.** `prisma/seed-item.ts` memanggil `setApproval(..., null)` tanpa `targetWarehouseId` (wajib) → seed gagal; `seed-production-flow.ts` membuat lot WIP tanpa penerimaan ledger sehingga posting HP bisa gagal `INSUFFICIENT_STOCK`. Keduanya perlu diperbarui sebelum dipakai.
4. **Drift index FK lama** (6 index `_fkey` yang belum dideklarasikan di schema) masih ada. Tidak terkait perubahan ini dan tidak memblokir, tetapi membuat `migrate diff` mengembalikan exit 2.
5. **`ProductionWorkOrder` masih tanpa penulis**, sehingga `orderId`/`productionWorkOrderId` di HP praktis selalu `null`.
6. **Frontend `/produksi-harian`** masih memposting ke PH yang sekarang 409; halaman produksi perlu diarahkan ke HP (tidak diubah pada tahap ini sesuai batasan).
7. **`QualityInspectionLine`/final inspection** tetap tidak diekspos — sesuai keputusan FINISHGOOD-via-scan. Kode QC lama dibiarkan untuk fungsi repair/reject.
8. **Laporan reject/repair tidak dapat difilter per varian** (data reject tercatat per lot Item) — dilaporkan 0 + warning, bukan ditebak.
9. **Legacy FINISHGOOD tanpa tautan** tetap `LEGACY_UNLINKED` (125 unit tanpa tautan produksi pada snapshot ini; 5.035 unit lain punya `finishGoodAt` dari histori).
10. **Pre-existing failing tests** (26) tidak diperbaiki karena berada di luar scope dan menyangkut perilaku approval permintaan yang sudah berbeda dari test lama.
11. **`ProduksiHarian` (PH)** masih menyimpan data dan endpoint baca; keputusan migrasi/penghapusan belum diambil.
12. **BOM varian seed belum lengkap** (hanya 1 komponen Top Coat), sehingga theoretical vs actual pada varian dilaporkan `BOM_TIDAK_LENGKAP` — data BOM perlu dilengkapi sebelum variance bisnis dipakai sebagai KPI.

---

## 11. Deployment Instructions

### Development Docker (yang dipakai project ini)

Stack: `backend-api-1` (API `tsx watch`, `prisma generate` saat start), `backend-db-1` (MariaDB, host port 3307), `backend-redis-1`, `backend-phpmyadmin-1`. `DATABASE_URL` memakai host `db`, jadi perintah Prisma dijalankan lewat container.

```powershell
cd backend
npm run docker:up            # bila container belum jalan
npm run db:status            # 66 migrations, harus "up to date"
npm run db:migrate:deploy    # terapkan migration yang belum ada (non-interaktif)
docker restart backend-api-1 # agar Prisma Client baru + kode baru dimuat
npm run verify:reports
npm run verify:e2e
```

> Status saat laporan ini dibuat: kedua migration **sudah diterapkan** ke `express_api` lokal (66/66 up to date) dan `verify:reports` + `verify:e2e` lulus. Perintah di atas dipakai untuk environment lain/reproduksi.

### Produksi

```bash
# 1. Backup (wajib, dan uji restore)
mysqldump -u root -p --single-transaction --routines --triggers express_api > backup_express_api_$(date +%Y%m%d_%H%M).sql

# 2. Snapshot baseline
#    SELECT status, COUNT(*) FROM Barang GROUP BY status;
#    SELECT itemId, locationId, SUM(quantity) FROM StockBalance GROUP BY 1,2;
#    SELECT itemId, SUM(jumlahSisa) FROM PemakaianMaterialItem GROUP BY 1;
#    SELECT tipe, SUM(jumlah) FROM StokItemMutasi GROUP BY 1;
#    SELECT COUNT(*) FROM hasil_produksi_harian; SELECT COUNT(*) FROM ProduksiHarian;

# 3. Terapkan migration + generate (jangan migrate dev/reset)
npx prisma migrate deploy
npx prisma generate

# 4. Build & test
npm run build && npm test

# 5. Restart service (Docker prod / pm2 / systemd)

# 6. Verifikasi
#    GET /api/reports/finished-goods/summary?from=...&to=...
#    GET /api/reports/reconciliation?from=...&to=...   (cek warning LEGACY_UNLINKED)
#    POST /api/hasil-produksi-harian (idempotencyKey unik) pada divisi ber-routing
#    scan FINISHGOOD 1 unit → finishGoodAt terisi; scan ulang → alreadyFinishGood
```

### Rollback
1. **Aplikasi:** deploy ulang image/commit sebelumnya. Kode lama tetap dapat membaca schema baru karena semua kolom nullable.
2. **Database:** jangan `migrate reset`. Buat migration maju yang menghapus kolom/FK baru **setelah** memastikan tidak ada data produksi baru yang bergantung padanya; kolom `finishGoodAt` dan tautan unit sebaiknya dipertahankan (aditif, tidak mengganggu kode lama).
3. **Pemulihan penuh:** restore backup langkah 1, lalu deploy versi sebelumnya. Backup pra-migration sesi ini: `%TEMP%\express_api_pre_hp_20261109.sql` (dev).

### Feature gate
`PRODUKSI_HARIAN_POSTING=true` mengaktifkan kembali posting PH (default mati). Gunakan hanya untuk keadaan darurat operasional; menyalakannya kembali membuat dua jurnal untuk proses yang sama.
