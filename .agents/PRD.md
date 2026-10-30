# PRD — Helmet ERP (Manufacturing)

| | |
|---|---|
| **Versi** | 1.1 |
| **Tanggal** | 29 Oktober 2026 |
| **Status** | PRD diselaraskan dengan repository yang ada; M1–M6 belum dinyatakan selesai (lihat §22 dan §24) |
| **Dokumen** | Kebutuhan produk, kondisi implementasi yang teramati, arsitektur, workflow, dan milestone |

## 1. Ringkasan

Helmet ERP adalah aplikasi web ERP manufaktur helm untuk mengelola stok, batch, alur produksi antar divisi, QC, rework, finished goods (FG), dan traceability. Sistem berfokus pada akurasi stok, pencegahan stok negatif atau konsumsi ganda, serta keterlacakan dari bahan awal sampai unit FG.

Aplikasi saat ini terdiri dari backend Express/TypeScript dengan Prisma dan MariaDB, serta frontend React/TypeScript. Backend menyediakan REST API; frontend mengaksesnya melalui klien API. Repository juga memuat Redis dan WebSocket. Rincian stack dan batas antara kondisi saat ini dengan target bisnis dijelaskan di §6.

## 2. Latar Belakang & Masalah

- Pencatatan stok dan hasil produksi per divisi rawan tidak sinkron.
- Asal batch dan proses yang dilalui unit FG sulit ditelusuri.
- Yield, reject, dan rework belum tercatat konsisten.
- Risiko dua operator mengonsumsi saldo stok yang sama secara bersamaan.
- Pembuatan halaman CRUD, form, tabel, dan laporan berulang dapat memperlambat development.

## 3. Tujuan dan Indikator Keberhasilan

| ID | Tujuan | Indikator |
|---|---|---|
| G1 | Stok akurat | Selisih stok sistem dan fisik ≤ 1% saat stock opname |
| G2 | Traceability | Riwayat FG dapat ditampilkan < 10 detik |
| G3 | Monitoring kualitas | Yield dan reject tersedia per tahap, PO, dan periode |
| G4 | Input cepat | Transaksi produksi dapat dicatat < 1 menit |
| G5 | Development efisien | Modul memakai komponen dan service reusable, bukan implementasi berulang |
| G6 | Data konsisten | Semua perubahan stok melalui service terpusat dan transaksi database |

## 4. Non-Tujuan v1

- Akuntansi, general ledger, payroll.
- Modul pembelian, penjualan, dan penagihan lengkap.
- Integrasi mesin, RFID, atau IoT otomatis.
- Aplikasi mobile native khusus; frontend saat ini juga memiliki target Electron dan Android melalui Capacitor.
- Material Requirements Planning (MRP).
- Sistem scan QR berbasis kamera browser; QR cukup membuka URL unit FG.

## 5. Pengguna dan Peran

| Peran | Kebutuhan |
|---|---|
| Admin | User, role, master data, konfigurasi |
| Supervisor Produksi | Buat/rilis/tutup PO, pantau WIP dan yield, approve adjustment |
| Operator Produksi | Catat konsumsi dan output sesuai divisi |
| Staf Gudang | Penerimaan, transfer, adjustment |
| QC | Inspeksi, hasil pass/reject/rework/repair |
| Manajer | Dashboard dan laporan read-only |

## 6. Stack dan Arsitektur

### 6.1 Stack

- Backend: Node.js, Express 4, TypeScript, Prisma ORM.
- Frontend: React 19, TypeScript, Vite, Tailwind CSS.
- Database: MariaDB, diakses melalui Prisma; Redis tersedia untuk fungsi cache/infrastruktur.
- Komunikasi real-time: WebSocket.
- Testing: Vitest dan Supertest di backend; Vitest di frontend.
- Dependency management: npm, dengan manifest terpisah di `backend/` dan `frontend/`.
- Frontend juga memiliki build Electron dan integrasi Android melalui Capacitor.

### 6.2 Arsitektur

```text
Browser / Electron / Android WebView
  React + TypeScript
          | HTTP / JSON
          v
Express API (Node.js + TypeScript)
  Router -> Middleware (auth/authorization)
         -> Controller -> Model/domain functions
         -> Prisma ORM
          |
MariaDB               Redis / WebSocket
```

