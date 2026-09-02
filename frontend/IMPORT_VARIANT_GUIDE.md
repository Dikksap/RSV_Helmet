# Panduan Import Variant — VariantProduk.tsx

## Lokasi Fitur
- Buka `Admin > Barang Produksi > Variant Produk` → `/admin/variant-produk`
- Tombol **Import** di header kanan, sebelah tombol **Produk** dan **Variant** (`VariantHeader.tsx:12`).

## Prasyarat (Wajib)
Import butuh ID master. Jika nama tidak ditemukan → baris `invalid` dan tidak diimpor.

1. **Produk** — buat di tab **Produk** (kirim `POST /api/products {nama,prefix}`).
   - Import mencari produk via `nama` **atau** `prefix` **atau** `ID` (case-insensitive).
   - Contoh: produk `Windbreaker` dengan prefix `W` → di CSV bisa tulis `Windbreaker` atau `W` atau `1`.

2. **Master Data** — buat di `/admin/master-data`:
   - **Style** → `POST /api/styles {nama}` (contoh: `Motif`, `Polos`)
   - **Warna** → `POST /api/colors {nama}` (contoh: `BOB`, `HITAM`)
   - **Ukuran** → `POST /api/sizes {nama, urutan?}` (contoh: `LG` urutan 1, `XL` urutan 2)

Jika CSV berisi style/warna/ukuran yang belum ada → error `tidak ditemukan di master`.

## Langkah Import (6 Langkah)
1. Klik **Template CSV** di modal Import — download `template_import_variant.csv`.
2. Buka dengan Excel / Google Sheets / Notepad.
3. Isi baris sesuai format (lihat Format Header).
4. Simpan sebagai **CSV UTF-8** (koma `,`). XLSX juga didukung: butuh `npm i xlsx`, atau simpan XLSX sebagai CSV.
5. Di modal Import klik **Pilih File** → pilih CSV/XLSX.
6. Cek preview: `valid` (hijau OK) vs `invalid` (merah + alasan). Klik **Import X variant** → progress bar → toast `Import selesai`.

## Format Header (Case-Insensitive, Alias Didukung)

| Header wajib | Alias diterima | Wajib | Keterangan |
|---|---|---|---|
| `produk` | `product`, `nama_produk`, `product_name`, `prefix` | Ya | Nama produk / prefix / ID. Lookup `products` |
| `style` | `motif`, `nama_style` | Ya | Nama style exact match master |
| `warna` | `color`, `colour`, `nama_warna` | Ya | Nama warna exact match master |
| `ukuran` | `size`, `nama_ukuran` | Ya | Nama ukuran exact match master |
| `tanggal` | `date`, `tgl` | Tidak | `YYYY-MM-DD` atau `DD/MM/YYYY` atau `DD-MM-YYYY`. Kosong = `now()` server. Contoh: `2026-08-01` |

- Urutan kolom bebas, nama header fleksibel asal alias di atas.
- Header wajib lengkap: `produk,style,warna,ukuran` → jika hilang, alert `Header wajib...`.
- Baris kosong di akhir file diabaikan. Quoted field (`"Windbreaker, Special"`) didukung parser `parseCSV` (`VariantImportModal.tsx:22`).

## Contoh CSV

```csv
produk,style,warna,ukuran,tanggal
Windbreaker,Motif,BOB,LG,2026-08-01
Windbreaker,Polos,HITAM,XL,2026-08-02
W,Motif,BOB,XL,
1,Polos,BOB,LG,01/08/2026
```

- Baris 3: `W` = prefix Windbreaker, tanggal kosong → server isi `now()`.
- Baris 4: `1` = ID produk, tanggal `DD/MM/YYYY` → dinormalisasi ke `2026-08-01` (`toISODate`).

Template yang di-download (`downloadTemplate` di `VariantImportModal.tsx:78`) otomatis pakai 2 contoh dari produk/style/warna/ukuran pertama yang ada.

## Validasi Per Baris (Preview)

