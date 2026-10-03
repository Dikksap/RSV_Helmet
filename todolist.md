# To-Do List: Arsip Dus + Penomoran Dus Dinamis

## Backend
- [x] Tambah kolom `isArsip Boolean @default(false)` di model `BarangGroup` (prisma/schema.prisma)
- [x] Migration baru + generate client (lokal & container)
- [x] `updateBarangGroup` terima `{ nama?, isArsip? }`
- [x] Controller PUT `/api/barang-group/:id` terima `{ nama?, isArsip? }`

## Frontend API
- [x] `BarangGroup` tambah `isArsip: boolean`
- [x] `updateBarangGroup(id, { nama?, isArsip? })`

## Helper
- [x] `frontend/src/lib/dus.ts`:
  - `isDusPengganti(group)` — nama `DUS PENGGANTI*` atau ada barang `pernahRetur`
  - `familyOfDus(nama)` — "biasa" | "pengganti"
  - `nextDusName(groups, pengganti)` — max suffix + 1, hanya hitung group `!isArsip`

## ScanQr (mode dus)
- [x] `ScannedItem.pernahRetur` dari `getScanBarang`
- [x] Effect: exclude `isArsip` saat pilih active group
- [x] Auto-create `DUS <n>` saat tak ada dus kosong/belum penuh
- [x] Saat simpan batch: batch dgn barang `pernahRetur` → group `DUS PENGGANTI <n>` (pakai/buat), selainnya `DUS <n>`; exclude `isArsip`

## StokProduksi
- [x] Split list aktif jadi dua bagian: "Dus" dan "Dus Pengganti" (mengikuti filter search/status)
- [x] Tombol "Arsipkan" per dus aktif (konfirmasi) → `isArsip: true`
- [x] Section "Arsip" (collapsible/toggle): list dus arsip + tombol "Pulihkan"

## Validasi
- [x] `npm run build` backend & frontend
- [x] Test PUT `{isArsip:true}` di container
- [ ] Cek: arsip semua dus → scan mode dus → auto-create mulai "DUS 1" lagi (manual di browser)