- Backend dan frontend adalah aplikasi terpisah dalam satu repository; API menjadi batas komunikasi antarkeduanya.
- Aturan bisnis saat ini berada pada model/domain functions, controller, dan transaksi Prisma. Perubahan baru harus mengikuti pola domain yang telah ada dan menjaga controller tetap tipis.
- Pencatatan inventory baru menggunakan model `InventoryMovement` dan fungsi posting/reversal terpusat di model inventory. Alur inventory/WIP lama juga masih ada; konsolidasi keduanya perlu ditinjau.
- Operasi stok multi-record harus menggunakan transaksi, idempotency key, dan penguncian yang sesuai.
- Implementasi tidak menggunakan Laravel, Inertia, atau Vue.

## 7. Package dan Tooling Development

Gunakan dependency yang sudah tercantum pada manifest aplikasi dan tambahkan package hanya untuk kebutuhan terukur. Versi aktual berada di `backend/package.json` dan `frontend/package.json`; jangan mengikuti daftar package Laravel dari rancangan awal.

### 7.1 Runtime dan data

| Package/tool | Area | Fungsi |
|---|---|---|
| `express` | Backend | HTTP API dan routing |
| `@prisma/client`, `prisma`, `@prisma/adapter-mariadb`, `mariadb` | Backend | ORM, schema/migration, dan koneksi MariaDB |
| `ioredis` | Backend | Integrasi Redis |
| `ws` | Backend | WebSocket |
| `react`, `react-dom`, `react-router-dom` | Frontend | UI dan navigasi aplikasi |
| `vite`, TypeScript | Backend/frontend | Development dan build |
| `vitest`, `supertest` | Testing | Unit/feature tests dan HTTP testing backend |
| `xlsx` | Frontend | Membaca XLSX untuk fitur import yang ada; bukan bukti fitur ekspor XLSX |
| `jspdf`, `jspdf-autotable`, `qrcode.react`, `jsbarcode` | Frontend | Dokumen/label dan tampilan QR/barcode |

## 8. Aturan Penggunaan Package

1. Package harus menyelesaikan kebutuhan nyata atau mengurangi kode berulang secara signifikan.
2. Package tidak boleh menggantikan aturan bisnis inti stok/produksi dengan black box.
3. Package untuk fitur tahap lanjut dipasang saat milestone fitur tersebut dimulai.
4. Pastikan kompatibel dengan versi Node.js, TypeScript, Prisma, React, dan toolchain proyek.
5. Audit lisensi, aktivitas pemeliharaan, dependensi, dan kompatibilitas sebelum pemasangan.
6. Package tidak boleh menjadi satu-satunya pengaman untuk integritas stok.
7. Semua aturan stok, PO, QC, dan traceability tetap diuji dengan test aplikasi.

## 9. Struktur Repository

```text
RSV_Helmet/
├── backend/
│   ├── api/                 # API entry point
│   ├── prisma/              # Prisma schema, migrations, seed
│   ├── src/
│   │   ├── controller/
│   │   ├── lib/
│   │   ├── middleware/
│   │   ├── model/
│   │   ├── routes/
│   │   └── websocket/
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── pages/
│   │   └── lib/
│   └── electron/
└── .agents/PRD.md
```

## 10. Komponen Reusable untuk Mempercepat Development

Frontend telah menggunakan komponen React di `frontend/src/components/`, halaman di `frontend/src/pages/`, dan klien API di `frontend/src/api/`. Periksa dan gunakan komponen/pola yang ada sebelum membuat komponen baru.

Ketentuan:
- Komponen menerima props bertipe TypeScript.
- Form menampilkan dan menangani error validasi yang dikirim API.
- Tabel menggunakan pagination server-side untuk data besar.
- Komponen tidak mengandung aturan bisnis stok/produksi.
- Konfirmasi diperlukan untuk posting transaksi yang tidak dapat dibatalkan.

## 11. Master Data

Bagian ini adalah kebutuhan domain, bukan nama tabel/schema yang harus diikuti secara literal. Skema aktual memakai model Prisma dengan nama seperti `ProductVariant`, `Barang`, `Item`, `ProductionBatch`, `Bom`, `ProductionRouting`, dan `Divisi`. Pemetaan setiap kebutuhan PRD ke model yang ada perlu dirapikan sebelum menambah tabel duplikat.

