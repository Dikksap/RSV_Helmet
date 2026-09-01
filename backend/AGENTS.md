# Project Agent Instructions

Instruksi ini berlaku untuk seluruh project `express-api`. Baca sebelum mengubah kode.

## Project Overview

- Backend REST API berbasis Node.js, TypeScript, dan Express.
- Modul utama: autentikasi, user, product, variant produk, barang, dan production batch.
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
- `src/lib/`: Prisma, JWT, Redis, blacklist token, dan helper bersama.
- `src/middleware/`: middleware Express, terutama autentikasi.
- `src/websocket/`: integrasi WebSocket.
- `prisma/schema.prisma`: sumber model database.
- `prisma/migrations/`: histori perubahan schema; jangan mengubah migration lama.
- `prisma/seed.ts`: data awal database.
- `generated/prisma/`: hasil generate Prisma; jangan edit manual.
- `tests/`: test API dengan Vitest dan Supertest.

## Architecture

Alur aktual umumnya:

```text
HTTP request -> Express middleware -> route -> auth middleware (jika dipasang)
	-> controller -> model/lib -> shared Prisma instance -> MariaDB/MySQL
```

- Route mendaftarkan endpoint, middleware, dan controller; query database tidak diletakkan di route.
- Controller membaca parameter/body/query, melakukan validasi lokal, memanggil model/lib, lalu menentukan status dan response.
- Model menangani query User, Product, ProductVariant, dan query/list Barang.
- `src/lib/barang.ts` menangani batch, counter, barcode, transaction, status, histori, dan bulk scan.
- `src/lib/prisma.ts` membuat satu Prisma client dengan `PrismaMariaDb`.
- `src/app.ts` mengaktifkan CORS, JSON body, dan URL-encoded body secara global.

## Data Flow

- Product memiliki banyak ProductVariant.
- ProductVariant mereferensikan Product, Style, Color, dan Size, serta memiliki Barang dan BarangCounter.
- Barang mereferensikan ProductVariant dan ProductionBatch, serta memiliki RiwayatBarang.
- ProductionBatch bersifat global, bukan milik Product atau Variant, dan memiliki Barang serta BarangCounter.
- GET variant standalone membaca SQL view `ViewVariantProduk`.
- Write product/variant menghapus cache Redis terkait dan menerbitkan event WebSocket setelah database berhasil.

## Domain Model

Model aktual di `prisma/schema.prisma`:

- `User`: unique `email`, hashed `password`, timestamp.
- `Product`: `nama`, `prefix`, dan relasi `variants`.
- `Style`: unique `nama`.
- `Color`: unique `nama`.
- `Size`: unique `nama` dan `urutan`.
- `ProductVariant`: unique `kodeVariant`, foreign key product/style/color/size, dan `tanggal`.
- `ProductionBatch`: unique `nomorBatch`, `totalProduksi`, `kapasitas` default `5000`, status `AKTIF`/`SELESAI`.
- `Barang`: unique `kodeBarang`, `variantId`, `batchId`, status default `REGISTER`.
- `RiwayatBarang`: `barangId`, status, `tanggal`, dan optional `keterangan`.
- `BarangCounter`: counter per `(batchId, variantId, tanggal)`.

Constraint penting:

- Product -> ProductVariant memakai `Cascade`.
- ProductVariant -> Barang/BarangCounter, Style/Color/Size -> ProductVariant, ProductionBatch -> Barang/BarangCounter, dan Barang -> RiwayatBarang memakai `Restrict`.
- ProductVariant unik pada kombinasi `(productId, styleId, colorId, sizeId)`.

## Business Rules

### Product dan ProductVariant

- Product dibuat dengan `{ nama, prefix }`; controller mewajibkan keduanya truthy.
- `kodeVariant` dibuat backend dengan format `<PREFIX_UPPERCASE><nomor 3 digit>`.
- Nomor variant berasal dari id variant terakhir milik product lalu ditambah satu.
- Duplicate kombinasi product/style/color/size menghasilkan `409` pada endpoint yang relevan.
- Tidak ada endpoint CRUD untuk Style, Color, atau Size; data tersebut dibuat melalui seed dan dipakai sebagai reference.

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

Semua endpoint bisnis berikut saat ini terdaftar tanpa auth middleware, kecuali logout.

### Authentication

| Method | Endpoint           | Request               | Perilaku utama                                                                              |
| ------ | ------------------ | --------------------- | ------------------------------------------------------------------------------------------- |
| POST   | `/api/auth/login`  | `{ email, password }` | `200` mengembalikan `{ message, token, user }`; input invalid `400`; credential salah `401` |
| POST   | `/api/auth/logout` | Bearer JWT            | blacklist token sampai expiry; token tidak ada/invalid/revoked `401`                        |

### Product dan variant

