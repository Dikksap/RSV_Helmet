# Integrasi Frontend — HP, Routing, FINISHGOOD & Laporan Produksi

**Tanggal:** 9 November 2026
**Cakupan:** `frontend/` (React + Vite) dan dua penyesuaian kontrak backend
**Basis:** `docs/implementation-report-2026-11.md` (backend) + `docs/audit-material-traceability-2026-11.md`

---

## 1. Ringkasan

| Sebelum | Sesudah |
|---|---|
| Halaman `/produksi/home` memposting ke `POST /api/produksi-harian` (PH) yang kini membalas `409 PH_DINONAKTIFKAN` | Halaman memakai `POST /api/hasil-produksi-harian` (HP) dengan pilihan routing stage, baris MASUK/HASIL/KELUAR, dan ProductVariant pada tahap akhir |
| `RoutingProduksi.tsx` ada tetapi tidak dirutekan; menyimpan routing selalu mengganti semua routing aktif | Route `/admin/routing-produksi` + navigasi; ada pemilih routing dan penyimpanan per `routingId` |
| Tidak ada UI laporan konsumsi/traceability/rekonsiliasi | `/admin/laporan-produksi` (4 tab) + tab “Laporan” di halaman produksi (otomatis dibatasi divisi untuk role produksi) |
| Scan FINISHGOOD hanya “sudah status X” | Pesan menyebut waktu FINISHGOOD pertama; hasil bulk yang idempoten dilaporkan sebagai “sudah FINISHGOOD sebelumnya” |
| Riwayat stok item mencampur legacy + ledger baru | Kartu legacy memakai `?sumber=LEGACY`; kartu ledger lokasi tetap terpisah; CSV menambah kolom Sumber |
| Tidak ada aksi koreksi di ledger | Tombol reversal per movement dengan guard sumber transaksi |

---

## 2. File yang ditambahkan / diubah

### API layer (baru)

| File | Isi |
|---|---|
| `frontend/src/api/hasilProduksiHarian.ts` | Tipe payload/response HP, `createHasilProduksi`, `listHasilProduksi`, `getHasilProduksiById`, `HasilProduksiApiError`, `pesanHasilProduksi` |
| `frontend/src/api/reports.ts` | Tipe 4 laporan, `buildReportQuery`, 4 fungsi fetch, `ReportApiError`, `pesanLaporan` |

### API layer (diubah)

| File | Perubahan |
|---|---|
| `api/erp.ts` | `reverseInventoryMovement(id, reason)`; `ErpMovement` + `sourceType/sourceId/reversalOfId/reversedBy`; `saveProductionRouting(body, routingId?)` |
| `api/barang.ts` | `Barang.finishGoodAt`; `BulkScanItemResult` + `status/finishGoodAt/alreadyFinishGood` |
| `api/stokItem.ts` | `StokMutasiRecord.sumber`, `meta.truncated`, filter `sumber`, hapus helper manual yang tidak dipakai |
| `api/produksiHarian.ts` | Dipangkas menjadi endpoint baca `getStokGudang` (dipakai `Lokasi.tsx`); fungsi posting PH dihapus |

### Halaman & komponen