Parser `buildRows` (`VariantImportModal.tsx:98`) melakukan:
- `produk/style/warna/ukuran wajib` → jika kosong → error.
- Lookup master → jika tidak ketemu → `produk "X" tidak ditemukan` / `style "X" tidak ditemukan di master`.
- `tanggal` → `toISODate` → jika tidak valid → `tanggal "X" format tidak valid (pakai YYYY-MM-DD)`.
- Duplikat kombinasi `productId-styleId-colorId-sizeId` **dalam file** → `duplikat kombinasi dalam file` (hanya baris kedua+ yang error, pakai `Set`).
- Duplikat dengan DB **tidak** dicek di preview — akan muncul saat import sebagai `409 Kombinasi style, color, size sudah ada untuk produk ini`.

Preview tabel: kolom Status `OK` (hijau) vs alasan error (merah). Statistik di atas tabel: `X valid / Y invalid / Z total`. Hanya 100 pertama preview jika file >100 baris.

## Proses Import

`doImport` (`VariantImportModal.tsx:240`) loop `validRows` **sequential** (bukan paralel):

```ts
for (r of validRows) await createProductVariant(r.productId!, {styleId, colorId, sizeId, tanggal})
// POST /api/products/:id/variants → kodeVariant = <PREFIX_UPPER><3digit> ex W001
```

- Sequential menjaga `generateKodeVariant` (`backend/src/model/product/product.ts:26`) tidak race (nextId = last id + 1).
- Progress `0→100%` update per baris (`setProgress`).
- Hasil: `{ok, fail, fails: [{idx, reason}]}`. Toast `flash` + `onImported` → `loadProducts()` reload `GET /api/products` + master.
- Jika `fail >0` → daftar 20 pertama `baris X: message` (409,400,404,500 dari `request` di `masterData.ts`).

## Error Umum & Solusi

| Pesan | Penyebab | Fix |
|---|---|---|
| `produk "X" tidak ditemukan` | Nama/prefix/ID tidak ada di DB | Buat produk dulu atau perbaiki ejaan (case-insensitive tapi harus persis) |
| `style "X" tidak ditemukan di master` | Belum ada di `/admin/master-data` | Tambah style di Master Data |
| `duplikat kombinasi dalam file` | 2 baris sama product+style+warna+ukuran | Hapus salah satu baris |
| `Kombinasi style, color, size sudah ada untuk produk ini` (409) | Sudah ada variant sama di DB | Skip atau ganti kombinasi |
| `tanggal "X" format tidak valid` | Format bukan YYYY-MM-DD / DD/MM/YYYY | Ubah ke `2026-08-01` |
| `Header wajib: ...` | Kolom header salah eja | Pastikan header `produk,style,warna,ukuran,tanggal` |
| `File XLSX butuh dependency 'xlsx'` | XLSX tanpa lib | `npm i xlsx` di `frontend` atau save as CSV |

## Tips
- Mulai dengan 2–5 baris untuk test. Cek preview `valid` semua baru import massal.
- Untuk 500+ baris, import tetap sequential — estimasi ±200ms/baris → 500 baris ≈ 100 detik, jangan tutup modal.
- Simpan CSV sebagai **UTF-8** agar karakter tidak korup.
- Kosongkan `tanggal` jika tidak perlu — backend isi `now()`.
- Gunakan `Master Data` untuk cek ejaan: copy-paste nama dari tabel master agar match 100%.

## Kode Terkait
- Modal: `frontend/src/components/VariantProduk/VariantImportModal.tsx:1`
- Header button: `frontend/src/components/VariantProduk/VariantHeader.tsx:12`
- Page state: `frontend/src/pages/VariantProduk.tsx:42` + `57` + `340`
- API: `frontend/src/api/products.ts:63` + `frontend/src/api/masterData.ts:1`

## Curl Alternatif (tanpa UI)
```bash
curl -X POST http://localhost:8000/api/products/1/variants \
  -H "Content-Type: application/json" \
  -d '{"styleId":1,"colorId":1,"sizeId":1,"tanggal":"2026-08-01"}'
```
Import UI hanya melakukan loop curl di atas per baris valid.
