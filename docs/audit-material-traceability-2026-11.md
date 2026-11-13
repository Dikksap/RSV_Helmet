# Audit & Desain Arsitektur — Material Movement, Konsumsi Material Produksi, dan Traceability Finished Goods

**Project:** RSV_Helmet
**Tanggal audit:** 9 November 2026 (Asia/Jakarta)
**Tahap:** AUDIT SAJA — tidak ada perubahan schema, migration, endpoint, service, frontend, maupun data

> **Status lanjutan:** implementasi sudah dijalankan pada 9 November 2026. Lihat `docs/implementation-report-2026-11.md`. Dokumen ini dipertahankan sebagai catatan kondisi **sebelum** implementasi; beberapa temuan (mis. endpoint HP mati, `StokItemMutasi` sebagai ledger aktif) sudah tidak berlaku setelah implementasi.
**Basis bukti:** `backend/prisma/schema.prisma` (1.780 baris, dibaca penuh), seluruh migration di `backend/prisma/migrations/`, `backend/src/**` (route → controller → model), `backend/tests/**`, `backend/prisma/seed*.ts`, `frontend/src/api/**` (hanya untuk memastikan endpoint mana yang dipanggil UI)

> **Batas verifikasi:** audit ini statis (source of truth: schema + migration + source + test). Eksekusi shell tidak tersedia pada sesi ini (`pwsh` gagal start karena sandbox Windows tidak dapat membuat direktori temp), sehingga **`prisma validate`, `migrate status`, hitung baris tabel, dan pengecekan drift tidak dapat dijalankan**. Semua angka data historis yang dikutip di §5.2, §9.1, §11, dan §14 berasal dari catatan audit sebelumnya di `todolist.md` dan **wajib diverifikasi ulang** terhadap database yang benar sebelum cutover.

---

## Ringkasan Eksekutif

1. **Fitur "input hasil produksi" yang dimaksud pada brief (4.3) memang ada di kode, tetapi tidak lagi diekspos sebagai HTTP endpoint.** `HasilProduksiHarian` + `HasilProduksiHarianItem` (MASUK/KELUAR/HASIL) beserta seluruh logika konsumsi WIP berbasis lot ada di `backend/src/model/hasilProduksiHarian/hasilProduksiHarian.ts`, namun `backend/src/app.ts` tidak mendaftarkan router-nya dan test `backend/tests/retired-workspace-api.test.ts:16-20` justru **mengunci 404** untuk prefix tersebut.
2. **Input hasil produksi yang benar-benar hidup hari ini adalah `/api/produksi-harian`** (`backend/src/routes/produksi-harian.ts`, dipakai `frontend/src/api/produksiHarian.ts:175-185`). Jalur ini **berbasis BOM + `Item` + lokasi gudang**, tidak memiliki `ProductVariant`, tidak membentuk lot WIP divisi, dan outputnya harus `Item` yang punya `Subassembly` (`backend/src/model/produksiHarian/produksiHarian.ts:147-161`).
3. **Tidak ada satu pun transaksi *posting* produksi yang menyimpan `ProductVariant`.** `HasilProduksiHarian` hanya menyimpan `divisiId`, `orderId`, `productionWorkOrderId`; `HasilProduksiHarianItem` hanya `itemId` + `tipe`. `ProduksiHarianItem` hanya `itemId` + `tipe`. Varian hanya muncul di perencanaan, `Barang`, `Bom`, dan `QualityInspectionLine` — sedangkan satu-satunya realisasi per varian (`ProductionRealization`) diisi **manual**, bukan dari jurnal produksi.
4. **Jembatan lot → varian → unit `Barang` sudah ada di schema dan kode, tetapi endpoint-nya dihapus.** `QualityInspectionLine` memuat sekaligus `pemakaianMaterialItemId` (lot WIP), `productVariantId`, dan `producedBarang` (`schema.prisma:1556-1590`), dan `finalizeQualityInspection` membuat unit `Barang` + menautkannya ke baris inspeksi (`backend/src/model/quality/quality.ts:897-942`). Namun `POST /api/quality/final-inspections` **tidak terdaftar** (`backend/src/routes/quality.ts:16-28`, ditegaskan `backend/tests/quality-routes.test.ts:33-48`).
5. **Akibatnya, FINISHGOOD hari ini dicapai tanpa jejak produksi:** `PATCH /api/barang/:id/status` hanya mengubah `Barang.status` + menambah `RiwayatBarang` (`backend/src/model/barang/barang.status.ts:53-106`), tanpa konsumsi material, tanpa mutasi inventory, dan tanpa referensi transaksi produksi. Unit `Barang` sendiri hanya dapat lahir dari dua jalur: `POST /api/barang/generate` berstatus `REGISTER` (`backend/src/model/barang/barang.generate.ts:142-244`) atau dari QC Akhir yang endpoint-nya sudah dihapus.
6. **BOM `ProductVariant` tidak pernah dipakai untuk menghitung konsumsi.** Satu-satunya pemakaian BOM dalam transaksi adalah `flattenBom()` di `produksiHarian.ts`, yang secara eksplisit menolak BOM varian: *"Produk hasil belum punya subassembly/BOM. BOM product variant tidak dipakai."* (`produksiHarian.ts:156-161`). BOM varian hanya di-CRUD (`backend/src/model/bom/bom.ts`) dan diisi seed (`backend/prisma/seed-production-flow.ts:127-171`).
7. **Terdapat tiga angka stok yang berbeda dan tidak dapat direkonsiliasi:** `Item.stok` (kolom cache), jumlah `StokItemMutasi` (`getSaldo`), dan `StockBalance` per lokasi. Migration terakhir bahkan mendefinisikan `Item.stok = Σ StokItemMutasi + Σ PemakaianMaterialItem.jumlahSisa` (`migrations/20261101090000_add_produksi_harian/migration.sql:87-97`), sementara konsumsi WIP **tidak pernah** mengurangi `Item.stok`.
8. **Rekomendasi utama: Opsi B (Production Lot), diimplementasikan di atas entitas lot yang sudah ada — tanpa membuat tabel "Production Lot" baru dan tanpa ledger ketiga.** Lot produksi = `HasilProduksiHarian` (satu posting proses) + `PemakaianMaterialItem` (satu lot WIP yang dihasilkan/dikonsumsi) + `HasilProduksiPemakaian` (edge genealogi). Yang perlu ditambahkan hanya **dimensi varian pada output produksi**, **referensi BOM yang dipakai**, **tautan unit `Barang` ke output produksi**, dan **timestamp FINISHGOOD pertama**.

---

## 1. Current Architecture

### 1.1 Peta runtime

```
HTTP → Express (backend/src/app.ts)
        ├── authenticate → authorize → requireRole / requirePermission (backend/src/middleware/auth.ts)
        ├── route      (backend/src/routes/*.ts)
        ├── controller (backend/src/controller/**)
        └── model      (backend/src/model/**) → Prisma (backend/src/lib/prisma.ts) → MariaDB
```

Router yang benar-benar terdaftar: `backend/src/app.ts:47-77` (31 prefix). Yang **tidak** terdaftar dan tidak punya file route:

| Fitur | Model/Service | Route | Status |
|---|---|---|---|
| Hasil Produksi Harian (MASUK/KELUAR/HASIL) | `hasilProduksiHarian.ts` | tidak ada | retired, dikunci test 404 |
| Transfer WIP | `wipTransfer.ts` | tidak ada | retired, dikunci test 404 |
| QC Akhir (lot → `Barang`) | `quality.ts:finalizeQualityInspection` | tidak ada | retired, handler ada di controller tapi tak dipasang |
| Laporan QC harian / WIP flow / WIP stocktake | `quality.ts`, `wip/*` | tidak ada | retired |
| Routing produksi (tulis) | `productionRouting*` | tidak ada | hanya dibaca; ditulis seed |
| Work Order produksi | `ProductionWorkOrder` | tidak ada | tidak ada penulis sama sekali |
| Penerimaan FG, Shipment, Retur | `FinishedGoodsReceipt*`, `CustomerShipment*`, `ShipmentReturn*` | tidak ada | **dead schema** (0 referensi di `src/`) |

Bukti dead schema: pencarian `finishedGoodsReceipt|customerShipment|shipmentReturn` di `backend/src` menghasilkan 0 match, sedangkan modelnya ada di `schema.prisma:1670-1780`.

### 1.2 Dua kelompok master (sesuai brief)

| Kelompok | Model | Peran aktual (terbukti dari kode) |
|---|---|---|
| Produk jadi | `Product` → `ProductVariant` (Product×Style×Color×Size, unik) → `Barang` (unit fisik, `kodeBarang` unik = QR/barcode) | Varian dipakai di perencanaan (`ProductionOrderItem`, `ProductionRealization`), `Barang`, `Bom.productVariantId`, dan `QualityInspectionLine.productVariantId`. Status unit: `REGISTER/FINISHGOOD/RETUR/OUT/BAD`. |
| Material | `Item` (`kode` unik, `jenis` teks bebas, `unit`, `stok`) | Dipakai di BOM, routing, permintaan, pemakaian, WIP lot, ledger item, dan sebagai **satu-satunya** dimensi output produksi. |

Titik temu yang ada di schema tetapi **tidak berfungsi**:

```
ProductVariant ──1:N── Bom ──1:N── BomItem ──N:1── Item
     │                                  └──N:1── Subassembly ──1:N── Bom (BOM bertingkat)
     └──1:N── Barang (unit)
Barang ──N:1── QualityInspectionLine ──N:1── PemakaianMaterialItem (lot WIP)
QualityInspectionLine ──N:1── ProductVariant
```

Rantai di atas adalah **satu-satunya** jalur yang dapat menghubungkan material ke helm jadi, dan jalur itu terputus di HTTP layer.

### 1.3 Peta jalur produksi aktual (tiga jalur paralel)

| Jalur | Entry | Output | Dimensi varian | Lot WIP | Ledger ditulis | Status |
|---|---|---|---|---|---|---|
| **PH** — Produksi Harian | `POST /api/produksi-harian` | `Item` (wajib punya `Subassembly.itemId`) ke gudang | ❌ | ❌ (langsung `StockBalance`) | `InventoryMovement` + `Item.stok` | **hidup** |
| **HP** — Hasil Produksi Harian | service `createHasilProduksi` | `Item` non-SM → stok; `Item` jenis `SM` → lot WIP divisi | ❌ | ✅ (`PemakaianMaterialItem`) | `StokItemMutasi` (KELUAR/HASIL non-SM) + `InventoryMovement` (semua) | service hidup, **endpoint mati** |
| **FG** — Finished Goods | `POST /api/barang/generate` → `PATCH /api/barang/:id/status` / `POST /api/barang/scan/bulk` | `Barang` unit | ✅ | ❌ | tidak ada | **hidup** |

---

## 2. Existing Data Flow

### 2.1 Alur A — Input hasil produksi yang hidup (`/api/produksi-harian`)

```
POST /api/produksi-harian { divisiId, outputItemId, jumlah, tujuanLocationId, bahan[] }
  └─ role produksi|admin            (routes/produksi-harian.ts:16)
     └─ createProduksi()            (model/produksiHarian/produksiHarian.ts:472)
        1. validasi input
        2. output = Item aktif; destinasi wajib WAREHOUSE dan lolos GudangJenisItem
        3. flattenBom(outputItemId, jumlah)        ← BOM di-resolve dari Subassembly item output
             resolveActiveBom(subassemblyId)       ← where isActive, orderBy id desc  (!)
             rekursi komponen subassembly, quantity × factor × (1 + scrap%)
        4. untuk setiap baris BOM: lockItem + cek StockBalance di lokasi sumber
        5. create ProduksiHarian + ProduksiHarianItem (BAHAN…, HASIL)
        6. consumeItemAtLocation() per bahan        → InventoryMovement (PRODUCTION, from) + Item.stok -= qty
        7. postInventoryMovementInTransaction(HASIL) → InventoryMovement (PRODUCTION, to)   + Item.stok += qty
        8. commit (satu prisma.$transaction)
```

