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
| `/api/roles` | `role.ts` |
| `/api/sizes` | `sizes.ts` |
| `/api/status-barang` | `statusBarang.ts` |
| `/api/status-transition` | `statusTransition.ts` |
| `/api/stok-opname` | `stokOpname.ts` |
| `/api/styles` | `styles.ts` |
| `/api/subassemblies` | `subassembly.ts` |
| `/api/users` | `user.ts` |
| `/api/variant-produk` | `variant-produk.ts` |

### API inventory dan quality yang masih aktif

Endpoint UI eksklusif yang dihapus: seluruh `/api/shipments`, endpoint saldo/lokasi/mutasi pada `/api/inventory` (hanya workflow `/adjustments` yang dipertahankan untuk persetujuan supervisor), seluruh `/api/hasil-produksi-harian`, seluruh `/api/wip-transfer`, `GET /api/quality/daily-report`, `POST /api/quality/final-inspections`, seluruh `/api/quality/wip-flow` dan `/api/quality/wip-stocktake`, `GET /api/quality/variants`, `PUT /api/quality/routings`, serta endpoint detail/CRUD `/api/gudang/:id` dan penulisan `/api/gudang`. Skema, tabel, data historis, dan migration terkait sengaja dipertahankan. Helper `src/model/inventory/inventory.ts` tetap digunakan internal untuk posting ledger dan validasi saldo; API `/api/mutasi-gudang` dan `GET /api/gudang` juga tetap tersedia untuk workflow gudang aktif dan pilihan gudang pada mutasi.

API quality yang masih aktif hanya menyediakan workflow reject/rework serta `GET /api/quality/routings`. Reject/rework dipertahankan sebagai workflow QC/admin bersama yang juga digunakan halaman Quality Control aktif; tidak ada prefix quality tersendiri untuk Divisi. Endpoint baca routing dipertahankan karena Work Order tahap aktif menggunakannya untuk memilih tahap. Penulisan konfigurasi routing, final-inspection mandiri, laporan QC harian, laporan WIP, dan opname WIP tidak lagi diekspos.

Penyesuaian saldo operasional internal wajib tetap melalui helper ledger: gerakan idempoten, pemeriksaan saldo lokasi/lot, dan riwayat append-only tetap diberlakukan oleh model inventory.

`/api/divisi` tetap aktif untuk master-data divisi yang dikelola admin dan dipakai oleh operasi bersama. Endpoint shared `/api/permintaan-barang`, `/api/pemakaian-material` (termasuk alias `/api/pemakaian-materials`), `/api/items`, `/api/karyawan`, dan `/api/production-orders` juga tetap aktif karena digunakan di luar workspace Divisi, termasuk proses admin/gudang dan master data. Tidak ada endpoint Hasil Produksi Harian atau transfer WIP yang terdaftar pada Express app, dan route/controller API lamanya telah dihapus. Service `createHasilProduksi`, `createWipTransfer`, serta `approveWipTransfer` tetap menjadi dependensi internal seed alur produksi; keduanya bukan endpoint HTTP. Schema, tabel, konfigurasi routing, dan histori tetap dipertahankan.

Repair/rework bersama tetap menyimpan alokasi lot dan riwayat pelaku. `GET /api/quality/routings` dan layanan production-order/work-order dipertahankan; layanan tersebut tetap dapat merujuk ke record divisi meskipun workspace Divisi tidak lagi tersedia melalui API.

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
