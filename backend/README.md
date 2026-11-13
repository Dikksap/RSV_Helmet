# Backend RSV Helmet

REST API untuk aplikasi RSV Helmet, dibuat dengan Express, TypeScript, Prisma, MariaDB, Redis, dan WebSocket.

## Prasyarat

- Node.js 22+
- npm
- Docker Desktop dengan Docker Compose, atau MariaDB dan Redis yang berjalan secara lokal

## Alur pengembangan lokal

### 1. Pasang konfigurasi dan dependency

```powershell
Copy-Item .env.example .env
npm ci
```

Sesuaikan `.env` dengan layanan yang digunakan. Jangan masukkan file `.env` atau kredensial ke Git.

### 2. Jalankan database dan Redis

Untuk menjalankan MariaDB, Redis, dan phpMyAdmin melalui Docker:

```powershell
docker compose up -d db redis phpmyadmin
```

MariaDB dipetakan ke port `3307` pada host, Redis ke `6379`, dan phpMyAdmin ke `8080`. Jika API dijalankan dari host, atur `DB_HOST=localhost`, `DB_PORT=3307`, dan `DATABASE_URL` agar memakai host `localhost` serta port `3307`. Pastikan `REDIS_URL` juga mengarah ke Redis lokal.

Alternatifnya, jalankan seluruh stack termasuk API di Docker:

```powershell
docker compose up --build
```

Pada mode ini API tersedia di port `8000`; API dan layanan pendukung memakai konfigurasi jaringan Docker pada `docker-compose.yml`.

### 3. Siapkan Prisma dan jalankan API

Jika generated Prisma Client belum tersedia atau schema berubah, jalankan:

```powershell
npx prisma generate
```

Jalankan migrasi pengembangan pada database yang sudah dipilih di `.env`, lalu mulai server lokal:

```powershell
npx prisma migrate dev
npm run dev
```

Server berjalan di `http://localhost:8000`. Endpoint `/` mengembalikan status dasar API. Mode lokal juga mengaktifkan WebSocket.

### 4. Jalankan pemeriksaan

```powershell
npm test
npm run build
```

`npm test` menjalankan tes Vitest di `tests/`. `npm run build` menjalankan TypeScript compiler dan menghasilkan output di `dist/`.

## Alur perubahan database (Docker development)

Stack development berjalan di Docker Compose: `backend-api-1` (API, `tsx watch` + `prisma generate` saat start), `backend-db-1` (MariaDB, port host `3307`), `backend-redis-1`, `backend-phpmyadmin-1`. Karena `DATABASE_URL` mengarah ke host `db` **di dalam jaringan Compose**, perintah Prisma harus dijalankan lewat container, bukan dari host.

```powershell
npm run docker:up          # docker compose up -d
npm run db:status          # docker exec backend-api-1 npx prisma migrate status
npm run db:migrate:deploy  # terapkan migration yang sudah ada (non-interaktif)
npm run db:seed            # docker exec -it backend-api-1 npx prisma db seed
```

Untuk membuat migration baru (interaktif, butuh TTY):

```powershell
npm run db:migrate         # docker exec -it backend-api-1 npx prisma migrate dev
```

Catatan penting:

- Container **tidak** menjalankan migration otomatis saat start; hanya `prisma generate` + `npm run dev`. Migration baru harus diterapkan manual (`db:migrate:deploy`) lalu container di-restart agar client baru dipakai: `docker restart backend-api-1`.
- `prisma db push` hanya untuk eksperimen yang tidak memerlukan histori migration. Jangan pakai untuk perubahan yang akan di-commit.
- Jangan gunakan `migrate dev`/`migrate reset` pada database produksi. Image produksi menjalankan `prisma migrate deploy` saat startup.
- Verifikasi cepat pasca-migration (butuh data development):

```powershell
npm run verify:reports     # 4 laporan: FG summary, konsumsi material, traceability, rekonsiliasi
npm run verify:e2e         # HP decal -> transfer WIP -> HP varian -> unit Barang -> FINISHGOOD -> traceability
```

