# Project Agent Instructions

Instruksi ini berlaku untuk seluruh project `express-api`. Baca sebelum mengubah kode.

## Project Overview

- Backend REST API berbasis Node.js, TypeScript, dan Express.
- Modul utama: autentikasi + RBAC (`admin`, `user`, `gudang`), user, master data (style, color, size), product, variant produk, barang (group/dus, batch, status, riwayat), production order + jadwal, permintaan barang, karyawan/divisi, notifikasi, dan integrasi jurnal.
- Database: MySQL/MariaDB melalui Prisma ORM 7 dan `@prisma/adapter-mariadb`.
- Auth: JWT dan bcryptjs; Redis dipakai untuk cache product, JWT blacklist, dan pub/sub event WebSocket.
- Tidak ada library validasi request khusus.
- Runtime menggunakan ESM. Import lokal harus memakai ekstensi `.js` pada source TypeScript.
- Entry point development: `api/index.ts`; konfigurasi Express utama ada di `src/app.ts`.

## Repository Structure

- `api/`: entry point deployment/runtime.
- `src/routes/`: deklarasi route dan middleware route.
- `src/controller/`: handler HTTP; validasi input dan response API.
- `src/model/`: akses data dan aturan domain per modul.
- `src/lib/`: Prisma, JWT, Redis, blacklist token, cache notifikasi (`notificationCache.ts`), dan helper bersama.
- `src/middleware/`: middleware Express, terutama autentikasi.
- `src/websocket/`: integrasi WebSocket.
- `prisma/schema.prisma`: sumber model database.
- `prisma/migrations/`: histori perubahan schema; jangan mengubah migration lama.
- `prisma/seed.ts`: data awal database; `prisma/seed-production-order.ts`: seed ProductionOrder (upsert, dijalankan belakangan).
- `generated/prisma/`: hasil generate Prisma; jangan edit manual.
- `tests/`: test API dengan Vitest dan Supertest.

## Architecture

Alur aktual umumnya:

```text
HTTP request -> Express middleware -> route -> authenticate / requireRole (jika dipasang)
	-> controller -> model/lib -> shared Prisma instance -> MariaDB/MySQL
```

- Route mendaftarkan endpoint, middleware, dan controller; query database tidak diletakkan di route.
- Controller membaca parameter/body/query, melakukan validasi lokal, memanggil model/lib, lalu menentukan status dan response.
- Model menangani query per modul di direktorinya masing-masing (`src/model/<modul>/`): user, product, variantproduk, barang, barangGroup, karyawan, divisi, permintaanBarang, production-order, dan master data.
- `src/model/barang/` menangani batch, counter, barcode, transaction, status, histori, dan bulk scan.
- `src/lib/prisma.ts` membuat satu Prisma client dengan `PrismaMariaDb`.
- `src/app.ts` mengaktifkan CORS, JSON body, dan URL-encoded body secara global.

## Data Flow

- Product memiliki banyak ProductVariant.
- ProductVariant mereferensikan Product, Style, Color, dan Size, serta memiliki Barang dan BarangCounter.
- Barang mereferensikan ProductVariant, ProductionBatch, dan BarangGroup (dus), serta memiliki RiwayatBarang.
- ProductionBatch bersifat global, bukan milik Product atau Variant, dan memiliki Barang serta BarangCounter.
- GET variant standalone membaca SQL view `ViewVariantProduk`.
- Write product/variant menghapus cache Redis terkait dan menerbitkan event WebSocket setelah database berhasil.
- Karyawan opsional terikat Divisi (`divisiId`, `onDelete: SetNull`); Divisi 1:1 dengan tahap jadwal produksi dan dipakai untuk SPK per divisi.
- PermintaanBarang punya banyak PermintaanBarangItem (teks bebas, bukan FK ProductVariant); hapus parent `Cascade` ke items.
- Notifikasi tidak punya model DB; daftar dibaca dari cache (`src/lib/notificationCache.ts`).

## Domain Model

Model aktual di `prisma/schema.prisma`:

