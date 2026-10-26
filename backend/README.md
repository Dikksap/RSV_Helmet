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

## Alur perubahan database

1. Ubah model di `prisma/schema.prisma`.
2. Buat migration terhadap database pengembangan:

   ```powershell
   npx prisma migrate dev --name nama_perubahan
   ```

3. Pastikan Prisma Client sudah ter-generate:

   ```powershell
   npx prisma generate
   ```

4. Jalankan tes dan build, lalu sertakan file migration baru bersama perubahan schema.

Untuk mengisi data seed pada database yang dikonfigurasi:

```powershell
npx prisma db seed
```

Jangan gunakan `migrate dev` pada database produksi. Image produksi menjalankan `prisma migrate deploy` saat startup.

Seed utama juga membuat data contoh alur WIP berbasis workflow aplikasi: RAW020 → SM0025 (Buffing), SM0025 → SM0026/SM0027/SM0028 (Base Coat), 7 varian keluaran Decal, lalu SM0001–SM0008 (Top Coat). Seed menetapkan mapping untuk 8 varian warna, membuat routing aktif untuk seluruh kombinasi ukuran produk beserta BOM seed, serta mencatat hasil produksi dan transfer melalui workflow agar lot dan ledger terbentuk. Pembagian contoh Decal adalah: Base Coat hitam → solid black dan motif BOB/Carbon; putih → solid white dan motif Nation; platinum grey → solid platinum dan motif Redline. Black doff dan black glossy sama-sama memakai output decal hitam, tetapi tetap menghasilkan item Top Coat yang berbeda. Data ini adalah contoh konsisten untuk pengujian, bukan pengganti konfirmasi BOM produksi aktual. Seed `seed-hasil-produksi-harian.ts` memanggil fixture alur yang sama; fixture lama yang membuat perpindahan tanpa posting ledger sudah dihapus.

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
| `/api/hasil-produksi-harian` | `hasil-produksi-harian.ts` |
| `/api/integrasi-jurnal` | `integrasi-jurnal.ts` |
| `/api/inventory` | `inventory.ts` |
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
| `/api/roles` | `role.ts` |
| `/api/sizes` | `sizes.ts` |
| `/api/shipments` | `shipment.ts` |
| `/api/status-barang` | `statusBarang.ts` |
| `/api/status-transition` | `statusTransition.ts` |
| `/api/stok-opname` | `stokOpname.ts` |
| `/api/styles` | `styles.ts` |
| `/api/subassemblies` | `subassembly.ts` |
| `/api/users` | `user.ts` |
| `/api/variant-produk` | `variant-produk.ts` |
| `/api/wip-transfer` | `wip-transfer.ts` |

### API workflow inventory, QC, dan shipment

Workflow berikut tersedia di backend dan seluruh endpoint memerlukan autentikasi serta permission yang sesuai. Pada 2026-10-25, seluruh migration ERP, routing produksi, dan opname WIP telah diterapkan pada database Docker lokal `express_api`, lalu database di-seed ulang dengan fixture alur produksi per divisi. Ini bukan database produksi; jangan menjalankan reset atau cutover pada database lain tanpa persetujuan tersendiri.

| Prefix | Endpoint utama | Permission |
| --- | --- | --- |
| `/api/inventory` | `GET /locations`, `GET /balances`, `GET /movements`; pemetaan lokasi dan mutasi/reversal | `INVENTORY_VIEW`, `INVENTORY_LOCATION_MANAGE`, `INVENTORY_MOVE`, `INVENTORY_ADJUST` |
| `/api/quality` | `GET /wip-rejects/options`, alasan reject, antrean reject, claim/attempt/review repair; `GET /daily-report`; pengaturan routing terpisah; `GET /wip-flow`; endpoint opname WIP | `QUALITY_VIEW`, `QUALITY_ROUTING_MANAGE`, `QUALITY_INSPECT`, `QUALITY_FINALIZE`, `REPAIR_WORK`, `INVENTORY_VIEW`, `INVENTORY_ADJUST` |
| `/api/shipments` | daftar/detail/draft/post/cancel shipment, `POST /finished-goods/receive`, `POST /returns` | `SHIPMENT_VIEW`, `SHIPMENT_MANAGE`, `SHIPMENT_POST`, `SHIPMENT_RETURN` |