`verify:e2e` menulis data uji berlabel `E2E-*` (dokumen HP, transfer, 1 unit `Barang`) ke database development; jangan dijalankan pada database produksi.

Untuk mengisi data seed pada database yang dikonfigurasi:

```powershell
npx prisma db seed
```

Seed utama juga membuat data contoh alur WIP berbasis workflow aplikasi: RAW020 → SM0025 (Buffing), SM0025 → SM0026/SM0027/SM0028 (Base Coat), 7 varian keluaran Decal, lalu SM0001–SM0008 (Top Coat). Seed menetapkan mapping untuk 8 varian warna, membuat routing aktif untuk seluruh kombinasi ukuran produk beserta BOM seed, serta mencatat hasil produksi dan transfer melalui workflow agar lot dan ledger terbentuk. Pembagian contoh Decal adalah: Base Coat hitam → solid black dan motif BOB/Carbon; putih → solid white dan motif Nation; platinum grey → solid platinum dan motif Redline. Black doff dan black glossy sama-sama memakai output decal hitam, tetapi tetap menghasilkan item Top Coat yang berbeda. Data ini adalah contoh konsisten untuk pengujian, bukan pengganti konfirmasi BOM produksi aktual. Seed `seed-hasil-produksi-harian.ts` memanggil fixture alur yang sama; fixture lama yang membuat perpindahan tanpa posting ledger sudah dihapus.

Seed juga menyediakan akun demo **Supervisor Inventory** (`supervisor@example.com` / `supervisor123`) dengan permission `INVENTORY_ADJUST_APPROVE`. Kredensial seed hanya untuk development dan validasi lokal; jangan gunakan akun/password demo di lingkungan produksi.

## Routing API

Semua router didaftarkan di `src/app.ts`. Prefix di bawah dipasangkan dengan file router di `src/routes/`.

| Prefix API | File router |
| --- | --- |
| `/api/admin` | `admin.ts` |
| `/api/auth` | `auth.ts` |
| `/api/barang` | `barang.ts` |
| `/api/barang-group` | `barangGroup.ts` |
| `/api/batches` | `batch.ts` |
| `/api/bom` | `bom.ts` |
| `/api/colors` | `colors.ts` |
| `/api/divisi` | `divisi.ts` |
| `/api/gudang` | `gudang.ts` |
| `/api/hasil-produksi-harian` | `hasil-produksi-harian.ts` (jalur kanonik posting produksi) |
| `/api/integrasi-jurnal` | `integrasi-jurnal.ts` |
| `/api/inventory` | `inventory.ts` (workflow adjustment saja) |
| `/api/items` | `item.ts` |
| `/api/karyawan` | `karyawan.ts` |
| `/api/mutasi-gudang` | `mutasiGudang.ts` |
| `/api/notifications` | `notifications.ts` |
| `/api/pemakaian-material` | `pemakaian-material.ts` |
| `/api/pemakaian-materials` | `pemakaian-material.ts` (alias) |
| `/api/permintaan-barang` | `permintaan-barang.ts` |
| `/api/production-orders` | `production-orders.ts` |
| `/api/products` | `products.ts` |
| `/api/quality` | `quality.ts` |
| `/api/reports` | `reports.ts` (Finished Goods, konsumsi material, traceability, rekonsiliasi) |
| `/api/roles` | `role.ts` |
| `/api/sizes` | `sizes.ts` |
| `/api/status-barang` | `statusBarang.ts` |
| `/api/status-transition` | `statusTransition.ts` |
| `/api/stok-opname` | `stokOpname.ts` |
| `/api/styles` | `styles.ts` |
| `/api/subassemblies` | `subassembly.ts` |
| `/api/users` | `user.ts` |
| `/api/variant-produk` | `variant-produk.ts` |

### Gambar profil dan item