- `User`: unique `email`, hashed `password`, `role` (`admin`/`user`/`gudang`, default `user`), timestamp.
- `Product`: `nama`, `prefix`, dan relasi `variants`.
- `Style`: unique `nama`.
- `Color`: unique `nama`.
- `Size`: unique `nama` dan `urutan`.
- `ProductVariant`: unique `kodeVariant`, foreign key product/style/color/size, dan `tanggal`.
- `ProductionBatch`: unique `nomorBatch`, `totalProduksi`, `kapasitas` default `5000`, status `AKTIF`/`SELESAI`.
- `Barang`: unique `kodeBarang`, `variantId`, `batchId`, `groupId`, status default `REGISTER`.
- `RiwayatBarang`: `barangId`, status, `tanggal`, dan optional `keterangan`.
- `BarangCounter`: counter per `(batchId, variantId, tanggal)`.
- `BarangGroup`: dus, `nama` unique, relasi `barang Barang[]`, kapasitas `DUS_CAPACITY = 8`, `isArsip` untuk soft-archive (arsip disembunyikan & tidak dihitung penomoran).
- `StatusBarang`: master kode status (`kode` unique), dipakai FK dari `Barang.status`.
- `StatusTransition`: transisi status yang diizinkan (`fromKode` -> `toKode`).
- `ProductionOrder`: order produksi, punya `items`, `capacities`, `realisasi`, override jadwal.
- `ProductionOrderItem`: item variant per order dengan rencana.
- `ProductionRealization`: aktual pcs per variant per tanggal per order.
- `ProductionRealizationStage`: aktual per tahap per hari (`stage`: buffing/baseCoat/...).
- `ProductionCapacity`: kapasitas manual per tahap per order.
- `ProductionScheduleTargetEdit` / `ProductionScheduleAllocEdit`: override target/alokasi jadwal.
- `Karyawan`: `nama`, `jabatan`, opsional `divisiId` (`SetNull`).
- `Divisi`: unique `nama`; relasi ke `Karyawan[]`.
- `PermintaanBarang`: `noPermintaan` unique format `PR-YYYYMMDD-NNNN` (nomor urut per hari), `approval` (`BELUM_DISETUJUI`/`DISETUJUI`, default belum), relasi `items`.
- `PermintaanBarangItem`: `nama`, `spesifikasi?`, `jumlah`, `satuan?`; FK ke parent dengan `Cascade`.

Constraint penting:

- Product -> ProductVariant memakai `Cascade`.
- ProductVariant -> Barang/BarangCounter, Style/Color/Size -> ProductVariant, ProductionBatch -> Barang/BarangCounter, dan Barang -> RiwayatBarang memakai `Restrict`.
- ProductVariant unik pada kombinasi `(productId, styleId, colorId, sizeId)`.

## Business Rules

### User dan RBAC

- Role valid: `admin`, `user`, `gudang`; create user default `user`.
- `requireRole(...)` membaca role ulang dari database (bukan dari token) sehingga perubahan role/penghapusan akun langsung berlaku tanpa menunggu JWT kedaluwarsa.
- Pola proteksi umum: `router.use(authenticate)` untuk semua route; operasi tulis (`POST/PUT/PATCH/DELETE`) ditambah `adminOnly`, kecuali yang eksplisit lain (barang tulis/scan memakai `requireRole("admin", "user")`).
- Pengecualian public: `POST /api/auth/login`, `POST /api/permintaan-barang` (form tanpa login), `GET /api/status-barang`.

### Permintaan Barang

- `POST /api/permintaan-barang` public; `GET` butuh login; `PUT/PATCH/DELETE` butuh `adminOnly`.
- Nomor `PR-YYYYMMDD-NNNN` dihitung per hari dari record terakhir; race nomor di-retry sekali saat `P2002`.
- Permintaan yang sudah `DISETUJUI` terkunci: update/delete balas `409` (`PermintaanTerkunciError`).
- Item berupa teks bebas (bukan FK variant) karena dapat berupa bahan baku di luar master variant.

### Product dan ProductVariant

- Product dibuat dengan `{ nama, prefix }`; controller mewajibkan keduanya truthy.
- `kodeVariant` dibuat backend dengan format `<PREFIX_UPPERCASE><nomor 3 digit>`.
- Nomor variant berasal dari id variant terakhir milik product lalu ditambah satu.
- Duplicate kombinasi product/style/color/size menghasilkan `409` pada endpoint yang relevan.
- Style, Color, dan Size punya endpoint CRUD penuh (`GET/POST /api/styles`, `/api/colors`, `/api/sizes`, plus `GET/PUT/DELETE /:id`); seed hanya menyediakan data awal.

