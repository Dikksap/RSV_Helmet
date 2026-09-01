-- ============================================================
-- Migration: add_view_variant_produk
-- Deskripsi:
--   Buat view ViewVariantProduk — join ProductVariant dengan
--   Product, Style, Color, Size agar data variant lengkap
--   dengan nama-nama relasinya bisa dibaca dalam satu query.
-- ============================================================

CREATE OR REPLACE VIEW `ViewVariantProduk` AS
SELECT
    pv.`id`,
    pv.`kodeVariant`,
    p.`id`      AS productId,
    p.`nama`    AS namaProduk,
    s.`id`      AS styleId,
    s.`nama`    AS namaStyle,
    c.`id`      AS colorId,
    c.`nama`    AS namaColor,
    sz.`id`     AS sizeId,
    sz.`nama`   AS namaSize,
    sz.`urutan` AS urutanSize,
    pv.`tanggal`
FROM `ProductVariant` pv
JOIN `Product` p  ON p.`id`  = pv.`productId`
JOIN `Style`   s  ON s.`id`  = pv.`styleId`
JOIN `Color`   c  ON c.`id`  = pv.`colorId`
JOIN `Size`    sz ON sz.`id` = pv.`sizeId`;