| Method | Endpoint                                | Request                                                                     |
| ------ | --------------------------------------- | --------------------------------------------------------------------------- |
| GET    | `/api/products`                         | Tidak ada; product beserta variant dan relasi; cache Redis 60 detik         |
| GET    | `/api/products/:id`                     | id numerik                                                                  |
| POST   | `/api/products`                         | `{ nama, prefix }`                                                          |
| PUT    | `/api/products/:id`                     | `{ nama }`                                                                  |
| DELETE | `/api/products/:id`                     | Tidak ada                                                                   |
| GET    | `/api/products/:id/variants`            | Tidak ada                                                                   |
| POST   | `/api/products/:id/variants`            | `{ styleId, colorId, sizeId, tanggal? }`                                    |
| PATCH  | `/api/products/:id/variants/:variantId` | `{ tanggal? }`                                                              |
| DELETE | `/api/products/:id/variants/:variantId` | Tidak ada                                                                   |
| GET    | `/api/variant-produk`                   | Query integer positif opsional: `productId`, `styleId`, `colorId`, `sizeId` |
| GET    | `/api/variant-produk/:id`               | id numerik                                                                  |
| POST   | `/api/variant-produk`                   | ID relation integer positif; `tanggal` opsional valid                       |
| PUT    | `/api/variant-produk/:id`               | Partial style/color/size/tanggal; minimal satu field                        |
| DELETE | `/api/variant-produk/:id`               | Tidak ada                                                                   |

### Barang

| Method | Endpoint                       | Request                                                                                         |
| ------ | ------------------------------ | ----------------------------------------------------------------------------------------------- |
| GET    | `/api/barang/generate-info`    | Query `variantId`                                                                               |
| POST   | `/api/barang/generate`         | `{ variantId, jumlah }`; `jumlah` 1 sampai 50.000                                               |
| GET    | `/api/barang`                  | Query `page`, `limit`, `variantId`, `batchId`, `status`; default `1`/`20`, maksimum limit `100` |
| GET    | `/api/barang/scan/:kodeBarang` | Barcode pada path                                                                               |
| POST   | `/api/barang/scan/bulk`        | `{ kodeBarang: string[], status, keterangan? }`                                                 |
| PATCH  | `/api/barang/:id/status`       | `{ status, keterangan? }`                                                                       |
| GET    | `/api/barang/:id`              | id numerik                                                                                      |
| GET    | `/api/barang/:id/riwayat`      | id numerik; histori descending dan summary                                                      |

- Secara umum invalid input memakai `400`, not found `404`, duplicate/conflict `409`, dan error tak terduga `500`; detail controller dan test adalah acuan akhir.
- Tidak ada endpoint CRUD untuk User, Style, Color, atau Size yang ditemukan.
- Tidak ada endpoint update status ProductVariant; status ProductVariant sudah dihapus dari schema.

## Authentication

```text
POST /api/auth/login -> findUserByEmail -> bcrypt.compare -> JWT
Bearer request -> Authorization header -> verify signature/expiry
	-> cek Redis blacklist -> controller
```

- JWT berisi `id`, `email`, dan `name`, dengan expiry default `8h`.
- Hanya `/api/auth/logout` memakai middleware auth saat ini; product, variant, barang, dan scan dapat diakses tanpa JWT.
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

- Framework: Vitest dengan Supertest.
- `tests/auth.test.ts`: login, JWT middleware, logout/blacklist, dan Redis fail-open.
- `tests/variantproduk.test.ts`: filter, detail, create/update/delete variant, validasi, duplicate, foreign key, dan broadcast.
- `tests/barang.test.ts`: generate info/generate, list/filter/pagination, scan single/bulk, update status, histori, dan broadcast.
- Test terutama memock model dan WebSocket. Coverage nyata untuk Prisma/MariaDB integration, concurrency generate, Redis cache nyata, migration, seed, dan koneksi WebSocket nyata tidak ditemukan.
- Perubahan behavior endpoint, auth, atau model harus menambah atau memperbarui test terdekat.

## Source of Truth

- Database structure, relation, enum, constraint, dan index: `prisma/schema.prisma` serta migration.
- Database connection/config: `src/lib/prisma.ts`, `prisma.config.ts`, Docker, dan environment.
- Route, method, serta auth registration: `src/app.ts` dan `src/routes/`.
- Request validation, status code, dan response: controller serta test endpoint terkait.
- Product/variant: `src/model/product/product.ts`, `src/model/variantproduk/variantproduk.ts`, dan controller terkait.
- User/auth: `src/model/user/user.ts`, `src/controller/auth/auth.ts`, `src/lib/jwt.ts`, `src/middleware/auth.ts`, dan `src/lib/tokenBlacklist.ts`.
- Barang, barcode, batch, status, counter, transaction, dan histori: `src/lib/barang.ts`, `src/model/barang/barang.ts`, schema, dan `tests/barang.test.ts`.
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
- Jangan membuat API, status, transition, event WebSocket, MQTT topic, RFID flow, atau business rule yang tidak ditemukan.
- Jangan mengubah source code lain hanya untuk menyelesaikan dokumentasi ini.

## Final Response Requirements

Jawaban akhir harus menyebutkan apa yang diverifikasi dari repository, bagian penting yang ditambahkan/diubah, file yang diubah, validasi beserta hasilnya, serta informasi yang belum dapat dipastikan atau coverage yang masih kurang.