Karakteristik penting:
- **Tidak ada lot WIP.** Bahan langsung diambil dari `StockBalance` gudang/divisi.
- **Tidak ada `ProductVariant`.** Output wajib `Item` yang punya `Subassembly` (`produksiHarian.ts:152-161`).
- **Konsumsi = teoretis BOM, bukan aktual.** Jumlah bahan yang dicatat = hasil `flattenBom`; pengguna tidak dapat menyatakan pemakaian aktual yang berbeda. Variance mustahil muncul dari jalur ini.
- **Tidak idempoten.** Tidak ada `idempotencyKey`; double-submit = dua dokumen + dua konsumsi (nomor `PH-YYYYMMDD-NNNN` hanya unik, bukan kunci request).

### 2.2 Alur B — Jurnal proses per divisi (service hidup, endpoint mati)

```
createHasilProduksi({ divisiId, items: [ {tipe: MASUK|KELUAR|HASIL, itemId, jumlah} ] })
  └─ model/hasilProduksiHarian/hasilProduksiHarian.ts:435 createInTx
     1. (opsional) productionWorkOrderId → FOR UPDATE, harus IN_PROGRESS, divisi cocok
        → header.orderId diisi HANYA dari work order ini
     2. validateConfiguredProcessRoute(): input/output harus cocok ProductionRoutingStage aktif
     3. lock Item; untuk tiap baris MASUK: lockWipRows(divisi,item) FOR UPDATE
        → total jumlahSisa harus >= jumlah, else WipKurangError (+ auto-permintaan bila non-SM)
     4. untuk tiap baris KELUAR: getSaldo(item) dari StokItemMutasi harus cukup
     5. create header + items
     6. MASUK: decrement PemakaianMaterialItem.jumlahSisa / increment jumlahDipakai
               + HasilProduksiPemakaian (edge lot→konsumsi)
               + InventoryMovement (PRODUCTION, from = lokasi divisi)   [tanpa Item.stok]
     7. HASIL jenis SM: create PemakaianMaterial(sumber=HASIL_PRODUKSI, nomor WIP-<nomor>)
               + lot baru (jumlahSisa = jumlah)
               + InventoryMovement (PRODUCTION, to = lokasi divisi)     [tanpa Item.stok]
     8. HASIL non-SM + KELUAR: catatMutasi (StokItemMutasi ± Item.stok)
               + InventoryMovement (PRODUCTION, to/from = lokasi divisi)
```

**Semantik yang harus dipahami sebelum menyentuh kode ini** (dan tidak boleh diubah tanpa analisis):

| Tipe | Arti bisnis | Efek stok |
|---|---|---|
| `MASUK` | material/WIP **dipakai** proses (input) | mengurangi lot WIP divisi; **tidak** menulis `StokItemMutasi` (komentar kode: stok sudah dikurangi saat approval/pemakaian — `hasilProduksiHarian.ts:676-677`) |
| `KELUAR` | pengeluaran stok item dari divisi | `StokItemMutasi` KELUAR + `Item.stok` turun + `InventoryMovement` keluar |
| `HASIL` (jenis `SM`) | output setengah jadi → **lot WIP divisi**, bukan stok gudang | lot baru + `InventoryMovement` masuk; `Item.stok` **tidak** berubah |
| `HASIL` (non-SM) | output barang jadi/komponen ke stok | `StokItemMutasi` MASUK + `Item.stok` naik + `InventoryMovement` masuk |

Validasi input (`hasilProduksiHarian.ts:228-302`): wajib ≥1 `MASUK` dan ≥1 `HASIL`; item `MASUK` tidak boleh duplikat; satu item tidak boleh `MASUK` dan `KELUAR` sekaligus. **Tidak ada idempotency key** — hanya retry nomor saat `P2002`.

### 2.3 Alur C — Finished Goods hari ini (generate → scan)

```
POST /api/barang/generate { variantId, jumlah }        (permission BARANG_GENERATE)
  └─ generateBarangBulkInTransaction()                 (barang.generate.ts:142)
      • batch aktif (kapasitas 5000) + FOR UPDATE
      • BarangCounter (batchId, variantId, tanggal) FOR UPDATE → nomor urut
      • createMany Barang(status = REGISTER, tanggal = now, batchId)
      • RiwayatBarang "Barang dibuat" (status REGISTER)
      • ProductionBatch.totalProduksi++ ; auto SELESAI saat penuh

POST /api/barang/scan/bulk { kodeBarang[], status, keterangan? }   (BARANG_SCAN + BARANG_UBAH_STATUS)
PATCH /api/barang/:id/status { status, keterangan? }
  └─ updateBarangStatus()                              (barang.status.ts:53)
      • cek StatusTransition (kosong = semua diizinkan; status sama selalu diizinkan)
      • BEGIN: update Barang.status ; INSERT RiwayatBarang ; COMMIT
      • TIDAK ADA: konsumsi material, mutasi inventory, referensi produksi, idempotency
```

Konsekuensi: `1000 unit FINISHGOOD` hanya berarti 1000 baris `Barang` berstatus `FINISHGOOD` pada saat query. Tidak ada bukti kapan status itu dicapai, dari lot mana, atau material apa yang dipakai.

### 2.4 Alur D — Finished Goods via QC Akhir (ada di kode, tidak dapat dipanggil)

```
finalizeQualityInspection(inspectionId, inspectorId)     (quality.ts:727)
  • validasi: lot = output ProductionRoutingStage terakhir; varian wajib
  • pindahkan lot ke lokasi QC (InventoryMovement QC)
  • decrement lot.jumlahSisa sebanyak inspectedQuantity
  • passed > 0:
      InventoryMovement (QC, from lokasi QC)  ← "konversi" lot menjadi unit
      generateBarangBulkInTransaction(variantId, passed, inspection.inspectedAt)
      Barang.updateMany({ qualityInspectionLineId: line.id })   ← TAUTAN UNIT → LOT → VARIAN
      InventoryMovement per unit (QC, to lokasi QC, quantity 1)
  • repair > 0: RepairAssignment + movement ke lokasi divisi repair
```

Ini satu-satunya tempat di seluruh backend yang membuat `Barang` **dan** menautkannya ke lot produksi **dan** ke varian, dalam satu transaksi. Endpoint-nya tidak ada, sehingga satu-satunya cara memakainya saat ini adalah seed/service internal.

### 2.5 Alur material pendukung (permintaan → WIP divisi)

```
POST /api/permintaan-barang (publik)  → PermintaanBarang + items (teks bebas + itemId opsional)
PATCH /api/permintaan-barang/:id/approval (admin|gudang)
  └─ setApproval(..., targetWarehouseId)                 (permintaanBarang.ts:477)
      • WAJIB targetWarehouseId (type WAREHOUSE)         ← permintaanBarang.ts:600-609
      • moveItemStock: consumeItemAtLocation(out) + postInventoryMovement(in)
        → gudang sumber → GUDANG TUJUAN (bukan lokasi divisi peminta)
POST /api/pemakaian-material (adminOnly)                  ← routes/pemakaian-material.ts:19
  └─ createPemakaian()                                    (pemakaianMaterial.ts:233)
      • membuat PemakaianMaterial + PemakaianMaterialItem (lot WIP divisi, jumlahSisa)
      • TIDAK memposting InventoryMovement / StokItemMutasi sama sekali
```

**Ini adalah cacat integrasi paling serius di lapisan stok** (lihat P-08): material "diterima divisi" hanya hidup di `PemakaianMaterialItem`, sedangkan konsumsi produksi mendebit `StockBalance` di lokasi divisi. Kedua angka tidak pernah bertemu.

---

## 3. Database Findings

Sumber: `backend/prisma/schema.prisma`. 64 file migration (terakhir `20261103090000_add_user_is_active`).

### 3.1 Master data

| Model | Field kunci | Constraint / index | Catatan audit |
|---|---|---|---|
| `Product` (`:225`) | `nama`, `prefix` | — | `prefix` dipakai membentuk `kodeVariant`, tidak unik |
| `ProductVariant` (`:398`) | `kodeVariant` unik; `productId/styleId/colorId/sizeId`; `tanggal` | `@@unique([productId,styleId,colorId,sizeId])`, index tiap FK | Tidak ada status varian (sudah dihapus) |
| `Color` / `Size` / `Style` | `nama` unik; `Size.urutan` | — | — |
| `Item` (`:293`) | `kode` unik, `nama`, `unit` (default pcs), `jenis` (teks, nullable), `stok` Decimal(18,6), `divisiId`, `defaultInventoryLocationId` | index FK | **`jenis` tanpa enum/validasi nilai**; `stok` = cache yang ditulis dua mekanisme berbeda |
| `Divisi` (`:268`) | `nama` unik | — | 1:1 dengan `InventoryLocation` (DIVISION) |
| `Gudang` (`:336`) | `kode` unik | — | `GudangJenisItem` membatasi jenis per gudang |

Nilai `jenis` yang ada di data seed: `RAW MATERIAL`, `HABIS PAKAI`, `SM` (`backend/prisma/data/item-20261017.ts`). Validasi controller hanya membatasi panjang ≤50 (`controller/item/item.ts:42-47`), **tidak** membatasi nilai.

### 3.2 BOM & subassembly

| Model | Struktur | Temuan |
|---|---|---|
| `Bom` (`:960`) | `kode` unik?, `version` String, `isActive`, `berlakuMulai`, `berlakuSelesai`, output **tepat satu**: `productVariantId` **atau** `subassemblyId` | `@@unique([productVariantId, version])` dan `@@unique([subassemblyId, version])`. Tidak ada constraint DB yang memaksa "tepat satu output" — hanya divalidasi service (`bom.ts:256-260`) |
| `BomItem` (`:984`) | `parentBomItemId`, `level`, `itemId?`/`subassemblyId?`, `quantity` Decimal(18,6), `unit`, `scrapPercent` Decimal(5,2) | Hierarki self-relation memakai composite FK `(bomId, parentBomItemId) → (bomId, id)` (`:999`) + `@@unique([bomId,id])`. **Mendukung BOM bertingkat secara struktur.** |
| `Subassembly` (`:941`) | `kode` unik, `itemId?` **unik**, `productVariantId?` | `itemId` unik = jembatan "item WIP ↔ BOM subassembly" |

Temuan BOM:
- **Versi & masa berlaku tidak ditegakkan.** `resolveActiveBom()` memilih `where: { subassemblyId, isActive: true }, orderBy: { id: "desc" }` (`produksiHarian.ts:124-137`) — `berlakuMulai`/`berlakuSelesai` diabaikan, dan bila ada dua BOM aktif, yang menang adalah yang terakhir dibuat.
- **BOM bisa ditimpa.** `createBom` menangkap `P2002` lalu memanggil `updateBom(existing)` (`bom.ts:224-249`); `updateBom` menghapus seluruh item root (`deleteMany({ bomId, parentBomItemId: null })` + cascade anak, `bom.ts:283`). Riwayat BOM lama hilang.
- **Tidak ada snapshot BOM di transaksi produksi.** Tidak ada `bomId`/`bomVersion` di `HasilProduksiHarian`, `HasilProduksiHarianItem`, `ProduksiHarian`, maupun `ProduksiHarianItem`. Setelah BOM diubah, kebutuhan teoretis historis tidak dapat direproduksi.
- **BOM bertingkat sudah didukung pembacaan** (`flattenBom` rekursif, `produksiHarian.ts:163-191`) dan deteksi siklus (`bom.ts:155-180`), tetapi **hanya untuk output `Subassembly`**, bukan untuk `ProductVariant`.

**Kesimpulan 4.2 — dapatkah sistem menghitung kebutuhan material bertingkat?**
Secara **struktur: ya** (`Bom` → `BomItem.itemId|subassemblyId` + `Bom.subassemblyId` + `Subassembly.itemId` unik + `parentBomItemId`). Secara **fungsional: belum lengkap**, karena (a) ekspansi hanya dimulai dari `Subassembly`, tidak dari `ProductVariant`; (b) tidak ada resolver yang menghormati versi/masa berlaku; (c) tidak ada penyimpanan BOM yang dipakai per transaksi. Material setengah jadi tidak akan terhitung dua kali **hanya jika** laporan menjumlahkan material daun (lihat §8.5-E), karena struktur saat ini menyimpan baik SM maupun material daun sebagai baris BOM.