| Entitas | Kolom/aturan utama |
|---|---|
| `product_models` | id, code, name |
| `items` | id, sku, name, product_model_id nullable, family_code, size, variant_code, type, uom_id, is_active |
| `uoms` | id, code, name |
| `locations` | id, code, name, division, type |
| `production_batches` | id, code, status, started_on, notes |
| `batches` | id, code unik, item_id, production_batch_id, code_key, batch_date, sequence, source_type, source_id |
| `code_sequences` | scope_key, seq_date, last_number; unique(scope_key, seq_date) |
| `routings` | id, name, kind |
| `routing_steps` | routing_id, sequence, step_type, is_optional, transforms_item, from_location_id, to_location_id |
| `routing_step_transforms` | routing_step_id, input_family_code, output_family_code |
| `boms` | id, output_item_id, is_active |
| `bom_lines` | bom_id, input_item_id, quantity_per_unit |

BOM bertingkat: BOM helm memuat batok, komponen beli jadi, dan subassembly; BOM subassembly memuat komponen mentah.

## 12. Inventory dan Stock Movement

Model di bawah adalah target invariant inventory. `StockBalance` dan tabel `StockAdjustment` sudah tersedia; saldo inventory diperbarui bersama movement oleh model inventory. Konsolidasi belum selesai: ledger stok item lama dan jalur mutasi di luar service terpusat masih ada, workflow approval adjustment belum dibuat, dan saldo legacy non-RAW belum dipetakan. Saldo legacy RAW sudah diimpor secara idempoten ke Gudang Raw tanpa menghapus histori. Pergerakan material/WIP juga terhubung ke `PemakaianMaterial`, `PemakaianMaterialItem`, `HasilProduksiHarian`, dan `WipTransfer`.

### 12.1 Tabel

| Tabel | Kolom utama |
|---|---|
| `InventoryLocation` | Lokasi gudang/divisi untuk pencatatan stok |
| `InventoryMovement` | item/barang, lokasi asal/tujuan, quantity decimal, type, idempotency key, sumber, user, waktu, dan relasi reversal |
| `StockBalance` | Saldo item/batch/lokasi; unique per kombinasi item, batch, dan lokasi; diperbarui atomik bersama ledger |
| `StockAdjustment` | Permintaan koreksi/opname dengan alasan, pembuat, approver, status, dan referensi movement hasil approval |
| Stock opname | Sesi dan baris hitung fisik; selisih harus melalui adjustment yang disetujui dan direkonsiliasi terhadap ledger |

### 12.2 Aturan target

1. `InventoryMovement` adalah satu-satunya ledger stok, append-only; koreksi dibuat sebagai reversal, bukan mengedit atau menghapus movement asal.
2. `StockBalance` harus konsisten dengan agregasi ledger untuk setiap item/barang, batch, dan lokasi.
3. Semua perubahan stok—penerimaan, pemakaian, hasil produksi, mutasi gudang, opname, dan koreksi—wajib melalui satu `StockMovementService`; controller/model lain tidak boleh menulis saldo atau ledger secara langsung.
4. Movement dan `StockBalance` diperbarui dalam transaksi database yang sama.
5. Gunakan `lockForUpdate` dengan urutan penguncian konsisten untuk mencegah race condition.
6. Stok negatif ditolak pada sumber kebenaran yang sama.
7. Adjustment/selisih opname wajib memiliki alasan dan persetujuan supervisor sebelum movement diposting.
8. Transfer membuat dua movement berpasangan dalam satu transaksi dengan satu `group_uuid`; transfer tidak boleh menggandakan konsumsi.
9. Posting produksi dan output harus atomik dan idempoten sesuai workflow yang menghasilkannya.
10. Kuantitas menggunakan decimal presisi, bukan float atau integer yang membatasi satuan pecahan.

## 13. Production

Implementasi produksi saat ini mencakup dua kebutuhan yang berhubungan tetapi tidak identik: `ProductionOrder` untuk rencana/order dan jadwal/realisasi per tahap, serta workflow produksi harian/WIP untuk pergerakan material antar divisi. Jangan menganggap satu record ProductionOrder sudah mewakili work order setiap tahap.

### 13.1 Data produksi aktual dan target