| File | Isi |
|---|---|
| `pages/produksi/ProduksiHome.tsx` | Ditulis ulang: tab Catat Hasil Produksi, Riwayat, Routing & BOM, Stok WIP & Gudang, Laporan |
| `components/produksi/hpForm.ts` | Logika murni: `stageOptions`, `validateHpForm`, `buildHpPayload`, `hpFormSignature`, `nextIdempotencyKey`, `expectedUnitCount` |
| `components/produksi/HasilProduksiForm.tsx` | Form HP: header, baris MASUK/HASIL/KELUAR, pemilih varian, panel error WIP/routing/BOM, panel hasil + daftar QR |
| `pages/admin/LaporanProduksi.tsx` | Halaman laporan admin |
| `components/admin/LaporanProduksi/*` | `LaporanProduksiContent`, `PeriodFilter`, `WarningsBanner`, 4 tab laporan |
| `pages/admin/RoutingProduksi.tsx` | Pemilih routing aktif + simpan per `routingId` + konfirmasi perubahan belum tersimpan |
| `pages/admin/InventoryLedger.tsx` | Kolom Sumber + aksi dan form reversal |
| `pages/admin/StokItem.tsx` | Filter `sumber=LEGACY`, peringatan `truncated`, kolom Sumber di CSV |
| `pages/public/ScanQr.tsx` | Pesan “sudah FINISHGOOD sejak …” dan hitungan `alreadyFinishGood` saat simpan |
| `components/admin/DaftarBarang/RiwayatModal.tsx` | Ringkasan FINISHGOOD pertama dihitung dari histori |
| `main.tsx` | Route `/admin/laporan-produksi`, `/admin/routing-produksi` |
| `layouts/admin/navigation.tsx` | Menu Input Hasil Produksi, Routing Produksi, Laporan Produksi |

---

## 3. Alur form HP (`/produksi/home`)

1. **Header**: tanggal (default hari ini, maksimal hari ini), divisi (terkunci untuk non-admin), tahap routing `vN · STAGE`. Bila divisi tidak punya routing, form menampilkan arahan ke halaman routing.
2. **MASUK**: item hanya dari `inputItems` stage; menampilkan sisa WIP divisi (`GET /pemakaian-material/stok-divisi`); jumlah integer.
3. **HASIL**: item dari `outputItems`; jika stage terakhir → `ProductVariant` wajib (dropdown `kodeVariant · produk style color size`); jika bukan stage terakhir opsi varian disembunyikan.
4. **KELUAR** (opsional): item aktif mana pun, tidak boleh sama dengan item MASUK.
5. **Submit** mengirim `divisiId`, `tanggalProduksi`, `routingStageId`, `idempotencyKey`, dan item MASUK/KELUAR/HASIL.
6. **Sukses**: nomor dokumen, stage, BOM versi, daftar `kodeBarang`, tombol “Scan FINISHGOOD” (`/scan-qr?status=FINISHGOOD`).
7. **Idempotensi**: key dibuat saat submit pertama, dipakai ulang hanya bila `hpFormSignature` identik (retry aman). Payload berubah → key baru, sehingga tidak berakhir `IDEMPOTENCY_CONFLICT`.

### Pemetaan error

| Kode | Tampilan |
|---|---|
| `WIP_KURANG` | Tabel item, tersedia, dibutuhkan, kurang + nomor permintaan otomatis + saran divisi transfer |
| `ROUTING_INVALID` | Pesan + arahan mengatur Routing Produksi |
| `BOM_NOT_FOUND` / `BOM_NOT_EFFECTIVE` / `BOM_AMBIGU` | Pesan spesifik + arahan melengkapi/menonaktifkan BOM |
| `IDEMPOTENCY_CONFLICT` | Pesan + minta muat ulang form |
| `INSUFFICIENT_STOCK` | Pesan + arahan periksa saldo lokasi divisi |

---

## 4. Laporan

- Filter: periode (default awal bulan–hari ini), produk, varian, divisi, item, status unit.
- **Finished Goods**: kartu total (output, FG pertama, REGISTER, gap, retur/out/bad, reject/repair, legacy) + tabel per varian.
- **Konsumsi Material**: basis `FINISHGOOD` / `PRODUKSI`, tabel theoretical vs actual, variance, %, badge `MATCH` / `TEORITIS_ONLY` / `AKTUAL_ONLY`, ringkasan kelengkapan BOM/genealogi.
- **Traceability**: cari kode QR atau tampilkan daftar unit FG periode; detail berisi dokumen HP, lot, sumber genealogi, material per unit, riwayat status, flag `LEGACY_UNLINKED`/`LOT_TIDAK_LENGKAP`.
- **Rekonsiliasi**: per varian (diproduksi vs dibuat vs FG/REGISTER/RETUR/OUT/BAD), WIP tersisa, data legacy, catatan `bucketRule`.
- `warnings[]` dari backend selalu ditampilkan (tidak disembunyikan).