Input Produksi Harian menerima beberapa item MASUK dan HASIL dalam satu transaksi. Jumlah tiap MASUK dikonsumsi dari saldo WIP item yang sama secara FIFO; sistem memvalidasi ketersediaan WIP per item. Jumlah input dan hasil tidak dijumlahkan untuk dibandingkan karena tiap item dapat memiliki satuan berbeda. Jika routing aktif, seluruh item input dan output WIP yang dicatat harus sesuai dengan konfigurasi tahap divisi tersebut.

QC Akhir memakai alur reject WIP yang terpisah dari ProductVariant: petugas QC memilih item output tahap terakhir yang memiliki stok menunggu QC, lalu membagi jumlahnya menjadi lolos dan reject. Jumlah lolos dipindahkan lewat ledger ke lokasi inventori divisi QC. Untuk reject, petugas memilih alasan serta tahap/divisi routing tempat repair dimulai; reject dipindahkan dari divisi tahap terakhir ke lokasi divisi perbaikan dan masuk ke antrean repair. Divisi repair mengambil tugas dan mencatat jumlah diperiksa/berhasil serta output tahap yang akan dibuat. Output repair menjadi lot WIP di divisi repair dan dapat ditransfer ke tahap routing berikutnya; jika repair dilakukan pada tahap sebelum tahap terakhir, output yang dipilih harus menjadi input tahap berikutnya. Output tahap terakhir masuk kembali ke antrean QC Akhir. Catatan reject dan repair mempertahankan alokasi lot WIP serta riwayat pelaku. Laporan harian ringkas mengelompokkan keluaran normal dari `HasilProduksiHarian` per divisi/item dan output repair.

Konfigurasi routing produksi dapat dikelola admin pada halaman **Routing Produksi** (`/admin/routing-produksi`) atau melalui `GET /api/quality/routings` dan `PUT /api/quality/routings` dengan permission `QUALITY_ROUTING_MANAGE`. Routing adalah satu alur global yang tidak terikat ke varian produk maupun BOM. Setiap tahap memilih divisi, beberapa item input, dan beberapa item output; output harus berupa item SM milik divisi tahap tersebut, dan item input tahap berikutnya harus berasal dari output tahap sebelumnya. Transfer WIP dibatasi ke divisi tahap berikutnya yang menerima item tersebut. Output semua item tahap terakhir menjadi sumber QC Akhir dan penanganan reject. Menyimpan konfigurasi membuat versi routing global baru dan menonaktifkan routing aktif sebelumnya; divisi dan item tetap dikelola melalui menu master masing-masing.

Halaman **Aliran WIP & Opname** tersedia untuk admin dan gudang. Laporan membandingkan saldo pembuka, mutasi masuk/keluar menurut jenis, saldo ledger penutup, hasil QC final, serta attempt repair/disposisi review dalam rentang tanggal (maksimal 366 hari). Tabel mutasi menampilkan 1.000 kejadian terbaru; ringkasan saldo menghitung seluruh kejadian periode dan UI memberi tahu bila detail terpotong. Opname mencatat saldo sistem, hitung fisik, selisih, dan alasan untuk setiap selisih (minimal 5 karakter); baris tanpa selisih boleh tanpa alasan. Setiap koreksi menghasilkan gerakan ledger `ADJUSTMENT` append-only dengan referensi sesi; kelebihan membuat lot WIP `OPNAME`, sedangkan kekurangan mengurangi lot tersedia secara FIFO. Baris sesi dan mutasi tidak memiliki API edit/hapus.

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
