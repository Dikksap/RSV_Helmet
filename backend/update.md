# PERBAIKAN FINAL SISTEM GENERATE KODE BARANG

Saya memiliki project backend menggunakan:

- Express.js
- TypeScript
- Prisma ORM
- MySQL
- Redis
- WebSocket

Project BUKAN NestJS.

Saya sudah memiliki implementasi Product, ProductVariant, Barang, RiwayatBarang, route Product, route Barang, Redis, dan WebSocket.

Jangan membuat ulang sistem dari awal.

Periksa struktur project dan implementasi existing terlebih dahulu sebelum melakukan perubahan.

Tujuan perubahan adalah memperbaiki sistem generate kode Barang dan sistem Production Batch.

==================================================
1. FORMAT KODE BARANG
==================================================

Gunakan format FINAL:

BC001-W001-250826-0001

Format:

BC{nomorBatch}-{kodeVariant}-{DDMMYY}-{nomorUrut}

Contoh:

BC001-W001-250826-0001
BC001-W001-250826-0002
BC001-W001-250826-0003

Variant berbeda:

BC001-W002-250826-0001
BC001-W002-250826-0002

Batch berbeda:

BC002-W001-250826-0001
BC002-W001-250826-0002


Penjelasan:

BC001
= kode Production Batch

W001
= kode ProductVariant

250826
= tanggal produksi dalam format DDMMYY

0001
= nomor urut Barang


==================================================
2. ATURAN PRODUCTION BATCH
==================================================

Batch bersifat GLOBAL.

Batch tidak dimiliki oleh Product atau ProductVariant.

Satu batch memiliki kapasitas maksimal:

5000 BARANG.

Angka 5000 adalah TOTAL SELURUH BARANG dari semua variant.

BUKAN:

5000 per variant.

Contoh:

BC001:

W001 = 2000 barang
W002 = 1500 barang
W003 = 1500 barang

Total:

5000 barang

Maka batch berikutnya menjadi:

BC002


==================================================
3. BATCH TIDAK RESET KARENA TANGGAL
==================================================

Tanggal berubah TIDAK berarti batch berubah.

Contoh:

25-08-2026:

BC001-W001-250826-0001
BC001-W001-250826-0002

Total produksi BC001 baru 3000.

Tanggal berubah:

26-08-2026

Batch tetap:

BC001

Kode:

BC001-W001-260826-0001
BC001-W001-260826-0002


Batch hanya berubah jika total produksi global batch mencapai 5000.


==================================================
4. NOMOR URUT BARANG HARUS RESET SETIAP TANGGAL
==================================================

Ini adalah aturan penting.

Nomor urut:

0001
0002
0003
...

HARUS RESET MENJADI 0001 SETIAP TANGGAL BERUBAH.

Contoh tanggal 25:

BC001-W001-250826-0001
BC001-W001-250826-0002
BC001-W001-250826-0003

Tanggal 26:

BC001-W001-260826-0001
BC001-W001-260826-0002
BC001-W001-260826-0003

Jangan melanjutkan:

BC001-W001-260826-0004

jika tanggal sudah berubah.


==================================================
5. NOMOR URUT JUGA TERPISAH UNTUK SETIAP VARIANT
==================================================

Counter nomor Barang tidak global.

Setiap ProductVariant memiliki counter sendiri.

Contoh:

W001:

BC001-W001-250826-0001
BC001-W001-250826-0002
BC001-W001-250826-0003

W002:

BC001-W002-250826-0001
BC001-W002-250826-0002
BC001-W002-250826-0003

Jangan membuat W002 mulai dari 0004 hanya karena W001 sudah sampai 0003.


==================================================
6. KETIKA BATCH BERUBAH, NOMOR RESET
==================================================

Jika:

BC001 sudah mencapai 5000 barang

maka batch menjadi:

BC002

Contoh:

BC001-W001-250826-0001
...
BC001-W001-250826-xxxx

Setelah batch berubah:

BC002-W001-250826-0001
BC002-W001-250826-0002

Nomor urut kembali ke 0001 karena batch berubah.


==================================================
7. KUNCI COUNTER
==================================================

Nomor urut Barang harus dihitung berdasarkan kombinasi:

batch + variant + tanggal

Secara konsep:

(batchId, variantId, tanggal)

Contoh:

BC001 + W001 + 25-08-2026
    -> 0001, 0002, 0003

BC001 + W001 + 26-08-2026
    -> 0001, 0002, 0003

BC001 + W002 + 25-08-2026
    -> 0001, 0002, 0003

BC002 + W001 + 25-08-2026
    -> 0001, 0002, 0003


==================================================
8. PRODUCTVARIANT
==================================================

ProductVariant sudah memiliki:

kodeVariant

Contoh:

W001
W002
W003

Jangan membuat kode variant baru saat generate Barang.

Jangan hardcode:

"W001"

Backend harus mengambil:

ProductVariant.kodeVariant

langsung dari database berdasarkan variantId.


==================================================
9. OPERATOR MEMILIH VARIANT
==================================================

Operator tidak mengetik kode Barang.

Operator juga tidak mengetik kode Variant.

Frontend menggunakan data ProductVariant yang sudah tersedia dari:

GET /api/products

atau endpoint existing yang sesuai.

Dropdown menampilkan:

W001 | Windbreaker | Motif | Carbon | LG
W002 | Windbreaker | Motif | BOB | LG
W003 | Windbreaker | Solid | Black Doff | LG

Value yang dikirim ke backend adalah:

variantId

Contoh:

{
  "variantId": 1,
  "jumlah": 100
}


==================================================
10. GENERATE BARANG
==================================================

Buat/perbaiki endpoint:

POST /api/barang/generate

Request:

{
  "variantId": 1,
  "jumlah": 100
}

Backend otomatis menentukan:

- ProductVariant
- kodeVariant
- batch aktif
- tanggal hari ini
- nomor urut berikutnya
- kodeBarang


==================================================
11. CONTOH GENERATE
==================================================

Jika:

tanggal = 25-08-2026
batch = BC001
variant = W001

Generate 3:

hasil:

BC001-W001-250826-0001
BC001-W001-250826-0002
BC001-W001-250826-0003


Kemudian generate variant W002 sebanyak 2:

BC001-W002-250826-0001
BC001-W002-250826-0002


==================================================
12. TANGGAL BERUBAH
==================================================

Tanggal sebelumnya:

25-08-2026

Barang:

BC001-W001-250826-0001
BC001-W001-250826-0002

Tanggal berubah:

26-08-2026

Batch masih BC001.

Generate W001:

BC001-W001-260826-0001
BC001-W001-260826-0002

Nomor HARUS kembali ke 0001.


==================================================
13. BATCH BERUBAH
==================================================

Misalnya:

BC001 memiliki:

4998 barang

Kemudian request generate:

5 barang

Maka:

2 barang terakhir masuk BC001

dan 3 barang berikutnya masuk BC002.

Contoh konsep:

BC001-W001-250826-0001
BC001-W001-250826-0002

kemudian:

BC002-W001-250826-0001
BC002-W001-250826-0002
BC002-W001-250826-0003

Nomor pada batch baru kembali ke 0001.


==================================================
14. REQUEST MELEBIHI SISA BATCH
==================================================

Jika:

BC001 total produksi = 4900

Sisa = 100

Kemudian operator generate:

200 barang

Jangan reject seluruh request.

Sistem harus otomatis:

100 barang -> BC001
100 barang -> BC002


Jika:

BC001 sisa 50

operator generate 12050:

50 -> BC001
5000 -> BC002
5000 -> BC003
2000 -> BC004


Semua harus diproses otomatis dalam transaction.


==================================================
15. PRODUCTION BATCH TABLE
==================================================

Jika belum tersedia, tambahkan model khusus ProductionBatch.

Contoh konsep Prisma:

model ProductionBatch {
  id            Int         @id @default(autoincrement())
  nomorBatch    Int         @unique
  totalProduksi Int         @default(0)
  kapasitas     Int         @default(5000)
  status        StatusBatch @default(AKTIF)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  barang Barang[]

  @@index([status])
}

enum StatusBatch {
  AKTIF
  SELESAI
}

nomorBatch:

1 -> BC001
2 -> BC002
3 -> BC003

Jangan menyimpan BC001 sebagai counter terpisah jika tidak diperlukan.

Gunakan:

String(nomorBatch).padStart(3, "0")


==================================================
16. BARANG HARUS MENYIMPAN BATCH
==================================================

Barang harus mempunyai:

batchId

Relasi:

