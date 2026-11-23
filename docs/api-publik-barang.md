# API Publik Barang

Dokumentasi endpoint publik read-only untuk data barang (unit helm). Semua endpoint **tanpa autentikasi** dan CORS terbuka.

Base URL mengikuti server, contoh: `http://localhost:8000` (produksi sesuai domain yang dipakai).

## Ringkasan endpoint

| Method | Path | Fungsi |
| --- | --- | --- |
| GET | `/api/public/barang` | Daftar unit barang (paginasi + filter) |
| GET | `/api/public/barang/:kodeBarang` | Detail satu unit berdasarkan kode |
| GET | `/api/public/barang/rekap-variant` | Agregat jumlah per tanggal + variant |

---

## 1. Daftar barang

```text
GET /api/public/barang?page=1&limit=20&variantId=5&status=FINISHGOOD
```

### Query parameter

| Parameter | Wajib | Default | Keterangan |
| --- | --- | --- | --- |
| `page` | tidak | `1` | Halaman, minimal 1 |
| `limit` | tidak | `20` | Maksimal `100` |
| `variantId` | tidak | – | Angka bulat positif |
| `status` | tidak | semua | Harus status **aktif** di tabel `StatusBarang`; case-insensitive |

`status` yang tidak dikenal menghasilkan `400` dengan pesan berisi daftar status aktif saat itu.

### Contoh request

```bash
curl "http://localhost:8000/api/public/barang?limit=1"
```

### Contoh response `200` (dipotong)

```json
{
  "data": [
    {
      "id": 101,
      "kodeBarang": "BC001-WB005-181126-0051",
      "variantId": 5,
      "batchId": 1,
      "groupId": null,
      "gudangId": null,
      "qualityInspectionLineId": null,
      "hasilProduksiHarianItemId": null,
      "tanggal": "2026-11-17T17:19:42.416Z",
      "status": "OUT",
      "finishGoodAt": null,
      "createdAt": "2026-11-17T17:19:42.522Z",
      "updatedAt": "2026-11-17T17:21:26.296Z",
      "variant": {
        "id": 5,
        "kodeVariant": "WB005",
        "productId": 1,
        "styleId": 1,
        "colorId": 2,
        "sizeId": 1,
        "tanggal": "2026-11-17T16:45:27.474Z",
        "createdAt": "2026-11-17T16:45:27.474Z",
        "updatedAt": "2026-11-17T16:45:27.474Z",
        "product": { "id": 1, "nama": "Windbreaker", "prefix": "wb" },
        "style": { "id": 1, "nama": "Motif" },
        "color": { "id": 2, "nama": "Carbon" },
        "size": { "id": 1, "nama": "LG", "urutan": 1 }
      },
      "batch": {
        "id": 1,
        "nomorBatch": 1,
        "totalProduksi": 150,
        "kapasitas": 5000,
        "status": "AKTIF"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 1,
    "total": 150,
    "totalPages": 150
  }
}
```

> Objek `product`, `style`, `color`, dan `size` di contoh dipotong; response asli juga memuat `createdAt` dan `updatedAt`.

---

## 2. Detail barang berdasarkan kode

```text
GET /api/public/barang/:kodeBarang
```

`kodeBarang` adalah kode unik, contoh `BC001-WB005-181126-0051` (bukan `id`).

```bash
curl "http://localhost:8000/api/public/barang/BC001-WB005-181126-0051"
```

### Response `200`

Satu objek barang tanpa pembungkus `data`, field sama dengan item pada endpoint daftar:

```json
{
  "id": 101,
  "kodeBarang": "BC001-WB005-181126-0051",
  "variantId": 5,
  "batchId": 1,
  "status": "OUT",
  "tanggal": "2026-11-17T17:19:42.416Z",
  "finishGoodAt": null,
  "variant": { "kodeVariant": "WB005", "product": { "nama": "Windbreaker" } },
  "batch": { "nomorBatch": 1, "status": "AKTIF" }
}
```

### Response `404`

```json
{ "message": "Barang tidak ditemukan" }
```

---

## 3. Rekap per tanggal + variant