Schema Prisma di working tree memodelkan `ProductionOrder` sebagai order berdasarkan periode dengan `nomor`, `periode`, `label`, `totalQty`, `status`, dan `mulaiProduksi`. Item order berada di `ProductionOrderItem`; realisasi disimpan per varian/tanggal di `ProductionRealization` dan secara agregat per tahap/tanggal di `ProductionRealizationStage`. Kapasitas serta perubahan target/alokasi jadwal memiliki model tersendiri.

Konsumsi dan output lintas divisi saat ini berjalan melalui workflow hasil produksi harian dan WIP. Tabel work order per tahap, input/output order, serta batch lineage pada rancangan awal bukan model yang dapat diasumsikan tersedia secara langsung. Tentukan apakah akan dipetakan ke workflow yang ada atau ditambahkan setelah kebutuhan operasional dikonfirmasi.

### 13.2 Status PO — target dan implementasi

`draft → released → in_progress → completed → closed`

- `draft → released`: rute dan input ditentukan.
- `released → in_progress`: konsumsi pertama dicatat.
- `in_progress → completed`: output tercatat, yield dihitung.
- `completed → closed`: QC tahap terkait selesai.
- PO `closed` tidak dapat diubah.

Schema Prisma di working tree memuat status `DRAFT`, `RELEASED`, `IN_PROGRESS`, `COMPLETED`, `CLOSED`, dan `BATAL`. Alur transisi, konsistensi endpoint/controller, serta migration lifecycle yang sedang dikerjakan tetap harus divalidasi sebelum status ini dianggap selesai.

### 13.3 Alur proses

```text
Batok Mentah
  → Buffing
  → Basecoat
  → Decal
  → Topcoat
  → QC Awal
      ├─ Reject → Lokasi Reject
      ├─ Rework → PO rework ke divisi penyebab → proses berikutnya
      └─ Lolos
          ├─ Poles (opsional)
          └─ Assembly
              → QC 2
                  ├─ Repair → Assembly
                  └─ Pass → Packing → Finished Goods + QR
```

### 13.4 Item per tahap

- Mentah: `SHELL-RAW`
- Buffing: `SHELL-BUFF`
- Basecoat: `SHELL-BASE-BLK`, `SHELL-BASE-WHT`, `SHELL-BASE-PGR`
- Decal: solid black, solid white, solid platinum grey, carbon, redline, nation, BOB
- Topcoat: black glossy, black doff, white glossy, platinum grey, carbon, redline, nation, BOB

Konversi hanya boleh mengikuti pasangan input-output yang terdefinisi di routing transform.

### 13.5 QC Awal

- `pass`: tujuan poles atau assembly.
- `reject`: pindah ke lokasi reject; responsible division dan reason wajib.
- `rework`: dibuat PO rework ke divisi penyebab; responsible division dan reason wajib.
- Rework kembali ke tahap penyebab dan melewati tahap berikutnya sesuai rute.

### 13.6 Poles

- Opsional, diputuskan inspektor QC awal.
- Item tidak berubah.
- Setelah poles langsung ke assembly tanpa QC ulang.

### 13.7 Subassembly, Assembly, QC 2, Packing

- Subassembly mengonsumsi komponen mentah dan menghasilkan stok subassembly.
- Assembly mengonsumsi batok topcoat, komponen beli jadi, dan subassembly sesuai BOM.
- Ukuran helm ditentukan saat assembly: MD, LG, XL, XXL.
- QC 2 hanya pass atau repair; repair kembali ke assembly untuk perbaikan kecil.
- Packing tidak mengubah item; membuat unit FG dan QR untuk item lolos QC 2.
- Implementasi memiliki modul subassembly, inspeksi/repair, dan penerimaan finished goods. Kesesuaian alur di atas, termasuk poles dan pembuatan QR individual, belum dinyatakan terverifikasi end-to-end.

## 14. Traceability dan Kode Batch

Implementasi sekarang memakai batch produksi, lot pada `PemakaianMaterialItem`, movement inventory, hasil produksi, inspeksi QC, dan record `Barang`. Schema yang diperiksa tidak memiliki model bernama `batch_lineages`; traceability target harus dipetakan ke relasi yang ada, bukan diasumsikan sudah terpenuhi hanya karena modul batch tersedia.

### 14.1 Relasi

- Trace mundur: FG → batch → lineage → batch asal, rekursif.
- Trace maju: batch input → batch output → FG.
- `batch_lineages` mendukung banyak input ke banyak output.

### 14.2 Kode

Format:

