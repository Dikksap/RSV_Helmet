# Dokumentasi API — RSV Helmet Backend

> **Untuk siapa:** agent AI lain / project lain (frontend, integrasi eksternal) yang mau konsumsi API ini tanpa baca seluruh source.
> **Source of truth:** `src/routes/*` (method+path+middleware), controller (`src/controller/*`) untuk validasi/status, `prisma/schema.prisma` untuk model/constraint, `tests/*.test.ts` untuk perilaku yang diasumsikan stabil.
> Jika doc ini bentrok dengan source → source menang.
>
> **Base URL:** `http://localhost:8000` (dev). Port dari `PORT` env, default `8000` (`api/index.ts:8`, `.env.example:5`). Doc lama tulis `3000` — itu stale, jangan pakai.
> **Stack:** Node.js + TypeScript + Express (ESM), Prisma 7 + `@prisma/adapter-mariadb` (MySQL/MariaDB), JWT + bcryptjs, Redis (cache + JWT blacklist + pub/sub), `ws` WebSocket.
> **Entry:** `src/app.ts` mount router, `api/index.ts` runtime (HTTP+WS, kecuali `VERCEL=1`). Import lokal TS wajib ekstensi `.js`.

## Daftar Isi
- [0. Quick Contract (baca ini dulu)](#0-quick-contract-baca-ini-dulu)
- [1. Setup Konsumen](#1-setup-konsumen)
- [2. Konvensi Umum](#2-konvensi-umum)
- [3. Auth](#3-auth)
- [4. Admin](#4-admin)
- [5. Product](#5-product)
- [6. Variant Produk Standalone](#6-variant-produk-standalone)
- [7. Style / Color / Size](#7-style--color--size-master-referensi)
- [8. Barang](#8-barang)
- [9. WebSocket Realtime](#9-websocket-realtime)
- [10. Domain Model & Aturan Bisnis](#10-domain-model--aturan-bisnis)
- [11. Error & Status Code](#11-error--status-code)
- [12. Resep Integrasi](#12-resep-integrasi-untuk-project-lain)
- [13. Contoh cURL](#13-contoh-curl)
- [14. File Referensi](#14-file-referensi)

---

## 0. Quick Contract (baca ini dulu)

### 0.1 Semua endpoint (verified dari `src/routes/*`, `src/app.ts`)

| Method | Path | Auth | Keterangan |
|--------|------|------|------------|
| GET | `/` | — | Health `{ message: "API berjalan" }` |
| POST | `/api/auth/login` | — | Login → JWT |
| POST | `/api/auth/logout` | Bearer wajib | Blacklist token |
| GET | `/api/admin/dashboard` | Bearer + admin | Echo `{ message, user }` |
| GET | `/api/products` | — | List + variants |
| GET | `/api/products/:id` | — | Detail |
| POST | `/api/products` | — | `{ nama, prefix }` |
| PUT | `/api/products/:id` | — | `{ nama }` |
| DELETE | `/api/products/:id` | — | Cascade variant |
| GET | `/api/products/:id/variants` | — | Variant milik product |
| POST | `/api/products/:id/variants` | — | `{ styleId, colorId, sizeId, tanggal? }` |
| PATCH | `/api/products/:id/variants/:variantId` | — | `{ tanggal? }` |
| DELETE | `/api/products/:id/variants/:variantId` | — | Hapus variant |
| GET | `/api/variant-produk` | — | List + filter `productId,styleId,colorId,sizeId` |
| GET | `/api/variant-produk/:id` | — | Detail |
| POST | `/api/variant-produk` | — | `{ productId, styleId, colorId, sizeId, tanggal? }` |
| PUT | `/api/variant-produk/:id` | — | Parsial, min 1 field |
| DELETE | `/api/variant-produk/:id` | — | Hapus variant |
| GET | `/api/styles` | — | List |
| GET | `/api/styles/:id` | — | Detail |
| POST | `/api/styles` | — | `{ nama }` |
| PUT | `/api/styles/:id` | — | `{ nama }` |
| DELETE | `/api/styles/:id` | — | 409 jika dipakai variant |
| GET/… | `/api/colors`, `/api/sizes` | — | Pola sama dengan styles (sizes ada field `urutan?`) |
| GET | `/api/barang/generate-info?variantId=` | — | Info batch + nextNumber |
| POST | `/api/barang/generate` | — | `{ variantId, jumlah }` 1..50000 |
| POST | `/api/barang` | — | Create single |
| GET | `/api/barang` | — | List + filter + pagination |
| GET | `/api/barang/hari-ini` | — | Barang tanggal hari ini (shortcut `?tanggal=<today>`) |
| GET | `/api/barang/status-summary` | — | `{ total, perStatus }` |
| GET | `/api/barang/summary` | — | Alias status-summary |
| GET | `/api/barang/stats?variantId=&batchId=` | — | `{ total, perStatus, perVariant, perBatch }` |
| GET | `/api/barang/batch-rentang-tanggal` | — | Filter tanggal batch |
| GET | `/api/barang/finishgood-per-bulan` | — | Group `YYYY-MM` |
| GET | `/api/barang/search?q=&limit=` | — | LIKE kodeBarang |
| GET | `/api/barang/export?format=` | — | `json`\|`csv` |
| GET | `/api/barang/scan/:kodeBarang` | — | Scan single by barcode |
| POST | `/api/barang/scan/bulk` | — | `{ kodeBarang[], status, keterangan? }` |
| POST | `/api/barang/bulk-status` | — | `{ items: [{id,status,keterangan?}] }` max 500 |
| PUT | `/api/barang/:id` | — | Update parsial |
| DELETE | `/api/barang/:id` | — | Hapus + decrement batch |
| PATCH | `/api/barang/:id/status` | — | `{ status, keterangan? }` |
| GET | `/api/barang/:id/riwayat` | — | `{ data[], summary }` |
| GET | `/api/barang/:id` | — | Detail (paling akhir agar tidak telan route di atas) |

### 0.2 Auth matrix — hanya 2 endpoint pakai middleware

| Endpoint | Middleware (`src/routes/*.ts`) |
|----------|-------------------------------|
| `POST /api/auth/logout` | `authenticate` (`src/routes/auth.ts:8`) |
| `GET /api/admin/dashboard` | `authenticate` + `adminOnly` (`src/routes/admin.ts:6`) |
| **Semua endpoint lain** | **tanpa auth** — bisa dipanggil tanpa `Authorization` header |

### 0.3 Enum yang harus di-hardcode di konsumen

```ts
type StatusBarang = "REGISTER" | "FINISHGOOD" | "RETUR" | "OUT" | "BAD";
type StatusBatch = "AKTIF" | "SELESAI";
// Transisi valid (src/model/barang/barang.status.ts:14):
// REGISTER   -> FINISHGOOD | OUT | RETUR | BAD
// FINISHGOOD -> OUT | RETUR | BAD
// RETUR      -> FINISHGOOD | OUT | BAD
// OUT, BAD   -> terminal
// PENTING: same-status (X->X) DITOLAK di POST /scan/bulk,
//           DITERIMA di PATCH /:id/status dan POST /bulk-status.
```

### 0.4 Yang TIDAK ada (jangan diasumsikan)

- Tidak ada CRUD User. Tidak ada register endpoint.
- Tidak ada MQTT / RFID / IoT / EPC di repo ini. Jangan bikin topic/payload IoT.
- Tidak ada endpoint update status ProductVariant; field status variant sudah tidak ada di schema.
- Tidak ada pagination di `GET /api/products` dan `GET /api/variant-produk`.

---

## 1. Setup Konsumen

```bash
# env minimal (lihat .env.example)
PORT=8000
DATABASE_URL="mysql://root:@localhost:3306/express_api"
REDIS_URL=redis://localhost:6379
JWT_SECRET=ganti-dengan-secret-acak-yang-panjang
JWT_EXPIRES_IN=8h
TZ=Asia/Jakarta

npm run dev        # tsx watch api/index.ts
npm run build      # tsc
npm test           # vitest run
npm run docker:up  # mysql+redis
npm run db:seed    # seed style/color/size awal
```

- `GET /` → `200 { message: "API berjalan" }` (`src/app.ts:21`).
- CORS global `cors()`, body `express.json()` + `urlencoded` (`src/app.ts:17-19`).
- Vercel (`VERCEL=1`): WS tidak diinisialisasi, hanya HTTP (`api/index.ts:12`).

---

## 2. Konvensi Umum

| Aspek | Detail |
|-------|--------|
| **Content-Type** | `application/json` kecuali `GET /api/barang/export?format=csv` → `text/csv` |
| **JWT** | `Authorization: Bearer <token>`, payload `{ id, email, name, role, iat, exp }` (`src/lib/jwt.ts:7`), expiry default `8h`, secret fallback `""` (jangan anggap aman) |
| **Blacklist** | Redis via `src/lib/tokenBlacklist.ts`; `authenticate` cek `isTokenRevoked`; Redis fail-open |
| **Validasi** | Manual di controller, tanpa library eksternal |
| **ID path** | Numerik `Number(param)`; NaN → `400` |
| **Tanggal query** | `YYYY-MM-DD`; `tanggalAwal` → start-of-day UTC, `tanggalAkhir` → end-of-day UTC; `tanggalAwal > tanggalAkhir` → `400` |
| **Cache** | Product list 60 dtk (Redis); barang list/search/stats di-cache, di-invalidate tiap write (`clearBarangCache`) |

---

## 3. Auth
Route `src/routes/auth.ts`, controller `src/controller/auth/auth.ts:7`, model `src/model/user/user.ts`.

### POST /api/auth/login
```json
// request
{ "email": "user@example.com", "password": "secret123" }
// 200
{ "message": "Login berhasil", "token": "<jwt>",
  "user": { "id": 1, "name": "Admin", "email": "a@b.com", "role": "admin" } }
```
- `email`/`password` wajib string truthy → `400 { message: "Field 'email' wajib diisi" }` (atau password).
- User tidak ada / password salah → `401 { message: "Email atau password salah" }`; error lain `500 { message: "Gagal login" }`.
- Flow: `findUserByEmail` → `bcrypt.compare` → `signToken({id,email,name,role})` (`src/controller/auth/auth.ts:31`).

### POST /api/auth/logout
- Auth `authenticate` wajib. Token diambil dari header, di-blacklist sampai `exp` (`revokeToken(token, req.user.exp)`).
- `200 { message: "Logout berhasil" }`.
- `401`: `Token tidak ditemukan` (header hilang), `Token sudah logout` (revoked), `Token tidak valid atau kedaluwarsa`.

---

## 4. Admin

### GET /api/admin/dashboard
- `authenticate` + `adminOnly` (`role === "admin"`, else `403 { message: "Akses ditolak. Memerlukan akses admin." }`).
- `200 { message: "Admin dashboard", user: { id, email, name, role, iat, exp } }`.

---

## 5. Product
Router `src/routes/products.ts`, controller `src/controller/product/product.ts`, model `src/model/product/product.ts`.

| Endpoint | Deskripsi | Success |
|----------|-----------|---------|
| GET `/api/products` | List + `variants { product, style, color, size }`, cache Redis 60 dtk, tanpa pagination | 200 array |
| GET `/api/products/:id` | Detail | 200 / `404 { message: "Produk tidak ditemukan" }` |
| POST `/api/products` | Body `{ nama, prefix }` wajib → `400`; broadcast `product.created` | 201 product |
| PUT `/api/products/:id` | Body `{ nama }` wajib → `400`; broadcast `product.updated` | 200 |
| DELETE `/api/products/:id` | Cascade hapus variant (`onDelete: Cascade`, `prisma/schema.prisma:75`); broadcast `product.deleted { id }` | 200 |
| GET `/api/products/:id/variants` | Variant milik product | 200 |
| POST `/api/products/:id/variants` | `{ styleId, colorId, sizeId, tanggal? }` wajib kecuali tanggal → `400`; duplicate unique `[productId,styleId,colorId,sizeId]` → `409`; broadcast `variant.created` | 201 |
| PATCH `/api/products/:id/variants/:variantId` | `{ tanggal? }` optional; broadcast `variant.updated` | 200 |
| DELETE `/api/products/:id/variants/:variantId` | Restrict jika dipakai Barang/Counter → `500`; broadcast `variant.deleted` | 200 |

`kodeVariant` auto-generated `<PREFIX_UPPERCASE><3 digit>` dari id variant terakhir +1.

---

## 6. Variant Produk Standalone
Router `src/routes/variant-produk.ts`, controller `src/controller/variantproduk/variantproduk.ts`, model `src/model/variantproduk/variantproduk.ts`.
Response row adalah raw-SQL row (`VariantProdukRow`: `id, kodeVariant, productId, namaProduk, styleId, namaStyle, colorId, namaColor, sizeId, namaSize, urutanSize, tanggal`), **bukan** Prisma view — schema.prisma tidak mendefinisikan view.

| Endpoint | Validasi | Success/Error |
|----------|----------|---------------|
| GET `/api/variant-produk?productId=&styleId=&colorId=&sizeId=` | tiap query jika ada harus integer >0 → `400` | 200 array |
| GET `/api/variant-produk/:id` | NaN → `400 { message: "Parameter 'id' tidak valid" }` | 200 / `404 { message: "Variant produk tidak ditemukan" }` |
| POST `/api/variant-produk` | `{ productId, styleId, colorId, sizeId, tanggal? }`; ID integer >0 → `400`; `tanggal` valid → `400`; FK hilang → `404`; duplicate → `409`; broadcast `variant.created` | 201 |
| PUT `/api/variant-produk/:id` | parsial, min 1 field → `400`; `P2002` → `409`; `P2003` → `400 { message: "styleId, colorId, atau sizeId merujuk data yang tidak ada" }`; broadcast `variant.updated` | 200 / 404 |
| DELETE `/api/variant-produk/:id` | `P2003` restrict → `409 { message: "Variant tidak dapat dihapus karena masih direferensikan..." }`; broadcast `variant.deleted` | `200 { message: "Variant berhasil dihapus" }` |

---

## 7. Style / Color / Size (Master Referensi)
Router `src/routes/styles.ts|colors.ts|sizes.ts`, controller `src/controller/style|color|size/*.ts`. Semua tanpa auth. Schema `Style/Color/Size` (`prisma/schema.prisma:33-59`): `nama @unique`, `Size.urutan Int default 0`.

| Endpoint | Body/Validasi | Success/Error |
|----------|---------------|---------------|
| GET `/api/styles`, `/api/colors`, `/api/sizes` | — | 200 array |
| GET `/:id` | integer >0 → 400 | 200 / 404 |
| POST `/` | styles/colors `{ nama }` wajib trim → 400; sizes `{ nama, urutan? }`, `urutan` integer >=0 → 400 | 201 / `409 Nama ... sudah ada` (P2002) |
| PUT `/:id` | styles/colors `{ nama }` wajib; sizes min satu `nama`/`urutan` → 400 | 200 / 404 (P2025) / 409 |
| DELETE `/:id` | — | 200 `{ message }` / 404 / `409 ... masih dipakai variant` (P2003) |

Seed awal via `prisma/seed.ts`.

---

## 8. Barang
Router `src/routes/barang.ts` — **urutan penting**: `/generate-info`, `/generate`, `/`, `/status-summary`, `/stats`, `/batch-rentang-tanggal`, `/finishgood-per-bulan`, `/search`, `/export`, `/scan/:kodeBarang`, `/scan/bulk`, `/bulk-status`, `/:id/*`, `/:id` terakhir.
Controller `src/controller/barang/*.controller.ts`, model `src/model/barang/barang*.ts`.

### 8.1 Generate & Generate-Info

**GET /api/barang/generate-info?variantId=1** (`generate.controller.ts:9`)
- `variantId` wajib angka → `400`; variant hilang → `404`.
- 200:
```json
{ "variantId": 1, "kodeVariant": "W001", "tanggal": "2026-09-03",
  "batch": { "kodeBatch": "BC001", "totalProduksi": 123, "kapasitas": 5000, "remaining": 4877 },
  "nextNumber": 45 }
```
`nextNumber` dari `BarangCounter (batchId, variantId, tanggal)` +1; belum ada batch → dummy `BC001`. Catatan: `ProductionBatch.nomorBatch` bertipe **Int** di DB; string `BC001` hanya format display/barcode.

**POST /api/barang/generate** (`generate.controller.ts:27`)
```json
{ "variantId": 1, "jumlah": 100 }
```
- `variantId` angka wajib → `400`; `jumlah` 1..50000 → `400` (`minimal 1` / `maksimal 50000`); variant hilang → `404`.
- Barcode: `BC{batch 3 digit}-{kodeVariant}-{DDMMYY}-{urut 4 digit}`, cth `BC001-W001-250826-0001`. Counter per `(batchId, variantId, tanggal)`.
- Batch kapasitas `5000` (`BATCH_KAPASITAS`); penuh → `SELESAI` + batch baru; 1 request bisa split multi-batch. Transaction + `SELECT FOR UPDATE`, timeout 120s, retry 5x (`P2002`/`P2034`/deadlock).
- Side-effect: `Barang` status `REGISTER`, `RiwayatBarang "Barang dibuat"`, update `totalProduksi`. Broadcast `barang.generated`.
- 201: `{ message, totalDibuat, batches: [{ kodeBatch, batchId, jumlah, barang: [{id, kodeBarang}] }] }`.

### 8.2 CRUD Single Barang

**POST /api/barang** (`crud.controller.ts:16`)
- Body `{ variantId*, batchId?, kodeBarang?, tanggal?, status?, keterangan? }`: `variantId` angka wajib; `batchId` angka jika ada; `status` salah satu enum; `tanggal` valid Date; `kodeBarang` kosong → auto-generate; `batchId` kosong → batch AKTIF/baru.
- 201 + broadcast `barang.created`. 404 variant/batch hilang, 409 duplicate `P2002`.

**PUT /api/barang/:id** (`crud.controller.ts:85`)
- Min 1 field → `400`; validasi sama; `tanggal: null` boleh (skip). 200 + broadcast `barang.updated`. 404/409.

**DELETE /api/barang/:id** (`crud.controller.ts:172`)
- Hapus `RiwayatBarang` dulu (Restrict), baru `Barang`, decrement `batch.totalProduksi`. 200 `{ message: "Barang berhasil dihapus", id }` + broadcast `barang.deleted`. 404 jika hilang.

### 8.3 List / Filter / Pagination

**GET /api/barang** (`query.controller.ts:38`)
- Query: `page` default 1 min 1; `limit` default 20 max 100; `variantId`/`batchId` angka → 400 jika NaN; `status` enum → 400; `tanggal` (`YYYY-MM-DD`) shortcut 1 hari penuh, **diabaikan jika `tanggalAwal`/`tanggalAkhir` dikirim**; `tanggalAwal > tanggalAkhir` → 400.
- Per-hari: `?tanggal=2026-08-26`. Per-minggu: `?tanggalAwal=..&tanggalAkhir=..`. Per-bulan: range 1 bulan penuh.
- 200: `{ data: [...include variant(product,style,color,size)+batch], meta: { page, limit, total, totalPages } }`.

**GET /api/barang/hari-ini** (`query.controller.ts:getBarangHariIniHandler`)
- Shortcut untuk `GET /api/barang?tanggal=<hari ini>` — filter `tanggalAwal`/`tanggalAkhir` dipaksa ke hari ini (start/end-of-day UTC, sama seperti `?tanggal=`), query tanggal lain diabaikan.
- Query opsional: `page` (default 1), `limit` (default 20, max 100), `variantId`, `batchId`, `status` (validasi sama seperti list → 400).
- 200: `{ tanggal: "YYYY-MM-DD", data: [...], meta: { page, limit, total, totalPages } }`.

**GET /api/barang/status-summary** + alias **GET /api/barang/summary** (`query.controller.ts:164`, `barang.stats.ts:39`)
- 200 bentuk aktual: `{ total: 20, perStatus: { REGISTER: 10, FINISHGOOD: 5, RETUR: 2, OUT: 3, BAD: 0 } }`.

**GET /api/barang/stats?variantId=&batchId=** (`query.controller.ts:173`, `barang.stats.ts:74`)
- 200: `{ total, perStatus, perVariant: [{variantId, nama, total}], perBatch: [{batchId, nomorBatch, total}] }`. Catatan: `perBatch` difilter `status != REGISTER`.

**GET /api/barang/batch-rentang-tanggal?tanggalAwal=&tanggalAkhir=**, **GET /api/barang/finishgood-per-bulan?variantId=&productId=&tanggalAwal=&tanggalAkhir=**
- Normalisasi tanggal sama (start/end-of-day UTC), range invalid → 400. Finishgood group `YYYY-MM` (`FinishgoodPerBulanRow { bulan, tahun, bulanAngka, variantId, productId, jumlah }`).

### 8.4 Detail / Riwayat

**GET /api/barang/:id** — 400 id invalid, 404 hilang, 200 include variant+batch.

**GET /api/barang/:id/riwayat** (`query.controller.ts:144`, `barang.ts:215`)
- 400/404 standar. 200 bentuk aktual:
```json
{ "data": [ { "id":1, "barangId":1, "status":"REGISTER", "tanggal":"...", "keterangan":"Barang dibuat" } ],
  "summary": { "kodeBarang":"BC001-...", "currentStatus":"REGISTER", "total": 2 } }
```
descending by tanggal.

### 8.5 Scan Single & Bulk

**GET /api/barang/scan/:kodeBarang** (`scan.controller.ts:6`)
- `kodeBarang` wajib → 400. 200 include variant+batch. 404 `Barang tidak ditemukan`.

**POST /api/barang/scan/bulk** (`scan.controller.ts:24`, `barang.ts:271`) — tanpa auth.
```json
{ "kodeBarang": ["BC001-W001-030926-0001", "BC001-W001-030926-0002"],
  "status": "FINISHGOOD", "keterangan": "QC pass - optional" }
```
- Validasi: `kodeBarang` array min 1 → 400; `status` enum → 400.
- Model: dedup (`duplicates` → `failed "Duplicate barcode dalam request"`), loop sequential, per-item `findUnique` → `failed "Barang tidak ditemukan"`, cek `VALID_TRANSITIONS[current].includes(newStatus)` — **same-status DITOLAK** (beda dengan `/bulk-status`), per-item `prisma.$transaction` (update + `riwayatBarang.create`), bukan global transaction (partial success mungkin).
- Broadcast per success `barang.status_updated`.
- Selalu 200 (kecuali validasi 400):
```json
{ "success": [...include variant+batch],
  "failed": [{ "kodeBarang":"...", "error":"Barang tidak ditemukan | Duplicate barcode dalam request | Transisi status dari OUT ke FINISHGOOD tidak valid" }],
  "summary": { "total": 4, "success": 1, "failed": 3 } }
```
`total` = panjang array asli termasuk duplikat.

### 8.6 Status Update Single & Bulk (by id)

**PATCH /api/barang/:id/status** (`status.controller.ts:10`, `barang.status.ts:30`)
- `{ status*, keterangan? }`; `validateTransition` **allow same-status** (`current===next → true`), tetap tulis riwayat. 200 + broadcast. 404 hilang, 400 transisi invalid.

**POST /api/barang/bulk-status** (`status.controller.ts:41`, `barang.status.ts:87`)
```json
{ "items": [{ "id":1, "status":"FINISHGOOD", "keterangan":"ok" }] }
```
- `items` array min 1 → 400; max 500 → 400; tiap `id` number → 400; tiap `status` enum → 400. Loop `updateBarangStatus` sequential (allow same-status). 200 `{ success, failed: [{id, error}], summary }` + broadcast per success.

### 8.7 Search & Export

**GET /api/barang/search?q=&limit=** — `q` wajib trim, max 100 char → 400; `limit` default 20 max 50. 200 `{ data, meta: { q, count } }`.

**GET /api/barang/export?format=csv|json&...filter** (`export.controller.ts:15`)
- `format` default `json`, selain itu → 400; `limit` max 10000 default 10000; filter sama seperti list.
- JSON: `Content-Disposition: attachment; filename="barang-export-<ts>.json"`, body `{ data, meta }`. CSV: `text/csv`, header `id,kodeBarang,status,tanggal,variantId,kodeVariant,product,style,color,size,batchId,nomorBatch`, escape koma/quote.

---

## 9. WebSocket Realtime
`src/websocket/socket.ts`, init di `api/index.ts` (non-Vercel). Channel Redis `product-events`, dua client ioredis pub/sub. Tanpa auth.

- Connect `ws://host:8000` → server kirim `{ message: "WebSocket terhubung" }` (`socket.ts:172`), simpan di `Set<WebSocket>`.
- Flow: controller `void broadcast(event)` → `redisPub.publish` → `redisSub.on("message")` → broadcast ke WS lokal.
- 11 event aktual (`AppEvent`, `socket.ts:81`):

| type | data | Pemicu |
|------|------|--------|
| `product.created` / `product.updated` | `Product` | POST / PUT `/api/products` |
| `product.deleted` | `{ id }` | DELETE product |
| `variant.created` / `variant.updated` | `ProductVariant` | POST / PATCH variant, POST / PUT `/api/variant-produk` |
| `variant.deleted` | `{ id }` | DELETE variant |
| `barang.generated` | `GenerateBarangResult { totalDibuat, batches }` | POST `/api/barang/generate` |
| `barang.status_updated` | `Barang` + variant + batch | PATCH status, POST `/bulk-status`, POST `/scan/bulk` (per success) |
| `barang.created` / `barang.updated` | `Barang` | POST / PUT `/api/barang` |
| `barang.deleted` | `{ id }` | DELETE barang |

---

## 10. Domain Model & Aturan Bisnis
`prisma/schema.prisma` — provider `mysql`, output `generated/prisma` (jangan edit manual).

- **User** `id, name, email @unique, password (bcrypt), role default "user", timestamps`.
- **Product** `id, nama, prefix, variants[]` — prefix untuk `kodeVariant`.
- **Style/Color/Size** `id, nama @unique`; `Size.urutan Int default 0`.
- **ProductVariant** `id, kodeVariant @unique, productId, styleId, colorId, sizeId, tanggal?`; `@@unique([productId,styleId,colorId,sizeId])`; `Cascade` dari Product, `Restrict` dari Style/Color/Size.
- **ProductionBatch** `id, nomorBatch Int @unique, totalProduksi default 0, kapasitas default 5000, status AKTIF|SELESAI`.
- **Barang** `id, kodeBarang @unique, variantId, batchId?, tanggal?, status REGISTER default`; `Restrict` ke variant & batch.
- **RiwayatBarang** `id, barangId, status, tanggal default now(), keterangan?`; `Restrict`.
- **BarangCounter** `@@unique([batchId,variantId,tanggal])` — reset per kombinasi.
- **Barcode:** `BC{batch 3 digit}-{kodeVariant}-{DDMMYY}-{4 digit}`, cth `BC001-W001-250826-0001`.
- Cascade: hanya Product→Variant. Hapus variant yang dipakai Barang → 409 P2003.

---

## 11. Error & Status Code

| Code | Kapan |
|------|-------|
| 200 | GET/DELETE/PATCH success; scan/bulk & bulk-status selalu 200 walau partial failed |
| 201 | POST create / generate success |
| 400 | Validasi (`wajib`, `tidak valid`, `Jumlah`, `harus` — `helpers.ts:10 errorStatus`) |
| 401 | Login salah; token hilang/invalid/revoked |
| 403 | `adminOnly` gagal |
| 404 | Pesan mengandung `tidak ditemukan` |
| 409 | Duplicate `P2002` (`sudah ada`) atau restrict `P2003` |
| 500 | Unexpected; beberapa handler sertakan `error` di body |

`errorMessage(error, fallback)` → `error.message` atau fallback. `errorStatus(msg)` → 404 / 400 / 500 sesuai substring di atas.

---

## 12. Resep Integrasi (untuk project lain)

### 12.1 Frontend baru (checklist minimal)
1. `GET /` cek koneksi. 2. `GET /api/products` isi dropdown produk. 3. `GET /api/variant-produk?productId=` isi variant. 4. `GET /api/barang/generate-info?variantId=` tampilkan `nextNumber`/sisa batch sebelum generate. 5. `POST /api/barang/generate` untuk produksi. 6. `POST /api/barang/scan/bulk` untuk QC/gudang (ingat: kirim array, handle `success`/`failed` per item, same-status = failed). 7. Subscribe WS `ws://host:8000` untuk refresh list saat `barang.status_updated` / `barang.generated`. 8. `GET /api/barang/export?format=csv` untuk laporan.

### 12.2 Contoh TypeScript shared types (copy ke project lain)
```ts
export type StatusBarang = "REGISTER" | "FINISHGOOD" | "RETUR" | "OUT" | "BAD";
export interface BulkScanRequest { kodeBarang: string[]; status: StatusBarang; keterangan?: string; }
export interface BulkScanResponse<T = unknown> {
  success: T[]; failed: { kodeBarang: string; error: string }[];
  summary: { total: number; success: number; failed: number };
}
export interface Paged<T> { data: T[]; meta: { page: number; limit: number; total: number; totalPages: number }; }
```

### 12.3 Untuk agent AI yang mau ubah backend ini
- Pola wajib: route → controller (validasi+status) → model (`src/lib/prisma.ts` shared instance). Jangan query DB di route.
- ESM: import lokal pakai `.js`. Strict TS, hindari `any`.
- Schema berubah → migration baru + generate; jangan edit `generated/` atau migration lama.
- Perilaku endpoint berubah → update/tambah test di `tests/` (`auth`, `variantproduk`, `barang` — mock model+WS).
- Jangan commit/reset/clean tanpa instruksi. Jangan reset DB destruktif.

---

## 13. Contoh cURL

```bash
BASE=http://localhost:8000

# login
curl -X POST $BASE/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@rsv.com","password":"admin123"}'

# buat product + variant
curl -X POST $BASE/api/products -H "Content-Type: application/json" \
  -d '{"nama":"Helmet X","prefix":"W"}'
curl -X POST $BASE/api/products/1/variants -H "Content-Type: application/json" \
  -d '{"styleId":1,"colorId":1,"sizeId":1}'

# master referensi
curl $BASE/api/styles && curl $BASE/api/colors && curl $BASE/api/sizes

# generate
curl -X POST $BASE/api/barang/generate -H "Content-Type: application/json" \
  -d '{"variantId":1,"jumlah":10}'
curl "$BASE/api/barang/generate-info?variantId=1"
curl "$BASE/api/barang?page=1&limit=20&status=REGISTER"
curl "$BASE/api/barang/hari-ini?status=REGISTER"
curl "$BASE/api/barang/scan/BC001-W001-030926-0001"

# bulk scan (same-status REGISTER->REGISTER = failed!)
curl -X POST $BASE/api/barang/scan/bulk -H "Content-Type: application/json" \
  -d '{"kodeBarang":["BC001-W001-030926-0001","BC001-W001-030926-0002"],"status":"FINISHGOOD","keterangan":"QC lulus"}'

# status by id (same-status OK)
curl -X PATCH $BASE/api/barang/1/status -H "Content-Type: application/json" \
  -d '{"status":"OUT","keterangan":"kirim distributor"}'
curl -X POST $BASE/api/barang/bulk-status -H "Content-Type: application/json" \
  -d '{"items":[{"id":1,"status":"RETUR"},{"id":2,"status":"BAD","keterangan":"cacat"}]}'

curl "$BASE/api/barang/1/riwayat"
curl "$BASE/api/barang/status-summary"
curl "$BASE/api/barang/stats?variantId=1"
curl "$BASE/api/barang/search?q=BC001&limit=10"
curl "$BASE/api/barang/export?format=csv&status=FINISHGOOD" -o export.csv

# websocket: wscat -c ws://localhost:8000
# -> {"message":"WebSocket terhubung"}

# logout
curl -X POST $BASE/api/auth/logout -H "Authorization: Bearer <token>"
```

---

## 14. File Referensi
- Routes: `src/routes/auth.ts`, `admin.ts`, `products.ts`, `variant-produk.ts`, `barang.ts`, `styles.ts`, `colors.ts`, `sizes.ts`, `src/app.ts`
- Controller: `src/controller/auth/auth.ts`, `product/product.ts`, `variantproduk/variantproduk.ts`, `style|color|size/*.ts`, `src/controller/barang/*`
- Model: `src/model/product/product.ts`, `variantproduk/variantproduk.ts`, `src/model/barang/barang.ts|barang.generate.ts|barang.status.ts|barang.stats.ts|barang.crud.ts`, `style|color|size/*.ts`, `user/user.ts`
- Lib: `src/lib/prisma.ts`, `jwt.ts`, `tokenBlacklist.ts`, `redis.ts`, `barangCache.ts`
- WS: `src/websocket/socket.ts` — runtime `api/index.ts`
- Schema/env/runtime: `prisma/schema.prisma`, `prisma/seed.ts`, `.env.example`, `package.json`, `docker-compose.yml`, `vercel.json`
- Test acuan: `tests/auth.test.ts`, `tests/variantproduk.test.ts`, `tests/barang.test.ts`

> Changelog doc ini: port default dikoreksi `3000`→`8000`; tabel quick-contract + auth matrix ditambah untuk konsumen luar; bentuk aktual `status-summary {total,perStatus}`, `stats {total,perStatus,perVariant,perBatch}`, `riwayat {data,summary:{kodeBarang,currentStatus,total}}` dikoreksi dari source; `nomorBatch` Int (string hanya display) ditegaskan; 11 WS event (termasuk `barang.created/updated/deleted`) diverifikasi dari `socket.ts`; penegasan tidak ada MQTT/RFID/IoT; perbedaan same-status scan/bulk vs bulk-status didokumentasikan; `GET /api/barang/hari-ini` ditambahkan.