### 3.3 Hasil produksi harian

| Model | Field | Constraint |
|---|---|---|
| `HasilProduksiHarian` (`:1144`, table `hasil_produksi_harian`) | `nomor` unik, `tanggalProduksi`, `divisiId`, `orderId?`, `productionWorkOrderId?`, `keterangan` | index tanggal, (divisi,tanggal), (order,tanggal), (workOrder,tanggal) |
| `HasilProduksiHarianItem` (`:1169`) | `hasilProduksiHarianId`, **`itemId`**, `tipe` enum(MASUK/KELUAR/HASIL), `jumlah` Decimal(18,6) | index (item,tipe). **Tidak ada unique (header,item,tipe)** — dedup hanya di service |
| `HasilProduksiPemakaian` (`:1192`) | `hasilProduksiHarianItemId`, `pemakaianMaterialItemId`, `jumlah` | `@@unique([hasilProduksiHarianItemId, pemakaianMaterialItemId])` — **edge genealogi lot** |

Jawaban atas pertanyaan audit 4.3:

| Pertanyaan | Jawaban berbasis kode |
|---|---|
| Bagaimana hasil produksi disimpan? | Header per divisi+tanggal + baris item per tipe. Tidak ada dimensi varian/produk. |
| Apakah detail hanya mendukung `Item`? | **Ya.** `itemId` wajib (`:1172`), tidak ada `variantId`/`barangId`. |
| Bagaimana `ProductVariant` direpresentasikan? | **Tidak direpresentasikan sama sekali.** |
| Apakah `HASIL` menambah stok? | Ya, tetapi ke **dua tempat berbeda** tergantung `jenis`: `SM` → lot WIP divisi (bukan stok gudang); non-SM → `StokItemMutasi` MASUK + `Item.stok`. |
| Apakah `MASUK` hanya pencatatan atau transaksi stok? | **Transaksi stok WIP**: mengurangi `PemakaianMaterialItem.jumlahSisa` dan memposting `InventoryMovement` keluar dari lokasi divisi. Tetapi **tidak** menulis `StokItemMutasi`. |
| Bagaimana `KELUAR` diproses? | `lockItem` → cek `getSaldo` (StokItemMutasi) → `catatMutasi` KELUAR (+`Item.stok`) → `InventoryMovement` keluar. |
| Apakah hasil produksi berhubungan dengan BOM? | **Tidak.** Tidak ada referensi BOM di jalur HP. Kebutuhan material divalidasi terhadap **routing** (daftar item input/output, tanpa kuantitas) dan terhadap saldo WIP. |
| Apakah konsumsi material mereferensikan transaksi hasil produksi? | **Ya**, lewat `HasilProduksiPemakaian` (baris MASUK → lot) dan `InventoryMovement.sourceType='PRODUCTION_CONSUMPTION'` (`hasilProduksiHarian.ts:644-657`). |
| Apakah terjadi penghitungan stok ganda? | Tidak ganda pada saldo yang sama, tetapi **dua ledger** mencatat kejadian yang sama untuk KELUAR/HASIL non-SM (lihat §5). |

### 3.4 Production planning & realization

| Model | Field | Temuan |
|---|---|---|
| `ProductionOrder` (`:598`) | `nomor` unik, `periode`, `totalQty`, `status` (DRAFT…BATAL) | Dipakai `/api/production-orders` |
| `ProductionOrderItem` (`:622`) | `orderId+variantId` unik, `qty`, `priority` | Rencana per varian |
| `ProductionRealization` (`:676`) | `orderId+variantId+tanggal` unik, `qty`, `reject` | **Manual**, ditulis `saveRealisasi` (replace per hari) |
| `ProductionRealizationStage` (`:697`) | `orderId+tanggal+stage` unik, `qty`, `reject` | Manual, agregat per tahap |
| `ProductionWorkOrder` (`:648`) | `number` unik, `orderId`, `routingStageId`, `plannedQty`, `status` | **Tidak ada penulis**: satu-satunya referensi adalah *pembacaan* di `hasilProduksiHarian.ts:452-473`. Tidak ada endpoint (test: 404). |
| `ProductionBatch` (`:442`) | `nomorBatch` unik, `kapasitas` 5000, `status` | **Bukan lot produksi** — ini batch label/barcode (`BC001-…`) |

Hubungan aktual (bukan asumsi):
- `HasilProduksiHarian.orderId` hanya terisi bila `productionWorkOrderId` dikirim, dan karena tidak ada cara membuat `ProductionWorkOrder`, **`orderId` selalu `null` pada praktiknya**.
- `ProductionRealization` **tidak** menerima data dari transaksi produksi mana pun. Sebaliknya, layar realisasi menawarkan **saran** dari hitungan `Barang` (`getFinishgoodCounts`, `production-order.ts:255-279`) yang memakai `status <> 'REGISTER'` dan `Barang.tanggal` (tanggal cetak label).
- Kesimpulan: **input hasil produksi tidak terhubung dengan `ProductionRealization` maupun `ProductionOrder`**, sesuai dugaan brief — dan memang tidak ada kode yang menghubungkannya.

### 3.5 Inventory & material movement

Lihat analisis penuh di §5. Ringkasan struktur:

| Model | Peran | Kunci |
|---|---|---|
| `StokItemMutasi` (`:821`) | ledger item **legacy**, append-only | `sumberHasilProduksiItemId` @unique; tidak ada lokasi; tidak ada idempotency generik |
| `InventoryMovement` (`:1386`) | ledger **lokasi** modern | `idempotencyKey` @unique, `sourceType`+`sourceId` + index, `reversalOfId` @unique, `groupUuid` |
| `StockBalance` (`:1435`) | saldo per `(item|barang, batch, lot, lokasi)` | `balanceKey` @unique (dibentuk aplikasi, `inventory.ts:1304-1317`) |
| `PemakaianMaterialItem` (`:1037`) | lot WIP divisi + saldo berjalan `jumlahSisa` | `hasilProduksiHarianItemId` @unique |
| `StockAdjustment` (`:1464`) | koreksi dengan approval + anti self-approve + stale check | `movementId` @unique |
| `PemakaianMaterial` (`:1011`) | dokumen penerimaan WIP divisi | `hasilProduksiHarianId` @unique, `wipTransferId` @unique |

### 3.6 Finished goods & QR

| Model | Field | Temuan |
|---|---|---|
| `Barang` (`:511`) | `kodeBarang` unik, `variantId`, `batchId?`, `groupId?`, `gudangId?`, `qualityInspectionLineId?`, `tanggal?`, `status` FK `StatusBarang.kode` | Satu-satunya tautan ke produksi = `qualityInspectionLineId` (dan hanya terisi via QC). Tidak ada kolom "production lot"/"production run" |
| `RiwayatBarang` (`:547`) | `barangId`, `status`, `tanggal`, `keterangan` | **Append-only tanpa unique/idempotency**; tidak ada `updatedAt`. Status sama berulang diizinkan → baris FINISHGOOD ganda |
| `RiwayatMutasiGudang` (`:366`) | `barangId`, gudang asal/tujuan, `jumlah` (default 1) | Append-only; tidak menautkan ke transaksi produksi |
| `BarangCounter` (`:568`) | `(batchId,variantId,tanggal)` unik + `currentCount` | Penomoran barcode |
| `QualityInspectionLine` (`:1556`) | `pemakaianMaterialItemId?`, `barangId?`, `productVariantId?`, `repairAttemptId?`, `inspected/passed/repair/rejectedQuantity`, `producedBarang[]` | **Satu-satunya jembatan lot↔varian↔unit**, tapi endpoint finalisasi tidak tersedia |
| `FinishedGoodsReceipt`/`Line` (`:1670`) | dokumen penerimaan FG + `idempotencyKey` unik | **Tidak dipakai kode** |
| `ProductionBatch` | batch label 5000 pcs | Sering disalahartikan sebagai lot produksi produksi |

**Cara menentukan "pertama kali FINISHGOOD"** (permintaan 4.6): query yang benar adalah
`MIN(RiwayatBarang.tanggal) WHERE barangId = ? AND status = 'FINISHGOOD'`.
Yang dipakai sistem saat ini adalah `Barang.status = 'FINISHGOOD' AND Barang.tanggal` (`ViewBarangFinishgoodPerBulan`, `migrations/20260829120000_.../migration.sql:11-28`), yaitu **status terkini + tanggal pembuatan label** — bukan waktu transisi.

---

## 4. Backend Findings

### 4.1 Route & otorisasi (yang relevan)

| Endpoint | Auth | Handler → model | Catatan |
|---|---|---|---|
| `POST /api/produksi-harian` | role `produksi`\|`admin` | `createProduksiHandler` → `createProduksi` | satu-satunya input produksi hidup; tanpa idempotency |
| `POST /api/produksi-harian/penerimaan` | idem | `createPenerimaan` | `InventoryMovement` OPENING + `Item.stok` |
| `POST /api/pemakaian-material` | `adminOnly` | `createPemakaian` | **tidak** memposting ledger |
| `PATCH /api/permintaan-barang/:id/approval` | `admin`\|`gudang` | `setApproval` | wajib gudang tujuan; hanya gudang→gudang |
| `POST /api/barang/generate` | `BARANG_GENERATE` | `generateBarangBulk` | membuat `Barang` REGISTER tanpa produksi |
| `PATCH /api/barang/:id/status`, `POST /api/barang/scan/bulk` | `BARANG_UBAH_STATUS` | `updateBarangStatus` | **FINISHGOOD tanpa jejak produksi** |
| `PUT /api/bom/:id`, `POST /api/bom` | `BOM_KELOLA` | `updateBom`/`createBom` | versioning bisa menimpa |
| `GET/POST /api/quality/wip-rejects*` (claim, attempts, review) | `QUALITY_*`, `REPAIR_WORK` | `wipReject.ts` | reject per **lot item**, tanpa varian |
| `GET /api/quality/routings` | — | — | **tidak ada** (test 404: `quality-routes.test.ts:41`) padahal README:153 menyebut aktif → dokumentasi usang |
| `POST /api/inventory/movements` | `INVENTORY_MOVE`/`INVENTORY_ADJUST` | `postInventoryMovement` | posting manual `MANUAL_*`, `barangId` ditolak (`controller/inventory/inventory.ts:254-256`) |
| `GET /api/production-orders/:id/realisasi` | admin | `getRealisasi` | data manual, tidak berasal dari produksi |

### 4.2 Temuan kode per area

**A. Input hasil produksi (§5.1 brief)**
- Sumber transaksi sebenarnya: `produksiHarian.createProduksi` (hidup) dan `hasilProduksiHarian.createHasilProduksi` (service mati).
- Perhitungan BOM hanya di `flattenBom` (`produksiHarian.ts:147-215`), dijalankan **sebelum** transaksi menulis dokumen; hasilnya disimpan sebagai baris `BAHAN` (jadi tersimpan, bagus untuk audit jalur PH).
- Pemeriksaan stok: PH → `StockBalance` per lokasi sumber; HP → `PemakaianMaterialItem.jumlahSisa` (MASUK) + `getSaldo`/`StokItemMutasi` (KELUAR).
- Pengurangan stok: PH → `consumeItemAtLocation` (+`syncItemStok`); HP → update lot + `catatMutasi`/movement.
- Penyimpanan hasil: PH → `ProduksiHarianItem` tipe `HASIL` (item); HP → `HasilProduksiHarianItem` tipe `HASIL` (+ lot bila SM).

**B. Material consumption (§5.2)**
- Entitas konsumsi yang ada: `HasilProduksiPemakaian` (lot-level, edge), `ProduksiHarianItem` tipe `BAHAN` (BOM-level), `InventoryMovement` `sourceType='PRODUCTION_CONSUMPTION'` (movement-level), `PemakaianMaterialItem.jumlahDipakai` (saldo lot).
- **Tidak ada entitas yang menyatakan "konsumsi ini menghasilkan N unit produk X"**. Itu gap intinya.
- Referensi transaksi: setiap movement punya `sourceType`/`sourceId`; tetapi **tidak ada FK** dari movement ke baris konsumsi — hanya string. Untuk audit yang tahan banting dibutuhkan FK (lihat §9).

