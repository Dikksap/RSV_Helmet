-- ============================================================
-- Migration: finishgood_view_uses_transition_date
-- Deskripsi:
--   Rekap FINISHGOOD tidak boleh berubah karena unit kemudian OUT/RETUR.
--   View memakai `Barang.finishGoodAt` (waktu pertama FINISHGOOD) bila ada,
--   dan jatuh ke `Barang.tanggal` hanya untuk unit legacy tanpa jejak histori.
--
--   Filter status diperluas: unit yang PERNAH FINISHGOOD tetap dihitung pada
--   bulan asalnya walau status saat ini OUT/RETUR/BAD.
--
-- Tidak ada data yang dihapus/diubah oleh view ini.
-- ============================================================

CREATE OR REPLACE VIEW `ViewBarangFinishgoodPerBulan` AS
SELECT
    DATE_FORMAT(COALESCE(b.`finishGoodAt`, b.`tanggal`), '%Y-%m') AS `bulan`,
    YEAR(COALESCE(b.`finishGoodAt`, b.`tanggal`))                 AS `tahun`,
    MONTH(COALESCE(b.`finishGoodAt`, b.`tanggal`))                AS `bulanAngka`,
    b.`variantId`                                                 AS `variantId`,
    pv.`productId`                                                AS `productId`,
    COUNT(*)                                                      AS `jumlah`
FROM `Barang` b
JOIN `ProductVariant` pv ON pv.`id` = b.`variantId`
WHERE (b.`finishGoodAt` IS NOT NULL OR b.`status` = 'FINISHGOOD')
  AND COALESCE(b.`finishGoodAt`, b.`tanggal`) IS NOT NULL
GROUP BY
    DATE_FORMAT(COALESCE(b.`finishGoodAt`, b.`tanggal`), '%Y-%m'),
    YEAR(COALESCE(b.`finishGoodAt`, b.`tanggal`)),
    MONTH(COALESCE(b.`finishGoodAt`, b.`tanggal`)),
    b.`variantId`,
    pv.`productId`;