`{kode batch produksi}-{kode varian/family}-{ddmmyy}-{urut 4 digit}`

Contoh:

`BC004-WB004-271026-0001`

- Item helm memakai `variant_code`.
- Batok sebelum assembly memakai `family_code`.
- Sequence naik per kode varian/family per tanggal.
- Sequence diambil dan dikunci dalam transaksi agar tidak duplikat.
- Satu kode batch dapat berisi kuantitas lebih dari satu.

## 15. Finished Goods dan QR

- FG didaftarkan pada packing setelah QC 2 pass.
- Setiap unit FG mendapat kode unik dan QR.
- QR membuka halaman riwayat/traceability untuk kode unit FG; endpoint target `/u/{code}` belum dikonfirmasi ada.
- Halaman menampilkan histori proses dan batch yang dapat ditelusuri.
- FG tidak dapat dibuat dari unit yang belum lolos QC 2.
- Implementasi memiliki `FinishedGoodsReceipt` yang terhubung dengan baris inspeksi QC serta scan/riwayat `Barang`. Verifikasi bahwa QR unit membuka traceability penuh dan bahwa hanya unit QC pass yang dapat diterima sebagai FG masih diperlukan.

## 16. Dashboard dan Laporan

- Stok per item, batch, lokasi, dan divisi.
- WIP per tahap.
- PO aktif dan selesai.
- Yield dan reject per PO, tahap, divisi, dan periode.
- Riwayat batch dan FG.
- Ekspor CSV tersedia untuk daftar barang; kebutuhan ekspor Excel/PDF untuk laporan produksi/QC belum terbukti terpenuhi.
- Dashboard manajer read-only.

API dan UI sudah memiliki dashboard, ringkasan statistik, laporan produksi/QC/WIP, dan ekspor barang JSON/CSV. Cakupan metrik target pada daftar ini perlu dibandingkan satu per satu dengan output saat ini.

## 17. Keamanan dan Audit

- Login berbasis API dengan JWT dan middleware autentikasi/otorisasi.
- Role dan permission dikelola aplikasi melalui model dan middleware; tidak memakai `spatie/laravel-permission`.
- Otorisasi resource dan pembatasan divisi diterapkan pada endpoint/domain yang relevan; cakupan menyeluruh harus diverifikasi.
- Operator hanya mengakses data divisinya.
- Audit log aktivitas master data dan persetujuan perlu divalidasi; jangan mengasumsikan package Laravel Activitylog tersedia.
- Ledger stok menjadi audit trail utama stok.
- HTTPS, perlindungan endpoint API, rate limiting login, dan password hashing harus dipastikan pada konfigurasi deploy.
- Log aplikasi tidak menyimpan credential atau data sensitif.

## 18. Kebutuhan Non-Fungsional

| Aspek | Target |
|---|---|
| Konsistensi | ACID, row locking saat posting stok |
| Performa | Halaman utama < 2 detik pada data produksi normal |
| Keamanan | HTTPS, autentikasi API, authorization, rate limiting, dan password hashing |
| Ketersediaan | Backup harian dan uji restore |
| Auditability | Ledger append-only; audit log tidak dapat diubah dari UI |
| Usability | Form produksi nyaman di tablet |
| Maintainability | Test otomatis untuk stok, PO, QC, dan traceability; cakupan integrasi DB/UAT harus dibuktikan |
| Development | Komponen UI dan service domain reusable |

## 19. Testing

Test harus dibuat sebelum atau bersamaan dengan implementasi modul.

### Unit

- Yield.
- Status PO dan transisi.
- Konversi item.
- Kode batch dan sequence.
- Perhitungan BOM.

### Feature

- Penerimaan, transfer, konsumsi, output.
- Adjustment dan approval.
- PO end-to-end.
- QC pass/reject/rework/repair.
- Packing dan FG QR.
- Authorization per role/divisi.

### Invariant dan concurrency

- Saldo sama dengan agregasi ledger.
- Stok tidak pernah negatif.
- Dua operator mengonsumsi stok yang sama secara bersamaan.
- Kode batch tidak duplikat.
- Posting PO menghasilkan movement yang tepat satu kali.
- QC dan rework tidak menggandakan stok.

## 20. Development Workflow

