-- ============================================================
-- Migration: add_status_register
-- Deskripsi:
--   Tambah nilai enum REGISTER pada StatusBarang sebagai
--   status awal barang baru.
--   1. Barang.status: tambah REGISTER + default jadi REGISTER
--   2. RiwayatBarang.status: tambah REGISTER
--   Data existing tidak diubah — hanya barang baru yang
--   dimulai dari REGISTER.
--   Urutan nilai enum harus identik dengan schema.prisma.
-- ============================================================

ALTER TABLE `Barang`
    MODIFY COLUMN `status`
    ENUM('REGISTER','FINISHGOOD','RETUR','OUT','BAD') NOT NULL DEFAULT 'REGISTER';

ALTER TABLE `RiwayatBarang`
    MODIFY COLUMN `status`
    ENUM('REGISTER','FINISHGOOD','RETUR','OUT','BAD') NOT NULL;