- `POST /api/auth/me/avatar` dan `DELETE /api/auth/me/avatar` mengelola avatar milik pengguna yang sedang login. `GET /api/auth/me/avatar` memerlukan autentikasi dan hanya menyajikan avatar sesi tersebut.
- `POST /api/items/:id/image` dan `DELETE /api/items/:id/image` memerlukan permission `KELOLA_ITEM`. `GET /api/items/:id/image` bersifat publik mengikuti akses katalog item.
- `GET /api/items/:id/stok/gudang` menampilkan saldo `StockBalance` per gudang aktif dan memerlukan `KELOLA_ITEM` atau `BARANG_LIHAT`.
- `POST /api/items/:id/stok/transfer` memindahkan kuantitas antargudang aktif melalui ledger `InventoryMovement`; wajib memakai permission `INVENTORY_MOVE` dan mengirim `fromLocationId`, `toLocationId`, `quantity`, `idempotencyKey`, serta `reason`. Transfer memeriksa saldo asal, mempertahankan lot, dan tidak mengubah total stok item.
- Unggahan menerima JPEG, PNG, atau WebP sampai 5 MB. Backend memvalidasi isi gambar, membatasi dimensi, menghapus metadata melalui normalisasi, dan menyimpan hasil WebP maksimal 1200 × 1200 piksel.
- File disimpan di direktori `UPLOADS_DIR` (default `uploads/`) dan hanya path relatif yang dicatat pada database. Docker development memakai `backend/uploads`; production memakai volume persisten `uploads_data`. Cadangkan volume ini bersama database karena keduanya menyimpan bagian berbeda dari data gambar.
- Container production menjalankan API sebagai user non-root `node`; `Dockerfile.production` menyiapkan direktori upload dengan kepemilikan yang sesuai untuk volume baru. Jika volume `uploads_data` sudah dibuat sebelum pengaturan ini, perbaiki kepemilikannya satu kali tanpa menghapus file:

  ```sh
  docker exec --user 0 rsv-backend-prod sh -c 'mkdir -p /app/uploads/avatars /app/uploads/items && chown node:node /app/uploads /app/uploads/avatars /app/uploads/items'
  docker exec rsv-backend-prod sh -c 'test -w /app/uploads/avatars && test -w /app/uploads/items'
  ```

- Sebelum menjalankan versi yang memakai fitur gambar, terapkan migration database melalui `npx prisma migrate deploy`.

### API inventory dan quality yang masih aktif

**Perubahan November 2026:** `HasilProduksiHarian` kembali menjadi jalur kanonik posting produksi per divisi (`/api/hasil-produksi-harian`), sementara `ProduksiHarian` tidak lagi menerima posting baru (`PRODUKSI_HARIAN_POSTING` harus bernilai `true` untuk mengaktifkannya kembali) dan tetap tersedia untuk pembacaan histori. `POST /api/quality/final-inspections` tetap tidak diekspos: FINISHGOOD kini dicapai lewat scan/PATCH status barang dan **tidak** memerlukan QC PASS terpisah. `GET`/`PUT /api/quality/routings` diaktifkan kembali karena posting HP divalidasi terhadap routing.

Endpoint yang masih dihapus: seluruh `/api/shipments`, seluruh `/api/wip-transfer`, `GET /api/quality/daily-report`, `POST /api/quality/final-inspections`, seluruh `/api/quality/wip-flow` dan `/api/quality/wip-stocktake`, serta `GET /api/quality/variants`. Skema, tabel, data historis, dan migration terkait sengaja dipertahankan.

`StokItemMutasi` (ledger L1) **dibekukan**: tetap disimpan dan dapat dibaca untuk histori, tetapi tidak lagi menjadi sumber posting baru dan tidak lagi mengubah `Item.stok`. Semua penulisan inventory baru memakai `InventoryMovement` + `StockBalance`, dan `Item.stok` adalah proyeksi dari gerakan satu arah di ledger tersebut. Endpoint baca stok (`/api/items/:id/stok`, `/api/items/stok-saldo`, `/api/items/stok-ringkasan`) memakai ledger lokasi; riwayat stok item menggabungkan baris legacy (id positif) dan ledger baru (id negatif, `sumber: "INVENTORY"`). Gunakan `GET /api/items/:id/stok?sumber=LEGACY|INVENTORY` untuk membaca satu ledger saja.