### ProductionBatch, Barang, dan barcode

- Batch pertama bernomor `BC001`; batch berikutnya dibuat saat batch aktif penuh.
- Kapasitas default batch adalah `5000` barang lintas semua variant.
- Satu request generate dapat didistribusikan ke beberapa batch.
- Format barcode aktual: `BC{nomorBatch 3 digit}-{kodeVariant}-{DDMMYY}-{nomorUrut 4 digit}`. Contoh: `BC001-W001-250826-0001`.
- Counter berdasarkan `(batchId, variantId, tanggal)`; nomor urut reset jika salah satu bagian berbeda.
- Generate membuat Barang berstatus `REGISTER`, histori awal berketerangan `Barang dibuat`, memperbarui `totalProduksi`, dan menandai batch penuh `SELESAI`.
- Generate memakai transaction, `SELECT ... FOR UPDATE`, timeout 120 detik, dan retry hingga lima kali untuk conflict/deadlock yang didukung implementasi.
- Migration batch melakukan backfill Barang lama ke batch `1`.

### Status Barang dan histori

Status aktual: `REGISTER`, `FINISHGOOD`, `RETUR`, `OUT`, `BAD`.

```text
REGISTER   -> FINISHGOOD | OUT | RETUR | BAD
FINISHGOOD -> OUT | RETUR | BAD
RETUR      -> FINISHGOOD | OUT | BAD
OUT        -> terminal
BAD        -> terminal
```

- Status yang sama diperbolehkan dan tetap membuat histori.
- Update status single dan insert `RiwayatBarang` berada dalam satu transaction.
- Bulk scan bukan satu transaction global; tiap barcode diproses sequentially dengan transaction sendiri.
- Barcode duplikat dalam request masuk `failed` dengan pesan `Duplicate barcode dalam request`.

## Development Rules

1. Ikuti pola modul yang sudah ada: route -> controller -> model/lib. Jangan menaruh query database langsung di route.
2. Pertahankan TypeScript strict dan ESM. Hindari `any`; gunakan type Prisma atau type domain yang jelas.
3. Validasi input request sebelum query database. Kembalikan status HTTP dan bentuk response yang konsisten dengan endpoint sejenis.
4. Gunakan instance Prisma dari `src/lib/prisma.ts`. Jangan membuat `PrismaClient` baru di controller atau model.
5. Untuk perubahan schema, ubah `prisma/schema.prisma`, buat migration baru, lalu generate client. Jangan mengedit `generated/prisma` atau SQL migration lama.
6. Jangan menjalankan operasi database destruktif seperti reset tanpa persetujuan eksplisit.
7. Password wajib di-hash dengan bcryptjs. Jangan mengembalikan password atau secret dalam response/log.
8. Endpoint yang memerlukan login harus memakai middleware auth dan memvalidasi token blacklist sesuai pola yang sudah ada.
9. Perubahan perilaku endpoint wajib disertai atau memperbarui test terdekat di `tests/`.
10. Jangan mengubah file konfigurasi, environment, deployment, atau dependency untuk memperbaiki masalah yang sebenarnya berada di kode aplikasi.
11. Jangan menambahkan komentar yang hanya mengulang kode. Komentar hanya untuk alasan atau aturan domain yang tidak jelas dari kode.
12. Pertahankan perubahan tetap fokus; jangan melakukan refactor besar yang tidak diperlukan oleh task.

## Domain Constraints

- `ProductVariant` unik berdasarkan kombinasi product, style, color, dan size.
- `kodeVariant` dan `kodeBarang` harus unik.
- `Barang` memiliki status `REGISTER`, `FINISHGOOD`, `RETUR`, `OUT`, atau `BAD`.
- `ProductionBatch` memiliki status `AKTIF` atau `SELESAI` dan kapasitas produksi.
- Perubahan status barang perlu mempertimbangkan histori pada `RiwayatBarang`.
- Relasi database memiliki aturan `onDelete` yang bermakna; jangan mengganti cascade/restrict tanpa memahami dampaknya.
- Operasi yang memperbarui beberapa record terkait harus memakai transaction bila atomicity diperlukan.