```text
GET /api/public/barang/rekap-variant?tanggalAwal=YYYY-MM-DD&tanggalAkhir=YYYY-MM-DD
```

### Query parameter

| Parameter | Wajib | Keterangan |
| --- | --- | --- |
| `tanggalAwal` | tidak | Format `YYYY-MM-DD`; tanpa ini dihitung dari data paling awal |
| `tanggalAkhir` | tidak | Format `YYYY-MM-DD`; inklusif sampai akhir hari |

- Tanggal invalid menghasilkan `400`.
- `tanggalAwal` lebih besar dari `tanggalAkhir` menghasilkan `400`.
- Tanpa parameter berarti seluruh riwayat; tidak ada paginasi sehingga response bisa besar.
- `perStatus` selalu memuat semua status **aktif** di database, termasuk yang jumlahnya `0`.

### Contoh request

```bash
curl "http://localhost:8000/api/public/barang/rekap-variant?tanggalAwal=2026-11-17&tanggalAkhir=2026-11-17"
```

### Contoh response `200`

```json
{
  "data": [
    {
      "tanggal": "2026-11-17",
      "variantId": 5,
      "kodeVariant": "WB005",
      "product": "Windbreaker",
      "style": "Motif",
      "color": "Carbon",
      "size": "LG",
      "sizeUrutan": 1,
      "perStatus": {
        "REGISTER": 0,
        "FINISHGOOD": 0,
        "RETUR": 0,
        "OUT": 100,
        "BAD": 0
      },
      "total": 100
    },
    {
      "tanggal": "2026-11-17",
      "variantId": 29,
      "kodeVariant": "WB029",
      "product": "Windbreaker",
      "style": "Solid",
      "color": "White Glossy",
      "size": "LG",
      "sizeUrutan": 1,
      "perStatus": {
        "REGISTER": 0,
        "FINISHGOOD": 50,
        "RETUR": 0,
        "OUT": 0,
        "BAD": 0
      },
      "total": 50
    }
  ],
  "statuses": ["REGISTER", "FINISHGOOD", "RETUR", "OUT", "BAD"],
  "total": 150
}
```

### Arti field

- `data[]` — satu baris per kombinasi **tanggal + variant**.
- `perStatus` — jumlah unit per status pada tanggal dan variant tersebut.
- `total` di dalam `data[]` — jumlah semua status untuk baris itu.
- `total` di root — jumlah seluruh baris yang dikembalikan.
- `statuses` — daftar kode status aktif dari database, urut sesuai `urutan`.

---

## Format error umum

| HTTP | Contoh body | Penyebab |
| --- | --- | --- |
| 400 | `{ "message": "Query 'variantId' harus angka bulat positif" }` | Parameter tidak valid |
| 400 | `{ "message": "Query 'status' tidak valid. Status aktif: REGISTER, ..." }` | Status tidak ada/nonaktif |
| 400 | `{ "message": "Parameter 'tanggalAwal' harus tanggal valid (YYYY-MM-DD)" }` | Format tanggal salah |
| 404 | `{ "message": "Barang tidak ditemukan" }` | Kode tidak ada |
| 500 | `{ "message": "Gagal mengambil data barang", "error": ... }` | Error server |

---

## Contoh pemakaian JavaScript

```js
const base = "http://localhost:8000/api/public/barang";

// Daftar finish good
const list = await fetch(`${base}?status=FINISHGOOD&limit=50`).then((r) => r.json());

// Detail satu unit
const unit = await fetch(`${base}/BC001-WB005-181126-0051`).then((r) => r.json());

// Rekap November 2026
const rekap = await fetch(
  `${base}/rekap-variant?tanggalAwal=2026-11-01&tanggalAkhir=2026-11-30`,
).then((r) => r.json());```

---

## Catatan keamanan dan batasan

- Semua field model terekspos, termasuk `gudangId`, `batchId`, dan id internal.
- Tidak ada autentikasi, rate limit, maupun cache.
- Rekap tanpa filter tanggal dapat menghasilkan response sangat besar.
- `status` pada daftar hanya menerima status aktif; status nonaktif ditolak `400`.
