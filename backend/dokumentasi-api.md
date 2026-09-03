# Dokumentasi API — RSV Helmet Backend

> Base URL: `http://localhost:3000` (dev) — lihat `src/app.ts:25-32`, `api/index.ts`  
> Stack: Node.js + TypeScript + Express (ESM), Prisma 7 + `@prisma/adapter-mariadb` (MySQL/MariaDB), JWT + bcryptjs, Redis (cache + blacklist + pub/sub), `ws` WebSocket  
> Entry: `src/app.ts` mount router, `api/index.ts` runtime. Semua import lokal pakai ekstensi `.js`.

## Daftar Isi
- [Konvensi Umum](#konvensi-umum)
- [Auth](#auth)
- [Admin](#admin)
- [Product](#product)
- [Variant Produk Standalone](#variant-produk-standalone)
- [Style / Color / Size (Master Referensi)](#style--color--size-master-referensi)
- [Barang](#barang)
  - [Generate & Generate-Info](#generate--generate-info)
  - [CRUD Single Barang](#crud-single-barang)
  - [List / Filter / Pagination](#list--filter--pagination)
  - [Detail / Riwayat / Summary / Stats](#detail--riwayat--summary--stats)
  - [Scan Single & Bulk (Fokus)](#scan-single--bulk-fokus)
  - [Status Update Single & Bulk](#status-update-single--bulk)
  - [Search & Export](#search--export)
- [WebSocket Realtime](#websocket-realtime)
- [Domain Model & Aturan Bisnis](#domain-model--aturan-bisnis)
- [Error & Status Code](#error--status-code)
- [Contoh cURL](#contoh-curl)

---

## Konvensi Umum

| Aspek | Detail |
|-------|--------|
| **Content-Type** | `application/json` kecuali `GET /api/barang/export?format=csv` → `text/csv` |
| **CORS** | `cors()` global di `src/app.ts:17` |
| **Body parser** | `express.json()` + `urlencoded` |
| **Auth** | JWT Bearer `Authorization: Bearer <token>` — hanya `POST /api/auth/logout` dan `GET /api/admin/dashboard` yang wajib auth (lihat `src/routes/auth.ts:8`, `src/routes/admin.ts:6`, `src/middleware/auth.ts:13`). Endpoint lain **tidak** pakai middleware auth saat ini. |
| **JWT payload** | `{ id, email, name, role, iat, exp }` — expiry default `8h` (`src/lib/jwt.ts:5`). Secret dari `JWT_SECRET` (fallback `""` — jangan anggap aman). |
| **Blacklist** | `src/lib/tokenBlacklist.ts` pakai Redis, di `authenticate` cek `isTokenRevoked`; Redis fail-open. |
| **Validasi** | Tidak ada library validasi eksternal — validasi manual di controller. |
| **ID** | Numerik `Number(param)`; beberapa endpoint validasi `Integer >0`. |
| **Health** | `GET /` → `200 { message: "API berjalan" }` (`src/app.ts:21`) |

---

## Auth
Route: `src/routes/auth.ts`, Controller: `src/controller/auth/auth.ts`, Model: `src/model/user/user.ts`

### POST /api/auth/login
Login, return JWT.

- **File:** `src/controller/auth/auth.ts:7`
- **Request:**
```json
{ "email": "user@example.com", "password": "secret123" }
```
Validasi: `email` dan `password` wajib string truthy → `400 { message: "Field 'email' wajib diisi" }` / password serupa.

- **Flow:** `findUserByEmail` → `bcrypt.compare` → `signToken({id,email,name,role})`
- **Success 200:**
```json
{ "message": "Login berhasil", "token": "<jwt>", "user": { "id": 1, "name": "Admin", "email": "a@b.com", "role": "admin" } }
```
- **Error:** `401 { message: "Email atau password salah" }` jika user tidak ada / password salah; `500 { message: "Gagal login" }`.

### POST /api/auth/logout
Blacklist token sampai expiry.

- **File:** `src/controller/auth/auth.ts:48`
- **Auth:** `authenticate` required — header `Authorization: Bearer <token>` wajib.
- **Success 200:** `{ message: "Logout berhasil" }` — `revokeToken(token, exp)`
- **Error 401:** `Token tidak ditemukan` (header hilang), `Token sudah logout` (revoked), `Token tidak valid atau kedaluwarsa`.

---

## Admin

### GET /api/admin/dashboard
- **File:** `src/routes/admin.ts:6`
- **Auth:** `authenticate` + `adminOnly` (`src/middleware/auth.ts:36` cek `role === "admin"` → `403 { message: "Akses ditolak. Memerlukan akses admin." }`)
- **Success 200:**
```json
{ "message": "Admin dashboard", "user": { "id":1, "email":"...", "name":"...", "role":"admin", "iat":..., "exp":... } }
```

---

## Product
Router: `src/routes/products.ts`, Controller: `src/controller/product/product.ts`, Model: `src/model/product/product.ts`

| Endpoint | Method | Deskripsi | Auth | Status |
|----------|--------|-----------|------|--------|
| `/api/products` | GET | List semua product + variants + relasi | — | 200/500 |
| `/api/products/:id` | GET | Detail product by id | — | 200/404/500 |
| `/api/products` | POST | Buat product | — | 201/400/500 |
| `/api/products/:id` | PUT | Update nama product | — | 200/400/500 |
| `/api/products/:id` | DELETE | Hapus product (cascade variant) | — | 200/500 |
| `/api/products/:id/variants` | GET | Variant milik product | — | 200/500 |
| `/api/products/:id/variants` | POST | Tambah variant ke product | — | 201/400/409/500 |
| `/api/products/:id/variants/:variantId` | PATCH | Update `tanggal` variant | — | 200/500 |
| `/api/products/:id/variants/:variantId` | DELETE | Hapus variant | — | 200/500 |

### Detail Product

**GET /api/products** — `getProductsHandler` (`src/controller/product/product.ts:19`) → `getAllProducts()` include `variants { product, style, color, size }`. Tanpa pagination. Redis cache 60 detik di model.

**GET /api/products/:id** — `getProductDetail` (`:32`) → `getProductById(id)`. `404 { message: "Produk tidak ditemukan" }` jika null.

**POST /api/products** — `createProductHandler` (`:52`)
- Body: `{ nama, prefix }` keduanya wajib truthy → `400 { message: "Field 'nama', 'prefix' wajib diisi" }`
- Model generate `kodeVariant` = `<PREFIX_UPPERCASE><nomor 3 digit>` dari id variant terakhir +1.
- **201** return product; broadcast `product.created` (`src/websocket/socket.ts:15`)

**PUT /api/products/:id** — `updateProductHandler` (`:78`) body `{ nama }` wajib → `400`. Broadcast `product.updated`.

**DELETE /api/products/:id** — `deleteProductHandler` (`:106`) cascade hapus variant (`onDelete: Cascade` di `prisma/schema.prisma:75`). Broadcast `product.deleted { id }`.

**GET /api/products/:id/variants** — `getProductVariantsHandler` (`:128`)

**POST /api/products/:id/variants** — `addVariantHandler` (`:144`)
- Body: `{ styleId, colorId, sizeId, tanggal? }` — semua wajib kecuali tanggal → `400`
- `createProductVariant(productId, { styleId:Number, colorId, sizeId, tanggal:Date })`
- `409 { message: "Kombinasi style, color, size sudah ada untuk produk ini" }` jika `P2002` (unique `[productId, styleId, colorId, sizeId]`)
- Broadcast `variant.created`, **201**.

**PATCH /api/products/:id/variants/:variantId** — `updateVariantHandler` (`:179`)
- Body: `{ tanggal? }` — optional, jika ada di-parse `new Date`. Tidak ada validasi minimal field di route product (beda dengan standalone PUT).
- Broadcast `variant.updated`, **200**.

**DELETE /api/products/:id/variants/:variantId** — `deleteVariantHandler` (`:205`)
- Restrict jika dipakai Barang/Counter → `500`. Broadcast `variant.deleted`.

---

## Variant Produk Standalone
Router: `src/routes/variant-produk.ts`, Controller: `src/controller/variantproduk/variantproduk.ts`, Model: `src/model/variantproduk/variantproduk.ts` (baca view `ViewVariantProduk`)

| Endpoint | Method | Deskripsi |
|----------|--------|-----------|
| `/api/variant-produk` | GET | List view, filter query |
| `/api/variant-produk/:id` | GET | Detail |
| `/api/variant-produk` | POST | Create |
| `/api/variant-produk/:id` | PUT | Update parsial |
| `/api/variant-produk/:id` | DELETE | Delete |

**GET /api/variant-produk** — `getVariantProdukHandler` (`src/controller/variantproduk/variantproduk.ts:34`)
- Query opsional: `productId, styleId, colorId, sizeId` — jika ada harus integer >0 → `400 { message: "Query param 'key' harus berupa angka bulat positif" }`
- **200** array view rows.

**GET /api/variant-produk/:id** — `getVariantProdukDetail` (`:61`)
- `id` NaN → `400 { message: "Parameter 'id' tidak valid" }`
- Not found → `404 { message: "Variant produk tidak ditemukan" }`

**POST /api/variant-produk** — `createVariantHandler` (`:86`)
- Body: `{ productId, styleId, colorId, sizeId, tanggal? }` semua ID wajib integer >0 → `400 { message: "Field 'field' wajib diisi dan berupa angka bulat positif" }`
- `tanggal` jika ada harus valid Date → `400 { message: "Field 'tanggal' harus berupa tanggal yang valid" }`
- FK tidak ada → `404` message `tidak ditemukan`, duplicate `P2002` → `409 { message: "Kombinasi style, color, size sudah ada untuk produk ini" }`
- Broadcast `variant.created`, **201** return variant (`kodeVariant` auto-generated).

**PUT /api/variant-produk/:id** — `updateVariantHandler` (`:146`)
- Body parsial: `{ styleId?, colorId?, sizeId?, tanggal? }` minimal satu → `400 { message: "Minimal satu field wajib diisi..." }`
- Tiap field validasi `parsePositiveInt` → `400`, `tanggal` valid → `400`
- `P2002` → `409` duplicate, `P2003` FK invalid → `400 { message: "styleId, colorId, atau sizeId merujuk data yang tidak ada" }`
- Not found → `404`, broadcast `variant.updated`, **200**

**DELETE /api/variant-produk/:id** — `deleteVariantHandler` (`:216`)
- `P2003` restrict (masih dipakai Barang/Counter) → `409 { message: "Variant tidak dapat dihapus karena masih direferensikan..." }`
- Broadcast `variant.deleted`, **200 { message: "Variant berhasil dihapus" }**

---

## Style / Color / Size (Master Referensi)
Router: `src/routes/styles.ts`, `colors.ts`, `sizes.ts`  
Controller: `src/controller/style/style.ts`, `color/color.ts`, `size/size.ts`  
Model: `src/model/style/style.ts` etc.  
Schema: `Style`, `Color`, `Size` (`prisma/schema.prisma:33-59`) — `nama @unique`, `Size.urutan Int default 0`

Semua tanpa auth.

### Pattern CRUD (berlaku untuk styles, colors, sizes)

| Endpoint | Method | Controller | Body / Validasi | Success | Error |
|----------|--------|------------|-----------------|---------|-------|
| `/api/styles` | GET | `getStylesHandler` | — | 200 array | 500 |
| `/api/styles/:id` | GET | `getStyleDetail` | `id` integer >0 → 400, 404 | 200 object | 400/404/500 |
| `/api/styles` | POST | `createStyleHandler` | `{ nama }` wajib trim truthy → 400 | 201 object | 409 `Nama style sudah ada` (P2002) |
| `/api/styles/:id` | PUT | `updateStyleHandler` | `id` >0, `nama` wajib → 400 | 200 object | 409 / 404 P2025 |
| `/api/styles/:id` | DELETE | `deleteStyleHandler` | `id` >0 | 200 `{ message }` | 404 P2025, 409 `masih dipakai variant` (P2003) |

- **Colors** sama, pesan `Warna ...` (`src/controller/color/color.ts`)
- **Sizes** beda: `POST /api/sizes` body `{ nama, urutan? }` — `urutan` jika ada harus integer >=0 → `400 { message: "Field 'urutan' harus angka bulat >= 0" }`; `PUT` butuh minimal satu dari `nama`/`urutan` → `400 { message: "Minimal satu field 'nama' atau 'urutan' wajib diisi" }`

---

## Barang
Router: `src/routes/barang.ts` (94 baris) — **urutan route penting**: `/generate-info`, `/generate`, `/`, `/status-summary`, `/stats`, `/batch-rentang-tanggal`, `/finishgood-per-bulan`, `/search`, `/export`, `/scan/:kodeBarang`, `/scan/bulk`, `/bulk-status`, `/:id` (detail harus paling akhir).  
Controller split: `generate.controller.ts`, `scan.controller.ts`, `status.controller.ts`, `query.controller.ts`, `export.controller.ts`, `crud.controller.ts`, `helpers.ts`  
Model: `src/model/barang/barang.ts` barrel + `barang.generate.ts`, `barang.status.ts`, `barang.stats.ts`, `barang.crud.ts`  
Schema: `Barang`, `ProductionBatch`, `RiwayatBarang`, `BarangCounter` (`prisma/schema.prisma:90-179`)

### Generate & Generate-Info

#### GET /api/barang/generate-info?variantId=1
- **File:** `src/controller/barang/generate.controller.ts:9`, `src/model/barang/barang.generate.ts:297`
- **Query:** `variantId` wajib angka → `400 { message: "Query parameter 'variantId' wajib diisi dan berupa angka" }`
- **404** jika variant tidak ada (`Variant tidak ditemukan` → `404` via `errorStatus`)
- **200:**
```json
{
  "variantId": 1,
  "kodeVariant": "W001",
  "tanggal": "2026-09-03",
  "batch": { "kodeBatch": "BC001", "totalProduksi": 123, "kapasitas": 5000, "remaining": 4877 },
  "nextNumber": 45
}
```
`nextNumber` dari `BarangCounter` `(batchId, variantId, tanggal)` +1; jika belum ada batch → `BC001` dummy.

#### POST /api/barang/generate
Bulk generate barang dengan barcode otomatis, distribusi multi-batch.

- **File:** `src/controller/barang/generate.controller.ts:27`, `src/model/barang/barang.generate.ts:142`
- **Request:**
```json
{ "variantId": 1, "jumlah": 100 }
```
Validasi: `variantId` wajib angka → `400`; `jumlah` wajib angka 1..50000 → `400 { message: "Field 'jumlah' ... minimal 1" }` / `400 { message: "Field 'jumlah' maksimal 50000 per request" }`; model juga cek `1..50000` → `400 Jumlah harus antara 1 dan 50000`; variant tidak ada → `404`.
- **Barcode format:** `BC{nomorBatch 3 digit}-{kodeVariant}-{DDMMYY}-{nomorUrut 4 digit}` — cth `BC001-W001-250826-0001`. Counter per `(batchId, variantId, tanggal)` via `BarangCounter`.
- **Batch:** kapasitas `5000` (`BATCH_KAPASITAS`), pertama `BC001`, penuh → `SELESAI` dan buat batch baru. Satu request bisa split ke beberapa batch (`batches[]`).
- **Transaction:** `prisma.$transaction` + `SELECT ... FOR UPDATE` di `ProductionBatch` & `BarangCounter`, timeout 120s, retry 5x untuk `P2002`/`P2034`/`write conflict`/`deadlock`.
- **Side-effect:** buat `Barang` status `REGISTER`, `RiwayatBarang` keterangan `Barang dibuat`, update `ProductionBatch.totalProduksi`, set `SELESAI` jika penuh.
- **Broadcast:** `barang.generated` (`src/websocket/socket.ts:51`) dengan `data: { totalDibuat, batches }`
- **Success 201:**
```json
{ "message": "100 barang berhasil digenerate", "totalDibuat": 100, "batches": [{ "kodeBatch":"BC001","batchId":1,"jumlah":100,"barang":[{"id":1,"kodeBarang":"BC001-W001-030926-0001"}]}] }
```

### CRUD Single Barang

#### POST /api/barang
Create single barang (manual / auto-generate kode).

- **File:** `src/controller/barang/crud.controller.ts:16`, `src/model/barang/barang.crud.ts`
- **Body:** `{ variantId, batchId?, kodeBarang?, tanggal?, status?, keterangan? }`
  - `variantId` wajib angka → `400 { message: "Field 'variantId' wajib diisi dan berupa angka" }`
  - `batchId` jika ada harus angka → `400`
  - `status` jika ada harus `REGISTER|FINISHGOOD|RETUR|OUT|BAD` → `400`
  - `tanggal` jika ada harus valid Date → `400`
  - `kodeBarang` jika ada harus string; kosong → auto-generate `BCxxx...`
  - `keterangan` optional string → disimpan ke riwayat
  - Jika `kodeBarang` kosong → auto-generate via counter (sama seperti bulk); `batchId` kosong → pakai batch AKTIF / buat baru.
- **201** return barang include variant+batch; broadcast `barang.created`
- **Error:** `404` variant/batch tidak ditemukan, `409` duplicate kode `P2002` message `sudah ada`.

#### PUT /api/barang/:id
Update barang parsial.

- **File:** `src/controller/barang/crud.controller.ts:85`
- **Params:** `id` valid → `400` jika NaN
- **Body:** `{ variantId?, batchId?, kodeBarang?, tanggal?, status?, keterangan? }` minimal satu → `400 { message: "Minimal satu field harus diisi..." }`
  - Validasi sama seperti create; `status` divalidasi dengan `VALID_TRANSITIONS` di model.
  - `tanggal: null` diperbolehkan (skip).
- **200** return updated; broadcast `barang.updated`
- **404** jika barang tidak ada, **409** duplicate, **400** `Tidak ada field`, **404/400** via `errorStatus`.

#### DELETE /api/barang/:id
- **File:** `src/controller/barang/crud.controller.ts:172`
- **Params:** `id` → `400` jika invalid
- **Flow:** hapus `RiwayatBarang` dulu (Restrict), baru `Barang`, decrement `batch.totalProduksi` jika ada batch.
- **200:** `{ message: "Barang berhasil dihapus", id }`; broadcast `barang.deleted { id }`
- **404** jika tidak ada.

### List / Filter / Pagination

#### GET /api/barang
List barang dengan filter & pagination.

- **File:** `src/controller/barang/query.controller.ts:14`, `src/model/barang/barang.ts:listBarang`
- **Query:**
  - `page` default `1` (min 1)
  - `limit` default `20`, max `100`, min 1
  - `variantId`, `batchId` optional angka → `400` jika NaN
  - `status` optional harus salah satu `REGISTER,FINISHGOOD,RETUR,OUT,BAD` → `400`
  - `tanggal` optional `YYYY-MM-DD` — shortcut filter 1 hari penuh (setara `tanggalAwal` + `tanggalAkhir` di hari sama) → `400` jika invalid; hanya dipakai jika `tanggalAwal`/`tanggalAkhir` tidak dikirim (jika dikirim bareng, `tanggal` diabaikan, `tanggalAwal`/`tanggalAkhir` yang dipakai)
  - `tanggalAwal`, `tanggalAkhir` optional `YYYY-MM-DD` → `400` jika invalid
  - **Normalisasi tanggal (fix 2026-09-03):** `tanggalAwal` → `00:00:00.000 UTC` (start-of-day), `tanggalAkhir` → `23:59:59.999 UTC` (end-of-day), `tanggal` → keduanya. Sebelum fix `new Date("YYYY-MM-DD")` midnight `gte/lte` bikin filter hari sama kosong (hanya match `00:00:00.000`); sekarang inclusive full day. Defensive normalize juga di `src/model/barang/barang.ts:listBarang` (midnight `tanggalAkhir` dipaksa end-of-day).
  - Validasi range: `tanggalAwal > tanggalAkhir` → `400 { message: "Parameter 'tanggalAwal' tidak boleh lebih besar dari 'tanggalAkhir'" }`
  - **Filter per-hari/minggu/bulan tanpa endpoint baru:**
    - Per hari: `?tanggal=2026-08-26` atau `?tanggalAwal=2026-08-26&tanggalAkhir=2026-08-26`
    - Per minggu: `?tanggalAwal=2026-08-25&tanggalAkhir=2026-08-31`
    - Per bulan: `?tanggalAwal=2026-08-01&tanggalAkhir=2026-08-31`
- **200:**
```json
{ "data": [ { "id":1, "kodeBarang":"BC001-...", "status":"REGISTER", "variant":{ "product":{...} } , "batch":{...} } ], "meta": { "page":1, "limit":20, "total":123, "totalPages":7 } }
```

#### GET /api/barang/status-summary & GET /api/barang/summary (alias)
- **File:** `src/controller/barang/query.controller.ts:119`, `src/model/barang/barang.stats.ts:getStatusSummary`
- **200:** `{ REGISTER: 10, FINISHGOOD: 5, RETUR: 2, OUT: 3, BAD: 0, total: 20 }` dan breakdown per variant/batch (groupBy).

#### GET /api/barang/stats?variantId=&batchId=
Statistik ringkas (total, by status, by variant, by batch).

- **File:** `src/controller/barang/query.controller.ts:128`, `src/model/barang/barang.stats.ts:getBarangStats`

#### GET /api/barang/batch-rentang-tanggal?tanggalAwal=&tanggalAkhir=
Range tanggal batch.

- **File:** `src/controller/barang/query.controller.ts:201`, `src/model/barang/barang.stats.ts:getBatchRentangTanggal`
- **Query tanggal:** sama dengan `GET /api/barang` — `tanggalAwal` start-of-day `00:00:00.000 UTC`, `tanggalAkhir` end-of-day `23:59:59.999 UTC`, `tanggalAwal > tanggalAkhir` → `400`.

#### GET /api/barang/finishgood-per-bulan?variantId=&productId=&tanggalAwal=&tanggalAkhir=
Jumlah finish good per bulan (group `YYYY-MM`).

- **File:** `src/controller/barang/query.controller.ts:233`
- **Query tanggal:** sama — `tanggalAwal`/`tanggalAkhir` dinormalisasi ke start/end-of-day UTC, validasi range `400`. Filter bulan pakai `YYYY-MM` dari tanggal tersebut.

### Detail / Riwayat / Summary / Stats

#### GET /api/barang/:id
Detail barang by ID include variant (product, style, color, size) + batch.

- **File:** `src/controller/barang/query.controller.ts:79`
- **400** `Parameter 'id' tidak valid` jika NaN, **404** `Barang tidak ditemukan`.

#### GET /api/barang/:id/riwayat
Riwayat status barang + summary.

- **File:** `src/controller/barang/query.controller.ts:99`, `src/model/barang/barang.ts:getRiwayatByBarangId`
- **400** id invalid, **404** barang tidak ada.
- **200:**
```json
{ "barang": { "id":1, "kodeBarang":"..." }, "riwayat": [ { "id":1, "status":"REGISTER", "tanggal":"2026-09-03T...", "keterangan":"Barang dibuat" } ], "summary": { "REGISTER":1, "FINISHGOOD":1 } }
```
Riwayat descending by tanggal.

### Scan Single & Bulk (Fokus)

#### GET /api/barang/scan/:kodeBarang
Scan single barang by barcode.

- **File:** `src/controller/barang/scan.controller.ts:6`, `src/model/barang/barang.ts:179`
- **Params:** `kodeBarang` wajib → `400 { message: "Parameter 'kodeBarang' wajib diisi" }`
- **200:** barang include `variant { product, style, color, size }` + `batch { id, nomorBatch, totalProduksi, kapasitas, status }`
- **Error:** `404 { message: "Barang tidak ditemukan" }` via `errorStatus` (`tidak ditemukan` → 404), `500` fallback.

#### POST /api/barang/scan/bulk
Bulk scan ubah status banyak barang via barcode — **endpoint utama dokumentasi ini**.

- **File:** `src/controller/barang/scan.controller.ts:24`, `src/model/barang/barang.ts:212`, `src/routes/barang.ts:71`, `tests/barang.test.ts`
- **Route:** `POST /api/barang/scan/bulk` — tanpa auth (sesuai `src/routes/barang.ts`).
- **Request Body:**
```json
{
  "kodeBarang": ["BC001-W001-030926-0001", "BC001-W001-030926-0002"],
  "status": "FINISHGOOD",
  "keterangan": "QC pass - optional"
}
```
- **Validasi Controller (sebelum model):**
  - `kodeBarang` harus array minimal 1 item → `400 { message: "Field 'kodeBarang' wajib diisi dan berupa array minimal 1 item" }` (`src/controller/barang/scan.controller.ts:28`)
  - `status` harus salah satu `REGISTER, FINISHGOOD, RETUR, OUT, BAD` via `isValidStatus` (`src/controller/barang/helpers.ts:21`) → `400 { message: "Field 'status' wajib diisi dan harus salah satu dari: REGISTER, FINISHGOOD, RETUR, OUT, BAD" }`
  - `keterangan` optional string; jika string akan diteruskan ke `RiwayatBarang.keterangan` untuk setiap sukses.

- **Logika Model `bulkScanBarang(kodeBarangList, newStatus, keterangan)` (`src/model/barang/barang.ts:212`):**
  1. **Dedup:** `unique = [...new Set(list)]`, `duplicates = list.filter((k,i)=>list.indexOf(k)!==i)` — duplicates tidak diproses update, langsung masuk `failed`.
  2. **Loop sequential** per `uniqueKodeBarang`:
     - `findUnique({ kodeBarang })` → jika null → `failed.push({ kodeBarang, error: "Barang tidak ditemukan" })`
     - Cek transisi: `VALID_TRANSITIONS[current].includes(newStatus)` (`src/model/barang/barang.status.ts:13`). **Catatan:** bulk scan **tidak allow same-status** (`REGISTER→REGISTER` akan `failed: Transisi status dari REGISTER ke REGISTER tidak valid`), beda dengan `updateBarangStatus` via `/bulk-status` yang allow same-status (`validateTransition` return true jika `current===next`).
     - Jika transisi invalid → `failed.push({ kodeBarang, error: "Transisi status dari X ke Y tidak valid" })`
     - Jika valid → `prisma.$transaction` per item:
       ```ts
       tx.barang.update({ where:{id}, data:{status:newStatus}, include:{variant:{include:{product,style,color,size}}, batch:{select:{...}}} })
       tx.riwayatBarang.create({ data:{ barangId:id, status:newStatus, keterangan } })
       ```
       Include lengkap (variant+batch) di return success. Catch per-item → `failed.push({ kodeBarang, error: message })`.
  3. **Duplicate handling:** setelah loop, `for (dup of duplicates) failed.push({ kodeBarang:dup, error:"Duplicate barcode dalam request" })`
  4. **Bukan global transaction** — tiap barcode transaction sendiri; partial success dimungkinkan.

- **Status Transitions (`src/model/barang/barang.status.ts:13`):**
```
REGISTER   -> FINISHGOOD | OUT | RETUR | BAD
FINISHGOOD -> OUT | RETUR | BAD
RETUR      -> FINISHGOOD | OUT | BAD
OUT        -> terminal (tidak boleh pindah)
BAD        -> terminal
```
Same-status hanya valid di path `updateBarangStatus`/`bulk-status`, tidak di `scan/bulk`.

- **Broadcast:** setelah `bulkScanBarang`, untuk setiap `success` → `await broadcast({ type:"barang.status_updated", message:`Status barang ${kode} diubah menjadi ${status}`, data: barang })` (`src/websocket/socket.ts:57`). Via Redis pub/sub `product-events`.

- **Response 200 (selalu 200 walau partial failed, kecuali validasi awal 400):**
```json
{
  "success": [ { "id":1, "kodeBarang":"BC001-W001-030926-0001", "status":"FINISHGOOD", "variant":{...}, "batch":{...} } ],
  "failed": [
    { "kodeBarang":"BC001-W001-030926-0009", "error":"Barang tidak ditemukan" },
    { "kodeBarang":"BC001-W001-030926-0002", "error":"Duplicate barcode dalam request" },
    { "kodeBarang":"BC001-W001-030926-0003", "error":"Transisi status dari OUT ke FINISHGOOD tidak valid" }
  ],
  "summary": { "total": 4, "success": 1, "failed": 3 }
}
```
`total` = `kodeBarang.length` asli (termasuk duplikat), `success`/`failed` = panjang array.

- **Error Controller:** catch global → `500 { message: "Gagal bulk scan barang" }` (tidak pakai `errorStatus` untuk bulk).

- **Contoh cURL:**
```bash
curl -X POST http://localhost:3000/api/barang/scan/bulk \
  -H "Content-Type: application/json" \
  -d '{"kodeBarang":["BC001-W001-030926-0001","BC001-W001-030926-0001"],"status":"FINISHGOOD","keterangan":"scan QC batch 1"}'
# 200 => success 1, failed 1 duplicate
```

- **Perbandingan dengan `/bulk-status` (by id):** `POST /api/barang/bulk-status` pakai `{ items: [{id, status, keterangan}] }`, allow same-status, max 500, per-item `updateBarangStatus` yang transaction-nya sama tapi validateTransition lebih longgar.

### Status Update Single & Bulk

#### PATCH /api/barang/:id/status
Update status single by ID.

- **File:** `src/controller/barang/status.controller.ts:10`, `src/model/barang/barang.status.ts:29`
- **Params:** `id` → `400 { message: "Parameter 'id' tidak valid" }` jika NaN
- **Body:** `{ status, keterangan? }` — `status` valid → `400 { message: "Field 'status' wajib diisi dan harus salah satu dari: ..." }`
- **Flow:** `findUnique` → `validateTransition` (allow same-status) → `prisma.$transaction` update + `riwayatBarang.create`
- **200:** barang include variant+batch; broadcast `barang.status_updated`
- **Error:** `404 Barang tidak ditemukan`, `400 Transisi status ... tidak valid` via `errorStatus`.

#### POST /api/barang/bulk-status
Bulk update by ID (beda dari scan/bulk yang by kodeBarang).

- **File:** `src/controller/barang/status.controller.ts:41`, `src/model/barang/barang.status.ts:83`
- **Body:**
```json
{ "items": [{ "id":1, "status":"FINISHGOOD", "keterangan":"ok" }, { "id":2, "status":"RETUR" }] }
```
- **Validasi:**
  - `items` array min 1 → `400 { message: "Field 'items' wajib diisi dan berupa array minimal 1 item" }`
  - max 500 → `400 { message: "Field 'items' maksimal 500 per request" }`
  - tiap item `id` number valid → `400 { message: "Setiap item harus memiliki 'id' berupa angka" }`
  - tiap `status` valid → `400 { message: "Setiap item.status harus salah satu dari: ..." }`
  - `keterangan` string optional, else undefined.
- **Model:** loop `updateBarangStatus` per item sequential, per-item transaction, allow same-status, kumpulkan `success`/`failed` (`{id, error}`)
- **Broadcast** per success `barang.status_updated` dengan `data.status` baru.
- **200:**
```json
{ "success":[...], "failed":[{ "id":99, "error":"Barang tidak ditemukan"}], "summary":{ "total":2, "success":1, "failed":1 } }
```

### Search & Export

#### GET /api/barang/search?q=&limit=
Cari by kodeBarang partial (LIKE).

- **File:** `src/controller/barang/query.controller.ts:241`, `src/model/barang/barang.ts:searchBarangByKode`
- **Query:** `q` wajib trim non-empty → `400 { message: "Query parameter 'q' wajib diisi" }`; max 100 char → `400 { message: "Query parameter 'q' maksimal 100 karakter" }`; `limit` default 20, max 50.
- **200:** `{ data:[...], meta:{ q, count } }`

#### GET /api/barang/export?format=csv|json&page=&limit=&variantId=&batchId=&status=&tanggalAwal=&tanggalAkhir=
Export barang.

- **File:** `src/controller/barang/export.controller.ts:15`
- **Query:** `format` `json`|`csv` default `json` → `400` jika lain; `page`/`limit` (limit max 10000 default 10000); filter sama seperti list; `status` valid → `400`; `tanggalAwal`/`tanggalAkhir` normalisasi start/end-of-day UTC sama seperti `GET /api/barang`, `tanggalAwal > tanggalAkhir` → `400`.
- **JSON 200:** header `Content-Type: application/json`, `Content-Disposition: attachment; filename="barang-export-<ts>.json"` body `{ data, meta }`
- **CSV 200:** `text/csv` dengan header `id,kodeBarang,status,tanggal,variantId,kodeVariant,product,style,color,size,batchId,nomorBatch` (nomorBatch format `BC001`), `escapeCsv` untuk koma/quote.

---

## WebSocket Realtime
File: `src/websocket/socket.ts`, init di `api/index.ts` (non-Vercel). Channel Redis `product-events` (dua client ioredis pub/sub).

- **Connect:** `new WebSocket("ws://localhost:3000")` → server kirim `{ message: "WebSocket terhubung" }` (`:172`), simpan di `Set<WebSocket>`.
- **Broadcast flow:** controller `void broadcast(event)` → `redisPub.publish(CHANNEL, JSON.stringify(event))` → `redisSub.on("message") → broadcastLocal` ke semua ws client lokal.
- **Tidak ada auth** untuk WS.
- **Event types (`AppEvent`):**

| type | data | Pemicu |
|------|------|--------|
| `product.created` | `Product` | `POST /api/products` |
| `product.updated` | `Product` | `PUT /api/products/:id` |
| `product.deleted` | `{ id }` | `DELETE /api/products/:id` |
| `variant.created` | `ProductVariant` | `POST /api/products/:id/variants` atau `POST /api/variant-produk` |
| `variant.updated` | `ProductVariant` | `PATCH .../variants/:variantId` / `PUT /api/variant-produk/:id` |
| `variant.deleted` | `{ id }` | `DELETE ...` |
| `barang.generated` | `GenerateBarangResult { totalDibuat, batches }` | `POST /api/barang/generate` |
| `barang.status_updated` | `Barang` (include variant+batch) | `PATCH /api/barang/:id/status`, `POST /api/barang/bulk-status`, `POST /api/barang/scan/bulk` (per success) |
| `barang.created` | `Barang` | `POST /api/barang` |
| `barang.updated` | `Barang` | `PUT /api/barang/:id` |
| `barang.deleted` | `{ id }` | `DELETE /api/barang/:id` |

Vercel: WS tidak diinisialisasi.

---

## Domain Model & Aturan Bisnis
`prisma/schema.prisma` — MySQL provider, output `generated/prisma`.

- **User** `id, name, email @unique, password (bcrypt), role default "user", timestamps`
- **Product** `id, nama, prefix, variants[]` — `prefix` dipakai untuk `kodeVariant`.
- **Style/Color/Size** `id, nama @unique` — `Size.urutan Int default 0`.
- **ProductVariant** `id, kodeVariant @unique, productId, styleId, colorId, sizeId, tanggal?` — `@@unique([productId,styleId,colorId,sizeId])`, `kodeVariant = <PREFIX_UPPERCASE><3 digit>` dari id terakhir +1, `onDelete: Cascade` dari Product, `Restrict` dari Style/Color/Size.
- **ProductionBatch** `id, nomorBatch @unique, totalProduksi default 0, kapasitas default 5000, status AKTIF|SELESAI, barang[], counters[]`
- **Barang** `id, kodeBarang @unique, variantId, batchId?, tanggal?, status REGISTER default, variant Restrict, batch Restrict`
- **RiwayatBarang** `id, barangId, status, tanggal default now(), keterangan?, barang Restrict`
- **BarangCounter** `id, batchId, variantId, tanggal, currentCount default 0, @@unique([batchId,variantId,tanggal])` — reset per tanggal/batch/variant.
- **Barcode:** `BC{nomorBatch 3 digit}-{kodeVariant}-{DDMMYY}-{4 digit}` cth `BC001-W001-250826-0001`.
- **Produk tanpa CRUD Style/Color/Size via seed:** `prisma/seed.ts`.
- **View:** `ViewVariantProduk` untuk `GET /api/variant-produk`.

**Constraint cascade:** Product→Variant `Cascade`, lainnya `Restrict`. Hapus variant yang dipakai Barang → `409` P2003.

---

## Error & Status Code

| Code | Kapan |
|------|-------|
| 200 | GET success, DELETE success, scan/bulk success (partial tetap 200) |
| 201 | POST create success |
| 400 | Validasi input gagal (pesan mengandung `wajib`, `tidak valid`, `Jumlah`, `harus` — lihat `src/controller/barang/helpers.ts:10 errorStatus`) |
| 401 | Auth gagal (login salah, token hilang/invalid/revoked) |
| 403 | `adminOnly` gagal (bukan admin) |
| 404 | `tidak ditemukan` (via `errorStatus` / controller explicit) |
| 409 | Duplicate `P2002` (`sudah ada`) atau `P2003` restrict |
| 500 | Unexpected error, `error` disertakan di response beberapa handler |

`errorMessage(error, fallback)` → `error.message` jika Error, else fallback. `errorStatus(message)` → 404 jika `tidak ditemukan`, 400 jika `tidak valid`/`Jumlah`/`wajib`, else 500.

---

## Contoh cURL

```bash
# login
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@rsv.com","password":"admin123"}'

# buat product
curl -X POST http://localhost:3000/api/products -H "Content-Type: application/json" \
  -d '{"nama":"Helmet X","prefix":"W"}'

# tambah variant
curl -X POST http://localhost:3000/api/products/1/variants -H "Content-Type: application/json" \
  -d '{"styleId":1,"colorId":1,"sizeId":1}'

# generate 10 barang
curl -X POST http://localhost:3000/api/barang/generate -H "Content-Type: application/json" \
  -d '{"variantId":1,"jumlah":10}'

# generate info
curl "http://localhost:3000/api/barang/generate-info?variantId=1"

# list barang
curl "http://localhost:3000/api/barang?page=1&limit=20&status=REGISTER"

# scan single
curl "http://localhost:3000/api/barang/scan/BC001-W001-030926-0001"

# bulk scan (scan bulk)
curl -X POST http://localhost:3000/api/barang/scan/bulk -H "Content-Type: application/json" \
  -d '{"kodeBarang":["BC001-W001-030926-0001","BC001-W001-030926-0002"],"status":"FINISHGOOD","keterangan":"QC lulus"}'

# patch status single
curl -X PATCH http://localhost:3000/api/barang/1/status -H "Content-Type: application/json" \
  -d '{"status":"OUT","keterangan":"kirim distributor"}'

# bulk status by id
curl -X POST http://localhost:3000/api/barang/bulk-status -H "Content-Type: application/json" \
  -d '{"items":[{"id":1,"status":"RETUR"},{"id":2,"status":"BAD","keterangan":"cacat"}]}'

# riwayat
curl "http://localhost:3000/api/barang/1/riwayat"

# search & export
curl "http://localhost:3000/api/barang/search?q=BC001&limit=10"
curl "http://localhost:3000/api/barang/export?format=csv&status=FINISHGOOD" -o export.csv

# websocket
# wscat -c ws://localhost:3000
# -> {"message":"WebSocket terhubung"}
# -> {"type":"barang.status_updated","message":"Status barang BC001-W001-030926-0001 diubah menjadi FINISHGOOD","data":{...}}

# logout
curl -X POST http://localhost:3000/api/auth/logout -H "Authorization: Bearer <token>"
```

---

## File Referensi
- Routes: `src/routes/auth.ts:1`, `src/routes/admin.ts:1`, `src/routes/products.ts:1`, `src/routes/variant-produk.ts:1`, `src/routes/barang.ts:1`, `src/routes/styles.ts:1`, `src/routes/colors.ts:1`, `src/routes/sizes.ts:1`, `src/app.ts:1`
- Controller: `src/controller/auth/auth.ts`, `src/controller/product/product.ts`, `src/controller/variantproduk/variantproduk.ts`, `src/controller/style/style.ts`, `src/controller/color/color.ts`, `src/controller/size/size.ts`, `src/controller/barang/*`
- Model: `src/model/product/product.ts`, `src/model/variantproduk/variantproduk.ts`, `src/model/barang/barang.ts` + `barang.generate.ts` + `barang.status.ts` + `barang.stats.ts` + `barang.crud.ts`, `src/model/style/style.ts` etc.
- Lib: `src/lib/prisma.ts`, `src/lib/jwt.ts:1`, `src/lib/tokenBlacklist.ts`, `src/websocket/socket.ts:1`
- Schema: `prisma/schema.prisma:1`
- Test acuan: `tests/auth.test.ts`, `tests/variantproduk.test.ts`, `tests/barang.test.ts`