Barang -> ProductionBatch

Contoh:

model Barang {
  id         Int    @id @default(autoincrement())
  kodeBarang String @unique

  variantId Int
  batchId   Int

  status StatusBarang @default(FINISHGOOD)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  variant ProductVariant @relation(
    fields: [variantId],
    references: [id],
    onDelete: Restrict
  )

  batch ProductionBatch @relation(
    fields: [batchId],
    references: [id],
    onDelete: Restrict
  )

  riwayat RiwayatBarang[]

  @@index([variantId])
  @@index([batchId])
  @@index([status])
}

Sesuaikan dengan schema existing jika model Barang sudah tersedia.


==================================================
17. STATUS BARANG
==================================================

Gunakan satu enum:

enum StatusBarang {
  FINISHGOOD
  RETUR
  OUT
  BAD
}

Jangan memisahkan FINISHGOOD menjadi beberapa status.

Barang hasil generate:

FINISHGOOD


==================================================
18. RIWAYAT BARANG
==================================================

Saat status Barang berubah:

FINISHGOOD -> OUT

atau:

FINISHGOOD -> RETUR

atau:

FINISHGOOD -> BAD

lakukan:

1. Update Barang.status
2. Insert RiwayatBarang

dalam satu Prisma transaction.


==================================================
19. CONCURRENCY
==================================================

Sistem harus aman jika dua operator generate secara bersamaan.

Contoh:

Operator A:
generate 1000

Operator B:
generate 1000

Jangan sampai menghasilkan:

- kodeBarang duplicate
- nomor urut duplicate
- totalProduksi salah
- batch salah
- counter hilang

Jangan hanya menggunakan:

count()

untuk menentukan nomor berikutnya.

Gunakan transaction dan mekanisme locking/atomic operation yang sesuai dengan MySQL + Prisma.

Database harus menjadi source of truth.


==================================================
20. UNIQUE KODE BARANG
==================================================

kodeBarang wajib:

@unique

Contoh:

BC001-W001-250826-0001

tidak boleh ada dua record dengan kodeBarang yang sama.


==================================================
21. FRONTEND GENERATE BARANG
==================================================

Buat/perbaiki halaman:

Generate Barang

Isi:

Product Variant
[ dropdown ]

Jumlah
[ input ]

Batch Aktif
BC001

Produksi Batch
3500 / 5000

Sisa Batch
1500

Tanggal
25-08-2026

Preview:

BC001-W001-250826-0001
s/d
BC001-W001-250826-0100

[ Generate Barang ]

Operator hanya memilih:

- Variant
- Jumlah

Batch, tanggal, kodeVariant, dan nomor barang ditentukan backend.


==================================================
22. PREVIEW
==================================================

Preview hanya bersifat informasi.

Nomor final harus ditentukan oleh backend saat transaction generate.

Jangan mengandalkan nomor yang dihitung frontend untuk insert database.


==================================================
23. API INFORMASI BATCH
==================================================

Jika diperlukan untuk halaman frontend, tambahkan endpoint:

GET /api/barang/generate-info?variantId=1

Contoh response:

{
  "variantId": 1,
  "kodeVariant": "W001",
  "tanggal": "2026-08-25",
  "batch": {
    "kodeBatch": "BC001",
    "totalProduksi": 3500,
    "kapasitas": 5000,
    "remaining": 1500
  },
  "nextNumber": 25
}

nextNumber hanya untuk preview.

Nomor final tetap ditentukan backend.


==================================================
24. SCAN BARANG
==================================================

Endpoint existing:

GET /api/barang/scan/:kodeBarang

harus tetap dapat digunakan.

Contoh:

GET /api/barang/scan/BC001-W001-250826-0001

Response harus memuat:

Barang
- kodeBarang
- status
- batch

ProductVariant
- kodeVariant
- Product
- Style
- Color
- Size


==================================================
25. MIGRATION
==================================================

Database sudah memiliki data existing.

JANGAN menjalankan:

npx prisma migrate reset

Jangan menghapus data existing.

Gunakan migration normal.

Contoh:

npx prisma migrate dev --name add_production_batch

Kemudian:

npx prisma generate


Sebelum migration:

1. Periksa schema existing.
2. Periksa apakah tabel Barang sudah ada.
3. Periksa apakah Barang sudah memiliki data.
4. Periksa ProductVariant existing.
5. Jangan melakukan destructive migration.
6. Jika batchId ditambahkan ke Barang yang sudah memiliki data, buat strategi backfill yang aman.


==================================================
26. REDIS
==================================================

Redis bukan source of truth untuk batch counter.

Database adalah source of truth.

Jangan menyimpan counter batch hanya di Redis.

Redis boleh digunakan sebagai cache informasi jika diperlukan.


==================================================
27. WEBSOCKET
==================================================

Project sudah menggunakan broadcast().

Pertahankan pola WebSocket existing.

Jika diperlukan tambahkan event:

{
  "type": "barang.generated",
  "message": "Barang berhasil digenerate",
  "data": result
}

Jangan mengubah mekanisme WebSocket yang tidak berhubungan dengan requirement.


==================================================
28. TEST WAJIB
==================================================

Test:

1. Generate 3 barang W001.

Expected:

BC001-W001-250826-0001
BC001-W001-250826-0002
BC001-W001-250826-0003


2. Generate 2 barang W002.

Expected:

BC001-W002-250826-0001
BC001-W002-250826-0002


3. Ganti tanggal.

Expected:

BC001-W001-260826-0001


4. Batch hampir penuh.

Jika:

BC001 = 4998

Generate 5.

Expected:

2 barang -> BC001
3 barang -> BC002


5. Batch penuh.

Jika:

BC001 = 5000

Generate berikutnya harus menggunakan:

BC002


6. Generate melewati beberapa batch.

Pastikan distribusi:

50 -> BC001
5000 -> BC002
5000 -> BC003
2000 -> BC004


7. Dua variant pada tanggal yang sama.

Pastikan masing-masing mulai dari:

0001


8. Dua tanggal berbeda.

Pastikan nomor reset ke:

0001


9. Concurrent generate.

Pastikan tidak ada duplicate kodeBarang.


==================================================
29. HAL YANG TIDAK BOLEH DIUBAH
==================================================

Jangan mengubah konsep:

Product
ProductVariant
Style
Color
Size

ProductVariant tetap merupakan kombinasi:

Product + Style + Color + Size


Jangan menambahkan ke Barang:

productId
styleId
colorId
sizeId
nama


Informasi tersebut harus diperoleh melalui:

Barang
 -> ProductVariant
 -> Product / Style / Color / Size


Jangan memindahkan kodeVariant ke Barang.

Jangan membuat kodeVariant baru ketika generate Barang.

Jangan mengubah unique constraint ProductVariant:

@@unique([productId, styleId, colorId, sizeId])


==================================================
30. HASIL AKHIR
==================================================

Sistem harus menghasilkan kode seperti:

BC001-W001-250826-0001
BC001-W001-250826-0002
BC001-W002-250826-0001

Tanggal berubah:

BC001-W001-260826-0001

Batch mencapai 5000:

BC002-W001-260826-0001

Aturan inti:

1. Batch global.
2. Setiap batch maksimal 5000 total barang.
3. 5000 dihitung dari SEMUA variant.
4. Batch tidak reset karena tanggal.
5. Nomor urut Barang RESET setiap tanggal.
6. Nomor urut Barang RESET ketika batch berubah.
7. Setiap variant mempunyai counter sendiri.
8. Operator hanya memilih variant dan jumlah.
9. Backend generate kode otomatis.
10. kodeBarang unique.
11. Generate harus transactional.
12. Harus aman terhadap concurrent request.
13. Jangan kehilangan data existing.
14. Jangan melakukan perubahan di luar scope.

==================================================
31. SETELAH IMPLEMENTASI
==================================================

Setelah selesai:

1. Tampilkan file yang diubah.
2. Tampilkan perubahan Prisma schema.
3. Tampilkan migration yang dibuat.
4. Tampilkan perubahan service.
5. Tampilkan perubahan route/controller.
6. Tampilkan perubahan frontend halaman Generate Barang jika frontend berada di project yang sama.
7. Jalankan:

npx prisma generate

8. Jalankan type check/build/test yang tersedia.
9. Perbaiki error yang muncul.
10. Jangan hanya menjelaskan kode; implementasikan perubahan langsung pada project existing.
11. Jika menemukan struktur/file yang berbeda dari asumsi prompt, periksa project terlebih dahulu dan sesuaikan implementasi dengan pola existing.