---

## 5. Penyesuaian kontrak backend (kecil)

| Endpoint | Perubahan | Alasan |
|---|---|---|
| `PUT /api/quality/routings` | Body menerima `routingId?`; hanya routing itu yang dinonaktifkan lalu dibuat versi baru | Seed punya dua routing aktif (Solid & Motif). Tanpa ini, menyimpan dari UI menonaktifkan routing lain. |
| `GET /api/items/:id/stok` | Query `sumber=LEGACY|INVENTORY` | Halaman stok item memisahkan kartu histori legacy dari kartu gerakan ledger. |

Test backend terkait: `tests/routing-replace.test.ts` (4 kasus) dan tambahan kasus `sumber` di `tests/stok-item.test.ts`.

---

## 6. Validasi

| Validasi | Hasil |
|---|---|
| `npx tsc -p tsconfig.app.json --noEmit` | ✅ tanpa error |
| `npm test` (frontend) | **77 tes / 14 file: 73 lulus, 4 gagal** |
| `npm run build` (tsc + vite build) | ✅ sukses |
| `npm run build` (backend) | ✅ |
| `npm test` (backend) | **659 tes / 50 file: 633 lulus, 26 gagal** |

Kegagalan yang ada hanya **pre-existing**:

- Frontend: 4 kasus di `src/components/admin/DaftarPermintaan/approval.test.ts` (sama sebelum perubahan).
- Backend: 26 kasus di `permintaan-approval-stok` (15), `permintaan-barang` (10), `inventory-model` (1) — sudah gagal pada baseline.

Smoke test HTTP terhadap container `backend-api-1` (login admin):

- `GET /api/quality/routings` → 2 routing aktif (v2 & v1).
- `GET /api/reports/finished-goods/summary` → totals terisi + warning `LEGACY_UNLINKED`.
- `GET /api/reports/material-consumption?basis=PRODUKSI` → 3 baris + warning `BOM_TIDAK_LENGKAP`.
- `GET /api/reports/reconciliation` → 2 varian + WIP.
- `GET /api/reports/traceability?kodeBarang=BC002-WB017-091126-0001` → tanpa flag, 1 material.
- `GET /api/items/1/stok?sumber=LEGACY` → 4 baris legacy saja; `sumber=INVENTORY` → 2 baris; tanpa filter → 6 baris gabungan.

Catatan operasional: perubahan file `backend/src` **tidak selalu** ter-reload oleh `tsx watch` pada container; setelah mengubah backend, jalankan `docker restart backend-api-1` sebelum menguji UI.

---

## 7. Keterbatasan & tindak lanjut

1. Validasi visual di browser belum dilakukan dari sini (tidak ada akses browser/screenshot); yang diverifikasi adalah typecheck, unit test, production build, dan API yang dipanggil halaman.
2. `Lokasi.tsx` masih memakai endpoint baca PH (`getStokGudang`). Endpoint baca PH memang masih aktif; migrasi ke `/inventory/balances` dapat dilakukan terpisah.
3. Filter `orderId` didukung backend tetapi belum ditampilkan di UI laporan.
4. `getVariantProduk()` memuat seluruh varian untuk dropdown; bila jumlah varian tumbuh besar, tambahkan filter produk pada form.
5. `QualityControl.tsx` dan `WipFlowReport.tsx` tetap tidak dirutekan (memanggil endpoint retired) dan tidak diubah pada pekerjaan ini.
6. Data uji `E2E-*` dan unit `BC002-WB017-091126-0001` masih ada di database development sebagai bukti uji integrasi; hapus hanya jika disetujui.
