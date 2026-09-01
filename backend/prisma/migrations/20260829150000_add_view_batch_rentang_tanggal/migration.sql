-- ============================================================
-- Migration: add_view_batch_rentang_tanggal
-- Deskripsi:
--   Buat view ViewBatchRentangTanggal — agregasi rentang tanggal
--   produksi per ProductionBatch berdasarkan tanggal barang
--   (barcode). tanggalMulai = produksi pertama (MIN), 
--   tanggalSelesai = produksi terakhir (MAX). Untuk batch AKTIF
--   yang belum punya barang, tanggalMulai di-fallback ke
--   createdAt batch. totalProduksi diambil dari kolom INT batch
--   (hindari COUNT yang menghasilkan BIGINT).
-- ============================================================

CREATE OR REPLACE VIEW `ViewBatchRentangTanggal` AS
SELECT
    pb.`id`                                    AS batchId,
    pb.`nomorBatch`,
    pb.`status`,
    pb.`totalProduksi`,
    COALESCE(MIN(b.`tanggal`), pb.`createdAt`) AS tanggalMulai,
    MAX(b.`tanggal`)                           AS tanggalSelesai
FROM `ProductionBatch` pb
LEFT JOIN `Barang` b ON b.`batchId` = pb.`id` AND b.`tanggal` IS NOT NULL
GROUP BY
    pb.`id`,
    pb.`nomorBatch`,
    pb.`status`,
    pb.`createdAt`,
    pb.`totalProduksi`;
