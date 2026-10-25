# Todolist — Seed Item Ikut Seed Utama

> Status: selesai diimplementasikan dan tervalidasi pada DB hasil reset.
> Tujuan: `npm run db:seed` membuat item master + saldo awal + PM/WIP historis, tanpa langkah manual `seed-item.ts`.
> Reset DB dan seed baru sudah diizinkan user.

---

## 1. Refactor Seed Item

File: `backend/prisma/seed-item.ts`

- [x] Ubah `async function main()` menjadi `export async function seedItem()`.
- [x] Tambah direct-run guard agar `npx tsx prisma/seed-item.ts` tetap bisa dijalankan standalone.
- [x] Pastikan `seedItem()` tidak auto-run saat di-import `seed.ts`.
- [x] Perilaku seed:
      - [x] upsert `Item` dari `ITEM_20261017`;
      - [x] set `Item.divisiId` dari `DIVISI_PERMINTAAN` sebelum PM historis dibuat;
      - [x] buat `StokItemMutasi` saldo awal;
      - [x] buat PM historis + approval untuk item dengan `keluar > 0`;
      - [x] skip ledger/PM jika mutasi sudah ada;
      - [x] self-check saldo akhir cocok CSV.

---

## 2. Integrasi ke Seed Utama

File: `backend/prisma/seed.ts`

- [x] Import `seedItem` dari `./seed-item.js`.
- [x] Panggil `await seedItem()` setelah seed Divisi.
- [x] Panggil sebelum early-return `existingBarang > 0`, supaya item tetap ter-seed saat Barang sudah ada.
- [x] Jangan menduplikasi data item/ledger di `seed.ts`.
- [x] Tutup client Prisma shared setelah `seedItem()` selesai.
- [x] `npx prisma db seed` selesai tanpa error.

---

## 3. Dokumentasi

- [x] Update `backend/AGENTS.md` bagian **Reset + re-seed**:

```bash
docker exec -it backend-api-1 npx prisma migrate reset --force
npm run db:seed
docker exec -it backend-api-1 npx tsx prisma/seed-production-order.ts
```

- [x] Catat `seed-item.ts` tetap bisa dijalankan standalone.
- [x] Catat `seed-production-order.ts` tetap terpisah.
- [x] Update komentar header `seed-item.ts`.
- [x] Tidak mengubah migration lama atau schema.

---

## 4. Validasi Seed

- [x] Reset DB:
      `docker exec -it backend-api-1 npx prisma migrate reset --force`
- [x] Jalankan `npx prisma db seed` (setara `npm run db:seed`).
- [x] Cek jumlah `Item` = 169.
- [x] Cek `StokItemMutasi` = 176 (169 saldo awal + 7 KELUAR approval).
- [x] Cek PM historis = 4 dan `PemakaianMaterial` = 4.
- [x] Cek 7 item PM punya `divisiId`; 4 PM historis punya `divisiApproverId` sesuai divisi.
- [x] Jalankan `seed-item.ts` standalone lagi → idempotent, ledger tidak bertambah.
- [x] `npx prisma migrate status` → database up to date.
- [x] `npx prisma migrate diff ... --exit-code` → `0`.
- [x] `npm run build` backend lulus.

---

## 5. E2E Setelah Seed

Gunakan item seed: `RAW020`, `SM0001`, `SM0002`.

- [x] Assign `produksi@example.com` ke Buffing dan `budi@example.com` ke Base Coat lewat admin API.
- [x] Buffing buat PM `RAW020` 10, admin approve → WIP Buffing `RAW020` = 10.
- [x] Produksi Buffing: `MASUK RAW020` 5 → `HASIL SM0001` 5.
- [x] Cek WIP `SM0001` Buffing = 5, stok gudang `SM0001` tetap 100.
- [x] Buffing `KIRIM SM0001` 5 → Base Coat, Base Coat approve.
- [x] Cek WIP Buffing `SM0001` = 0, Base Coat = 5, stok gudang tetap 100.
- [x] Produksi Base Coat: `MASUK SM0001` 5 → `HASIL SM0002` 5.
- [x] Cek WIP `SM0001` Base Coat = 0, WIP `SM0002` Base Coat = 5, stok gudang `SM0002` tetap 100.
- [x] Uji `MINTA` Base Coat → Buffing 2 `SM0002`, Base Coat approve.
- [x] Cek WIP `SM0002`: Base Coat = 3, Buffing = 2.
- [x] Cek rekap harian: stok awal, masuk, keluar produksi/transfer/lain, sisa.
- [x] Uji guard pembatalan PM yang sudah dipakai produksi → `409 PEMAKAIAN_DIPAKAI_PRODUKSI`.
- [x] Uji edit/delete PM yang sudah disetujui → `409 PERMINTAAN_TERKUNCI`.
- [ ] Smoke `/divisi/transfer-wip` di 390px dan 1440px.

---

## 6. Acceptance Criteria

- [x] `npm run db:seed` dari DB kosong menghasilkan item master.
- [x] `seed-item.ts` standalone tetap berfungsi.
- [x] Seed ulang tidak menggandakan item/ledger/PM.
- [x] Reset + seed utama + `seed-production-order.ts` cukup untuk mulai E2E.
- [x] Tidak ada perubahan schema/migration.
- [ ] Tidak commit tanpa instruksi eksplisit.

---

## 7. Catatan / Risiko

- [x] `seed-item.ts` membuat item + saldo + PM/WIP historis, bukan hanya master item.
- [x] Item di luar `DIVISI_PERMINTAAN` tetap `divisiId = null` karena CSV sumber tidak punya kolom divisi.
- [x] `seed-production-order.ts` tetap dijalankan terpisah.
- [x] `seed-permintaan-pemakaian.ts` tidak dijalankan; data E2E deterministik.
- [x] Reset DB menghapus seluruh data dev saat ini, sesuai izin user.
- [ ] Smoke UI viewport belum dilakukan karena browser MCP tidak tersedia.