## Prisma Workflow

- Setelah mengubah schema, gunakan migration baru melalui script atau Prisma CLI yang sesuai.
- Jalankan generate setelah perubahan schema jika client dibutuhkan oleh kode.
- Gunakan `npm run db:migrate` untuk migration development yang terhubung ke Docker Compose.
- Gunakan `npm run db:push` hanya untuk sinkronisasi schema yang memang tidak memerlukan histori migration.
- Gunakan `npm run db:seed` untuk seed data.
- Periksa `prisma.config.ts` dan `.env` sebelum mendiagnosis masalah koneksi.
- Untuk membatalkan perubahan schema atau pulih dari `git reset` pada migration, ikuti **Schema Change & Git Reset** di bawah.

## Schema Change & Git Reset

Satu perubahan schema menghasilkan tiga artefak di dua tempat, dan hanya satu yang di-undo oleh git:

| Artefak | Lokasi | Di-undo `git reset`? |
| --- | --- | --- |
| `migration.sql` | `prisma/migrations/` (git) | Ya |
| Efek SQL (tabel/kolom/index) | MariaDB, volume `mariadb_data` | Tidak |
| Baris ledger | tabel `_prisma_migrations` | Tidak |

`git reset` pada `prisma/migrations/` setelah migration sempat applied meninggalkan efek SQL tanpa file sumber. Prisma membalas dengan `P3015`, atau menuntut `migrate reset` yang menghapus seluruh database.

### Membatalkan perubahan schema

```text
Edit schema.prisma
├─ BELUM jalan db:migrate
│    git restore prisma/schema.prisma   -> aman, DB tidak tersentuh
│
└─ SUDAH jalan db:migrate
     ├─ data dev boleh hilang (hasil seed)
     │    migrate reset + re-seed       -> wipe sadar
     │
     └─ data harus dipertahankan
          JANGAN git reset file migration. Kembalikan isi schema.prisma
          saja, biarkan db:migrate membuat migration drop baru, lalu commit
          schema + migration.
```

Pembatalan selalu maju ke depan lewat migration baru, tidak pernah menghapus histori. Khusus jalur development dengan data seed, `migrate reset` lebih tepat daripada menumpuk migration add lalu drop.

### Reset + re-seed

`prisma migrate reset` di Prisma 7 **tidak** menjalankan seed otomatis; flag `--seed`/`--skip-seed` juga sudah tidak ada. Setelah reset, database hanya berisi schema plus data yang di-`INSERT` di dalam `migration.sql` (misalnya 5 baris `StatusBarang` dan batch `nomorBatch=1`), dengan `User`, `Product`, `ProductVariant`, dan `Barang` kosong. Seed harus dijalankan manual, dua langkah:

```bash
docker exec -it backend-api-1 npx prisma migrate reset --force
npm run db:seed                                                           # master, batch, variant, barang
docker exec -it backend-api-1 npx tsx prisma/seed-production-order.ts     # ProductionOrder
```

Urutan wajib: `seed.ts` dulu, `seed-production-order.ts` belakangan. Yang kedua bersifat upsert jadi aman diulang, membaca `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME` (bukan `DATABASE_URL`), dan harus jalan di dalam container agar host `db` resolve.

### Tiga arti "reset"

- `git reset`: undo file di working tree atau index.
- `prisma migrate reset`: drop seluruh database lalu apply ulang semua migration.
- `prisma migrate resolve`: tambal baris ledger `_prisma_migrations` tanpa menyentuh data.

### Cek sinkronisasi

```bash
docker exec -it backend-api-1 npx prisma migrate status
docker exec -it backend-api-1 npx prisma migrate diff \
  --from-schema prisma/schema.prisma --to-config-datasource --exit-code
```

Exit `0` = sinkron, `2` = ada drift, `1` = error. Jalankan sebelum commit schema supaya drift ketahuan dini, bukan saat Prisma sudah menuntut reset.

### Catatan Prisma 7.9.1