**C. Scan QR FINISHGOOD (§5.3)**
- `scanBarang` hanya membaca; `bulkScanBarang` memproses **satu barcode per transaksi** (bukan satu transaksi global) — `barang.status.ts:108-134`.
- Tidak ada pengurangan stok item pada scan. **Sesuai aturan bisnis #7.**
- Tidak ada validasi bahwa unit pernah melewati produksi/QC → **pelanggaran aturan #8/#9** secara semantik (REGISTER dianggap bisa langsung FINISHGOOD tanpa bukti apa pun).

**D. Integritas transaksi (§5.4)**

| Aspek | Kondisi |
|---|---|
| Prisma transaction | Dipakai hampir di semua jalur tulis. `bulkScanBarang` **tidak** atomik (per item), `createPemakaian` retry 1× untuk `P2002`. |
| Idempotency | Hanya `InventoryMovement.idempotencyKey` (dan `FinishedGoodsReceipt`/`CustomerShipment` yang mati). `POST /produksi-harian`, `POST /pemakaian-material`, `POST /barang/generate`, scan, approval **tidak** punya kunci idempotensi. |
| Unique constraint | Baik pada ledger & counter. **Tidak ada** unique pada `RiwayatBarang(barangId,status,tanggal)` atau baris hasil produksi. |
| Concurrency | `lockItem` (Item `FOR UPDATE`), WIP rows `FOR UPDATE`, `StockBalance` `FOR UPDATE`, batch/counter `FOR UPDATE`, update bersyarat `jumlahSisa >= x` — pola bagus. **Scan status tidak mengunci `Barang`** → dua operator bisa menulis transisi bersamaan dan menghasilkan dua baris riwayat. |
| Rollback | Dijamin transaksi DB. Tidak ada kompensasi bisnis. |
| Reversal | `reverseInventoryMovement` **ada** (`inventory.ts:1060-1138`) tetapi **tidak diekspos** ke route mana pun → tidak dapat dipakai operator. `StokItemMutasi`, `HasilProduksiHarian`, `ProduksiHarian` tidak punya reversal. |
| Audit trail | `userId` + timestamp ada di sebagian besar tabel; `RiwayatBarang`/`RiwayatMutasiGudang` append-only; tetapi `HasilProduksiHarianItem` tidak menyimpan `userId` per baris (hanya header). |
| Zona waktu | Hanya `hasilProduksiHarian`, `wip.ts`, dan `pemakaian` sebagian memakai `src/lib/tanggalBisnis.ts`. `produksiHarian.ts:97-102` (nomor), `produksiHarian.ts:547` (tanggal), `production-order.ts:226-238`, `barang.generate.ts:160-161`, dan `controller/stokItem/stokItem.ts:259-265` memakai waktu lokal server. **Aturan #20 belum konsisten.** |

### 4.3 Kode/dokumentasi yang menyesatkan (harus diperbaiki sebelum implementasi)

| Lokasi | Klaim | Realita |
|---|---|---|
| `backend/README.md:153` | `GET /api/quality/routings` masih aktif | tidak ada route (test 404) |
| `backend/README.md:159` | "Service `createHasilProduksi`, `createWipTransfer`, `approveWipTransfer` tetap menjadi dependensi seed" | benar, tetapi seed-nya sendiri kini gagal: `seed-item.ts:181-189` memanggil `setApproval(..., null)` tanpa `targetWarehouseId`, yang sekarang **wajib** (`permintaanBarang.ts:600-602`) |
| `backend/prisma/seed-permintaan-pemakaian.ts:168-170` | "Approval membuat pemakaian otomatis" | `setApproval` tidak lagi membuat `PemakaianMaterial` |
| `stokItem.ts:43` | "Saldo = SUM(MASUK) - SUM(KELUAR). Dihitung dari ledger, tidak ada kolom stok." | kolom `Item.stok` **ada** dan ditulis di `catatMutasi` |
| `frontend/src/api/erp.ts:379,406,490` | memanggil `/quality/final-inspections`, `/quality/daily-report`, `/quality/wip-flow` | semuanya 404 |

---

## 5. Inventory Ledger Analysis

### 5.1 Ledger yang aktif

| # | Ledger | Penulis (terbukti) | Saldo yang dijaga |
|---|---|---|---|
| L1 | `StokItemMutasi` | `controller/stokItem` (MASUK/KELUAR manual), `stokOpname`, `hasilProduksiHarian` (KELUAR + HASIL non-SM) | `getSaldo()` = Σ MASUK − Σ KELUAR |
| L2 | `InventoryMovement` + `StockBalance` | `permintaanBarang.setApproval`, `hasilProduksiHarian` (WIP consume, WIP output, KELUAR, HASIL), `produksiHarian` (bahan, hasil, penerimaan), `quality.ts` (QC/repair), `wipReject`, `wipTransfer`, `inventory` (adjustment/transfer/manual) | `StockBalance.quantity` per lokasi/lot |
| L3 | `PemakaianMaterialItem.jumlahSisa` (bukan ledger, saldo berjalan) | `pemakaianMaterial.create/update`, `hasilProduksiHarian` (MASUK/QC), `wipTransfer`, `quality` | saldo WIP per divisi/item |
| L4 | `Item.stok` (kolom cache) | `catatMutasi` (L1) **dan** `syncItemStok` dari L2 pada gerakan satu arah | tidak ada definisi tunggal |

### 5.2 Jawaban atas 10 pertanyaan brief

1. **Apakah kedua mekanisme inventory masih aktif?** **Ya.** L1 dan L2 sama-sama ditulis; bahkan untuk kejadian yang sama.
2. **Perbedaan tanggung jawab?** L1 = ledger item tanpa lokasi (legacy, masih dipakai untuk input manual, opname, dan KELUAR/HASIL non-SM). L2 = ledger lokasi dengan idempotency, reversal, dan saldo per lokasi (target arsitektur).
3. **Sumber kebenaran saldo?** **Belum ditetapkan.** `Item.stok`, `getSaldo`, dan `StockBalance` dapat berbeda. Secara desain L2 adalah kandidat yang benar (lokasi + idempotency + reversal); L1 harus dibekukan sebagai read-only legacy.
4. **Satu transaksi mencatat di kedua ledger?** **Ya** — `hasilProduksiHarian.ts:681-703` menulis `catatMutasi` **dan** `postInventoryMovementInTransaction` untuk baris yang sama.
5. **Idempotency?** Hanya L2 (`idempotencyKey` unik + `assertSameMovement`). L1 hanya unik per `sumberHasilProduksiItemId`.
6. **Reversal?** Hanya L2, level model, **tanpa endpoint**.
7. **Source type & source ID?** L2 punya (`sourceType`, `sourceId` + index); L1 hanya 3 kolom sumber spesifik.
8. **Histori dapat ditelusuri ke transaksi asal?** Sebagian: `StokItemMutasi.sumberHasilProduksiItemId` → baris hasil produksi; `InventoryMovement.hasilProduksiHarianId`/`produksiHarianId`/`pemakaianMaterialItemId` (FK) → dokumen. Baris L1 tanpa sumber: **tidak dapat ditelusuri** (audit sebelumnya mencatat 365/418 baris tanpa referensi).
9. **Material setengah jadi konsisten?** **Tidak.** Jalur HP memperlakukan SM sebagai lot WIP divisi (tidak menambah `Item.stok`), jalur PH memperlakukan SM sebagai stok lokasi biasa (menambah `Item.stok` + `StockBalance`). Dua perlakuan untuk hal yang sama.
10. **Saldo dapat direkonsiliasi dengan ledger?** **Tidak otomatis.** `Item.stok` ditulis oleh dua jalur; WIP masuk/keluar tidak menyentuh `Item.stok`; lokasi divisi tidak dikreditkan saat material diterima. Tidak ada laporan rekonsiliasi di kode.

### 5.3 Bukti drift `Item.stok` (paling penting)

```
Migration 20261101090000:
  Item.stok := Σ MASUK−KELUAR (StokItemMutasi) + Σ jumlahSisa (PemakaianMaterialItem)

Setelah itu:
  createWipHasilProduksi  → lot baru (+jumlahSisa)          : Item.stok TIDAK bertambah (hasilProduksiHarian.ts:680 skip SM, tanpa syncItemStok)
  MASUK produksi          → lot berkurang (−jumlahSisa)     : Item.stok TIDAK berkurang (hasilProduksiHarian.ts:644-657)
  QC final (bila hidup)   → lot berkurang                   : Item.stok TIDAK berkurang (quality.ts:899-941)

⇒ komponen WIP di dalam Item.stok tidak pernah turun mengikuti konsumsi.
```

---

## 6. Problem Identification