`PUT /api/quality/routings` menyimpan routing sebagai **versi baru**. Bila body menyertakan `routingId`, hanya routing tersebut yang dinonaktifkan; tanpa `routingId` perilaku lama (mengganti seluruh routing aktif) dipertahankan. Ini memungkinkan beberapa routing aktif berdampingan (mis. Solid dan Motif).

Kolom **Stok Gudang** di Master Item & Material adalah penjumlahan `StockBalance` untuk seluruh gudang aktif. Rincian gudang dan pemindahan stok tersedia pada halaman stok item; transfer memindahkan saldo sumber ke tujuan tanpa menambah total.

`/api/divisi` tetap aktif untuk master-data divisi yang dikelola admin dan dipakai oleh operasi bersama. Endpoint shared `/api/permintaan-barang`, `/api/pemakaian-material` (termasuk alias `/api/pemakaian-materials`), `/api/items`, `/api/karyawan`, dan `/api/production-orders` juga tetap aktif. Service `createHasilProduksi` dan `createWipTransfer` tetap dipakai seed alur produksi; `createHasilProduksi` kini juga merupakan handler endpoint HTTP.

Repair/rework bersama tetap menyimpan alokasi lot dan riwayat pelaku. Layanan production-order/work-order dipertahankan; layanan tersebut tetap dapat merujuk ke record divisi.

Migration routing produksi dan aliran/opname WIP, termasuk `20261026200000_route_repaired_wip_forward`, sudah diterapkan ke database Docker lokal `express_api`. Untuk database lain, terapkan migration yang belum ada secara berurutan dengan `npx prisma migrate deploy` sebelum menjalankan versi backend ini. Saldo legacy dari export stok tetap merupakan sumber terpisah dari ledger WIP per lokasi; jangan anggap saldo lama atau 5.010 barang `FINISHGOOD` sebagai stok operasional yang tersedia.

Migration tidak memakai `CHECK` constraint untuk bentuk data yang melibatkan kolom foreign key karena MariaDB 11 menolak kombinasi tersebut saat foreign key ditambahkan. Validasi bentuk mutasi/QC dilakukan oleh model aplikasi; constraint kuantitas yang tidak melibatkan kolom foreign key tetap dipertahankan.

Untuk menambah endpoint:

1. Tambahkan handler pada router domain di `src/routes/`.
2. Jika logika bisnis perlu dipisahkan, letakkan di `src/controller/`; akses data Prisma diletakkan di `src/model/`.
3. Daftarkan router dan prefix-nya di `src/app.ts`.
4. Tambahkan atau perbarui tes terkait di `tests/`. Gunakan prefix yang konsisten dengan endpoint yang sudah dipakai frontend.

`api/index.ts` adalah entry point runtime: server HTTP dan WebSocket dijalankan di luar Vercel, sedangkan Vercel menggunakan Express app tanpa membuat server HTTP lokal.

## Peta direktori

```text
backend/
├── api/                 # Entry point runtime dan adapter Vercel
├── prisma/              # Schema, migration, dan seed
├── src/
│   ├── app.ts            # Konfigurasi Express dan pendaftaran route
│   ├── controller/       # Handler dan logika request per domain
│   ├── lib/              # Koneksi, helper, dan integrasi bersama
│   ├── middleware/       # Middleware Express
│   ├── model/            # Akses data dan operasi domain
│   ├── routes/           # Definisi endpoint per domain
│   └── websocket/        # Integrasi WebSocket
├── tests/                # Tes API dan model
├── Dockerfile            # Lingkungan pengembangan Docker
└── Dockerfile.production # Build dan runtime produksi
```