- `migrate dev` sudah tidak punya `--accept-data-loss`; flag itu dihapus.
- `migrate dev` wajib interaktif (TTY). Di CI atau shell non-TTY, buat migration dengan `migrate dev --create-only` di terminal lalu terapkan lewat `migrate deploy`.
- `--from-schema-datamodel` berganti nama menjadi `--from-schema`. `--shadow-database-url` dihapus; diff `--from-migrations` kini butuh `datasource.shadowDatabaseUrl` di `prisma.config.ts`.
- MariaDB membuat index backing foreign key otomatis dengan nama `<Tabel>_<kolom>_fkey`. Migration berisi `ALTER TABLE ... ADD CONSTRAINT` tanpa index eksplisit menghasilkan index `_fkey` di database yang tidak tercatat di `schema.prisma`. Selisih ini terdeteksi sebagai drift dan muncul kembali setiap reset karena replay migration yang sama.

Index backing FK **tidak bisa dihapus** selama foreign key-nya ada — MariaDB menolak, dan arah diff Prisma justru `CREATE INDEX` (database sudah benar, `schema.prisma` yang kurang deklarasi), bukan `DROP`. Jadi satu-satunya penyelesaian adalah mendeklarasikannya eksplisit dengan `map` memakai nama yang sudah dihasilkan MariaDB, bukan mencoba membuangnya. Sudah diterapkan pada dua index:

```prisma
// RiwayatBarang
@@index([status], map: "RiwayatBarang_status_fkey")

// ProductionRealization
@@index([variantId], map: "ProductionRealization_variantId_fkey")
```

Dengan `map` yang cocok, diff menjadi kosong dan tidak ada migration baru yang terbentuk, karena replay migration tetap menghasilkan nama index yang sama.

### Commit

`schema.prisma` dan direktori migration baru wajib masuk commit yang sama, segera setelah `db:migrate`. Migration yang sudah applied tapi belum di-commit adalah sumber kecelakaan utama: perubahan kode bisa di-revert, efek database tidak.

## Commands

```bash
npm run build
npm test
npm run dev
npm run docker:up
npm run docker:down
npm run db:migrate
npm run db:push
npm run db:seed
npm run db:studio
```

## Required Validation

- Perubahan TypeScript: jalankan `npm run build`.
- Perubahan endpoint, auth, atau model: jalankan test yang relevan dan `npm test` bila memungkinkan.
- Perubahan schema Prisma: validasi schema, generate client, jalankan build, lalu test terkait.
- Jika command gagal karena Docker, database, Redis, atau environment tidak tersedia, laporkan penyebabnya dengan jelas; jangan menyamarkan kegagalan sebagai sukses.
- Sebelum selesai, periksa diff dan pastikan tidak ada secret, file generated, atau perubahan tidak terkait yang ikut masuk.

## Agent Behavior

- Mulai dari file/symbol/test yang paling dekat dengan masalah dan baca implementasi lokal sebelum mengedit.
- Nyatakan asumsi penting bila requirement ambigu, tetapi gunakan pola project yang sudah ada sebagai default.
- Buat perubahan sekecil mungkin, validasi segera setelah edit, dan perbaiki kegagalan pada slice yang sama sebelum memperluas scope.
- Jangan commit, reset, checkout, atau menghapus perubahan pengguna tanpa instruksi eksplisit.
- Jawaban akhir harus menyebutkan file yang diubah, validasi yang dijalankan, dan keterbatasan yang masih ada.

## API Contract

Matriks auth aktual per router (`src/routes/`): hampir semua butuh `authenticate`; tulis butuh `adminOnly` kecuali yang disebut lain. Pengecualian public hanya `POST /api/auth/login`, `POST /api/permintaan-barang`, dan `GET /api/status-barang`.

### Authentication

| Method | Endpoint           | Auth   | Request               | Perilaku utama                                                                              |
| ------ | ------------------ | ------ | --------------------- | ------------------------------------------------------------------------------------------- |
| POST   | `/api/auth/login`  | publik | `{ email, password }` | `200` mengembalikan `{ message, token, user }`; input invalid `400`; credential salah `401` |
| GET    | `/api/auth/me`     | login  | Bearer JWT            | `200` mengembalikan `{ user, exp }`; token invalid/revoked `401`                             |
| POST   | `/api/auth/logout` | login  | Bearer JWT            | blacklist token sampai expiry; token tidak ada/invalid/revoked `401`                        |

