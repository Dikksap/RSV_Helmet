-- ============================================================
-- Migration: add_view_barang_finishgood_per_bulan
-- Deskripsi:
--   Buat view ViewBarangFinishgoodPerBulan — agregasi jumlah
--   Barang yang saat ini berstatus FINISHGOOD, dikelompokkan
--   per bulan berdasarkan kolom `tanggal` barang (tanggal
--   produksi), dengan rincian variantId dan productId agar
--   bisa difilter di query endpoint.
-- ============================================================

CREATE OR REPLACE VIEW `ViewBarangFinishgoodPerBulan` AS
SELECT
    DATE_FORMAT(b.`tanggal`, '%Y-%m') AS bulan,
    YEAR(b.`tanggal`)                 AS tahun,
    MONTH(b.`tanggal`)                AS bulanAngka,
    b.`variantId`,
    pv.`productId`,
    COUNT(*)                          AS jumlah
FROM `Barang` b
JOIN `ProductVariant` pv ON pv.`id` = b.`variantId`
WHERE b.`status` = 'FINISHGOOD'
  AND b.`tanggal` IS NOT NULL
GROUP BY
    DATE_FORMAT(b.`tanggal`, '%Y-%m'),
    YEAR(b.`tanggal`),
    MONTH(b.`tanggal`),
    b.`variantId`,
    pv.`productId`;
