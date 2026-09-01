-- ============================================================
-- Migration: update_view_batch_rentang_tanggal
-- Deskripsi:
--   Update ViewBatchRentangTanggal menambah kolom
--   jumlahNonRegister = banyak barang di batch yang berstatus
--   TIDAK REGISTER (FINISHGOOD, RETUR, OUT, BAD). Sesuai aturan
--   transisi status (tidak ada yang kembali ke REGISTER), angka
--   ini monotonik naik dan tidak pernah turun walau satu barang
--   berubah status (mis. FINISHGOOD -> RETUR).
--   totalProduksi tetap dipertahankan (dipakai logika kapasitas).
--   Tanggal mulai/selesai tetap dihitung atas semua barang batch.
-- ============================================================

CREATE OR REPLACE VIEW `ViewBatchRentangTanggal` AS
SELECT
    pb.`id`                                    AS batchId,
    pb.`nomorBatch`,
    pb.`status`,
    pb.`totalProduksi`,
    SUM(CASE WHEN b.`status` <> 'REGISTER' THEN 1 ELSE 0 END) AS jumlahNonRegister,
    COALESCE(MIN(b.`tanggal`), pb.`createdAt`) AS tanggalMulai,
    MAX(b.`tanggal`)                           AS tanggalSelesai
FROM `ProductionBatch` pb
LEFT JOIN `Barang` b ON b.`batchId` = pb.`id`
GROUP BY
    pb.`id`,
    pb.`nomorBatch`,
    pb.`status`,
    pb.`createdAt`,
    pb.`totalProduksi`;