### User (admin-only)

`GET/POST /api/users`, `GET/PUT/DELETE /api/users/:id` — semua `authenticate + adminOnly`. Create `{ name, email, password, role? }` (`role` default `user`); update minimal satu field `name/email/password/role`.

### Master data (styles, colors, sizes) + batch, divisi, karyawan

Pola sama: `GET` butuh login; `POST/PUT/DELETE` butuh `adminOnly`. Berlaku untuk `/api/styles`, `/api/colors`, `/api/sizes`, `/api/batches`, `/api/divisi`, `/api/karyawan`.

### Product dan variant

| Method | Endpoint                                | Auth            | Request                                                                     |
| ------ | --------------------------------------- | --------------- | --------------------------------------------------------------------------- |
| GET    | `/api/products`                         | login           | Tidak ada; product beserta variant dan relasi; cache Redis 60 detik         |
| GET    | `/api/products/:id`                     | login           | id numerik                                                                  |
| POST   | `/api/products`                         | admin           | `{ nama, prefix }`                                                          |
| PUT    | `/api/products/:id`                     | admin           | `{ nama }`                                                                  |
| DELETE | `/api/products/:id`                     | admin           | Tidak ada                                                                   |
| GET    | `/api/products/:id/variants`            | login           | Tidak ada                                                                   |
| POST   | `/api/products/:id/variants`            | admin           | `{ styleId, colorId, sizeId, tanggal? }`                                    |
| PATCH  | `/api/products/:id/variants/:variantId` | admin           | `{ tanggal? }`                                                              |
| DELETE | `/api/products/:id/variants/:variantId` | admin           | Tidak ada                                                                   |
| GET    | `/api/variant-produk`                   | login           | Query integer positif opsional: `productId`, `styleId`, `colorId`, `sizeId` |
| GET    | `/api/variant-produk/:id`               | login           | id numerik                                                                  |
| POST   | `/api/variant-produk`                   | admin           | ID relation integer positif; `tanggal` opsional valid                       |
| PUT    | `/api/variant-produk/:id`               | admin           | Partial style/color/size/tanggal; minimal satu field                        |
| DELETE | `/api/variant-produk/:id`               | admin           | Tidak ada                                                                   |

### Barang

Seluruh `/api/barang` butuh login. Baca (list, detail, search, export, stats, summary, riwayat) cukup login; generate, CRUD, scan, dan update status butuh `requireRole("admin", "user")`.

| Method | Endpoint                       | Auth        | Request                                                                                         |
| ------ | ------------------------------ | ----------- | ----------------------------------------------------------------------------------------------- |
| GET    | `/api/barang/generate-info`    | admin/user  | Query `variantId`                                                                               |
| POST   | `/api/barang/generate`         | admin/user  | `{ variantId, jumlah }`; `jumlah` 1 sampai 50.000                                               |
| GET    | `/api/barang`                  | login       | Query `page`, `limit`, `variantId`, `batchId`, `status`; default `1`/`20`, maksimum limit `100` |
| GET    | `/api/barang/scan/:kodeBarang` | admin/user  | Barcode pada path                                                                               |
| POST   | `/api/barang/scan/bulk`        | admin/user  | `{ kodeBarang: string[], status, keterangan? }`                                                 |
| PATCH  | `/api/barang/:id/status`       | admin/user  | `{ status, keterangan? }`                                                                       |
| GET    | `/api/barang/:id`              | login       | id numerik                                                                                      |
| GET    | `/api/barang/:id/riwayat`      | login       | id numerik; histori descending dan summary                                                      |

### Permintaan barang

| Method | Endpoint                              | Auth  | Request                                                   |
| ------ | ------------------------------------- | ----- | --------------------------------------------------------- |
| POST   | `/api/permintaan-barang`              | publik| `{ tanggal, departemen, namaPeminta, alasan, items[] }`; `kebutuhanUntuk`/`prioritas` opsional |
| GET    | `/api/permintaan-barang`              | login | Query `page`, `limit`, `approval?`, `dari?`/`sampai?` (`YYYY-MM-DD`, inklusif, filter kolom `tanggal`) |
| GET    | `/api/permintaan-barang/:id`          | login | id numerik                                                |
| PUT    | `/api/permintaan-barang/:id`          | admin | Body sama dengan POST; `409` jika sudah disetujui         |
| PATCH  | `/api/permintaan-barang/:id/approval` | admin | `{ approval: BELUM_DISETUJUI \| DISETUJUI }`              |
| DELETE | `/api/permintaan-barang/:id`          | admin | `409` jika sudah disetujui                                |