1. Buat branch fitur.
2. Perbarui Prisma schema dan buat migration yang aman.
3. Buat test untuk aturan bisnis.
4. Implementasikan fungsi domain/model dan transaksi.
5. Implementasikan controller, validasi input, dan middleware otorisasi.
6. Implementasikan UI React dan klien API.
7. Jalankan test dan build backend/frontend.
8. Review migration, permission, ledger, locking, dan transaksi.
9. Merge setelah CI lulus.

Perintah standar:

```powershell
Push-Location backend
npm test
npm run build
Pop-Location

Push-Location frontend
npm test
npm run build
Pop-Location
```

Gunakan `npm run lint` pada frontend jika perubahan menyentuh UI. Perintah database Prisma dijalankan dari folder `backend/` dan harus menunjuk ke database pengembangan yang benar.

## 21. Deployment dan Operasional

- Backend memiliki konfigurasi Docker Compose untuk MariaDB, Redis, dan API. Konfigurasi environment local, staging, dan production harus dipisah.
- Infrastruktur queue/background job belum terverifikasi; gunakan hanya saat kebutuhan volume dan operasi ekspor membutuhkannya.
- Backup database harian dan uji restore adalah kebutuhan yang belum terverifikasi.
- CI untuk test/build dan proses deploy harus dikonfirmasi dari konfigurasi repository/hosting.
- Deploy hanya setelah migration dan build lolos.
- Tidak menyimpan secret di repository.

## 22. Milestone

| Fase | Isi | Hasil | Status |
|---|---|---|---|---|
| M1 | Setup, auth, permission, master data, reusable UI | Fondasi | ⚠️ Sebagian: API/frontend, login, role/permission, dan master data tersedia; penyelarasan kebutuhan, validasi cakupan, serta UAT belum selesai |
| M2 | Inventory, ledger/movement, kontrol saldo | Stok akurat | ⚠️ Sebagian: `InventoryMovement`, posting/reversal, idempotency, transaksi, WIP, dan stock opname ada; konsolidasi jalur stok, rekonsiliasi ledger, approval, dan uji concurrency dengan DB belum dibuktikan |
| M3 | Produksi Buffing end-to-end | Produksi pertama tercatat | ⚠️ Sebagian: order, jadwal/realisasi per tahap, hasil produksi harian, dan WIP tersedia; skenario end-to-end terhadap alur Buffing aktual belum diverifikasi |
| M4 | Basecoat, decal, topcoat, lineage | Alur utama dan traceability | ⚠️ Sebagian: routing, BOM, transfer WIP, batch/lot, dan seed alur proses tersedia; lineage lengkap sampai unit FG dan kesesuaian BOM aktual perlu UAT |
| M5 | QC, poles, subassembly, assembly, QC 2, packing, FG QR | FG terlacak | ⚠️ Sebagian: inspeksi QC, reject/repair, subassembly, penerimaan FG, dan scan/riwayat barang ada; poles sebagai WO, QC-gate packing, QR individual, dan traceability ujung-ke-ujung belum dibuktikan |
| M6 | Dashboard, laporan, export, backup, UAT | Pilot siap | ⚠️ Sebagian: dashboard/statistik, laporan WIP/QC/produksi, dan ekspor barang JSON/CSV ada; ekspor laporan XLSX/PDF, backup/restore, retensi audit, CI/deploy, dan UAT belum diverifikasi |

**Aturan status:** “Ada” berarti kode/model/route ditemukan saat inspeksi repository, bukan bukti siap produksi. Milestone hanya boleh ditandai selesai setelah acceptance criteria diuji, termasuk alur integrasi yang relevan dan persetujuan UAT. Tidak ada milestone yang saat ini dinyatakan selesai.

## 23. Keputusan dan Isu Terbuka

### Keputusan

- Backend Express/TypeScript + Prisma dan frontend React/TypeScript berkomunikasi melalui REST API dalam satu repository.
- MariaDB adalah database aplikasi; Redis dan WebSocket digunakan/dikonfigurasi untuk kebutuhan pendukung.
- Semua penambahan fitur harus mengikuti pola/model aktual dan tidak menambah implementasi Laravel/Vue.
- Ledger inventory menggunakan movement dan reversal; koreksi tidak boleh menghapus jejak transaksi.
- Posting movement harus atomik dan idempoten.
- Ukuran ditentukan di assembly.
- QC awal menentukan reject/rework/poles.
- QC 2 pass/repair.
- Target FG/QR harus tetap memenuhi QC-gate serta traceability.
- Dependency dipasang sesuai kebutuhan aktual.