| ID | Masalah | Bukti | Dampak |
|---|---|---|---|
| **P-01** | Tidak ada dimensi `ProductVariant` pada transaksi produksi | `schema.prisma:1169-1188`, `:1234-1251`; `produksiHarian.ts:152-161` | Laporan "material untuk varian X" mustahil |
| **P-02** | Jembatan lot→varian→`Barang` ada tetapi endpoint-nya dihapus | `routes/quality.ts:16-28`; `tests/quality-routes.test.ts:33-48`; `quality.ts:897-942` | Traceability unit tidak dapat dibuat lewat API |
| **P-03** | FINISHGOOD hanya perubahan status, tanpa referensi produksi | `barang.status.ts:53-106` | 1.000 FINISHGOOD tidak dapat dihubungkan ke konsumsi |
| **P-04** | BOM `ProductVariant` tidak pernah dipakai menghitung konsumsi | `produksiHarian.ts:156-161` (komentar eksplisit); grep `Bom` hanya CRUD + seed | Theoretical consumption tidak tersedia |
| **P-05** | Versi/berlaku BOM tidak ditegakkan; BOM bisa ditimpa; tidak ada snapshot di transaksi | `produksiHarian.ts:124-137`; `bom.ts:224-249,283` | Variance historis tidak dapat direproduksi |
| **P-06** | Tiga angka stok tanpa sumber kebenaran | §5.3 | Laporan stok antar layar berbeda |
| **P-07** | Dua ledger mencatat kejadian yang sama | `hasilProduksiHarian.ts:681-703` | Double maintenance, risiko drift |
| **P-08** | Lokasi divisi tidak dikreditkan saat material diterima divisi | `pemakaianMaterial.ts:210-231` (tanpa movement); `permintaanBarang.ts:600-655` (hanya gudang→gudang) | Konsumsi dari lokasi divisi bisa gagal/negatif; WIP vs lokasi tidak rekonsiliasi |
| **P-09** | `RiwayatBarang` tanpa idempotency; scan ganda menambah baris | `barang.status.ts:96-102`; `schema.prisma:547-560` | FG dapat terhitung dua kali bila memakai riwayat mentah |
| **P-10** | Laporan FG memakai status terkini + tanggal label | `migrations/20260829120000...:11-28`; `production-order.ts:255-279` | FG periode lalu berubah saat ada OUT; OUT/BAD/RETUR dihitung sebagai produksi |
| **P-11** | `ProductionRealization*` tidak terhubung ke jurnal produksi dan kosong sementara produksi berjalan | `production-order.ts:240-299` | KPI ganda/tidak konsisten |
| **P-12** | Zona waktu tidak konsisten (aturan #20) | §4.2-D | Batas hari laporan bergeser 7 jam pada server UTC |
| **P-13** | Idempotency hanya di L2 | §4.2-D | Double submit membuat dokumen & konsumsi ganda |
| **P-14** | Tidak ada reversal yang dapat dipakai operator | `model/inventory/inventory.ts:1060` tanpa route | Koreksi hanya lewat adjustment manual |
| **P-15** | Posting manual bebas ke ledger (`MANUAL_*`) | `controller/inventory/inventory.ts:280-295` | Gerakan tidak berdomain, sulit diaudit |
| **P-16** | Dead schema/model: `FinishedGoodsReceipt*`, `CustomerShipment*`, `ShipmentReturn*`, `ProductionWorkOrder`, `WipStocktake*`; `ProductionRouting*` hanya ditulis seed | grep 0 referensi; `tests/retired-workspace-api.test.ts:25-26` | Menyesatkan desain; jangan diandalkan sebagai fondasi |
| **P-17** | `Item.jenis` teks bebas; logika WIP bergantung literal `"SM"` | `controller/item/item.ts:42-47`; `hasilProduksiHarian.ts:506,671,680` | Satu salah ketik memutus alur WIP |
| **P-18** | Semantik MASUK/KELUAR/HASIL tidak simetris dan tidak terdokumentasi di API | §2.2 | Risiko regresi bila diubah tanpa memahami aturan |
| **P-19** | **(peluang, bukan cacat)** Genealogi lot sudah lengkap: `HasilProduksiPemakaian` + `PemakaianMaterialItem.hasilProduksiHarianItemId` | `schema.prisma:1042,1192-1204` | Bisa menjadi tulang punggung traceability tanpa tabel baru |
| **P-20** | `Barang.batchId` = batch label (5000 pcs), bukan lot produksi | `barang.generate.ts:44-109` | Jangan dipakai sebagai "Production Lot" |

---

## 7. Root Cause Analysis

**Gejala:** tidak ada cara menjawab "untuk 1.000 helm varian V yang FINISHGOOD pada periode P, berapa material yang dipakai".

**Penyebab berlapis (5 Why):**

1. **Mengapa laporan tidak bisa dibuat?** Karena tidak ada baris data yang menghubungkan `(material, kuantitas)` dengan `(unit/varian, waktu FINISHGOOD)`.
2. **Mengapa tidak ada baris itu?** Karena produksi mencatat output sebagai `Item`, sedangkan FINISHGOOD hidup di `Barang` (yang bertipe `ProductVariant`). Tidak ada titik konversi yang menyimpan kedua identitas sekaligus.
3. **Mengapa konversi tidak ada?** Titik konversi pernah dirancang (`QualityInspectionLine` + `producedBarang`), tetapi endpoint yang memanggilnya (`/quality/final-inspections`) dihapus saat penyederhanaan API; yang tersisa hanya jalur generik `barang/generate` + scan status.
4. **Mengapa jalur generik dipakai?** Karena jalur QC bergantung pada `ProductionRouting` yang hanya dapat ditulis lewat seed/DB (endpoint tulis routing juga dihapus) dan pada `ProductWorkOrder` yang tidak pernah dibuat. Jalur "benar" menjadi tidak dapat dioperasikan, sehingga operasi nyata jatuh ke jalur cepat (cetak label → scan FINISHGOOD).
5. **Mengapa BOM tidak menutup celah ini?** Karena BOM `ProductVariant` tidak pernah dieksekusi oleh transaksi mana pun (P-04), sehingga bahkan "kebutuhan teoretis" pun tidak punya titik penerapan.

**Akar tunggal:** **tidak adanya identitas lot produksi yang melekat pada unit jadi.** Semua data yang dibutuhkan sebenarnya ada (lot WIP, konsumsi per lot, varian per unit via QC, riwayat status), tetapi tidak ada kunci yang menyatukannya dalam satu transaksi yang dapat dipanggil operator.

---

## 8. Architecture Recommendation

### 8.1 Perbandingan Opsi A / B / C

Skor 1 (buruk) – 5 (baik), dinilai terhadap kondisi database saat ini.

| Kriteria | A. Konsumsi dari input produksi | B. Production Lot (di atas lot yang ada) | C. Unit-level traceability penuh |
|---|---|---|---|
| Konsistensi transaksi | 3 — konsumsi menempel pada header produksi, tetapi tetap tanpa varian | **5** — lot + edge genealogi sudah transaksional (`HasilProduksiPemakaian`, movement) | 4 — butuh tulisan per unit, lebih banyak titik gagal |
| Akurasi stok | 3 — menambah pemisahan tanpa menyelesaikan P-06/P-08 | **4** — satu ledger lokasi (L2) dapat dijadikan acuan; WIP = sub-lot | 4 |
| Akurasi konsumsi material | 2 — konsumsi = BOM, tidak ada aktual nyata | **5** — konsumsi aktual per lot, dapat dibandingkan BOM | 5 |
| Traceability | 2 — hanya sampai "batch produksi" | **4** — sampai lot; unit dapat ditautkan bila perlu | 5 — sampai unit |
| Skalabilitas | 4 | **4** — 1 baris lot + N edge per posting | 2 — 1 baris per unit per tahap |
| Kompleksitas implementasi | **5** (paling murah) | 3 — perlu 1 dimensi varian + referensi BOM + laporan | 1–2 |
| Kompatibilitas DB saat ini | 3 | **5** — memakai `HasilProduksiHarian`, `PemakaianMaterialItem`, `HasilProduksiPemakaian`, `InventoryMovement` yang sudah ada | 3 — menambah FK ke `Barang` (murah) tetapi proses per unit mahal |

### 8.2 Rekomendasi utama: **Opsi B, tanpa tabel "Production Lot" baru**

**Alasan:**
1. **Entitas lot sudah ada dan sudah benar.** `PemakaianMaterialItem` adalah lot WIP (saldo per divisi+item), `HasilProduksiHarian` adalah posting proses yang menghasilkan/mengonsumsi lot, dan `HasilProduksiPemakaian` adalah edge konsumsi lot→lot. Membuat tabel `ProductionLot` akan menduplikasi ketiganya dan melanggar larangan "jangan membuat master duplikat".
2. **Yang hilang bukan lot, melainkan dua atribut:** (a) lot output harus tahu **varian** apa yang dihasilkannya pada tahap akhir; (b) unit `Barang` harus tahu **lot/tulisan produksi** mana asalnya. Keduanya cukup satu kolom nullable + satu FK.
3. **Opsi C tidak diperlukan untuk laporan agregat**, tetapi **hampir gratis** karena `Barang` sudah ada: satu FK `Barang.hasilProduksiHarianItemId` memberi kemampuan unit-level hanya untuk unit yang memang butuh (mis. klaim garansi), tanpa biaya penulisan per unit pada setiap tahap.
4. **Opsi A ditolak sebagai arsitektur utama** karena konsumsi tetap teoretis (BOM) dan tidak dapat menjawab variance; A dipertahankan hanya sebagai **fallback tampilan** ketika lot tidak lengkap.

**Batas desain yang dipertahankan (sesuai §11 brief):**
- `ProductVariant` tetap master produk jadi; `Item` tetap master material.
- BOM tetap acuan kebutuhan, bukan transaksi.
- **Tidak ada ledger ketiga.** `StokItemMutasi` dibekukan sebagai legacy read-only; `InventoryMovement` + `StockBalance` menjadi satu-satunya ledger tulis.
- **Tidak ada master duplikat.** Tidak ada `ProductionLot`, tidak ada `MaterialMaster` baru.
- `ProductionBatch` **tidak** dipakai sebagai lot produksi.

### 8.3 Diagram relasi target

```
ProductVariant
 ├──< Bom (version, isActive, berlakuMulai/Selesai, productVariantId ATAU subassemblyId)
 │      └──< BomItem (itemId | subassemblyId, quantity, scrapPercent, parentBomItemId)
 │             ├──> Item (material / WIP)
 │             └──> Subassembly ──< Bom          ← BOM bertingkat
 └──< Barang (unit helm; kodeBarang/QR; status)
        ├── finishGoodAt *          ← waktu PERTAMA FINISHGOOD (write-once)
        ├──< RiwayatBarang          ← append-only: status + tanggal (dasar backfill)
        ├──> QualityInspectionLine  ← lot WIP + varian + producedBarang[]
        └──> HasilProduksiHarianItem *   ← tautan unit fisik → output produksi

HasilProduksiHarian (divisi, tanggalProduksi, routingStageId *, bomId *,
                     orderId?, productionWorkOrderId?)
 ├──< HasilProduksiHarianItem (tipe: MASUK | KELUAR | HASIL;
 │                             productVariantId * wajib pada HASIL tahap akhir)
 │      ├──< HasilProduksiPemakaian ──> PemakaianMaterialItem
 │      │        (edge genealogy: lot mana yang dikonsumsi baris MASUK)
 │      └──> PemakaianMaterialItem (HASIL jenis SM)
 │               (lot baru yang dihasilkan, sisa = jumlah)
 └──< InventoryMovement (sourceType, sourceId, idempotencyKey, reversalOfId)
        └──> StockBalance (item|barang × batch × lot × lokasi)  ← satu-satunya saldo tulis

PemakaianMaterialItem (LOT WIP: jumlahDiterima / jumlahDipakai / jumlahSisa)
 ├──> HasilProduksiHarianItem (produksi lot)  |  PermintaanBarangItem (asal bahan)
 ├──< HasilProduksiPemakaian                   ← dikonsumsi produksi berikutnya
 ├──< WipTransferAlokasi                       ← dipindah antar divisi (bukan konsumsi)
 └──< QualityInspectionLine                    ← diperiksa / dikonversi jadi Barang

(*) field baru yang diusulkan di §9. Tidak ada tabel lot baru; tidak ada ledger ketiga.
```

### 8.4 Alur transaksi target (end-to-end)

```
1. RENCANA      ProductionOrder + items (varian, qty)         → tidak menyentuh stok
2. BOM          Bom(productVariantId) diaktifkan & dibekukan    → snapshot dipakai saat konsumsi
3. PROSES       POST /api/hasil-produksi-harian (idempoten)
                  header: divisi, tanggal bisnis, routingStageId, bomId
                  baris MASUK : lot WIP dikonsumsi  → HasilProduksiPemakaian + InventoryMovement(out)
                  baris HASIL : lot WIP dibuat     → lot baru + InventoryMovement(in)
                                (tahap akhir: productVariantId wajib)
4. TRANSFER     WipTransfer (bila antar divisi) → movement out/in, bukan konsumsi final
5. QC AKHIR     POST /api/quality/final-inspections
                  lot tahap akhir → passed  → generate Barang(variant) + Barang.hasilProduksiHarianItemId
                                            → QualityInspectionLine.producedBarang
                  reject/repair             → tetap di lot, tidak membuat unit baru
6. FINISHGOOD   scan/PATCH status → hanya status + RiwayatBarang + Barang.finishGoodAt (write-once)
                  TIDAK mengonsumsi material
7. LAPORAN      material consumption = roll-up genealogi lot dari unit/varian/periode FINISHGOOD
```

### 8.5 Desain laporan (target §8 brief)

**Sumber fakta yang ditetapkan:**

| Fakta | Sumber |
|---|---|
| FG pertama kali mencapai FINISHGOOD pada periode | `Barang.finishGoodAt` (di-backfill dari `MIN(RiwayatBarang.tanggal)`) |
| Hasil produksi diinput | `HasilProduksiHarianItem` tipe `HASIL` (+ `ProduksiHarianItem` tipe `HASIL`) |
| QR dipindai | `RiwayatBarang` (transisi `→FINISHGOOD`) dan `Barang.finishGoodAt` |
| Konsumsi aktual | edge `HasilProduksiPemakaian` + `InventoryMovement` `PRODUCTION_CONSUMPTION` |
| Kebutuhan teoretis | ekspansi BOM `ProductVariant` (multi-level) versi yang tersimpan di `HasilProduksiHarian.bomId` |
| Unit ↔ lot | `Barang.hasilProduksiHarianItemId` → `QualityInspectionLine` → `PemakaianMaterialItem` |

**A. Finished Goods Summary** — satu baris per (periode, varian):
`fgFirstCount`, `productionInputQty`, `scannedCount`, `notScannedCount`, `statusChangedCount`, `gap = productionInputQty − fgFirstCount`.

**B. Material Consumption Summary** — per (item):
`kebutuhanBom`, `aktual`, `satuan`, `variance = aktual − bom`, `variancePct = variance / bom`.
Dua basis terpisah dan tidak boleh dicampur:
- basis **FG** (hanya unit yang FINISHGOOD pada periode) — untuk menjawab pertanyaan bisnis;
- basis **produksi** (semua output yang dihasilkan periode itu, termasuk yang belum/tidak jadi FG) — untuk rekonsiliasi.

**C. Traceability** — satu baris per rantai:
`hasilProduksiHarianId`, `hasilProduksiHarianItemId`, `pemakaianMaterialItemId`, `bomId`/`bomVersion`, `barangId`/`kodeBarang`, `riwayatFinishGoodAt`, `tanggalProduksi`, `tanggalKonsumsi`, `tanggalFinishGood`.

**D. Reconciliation (buckets, saling eksklusif dan berjumlah total):**
```
produced_qty
 ├── fg_qty                (punya finishGoodAt, belum OUT/BAD)
 ├── wip_qty               (lot masih tersisa)
 ├── unscanned_qty         (unit REGISTER berasal dari lot)
 ├── reject_qty            (WipReject / rejectedQuantity)
 ├── retur_qty             (status RETUR)
 └── out_qty               (status OUT; TIDAK dihitung sebagai FG baru)
```
Aturan: `out_qty` dan `retur_qty` **tidak** menambah `fg_qty`, dan `fg_qty` periode tidak berubah karena pengiriman di periode berikutnya.

**E. Metode alokasi konsumsi (dapat diaudit, tanpa mengubah histori):**
1. Setiap unit FG memiliki lot asal `L` (via `Barang.hasilProduksiHarianItemId` → `PemakaianMaterialItem`).
2. Untuk setiap lot `L`, hitung konsumsi kumulatif genealogy: telusuri `HasilProduksiPemakaian` ke hulu sampai lot yang berasal dari `PermintaanBarang` (bahan baku), jumlahkan per item. **Item setengah jadi tidak dijumlahkan pada total akhir** (hanya ditampilkan per tahap) agar tidak dihitung dua kali.
3. Biaya material per unit = konsumsi kumulatif lot `L` ÷ `L.jumlahDiterima` (kuantitas output lot).
4. Total periode/varian = Σ (per unit) untuk unit yang benar-benar `finishGoodAt ∈ periode`.
5. Unit yang diproduksi tetapi tidak/belum FG **tidak** dialokasikan ke FG; selisihnya masuk bucket `wip/unscanned/reject` dan dilaporkan terpisah. **Histori konsumsi tidak diubah.**
6. Bila `L.jumlahDiterima = 0` atau genealogy tidak lengkap → baris ditandai `LOT_TIDAK_LENGKAP` dan masuk bucket `legacy/unlinked`, **tidak** dihitung sebagai FG-linked.

### 8.6 Posisi `ProductionRealization` dan `ProductionOrder` (jawaban 4.4)

**Rekomendasi: `ProductionRealization` TETAP sistem terpisah pada tahap ini, dan tidak boleh menjadi sumber data realisasi produk jadi.**

Alasan berbasis kode:
- Isinya manual per (order, varian, tanggal) dan ditulis dengan pola *replace per hari* (`saveRealisasi`, `production-order.ts:281-299`) — tidak append-only, sehingga tidak memenuhi syarat audit trail untuk fakta produksi.
- Tidak memiliki relasi ke lot, `Item`, atau `Barang`; tidak dapat direkonsiliasi dengan ledger.
- `ProductionOrder`/`ProductionOrderItem` adalah rencana (qty per varian) dan tidak menyentuh stok — tetap dipertahankan sebagai rencana.

**Peran yang diusulkan:**
1. Rencana & jadwal: `ProductionOrder` + `ProductionOrderItem` + `ProductionSchedule*` + `ProductionCapacity` (tetap).
2. Fakta fisik/konsumsi: `HasilProduksiHarian` (+ lot) — **bukan** `ProductionRealization`.
3. KPI realisasi: **proyeksi** dari jurnal produksi (`HASIL` × varian) → ditampilkan melalui endpoint realisasi yang sudah ada sebagai *adapter*, dengan penanda sumber (`MANUAL` vs `JURNAL`). Penulisan manual dibekukan bertahap, bukan dihapus.
4. `ProductionOrder` ↔ jurnal produksi: hubungkan melalui `orderId`/`productionWorkOrderId` yang **sudah ada** di header, tetapi hanya setelah ada penulis `ProductionWorkOrder` (saat ini tidak ada). Jangan memaksa backfill ke satu order tanpa bukti.

Dengan pemisahan ini, laporan konsumsi material **tidak** bergantung pada `ProductionRealization`, sehingga tidak ada angka KPI yang dihitung dua kali.

---

## 9. Proposed Database Changes

Semua perubahan **aditif** dan **nullable** (kecuali disebut). Tidak ada `DROP`, tidak ada tabel ledger baru.

### 9.1 Perubahan model & alasan

| # | Perubahan | Definisi usulan | Alasan | Dampak data lama |
|---|---|---|---|---|
| **S1** | `HasilProduksiHarianItem.productVariantId` | `Int?`, FK `ProductVariant` `onDelete: Restrict`, `@@index([productVariantId])` | Satu-satunya cara menyatakan "posting ini menghasilkan varian V". Wajib hanya untuk baris `HASIL` tahap akhir (validasi service) | `NULL` = legacy/unlinked |
| **S2** | `HasilProduksiHarian.routingStageId` | `Int?`, FK `ProductionRoutingStage` `Restrict`, index | Atribusi tahap tanpa menebak dari divisi (satu divisi bisa punya >1 stage) | `NULL` untuk data lama |
| **S3** | `HasilProduksiHarian.bomId` | `Int?`, FK `Bom` `Restrict`, index | Membekukan BOM yang dipakai saat konsumsi → kebutuhan teoretis historis dapat direproduksi | `NULL` |
| **S4** | `HasilProduksiHarian.idempotencyKey` | `String? @unique` | Mencegah double-submit (aturan #14/#15) | `NULL` (MySQL mengizinkan banyak NULL) |
| **S5** | `ProduksiHarian.bomId` + `idempotencyKey` | `Int?` FK Bom; `String? @unique` | Sama untuk jalur PH | `NULL` |
| **S6** | `Barang.hasilProduksiHarianItemId` | `Int?`, FK `HasilProduksiHarianItem` `onDelete: Restrict`, `@@index` | Menautkan unit fisik ke output produksi. Melengkapi `qualityInspectionLineId` (yang hanya terisi via QC) | `NULL` untuk 5.010 unit legacy |
| **S7** | `Barang.finishGoodAt` | `DateTime?`, `@@index([finishGoodAt])` | Waktu **pertama** FINISHGOOD, write-once. Menghilangkan ketergantungan pada status terkini untuk laporan periode | Backfill dari `MIN(RiwayatBarang.tanggal)` |
| **S8** | `RiwayatBarang` index | `@@index([status, tanggal])` | Mempercepat laporan "first FG" dan audit transisi | — |
| **S9** | `Item.jenis` | tambah `@@index([jenis])` + validasi whitelist di controller (`RAW MATERIAL`, `HABIS PAKAI`, `SM`) | P-17; menghindari putusnya logika WIP karena salah ketik | Tidak mengubah data |

### 9.2 Constraint tambahan (bukan kolom baru)

| Constraint | Usulan | Catatan |
|---|---|---|
| `HasilProduksiHarianItem` dedup | `@@unique([hasilProduksiHarianId, itemId, tipe])` | Saat ini hanya divalidasi service; constraint akan menolak duplikat lebih awal. **Perlu cek data lama** sebelum apply |
| `RiwayatBarang` anti-duplikat teknis | **JANGAN** buat unique `(barangId,status,tanggal)` | Status sama berulang sah untuk audit; dedup dilakukan saat query (`MIN(tanggal)`) / `finishGoodAt` |
| `InventoryMovement` FK ke baris konsumsi | `produksiHarianItemId Int?` FK | Saat ini hanya string `sourceId`; FK membuat audit tahan rename |

### 9.3 Yang secara eksplisit **tidak** diusulkan

- **Tidak** membuat tabel `ProductionLot`/`ProductionLotItem` (duplikasi `PemakaianMaterialItem` + `HasilProduksiPemakaian`).
- **Tidak** membuat `ProductionMaterialConsumption` baru (sudah ada `HasilProduksiPemakaian` + `ProduksiHarianItem` tipe `BAHAN`).
- **Tidak** membuat ledger ketiga; `StokItemMutasi` dibekukan, bukan dihapus.
- **Tidak** mengaktifkan kembali `FinishedGoodsReceipt`/`Shipment` pada fase ini (dead schema; menunggu keputusan proses).
- **Tidak** memakai `ProductionBatch` sebagai lot produksi.

### 9.4 Sketsa Prisma (ringkas)

```prisma
model HasilProduksiHarian {
  // …
  routingStageId Int?
  bomId          Int?
  idempotencyKey String?  @unique

  routingStage ProductionRoutingStage? @relation(fields: [routingStageId], references: [id], onDelete: Restrict)
  bom          Bom?                    @relation(fields: [bomId], references: [id], onDelete: Restrict)

  @@index([routingStageId])
  @@index([bomId])
}

model HasilProduksiHarianItem {
  // …
  productVariantId Int?

  productVariant ProductVariant? @relation(fields: [productVariantId], references: [id], onDelete: Restrict)
  barangDihasilkan Barang[]      @relation("BarangHasilProduksi")

  @@index([productVariantId])
  @@unique([hasilProduksiHarianId, itemId, tipe])
}

model Barang {
  // …
  hasilProduksiHarianItemId Int?
  finishGoodAt              DateTime?

  hasilProduksiHarianItem HasilProduksiHarianItem? @relation("BarangHasilProduksi", fields: [hasilProduksiHarianItemId], references: [id], onDelete: Restrict)

  @@index([hasilProduksiHarianItemId])
  @@index([finishGoodAt])
}

model RiwayatBarang {
  // …
  @@index([status, tanggal])
}

model ProduksiHarian {
  // …
  bomId          Int?
  idempotencyKey String? @unique
  bom            Bom?    @relation(fields: [bomId], references: [id], onDelete: Restrict)
  @@index([bomId])
}
```

Catatan: relasi balik wajib ditambahkan di `ProductVariant`, `Bom`, dan `ProductionRoutingStage` (Prisma mewajibkan sisi kedua).

---

## 10. Proposed Backend Changes

### 10.1 Endpoint

| Endpoint | Aksi | Perubahan |
|---|---|---|
| `POST /api/hasil-produksi-harian` | **dihidupkan kembali** sebagai jalur kanonik posting proses | pasang router; wajib `idempotencyKey`; `routingStageId`/`bomId`; `productVariantId` untuk baris HASIL tahap akhir; tolak bila lot/route tidak konsisten |
| `GET /api/hasil-produksi-harian`, `/:id` | riwayat & detail | read-only, filter divisi (scope) |
| `POST /api/quality/final-inspections` | **dihidupkan kembali** sebagai satu-satunya pembuat unit FG | validasi lot = output stage terakhir; isi `Barang.hasilProduksiHarianItemId`; tolak bila varian tidak sesuai BOM/route |
| `GET /api/quality/routings` | **dihidupkan kembali** (read) | prasyarat operasional QC; alternatif: endpoint admin tulis routing |
| `PATCH /api/barang/:id/status` | diperketat | transisi `→FINISHGOOD` hanya untuk unit dengan `hasilProduksiHarianItemId` **atau** `qualityInspectionLineId`; selain itu `409 LEGACY_UNLINKED` (dapat di-override admin dengan alasan, tercatat di `RiwayatBarang.keterangan`) |
| `POST /api/barang/scan/bulk` | diperketat + idempotensi | kunci `(kodeBarang, status)` per request; satu transaksi per barcode tetap, tetapi hasil harus melaporkan `duplicate` alih-alih menulis ulang |
| `POST /api/produksi-harian` | dipertahankan (kompatibilitas) | tambah `idempotencyKey`; simpan `bomId`; **tolak output `jenis='SM'`** (SM harus lewat jalur lot) atau arahkan ke lot |
| `POST /api/pemakaian-material` | diperbaiki | **wajib** memposting `InventoryMovement` TRANSFER gudang sumber → lokasi divisi (idempoten, `sourceType='PEMAKAIAN_MATERIAL'`), agar WIP lot dan `StockBalance` konsisten |
| `GET /api/reports/finished-goods/summary` | **baru** | §8.5-A |
| `GET /api/reports/material-consumption` | **baru** | §8.5-B |
| `GET /api/reports/traceability` | **baru** | §8.5-C |
| `GET /api/reports/reconciliation` | **baru** | §8.5-D |
| `POST /api/inventory/movements/:id/reverse` | **baru** | mengekspos `reverseInventoryMovement` yang sudah ada |

### 10.2 Service / model

| File | Perubahan |
|---|---|
| `model/hasilProduksiHarian/hasilProduksiHarian.ts` | tambah `idempotencyKey`, `routingStageId`, `bomId`; validasi varian pada HASIL tahap akhir; `syncItemStok` konsisten (tetapkan: HP **tidak** menulis `Item.stok`, cukup L2) |
| `model/produksiHarian/produksiHarian.ts` | `flattenBom` menerima `bomId` eksplisit (bukan "BOM aktif terbaru"); simpan `bomId`; idempotency |
| `model/bom/bom.ts` | larang `updateBom` pada BOM yang sudah direferensikan transaksi; buat versi baru; tegakkan `berlakuMulai/Selesai` di resolver |
| `model/inventory/inventory.ts` | jadikan `StockBalance` satu-satunya saldo tulis; tambah helper `postMaterialReceiptToDivision`; ekspos reversal |
| `model/stokItem/stokItem.ts` | bekukan `catatMutasi` untuk penulisan baru (atau batasi ke input manual/opname); `getSaldo` diberi label legacy di API |
| `model/pemakaianMaterial/pemakaianMaterial.ts` | posting movement saat create/update/delete lot; hentikan `resolveSisaSebelumnya` berbasis `updatedAt` (rapuh) → pakai saldo L2 |
| `model/barang/barang.status.ts` | `finishGoodAt` write-once; validasi keterkaitan produksi; idempotensi scan; lock baris `Barang` |
| `model/quality/quality.ts` | `finalizeQualityInspection` mengisi `hasilProduksiHarianItemId`; tetap membuat unit hanya dari lot |
| `model/quality/routing.ts` | resolver stage: tegakkan satu stage aktif per (routing, divisi, sequence) |
| `model/production-order/production-order.ts` | `getFinishgoodCounts` → ganti ke `finishGoodAt` + hanya status yang sah sebagai FG; jangan masukkan OUT/BAD/RETUR |
| `lib/tanggalBisnis.ts` | wajib dipakai pada semua prefix nomor, filter periode, dan tanggal bisnis default (aturan #20) |
| `controller/item/item.ts` | whitelist `jenis` |

### 10.3 Report service (inti)

```
getMaterialConsumptionReport({ from, to, productId, variantId, orderId, itemId, divisiId, status })
  1. FG set      : Barang WHERE finishGoodAt ∈ [from,to) AND status ∉ (BAD)  (OUT/RETUR dilaporkan terpisah, tidak dihapus dari FG historis)
  2. per unit    : lot asal → genealogy roll-up → { item, qty }
  3. agregasi    : per item → bomQty (ekspansi Bom.productVariantId) vs actualQty
  4. variance    : actual − bom ; pct
  5. bucket      : produced / fg / wip / unscanned / reject / retur / out
  6. flag        : LOT_TIDAK_LENGKAP, LEGACY_UNLINKED, BOM_TIDAK_LENGKAP
```

Kinerja: genealogy roll-up harus di-*precompute* per lot (tabel cache/laporan harian) bila volume besar; **jangan** traverse rekursif saat request.

---

## 11. Migration Strategy

### 11.1 Prinsip
- Aditif, dapat diulang (`idempoten`), dan **tidak menebak relasi historis**.
- Tidak ada `git reset` pada migration; koreksi selalu maju.
- Histori tidak dihapus; data yang tidak dapat dibuktikan diberi status **legacy/unlinked**.

### 11.2 Langkah

| Fase | Aksi | Aman bila |
|---|---|---|
| 0 | Backup + snapshot agregat (per item/lokasi: `StockBalance`, `StokItemMutasi`, `PemakaianMaterialItem.jumlahSisa`, hitung `Barang` per status) | sebelum semua perubahan |
| 1 | Migration aditif S1–S9 (§9.1) + constraint yang tidak konflik data | setelah cek duplikat `HasilProduksiHarianItem` |
| 2 | **Backfill `Barang.finishGoodAt`** = `MIN(RiwayatBarang.tanggal)` untuk `status='FINISHGOOD'` (hanya bila ada riwayat; bila tidak ada → biarkan `NULL` = legacy) | idempoten: `UPDATE … WHERE finishGoodAt IS NULL` |
| 3 | **Backfill tautan unit→lot** hanya bila dapat dibuktikan: `Barang.qualityInspectionLineId → QualityInspectionLine.pemakaianMaterialItemId → hasilProduksiHarianItemId` | hanya baris dengan bukti lengkap |
| 4 | **Klasifikasi legacy**: `Barang` tanpa tautan diberi penanda laporan `LEGACY_UNLINKED` (tidak diubah statusnya) | sesuai keputusan pengguna sebelumnya (5.010 unit ditahan) |
| 5 | **Kelengkapan BOM**: untuk setiap varian, ekspansi `Bom(productVariantId)` → subassembly → material daun. Varian yang tidak mencapai daun ditandai `BOM_TIDAK_LENGKAP` dan **tidak** dihitung variance-nya | tidak mengubah data produksi |
| 6 | **Rekonsiliasi WIP vs lokasi**: bandingkan `PemakaianMaterialItem.jumlahSisa` dengan `StockBalance` lot yang sama. Selisih dilaporkan sebagai temuan; bila suatu lot belum punya jejak lokasi sama sekali, buat `InventoryMovement` OPENING idempoten (`sourceType='WIP_OPENING'`) **hanya setelah** saldo pembuka disetujui. **Jangan menimpa `jumlahSisa`.** | setelah persetujuan saldo pembuka |
| 7 | **Rekonsiliasi `Item.stok`**: tetapkan `StockBalance` sebagai acuan; `Item.stok` dijadikan proyeksi (jobs) atau dideprecate dari laporan | setelah fase 6 |
| 8 | **`StokItemMutasi` dibekukan**: tolak penulisan baru; sediakan view "legacy ledger" untuk laporan lama | setelah semua penulis L1 dimigrasi ke L2 |
| 9 | **ProductionRealization**: pertahankan; bekukan penulisan manual setelah jurnal produksi menjadi sumber KPI; sediakan adapter/proyeksi | setelah mapping order/variant ada |

### 11.3 Penanganan transaksi lama

| Kelompok | Perlakuan |
|---|---|
| `HasilProduksiHarian` lama (tanpa varian) | tetap; `productVariantId = NULL`; laporan menandai `TANPA_VARIAN`; **jangan** menebak varian dari divisi |
| `StokItemMutasi` tanpa sumber | legacy ledger; tetap dapat dibaca; tidak di-backfill ke lokasi |
| `Barang` lama tanpa tautan | `LEGACY_UNLINKED`; tidak dihitung sebagai FG terverifikasi pada laporan traceability, tetapi tetap muncul di laporan status |
| `PemakaianMaterialItem` lama | lot tetap; genealogy parsial ditandai; jangan mengubah `jumlahSisa` |
| `BOM` versi lama yang sudah ditimpa | tidak dapat dipulihkan; akui sebagai keterbatasan; mulai snapshot (`bomId`) untuk transaksi baru |
| `ProductionRealization*` lama | manual KPI; tidak dianggap jurnal stok |

---

## 12. Testing Strategy

### 12.1 20 skenario wajib (sesuai brief §10)

| # | Skenario | Expected result |
|---|---|---|
| 1 | Input 100 helm, 100 QR mencapai FINISHGOOD | `fgFirstCount=100`; `materialQty(FG) = 100 × per-unit lot`; gap produksi−FG = 0 |
| 2 | Input 100, hanya 95 FINISHGOOD | `fgFirstCount=95`; konsumsi FG = 95/100 dari konsumsi lot; selisih 5 masuk `unscanned/reject`, **bukan** dihapus dari ledger |
| 3 | Input hasil produksi dua kali (request identik) | request kedua → `200` dengan dokumen sama (idempotency) **atau** `409`; tidak ada dokumen/lot/movement kedua |
| 4 | Scan QR dua kali | `finishGoodAt` tidak berubah (write-once); riwayat boleh bertambah; `fgFirstCount` tetap 1 |
| 5 | FINISHGOOD → OUT | `fgFirstCount` periode asal **tetap**; `out_qty` bertambah; laporan OUT terpisah |
| 6 | FINISHGOOD → RETUR → FINISHGOOD | `finishGoodAt` tetap yang pertama; tidak ada unit baru; tidak ada konsumsi material baru |
| 7 | BOM diubah setelah transaksi | laporan transaksi lama memakai `bomId` tersimpan; nilai variance lama tidak berubah |
| 8 | Satu Item dipakai beberapa varian | konsumsi teralokasi ke varian masing-masing; total antar varian = total item |
| 9 | Satu varian banyak Item | semua item muncul; `SUM(actual)` konsisten dengan roll-up lot |
| 10 | Stok material tidak cukup | transaksi ditolak utuh (rollback); tidak ada dokumen/lot/movement parsial |
| 11 | Transaksi gagal di tengah | tidak ada baris tersisa; `StockBalance` tidak berubah |
| 12 | Koneksi terputus saat commit | tidak ada dokumen setengah jadi; retry dengan `idempotencyKey` sama tidak menggandakan |
| 13 | Produksi punya konsumsi tetapi belum ada QR | `wip_qty`/`unscanned_qty > 0`; `fg_qty` sesuai unit nyata |
| 14 | FINISHGOOD tanpa referensi kelompok produksi | ditandai `LEGACY_UNLINKED`; tidak masuk traceability terverifikasi |
| 15 | SM menjadi input produksi berikutnya | SM dihitung **sekali** sebagai material daun pada tahapnya; total akhir tidak memasukkan SM antar-tahap |
| 16 | Transfer antar gudang/divisi | `Σ masuk = Σ keluar`; total item tidak berubah; tidak dihitung konsumsi |
| 17 | Satu konsumsi terdeteksi di dua ledger | hanya **satu** ledger tulis (L2); test regresi memastikan L1 tidak lagi ditulis |
| 18 | Dua operator memproses bersamaan | satu sukses, satu gagal (`409`) atau idempoten; tidak ada saldo negatif/duplikat |
| 19 | Perubahan BOM tidak mengubah histori konsumsi | konsumsi lama tetap; variance lama tidak berubah |
| 20 | Laporan FG tidak menghitung unit yang sama dua kali | `COUNT(DISTINCT barangId)` / unique `finishGoodAt`; tidak ada duplikat walau riwayat berulang |

### 12.2 Test tambahan (belum ada di repo)

- Unit: `flattenBom` dengan BOM bertingkat + scrap + siklus (sudah ada `bom-model.test.ts`; perluas untuk varian).
- Unit: resolver BOM dengan `berlakuMulai/Selesai` dan dua BOM aktif.
- Unit: `finishGoodAt` write-once + transisi RETUR→FINISHGOOD.
- Integrasi: genealogy roll-up 4 tahap (Buffing→Base Coat→Decal→Top Coat) menghasilkan per-unit yang sama dengan seed.
- Integrasi: `createPemakaian` memposting movement divisi (regresi P-08).
- Konkurensi: dua `POST /hasil-produksi-harian` untuk lot yang sama.
- Timezone: transaksi pada 23:30 dan 00:30 WIB menghasilkan tanggal bisnis yang benar.

### 12.3 Coverage saat ini (jujur)

Ada 45 file test (`backend/tests/`), termasuk `hasil-produksi-harian-model.test.ts`, `bom-model.test.ts`, `quality-model.test.ts`, `inventory-model.test.ts`, `pemakaian-*`, `retired-workspace-api.test.ts`. **Tidak ada** test end-to-end material→FG, tidak ada test rekonsiliasi ledger, tidak ada test concurrency DB nyata. Test tidak dapat dijalankan pada sesi ini (shell tidak tersedia).

---

## 13. Implementation Roadmap

| Fase | Isi | Gate / bukti |
|---|---|---|
| **0. Bekukan baseline** | backup, snapshot agregat, tandai versi | backup terverifikasi |
| **1. Schema aditif S1–S9** | migration baru + generate client + build | `prisma validate` + migration diterapkan di salinan DB |
| **2. Ledger tunggal** | hentikan penulisan L1 baru; `StockBalance` jadi acuan; posting movement saat `PemakaianMaterial`; ekspos reversal | rekonsiliasi L1 vs L2 dilaporkan (selisih 0 atau terdaftar) |
| **3. Varian pada produksi** | isi `productVariantId` HASIL tahap akhir; `routingStageId`, `bomId`; idempotency | produksi 1 lot uji menghasilkan 1 baris varian benar |
| **4. Jalur FG resmi** | hidupkan `/quality/final-inspections` + `/quality/routings`; `Barang.hasilProduksiHarianItemId`; perketat transisi FINISHGOOD | 100 unit uji: 100 `Barang` tertaut lot, 0 tanpa tautan |
| **5. Reporting** | 4 endpoint laporan + query `finishGoodAt`; ganti view/rekap lama | laporan uji cocok dengan perhitungan manual |
| **6. Migrasi & backfill** | `finishGoodAt`, klasifikasi legacy, kelengkapan BOM | laporan membedakan linked vs legacy |
| **7. Hardening** | idempotency menyeluruh, timezone, audit trail, dokumentasi | test 20 skenario lulus |
| **8. Deprecation** | `ProductionRealization` sebagai adapter; `ProduksiHarian` vs HP: satu jalur kanonik | tidak ada penulis ganda |

Urutan ini menjaga agar **tidak ada perubahan schema yang memaksa reset**, dan setiap fase dapat dihentikan tanpa kehilangan data.

**Keputusan arsitektur yang masih harus diambil pengguna sebelum fase 3–4:**
1. Apakah **jalur kanonik** produksi adalah HP (jurnal divisi + lot) atau PH (BOM langsung ke gudang)? Rekomendasi: HP untuk komponen/WIP, PH hanya untuk perakitan akhir yang tidak melalui lot — atau satukan.
2. Apakah FINISHGOOD **hanya** boleh lewat QC Akhir (rekomendasi: ya, dengan pengecualian admin beralasan), atau scan bebas dipertahankan?
3. Identitas gudang FG dan lokasi divisi final (masih terbuka dari audit sebelumnya).
4. Apakah laporan konsumsi memakai basis **FG** (rekomendasi) atau basis **produksi** sebagai angka resmi; atau keduanya dengan label jelas.

---

## 14. Risk Assessment

| Area | Risiko | Level | Mitigasi |
|---|---|---|---|
| **Produksi** | Menghidupkan kembali HP mengubah perilaku operator; dua jalur bersaing | Tinggi | Feature flag; jalur lama tetap; satu jalur ditutup setelah cutover |
| **BOM** | BOM bisa ditimpa → laporan historis berubah | Tinggi | Simpan `bomId`; larang edit BOM yang sudah dipakai; buat versi baru |
| **WIP** | Lot dan `StockBalance` tidak cocok (P-08) | **Kritis** | Posting movement saat penerimaan material divisi; rekonsiliasi sebelum cutover; jangan overwrite `jumlahSisa` |
| **Inventory** | Tiga angka saldo; `Item.stok` drift | **Kritis** | Tetapkan L2 sebagai acuan; bekukan L1; job proyeksi untuk `Item.stok` |
| **Gudang** | Master gudang FG belum ada; lokasi divisi tidak lengkap | Tinggi | Inventarisasi fisik; mapping `Gudang→InventoryLocation`; jangan auto-create |
| **QR Code** | Format barcode memuat `batchId` (batch label), bukan lot produksi | Sedang | Jangan ubah format; tambahkan relasi DB, bukan makna baru pada barcode |
| **Finished Goods** | 5.010 unit FINISHGOOD legacy tanpa lokasi/QC/tautan | **Kritis** | Tahan sebagai legacy; jangan mass-update status; laporkan terpisah |
| **Laporan** | Angka periode berubah karena status terkini (P-10) | Tinggi | `finishGoodAt` + query periode; ganti view lama |
| **Kinerja** | Roll-up genealogy rekursif per unit | Sedang | Precompute per lot; index; cache harian |
| **Kompatibilitas** | Frontend memanggil endpoint yang 404 (`/quality/final-inspections`, dsb.) | Tinggi | Menghidupkan kembali endpoint = memperbaiki frontend tanpa mengubah frontend |
| **Data loss** | `updateBom` menghapus item lama; `PemakaianMaterial` update menghapus lot | Tinggi | Larang edit bila sudah direferensikan; histori append-only |
| **Operasional** | Seed kini gagal (`setApproval` wajib `targetWarehouseId`) | Sedang | Perbaiki seed sebelum fase 2; jangan dijalankan di produksi |

---

## Lampiran A — Kepatuhan terhadap Aturan Bisnis (§7 brief)

| # | Aturan | Status | Bukti |
|---|---|---|---|
| 1 | `ProductVariant` tetap master produk jadi | ✅ dipertahankan | desain §8 |
| 2 | `Item` tetap master material | ✅ | desain §8 |
| 3 | BOM acuan kebutuhan varian | ❌ belum berfungsi (P-04) | `produksiHarian.ts:156-161` |
| 4 | Input hasil produksi tetap proses pencatatan | ⚠️ ada 2 jalur (PH hidup, HP mati) | §1.3 |
| 5 | Jangan asumsikan HP↔ProductionRealization | ✅ terbukti tidak terhubung | §3.4 |
| 6 | Setiap konsumsi punya sumber transaksi | ⚠️ sebagian (L2 ya, L1 tidak) | §5.2 |
| 7 | Scan FINISHGOOD tidak mengonsumsi material | ✅ | `barang.status.ts:53-106` |
| 8 | REGISTER bukan produk jadi | ⚠️ semantik dijaga, tetapi tidak ada validasi produksi | P-03 |
| 9 | FINISHGOOD indikator produk jadi | ⚠️ indikator status saja | P-10 |
| 10 | OUT/RETUR/BAD tidak otomatis hasil produksi baru | ❌ dilanggar `getFinishgoodCounts` | `production-order.ts:266` |
| 11 | FINISHGOOD lalu OUT tidak dihitung ulang | ❌ view historis berubah | `migrations/20260829120000...:21` |
| 12 | RETUR→FINISHGOOD punya aturan histori | ⚠️ ada riwayat; `finishGoodAt` belum ada | §9 S7 |
| 13 | Perubahan BOM tidak mengubah histori | ❌ BOM ditimpa; tidak ada snapshot | P-05 |
| 14 | Tidak ada pengurangan stok ganda | ⚠️ tidak ganda pada saldo, tetapi dua ledger | P-07 |
| 15 | Tidak ada penambahan stok ganda | ⚠️ idem | P-07 |
| 16 | SM ditelusuri lewat prosesnya | ⚠️ hanya di jalur HP | §5.2 jawaban 9 |
| 17 | Transfer bukan konsumsi final dua kali | ✅ `getWipRows` mengurangi alokasi transfer | `wip.ts:155-182` |
| 18 | Transaksi stok konsisten dengan ledger acuan | ❌ acuan belum ditetapkan | P-06 |
| 19 | Audit trail dipertahankan | ✅ append-only pada riwayat; ⚠️ `RiwayatBarang` tanpa idempotensi | P-09 |
| 20 | Tanggal bisnis Asia/Jakarta | ❌ tidak konsisten | P-12 |
| 21 | Histori tidak dihapus | ⚠️ append-only, tetapi `updateBom`/`updatePemakaian` dapat menghapus baris | P-05; §14 (Data loss) |

---

## Lampiran B — Temuan yang Membutuhkan Verifikasi (belum dapat dipastikan dari codebase)

1. **Jumlah baris aktual** per tabel di database target (produksi, ledger, FG) — butuh koneksi DB.
2. **Apakah `prisma migrate status` bersih** (tidak ada drift) di database target — tidak dapat dijalankan.
3. **Apakah seed pernah berhasil** setelah `setApproval` mewajibkan `targetWarehouseId`. Secara statis `seed-item.ts:181-189` akan melempar `KeputusanItemError`; perlu konfirmasi apakah seed yang dipakai adalah versi lain.
4. **Apakah ada konsumen eksternal** (selain frontend repo ini) yang memanggil `/api/hasil-produksi-harian` atau `/api/quality/final-inspections`.
5. **Kebijakan bisnis** untuk unit legacy 5.010 FINISHGOOD (tetap ditahan atau diverifikasi).
6. **Struktur BOM aktual** di database (apakah BOM subassembly untuk item Top Coat `SM0001–SM0008` sudah ada; seed hanya membuat BOM varian 1 baris).
7. **Apakah routing aktif** mencakup semua divisi yang dipakai produksi (routing ditulis hanya oleh seed).

---

## Lampiran C — Indeks Bukti (file:line)

| Topik | Lokasi |
|---|---|
| Router terdaftar | `backend/src/app.ts:47-77` |
| Router mati/retired | `backend/src/routes/quality.ts:16-28`; `backend/tests/quality-routes.test.ts:33-48`; `backend/tests/retired-workspace-api.test.ts:15-32` |
| Schema produksi | `backend/prisma/schema.prisma:1144-1204` |
| Schema produksi harian baru | `backend/prisma/schema.prisma:1212-1251` |
| Schema ledger | `backend/prisma/schema.prisma:821-844`, `:1386-1456` |
| Schema lot & dokumen WIP | `backend/prisma/schema.prisma:1011-1066` |
| Schema BOM | `backend/prisma/schema.prisma:941-1009` |
| Schema QC & FG | `backend/prisma/schema.prisma:1556-1701` |
| Logika HP | `backend/src/model/hasilProduksiHarian/hasilProduksiHarian.ts:435-712` |
| Logika PH + BOM | `backend/src/model/produksiHarian/produksiHarian.ts:124-215`, `:472-612` |
| Ledger engine | `backend/src/model/inventory/inventory.ts:1045-1302`, `:1060-1138` |
| Saldo legacy | `backend/src/model/stokItem/stokItem.ts:18-53`, `:115-137` |
| Approval material | `backend/src/model/permintaanBarang/permintaanBarang.ts:477-669` |
| Pemakaian/lot | `backend/src/model/pemakaianMaterial/pemakaianMaterial.ts:210-231`, `:331-374` |
| Genealogi WIP | `backend/src/model/wip/wip.ts:47-253` |
| QC final → Barang | `backend/src/model/quality/quality.ts:727-991`, `:897-942` |
| Generate Barang | `backend/src/model/barang/barang.generate.ts:142-244` |
| Status & riwayat barang | `backend/src/model/barang/barang.status.ts:25-134` |
| Laporan FG salah basis | `backend/prisma/migrations/20260829120000_add_view_barang_finishgood_per_bulan/migration.sql:11-28`; `backend/src/model/production-order/production-order.ts:255-279` |
| Backfill `Item.stok` | `backend/prisma/migrations/20261101090000_add_produksi_harian/migration.sql:87-97` |
| Opening RAW + StockBalance | `backend/prisma/migrations/20261029132700_inventory_balance_and_legacy_raw_opening/migration.sql:103-199` |
| BOM CRUD (timpa versi) | `backend/src/model/bom/bom.ts:203-291` |
| Seed BOM varian | `backend/prisma/seed-production-flow.ts:127-171` |
| Seed drift (approval) | `backend/prisma/seed-item.ts:180-189` |
| Timezone helper | `backend/src/lib/tanggalBisnis.ts:1-47` |
| Bukti frontend memanggil endpoint mati | `frontend/src/api/erp.ts:379,406,490` |