### Lainnya

| Router | Auth |
| ------ | ---- |
| `/api/barang-group` CRUD + `assign`/`unassign` | login; tulis `requireRole("admin", "user")` |
| `/api/status-barang` | `GET` publik; tulis admin |
| `/api/status-transition` | `GET` login; tulis admin |
| `/api/production-orders` (CRUD + items/capacities/schedule/realisasi) | semua admin |
| `/api/integrasi-jurnal/products` | admin |
| `/api/admin/dashboard` | admin |
| `/api/notifications` | `GET` login; `DELETE` admin (sumber: cache, bukan DB) |

- Secara umum invalid input memakai `400`, butuh login memakai `401`, role kurang memakai `403`, not found `404`, duplicate/conflict `409`, dan error tak terduga `500`; detail controller dan test adalah acuan akhir.
- Tidak ada endpoint update status ProductVariant; status ProductVariant sudah dihapus dari schema.

## Authentication

```text
POST /api/auth/login -> findUserByEmail -> bcrypt.compare -> JWT
Bearer request -> Authorization header -> verify signature/expiry
	-> cek Redis blacklist -> requireRole baca role dari DB -> controller
```

- JWT berisi `id`, `email`, `name`, dan `role`, dengan expiry default `8h`.
- `requireRole`/`adminOnly` membaca role ulang dari database, bukan dari token.
- Redis blacklist fail-open jika Redis gagal.
- Jika `JWT_SECRET` tidak tersedia, implementasi menggunakan string kosong; jangan menganggap konfigurasi ini aman.

## Realtime / WebSocket

- `src/websocket/socket.ts` memakai package `ws`.
- Pesan awal client: `{ "message": "WebSocket terhubung" }`; WebSocket tidak memakai authentication.
- Client lokal disimpan dalam `Set<WebSocket>`.
- Event dipublish ke Redis channel `product-events`; subscriber melakukan broadcast ke client lokal.
- Event aktual: `product.created`, `product.updated`, `product.deleted`, `variant.created`, `variant.updated`, `variant.deleted`, `barang.generated`, `barang.status_updated`.
- Event dikirim setelah operasi database berhasil. Event khusus User, Style, Color, Size, ProductionBatch, atau RiwayatBarang tidak ditemukan.
- Pada deployment Vercel, WebSocket tidak diinisialisasi.

## IoT / MQTT / RFID

Integrasi MQTT, RFID, IoT, dan EPC tidak ditemukan di repository ini. MQTT/RFID integration is not currently implemented in this repository. Jangan membuat dokumentasi topic, payload, atau flow IoT berdasarkan rencana atau nama domain saja.

## Testing

- Framework: Vitest dengan Supertest (13 file di `tests/`).
- `tests/auth.test.ts`: login, JWT middleware, `me`, logout/blacklist, dan Redis fail-open.
- `tests/user.test.ts`: CRUD user admin-only dan validasi role.
- `tests/variantproduk.test.ts`: filter, detail, create/update/delete variant, validasi, duplicate, foreign key, dan broadcast.
- `tests/barang.test.ts`: generate info/generate, list/filter/pagination, scan single/bulk, update status, histori, dan broadcast.
- `tests/permintaan-barang.test.ts`: validasi create, approval terkunci (`409`), dan wiring auth (POST publik, sisanya di belakang `authenticate`).
- `tests/barangGroup|batch|divisi|integrasi-jurnal|notification.test.ts`: CRUD/akses per modul.
- `tests/production-order.test.ts`, `production-schedule.test.ts`, `schedule-alloc.test.ts`: order, override target/alokasi jadwal, dan alokasi per tahap.
- Test memock model, middleware auth, dan WebSocket. Coverage nyata untuk Prisma/MariaDB integration, concurrency generate, Redis cache nyata, migration, seed, dan koneksi WebSocket nyata tidak ditemukan.
- Perubahan behavior endpoint, auth, atau model harus menambah atau memperbarui test terdekat.