### Isu terbuka

1. Daftar model helm selain Windbreaker.
2. Daftar 32 kode varian helm dan BOM.
3. Kode batch untuk item sebelum assembly.
4. Daftar komponen beli jadi dan subassembly.
5. Bagaimana traceability dipetakan dari lot/movement hingga unit `Barang` dan apakah perlu model lineage eksplisit.
6. Hosting final, CI/deploy, backup, dan uji restore.
7. Apakah domain dan label order planning perlu dipisahkan lebih jelas dari work order per tahap.

## 24. Checklist Penyelarasan dan Pekerjaan Lanjutan

Diperbarui 29 Oktober 2026. File kerja sedang memiliki perubahan kode lokal; status milestone di bawah tidak mengesahkan perubahan tersebut atau kesiapan produksi.

Audit terbaru yang disampaikan pengguna melaporkan: backend build lulus tetapi 3 test gagal; frontend build lulus dengan warning bundle sekitar 3,1 MB, 49 test lulus, dan lint memiliki 49 error. Hasil ini belum diulang secara independen pada sesi ini; angka test pada inspeksi sebelumnya di bawah adalah catatan historis, bukan status terkini.

### Terverifikasi di repository

- [x] Backend memakai Express/TypeScript, Prisma, MariaDB; frontend memakai React/TypeScript.
- [x] Terdapat endpoint autentikasi, role/permission, inventory, order/realisasi produksi, WIP, QC, subassembly, dan finished goods.
- [x] Ada model `InventoryMovement` dengan idempotency key dan relasi reversal.
- [x] Terdapat dashboard/statistik, laporan produksi/QC/WIP, dan ekspor barang JSON/CSV.
- [x] `backend`: 40 file test / 604 test lulus pada working tree saat diperiksa.
- [x] `frontend`: 8 file test / 49 test lulus pada working tree saat diperiksa.

### Belum terverifikasi / pekerjaan selanjutnya

- [ ] Susun acceptance criteria dan jalankan UAT satu skenario bisnis lengkap dari penerimaan bahan sampai FG.
- [ ] Verifikasi mutasi saldo konsisten dengan seluruh ledger lama dan baru; uji concurrency menggunakan MariaDB, bukan hanya mock/unit test.
- [x] Tambahkan tabel `StockBalance` dan `StockAdjustment`; `StockBalance` diperbarui atomik bersama posting `InventoryMovement`.
- [x] Migrasikan saldo legacy RAW secara idempoten ke Gudang Raw dan backfill `StockBalance` dari ledger inventory; migration diterapkan pada database Docker lokal.
- [ ] Petakan saldo legacy SM dan HABIS PAKAI ke lokasi yang ditetapkan, rekonsiliasi seluruh saldo, dan buat workflow approval supervisor untuk `StockAdjustment` sebelum cutover.
- [ ] Hapus seluruh jalur tulis ledger/saldo alternatif setelah migrasi; seluruh operasi harus melalui `StockMovementService`.
- [ ] Uji otorisasi per role dan divisi untuk seluruh route inventory, produksi, QC, FG, dan laporan.
- [ ] Verifikasi transisi status PO, migration lifecycle, dan batas antara order perencanaan dengan work order tahap produksi.
- [ ] Uji genealogy/trace mundur dan maju dari FG sampai batch/lot input; tentukan kebutuhan lineage eksplisit.
- [ ] Pastikan QC pass menjadi prasyarat penerimaan FG; validasi QR per unit membuka riwayat yang benar.
- [ ] Putuskan dan implementasikan ekspor XLSX/PDF untuk laporan yang diperlukan; jangan menyamakan fungsi import XLSX dengan export.
- [ ] Tetapkan audit log dan retensi yang dibutuhkan serta buktikan implementasi dan jadwalnya.
- [ ] Siapkan backup terjadwal, simpan di lokasi aman, dan lakukan uji restore.
- [ ] Konfirmasi CI, staging/production deployment, monitoring, dan checklist akses sebelum pilot.
- [ ] Lengkapi data model/varian helm, BOM, komponen beli jadi, dan subassembly berdasarkan data produksi yang disetujui.
- [ ] Jalankan `npm run build` backend dan frontend serta lint frontend pada perubahan berikutnya; test suite saja belum membuktikan build produksi.