## Source of Truth

- Database structure, relation, enum, constraint, dan index: `prisma/schema.prisma` serta migration.
- Database connection/config: `src/lib/prisma.ts`, `prisma.config.ts`, Docker, dan environment.
- Route, method, serta auth registration: `src/app.ts` dan `src/routes/`.
- Request validation, status code, dan response: controller serta test endpoint terkait.
- Product/variant: `src/model/product/product.ts`, `src/model/variantproduk/variantproduk.ts`, dan controller terkait.
- User/auth: `src/model/user/user.ts`, `src/controller/auth/auth.ts`, `src/controller/user/user.ts`, `src/lib/jwt.ts`, `src/middleware/auth.ts`, dan `src/lib/tokenBlacklist.ts`.
- Permintaan barang: `src/model/permintaanBarang/permintaanBarang.ts`, `src/controller/permintaanBarang/permintaanBarang.ts`, `src/routes/permintaan-barang.ts`, `tests/permintaan-barang.test.ts`.
- Karyawan/divisi: `src/model/karyawan/`, `src/model/divisi/`, controller dan route masing-masing.
- BarangGroup (dus): `src/model/barangGroup/barangGroup.ts`, `src/controller/barangGroup/barangGroup.ts`.
- Notifikasi: `src/lib/notificationCache.ts`, `src/controller/notification/notification.ts` (tanpa model DB).
- Barang, barcode, batch, status, counter, transaction, dan histori: `src/model/barang/`, schema, dan `tests/barang.test.ts`.
- BarangGroup (dus): `src/model/barangGroup/barangGroup.ts`, `src/controller/barangGroup/barangGroup.ts`.
- Realtime: `src/websocket/socket.ts` dan pemanggil broadcast.
- Seed: `prisma/seed.ts`; runtime/deployment: `api/index.ts`, Dockerfile, `docker-compose.yml`, dan `vercel.json`.
- Jika dokumentasi bertentangan dengan source, schema/migration, atau test, prioritaskan source, schema/migration, dan test. `README.md` saat ini hanya dump struktur direktori. `test_api.http` memiliki request yang tidak konsisten, termasuk create product tanpa `prefix`.

## Agent Behavior

Sebelum mengedit: pahami task, cari file/symbol/test relevan, baca implementasi lokal, trace data flow sampai Prisma bila perlu, identifikasi source of truth/API contract/dampak database, lalu buat rencana minimal.

Saat mengedit: implementasikan perubahan terkecil, pertahankan architecture, naming, API contract, dan business logic existing. Jangan refactor besar hanya karena architecture dapat dibuat lebih baik; jelaskan alasan jika refactor memang diperlukan.

Setelah mengedit: jalankan validasi relevan, periksa diff untuk secret/generated file/migration lama/perubahan tidak terkait, dan laporkan hasil serta keterbatasan secara jujur. Jika fakta tidak ditemukan, tulis `Not established in current repository.`

## Safety / Do Not

- Jangan `git reset`, `git checkout`, `git clean`, force-overwrite, menghapus perubahan pengguna, atau commit tanpa instruksi eksplisit.
- Jangan edit `generated/prisma` atau migration lama secara manual.
- Jangan reset database atau menjalankan operasi destructive tanpa persetujuan eksplisit.
- Jangan membatalkan migration yang sudah applied dengan `git reset` pada `prisma/migrations/`, dan jangan commit `schema.prisma` tanpa migration pendampingnya. Lihat **Schema Change & Git Reset**.
- Jangan membuat API, status, transition, event WebSocket, MQTT topic, RFID flow, atau business rule yang tidak ditemukan.
- Jangan mengubah source code lain hanya untuk menyelesaikan dokumentasi ini.

## Final Response Requirements

Jawaban akhir harus menyebutkan apa yang diverifikasi dari repository, bagian penting yang ditambahkan/diubah, file yang diubah, validasi beserta hasilnya, serta informasi yang belum dapat dipastikan atau coverage yang masih kurang.
