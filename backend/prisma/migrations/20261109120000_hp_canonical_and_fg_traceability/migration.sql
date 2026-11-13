-- ============================================================
-- Migration: hp_canonical_and_fg_traceability
-- Deskripsi (aditif, tanpa DROP):
--   1. HasilProduksiHarian menjadi jalur posting produksi kanonik:
--      - routingStageId : identitas tahap produksi (satu divisi bisa >1 stage)
--      - bomId          : BOM yang dipakai saat posting (histori dapat direproduksi)
--      - idempotencyKey : anti double-submit per dokumen
--   2. HasilProduksiHarianItem.productVariantId: output tahap akhir dapat
--      menyatakan ProductVariant tanpa membuat Item dummy.
--   3. Barang.hasilProduksiHarianItemId: relasi unit fisik -> output produksi.
--   4. Barang.finishGoodAt: waktu PERTAMA unit mencapai FINISHGOOD (write-once),
--      di-backfill hanya dari RiwayatBarang yang benar-benar ada.
--   5. InventoryMovement.hasilProduksiHarianItemId: referensi baris HP.
--   6. Index untuk laporan (Item.jenis, RiwayatBarang(status,tanggal),
--      Barang.finishGoodAt).
--
-- Catatan: tidak ada kolom/tabel yang dihapus. StokItemMutasi tidak diubah.
-- ============================================================

ALTER TABLE `hasil_produksi_harian`
  ADD COLUMN `routingStageId` INTEGER NULL,
  ADD COLUMN `bomId` INTEGER NULL,
  ADD COLUMN `idempotencyKey` VARCHAR(191) NULL;

ALTER TABLE `hasil_produksi_harian_item`
  ADD COLUMN `productVariantId` INTEGER NULL;

ALTER TABLE `Barang`
  ADD COLUMN `hasilProduksiHarianItemId` INTEGER NULL,
  ADD COLUMN `finishGoodAt` DATETIME(3) NULL;

ALTER TABLE `InventoryMovement`
  ADD COLUMN `hasilProduksiHarianItemId` INTEGER NULL;

CREATE UNIQUE INDEX `hasil_produksi_harian_idempotencyKey_key`
  ON `hasil_produksi_harian`(`idempotencyKey`);

CREATE INDEX `hasil_produksi_harian_routingStageId_fkey`
  ON `hasil_produksi_harian`(`routingStageId`);

CREATE INDEX `hasil_produksi_harian_bomId_fkey`
  ON `hasil_produksi_harian`(`bomId`);

CREATE INDEX `hasil_produksi_harian_item_productVariantId_fkey`
  ON `hasil_produksi_harian_item`(`productVariantId`);

CREATE INDEX `Barang_hasilProduksiHarianItemId_fkey`
  ON `Barang`(`hasilProduksiHarianItemId`);

CREATE INDEX `Barang_finishGoodAt_idx`
  ON `Barang`(`finishGoodAt`);

CREATE INDEX `InventoryMovement_hasilProduksiHarianItemId_fkey`
  ON `InventoryMovement`(`hasilProduksiHarianItemId`);

CREATE INDEX `Item_jenis_idx`
  ON `Item`(`jenis`);

CREATE INDEX `RiwayatBarang_status_tanggal_idx`
  ON `RiwayatBarang`(`status`, `tanggal`);

ALTER TABLE `hasil_produksi_harian`
  ADD CONSTRAINT `hasil_produksi_harian_routingStageId_fkey`
    FOREIGN KEY (`routingStageId`) REFERENCES `ProductionRoutingStage`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `hasil_produksi_harian_bomId_fkey`
    FOREIGN KEY (`bomId`) REFERENCES `Bom`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `hasil_produksi_harian_item`
  ADD CONSTRAINT `hasil_produksi_harian_item_productVariantId_fkey`
    FOREIGN KEY (`productVariantId`) REFERENCES `ProductVariant`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Barang`
  ADD CONSTRAINT `Barang_hasilProduksiHarianItemId_fkey`
    FOREIGN KEY (`hasilProduksiHarianItemId`) REFERENCES `hasil_produksi_harian_item`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `InventoryMovement`
  ADD CONSTRAINT `InventoryMovement_hasilProduksiHarianItemId_fkey`
    FOREIGN KEY (`hasilProduksiHarianItemId`) REFERENCES `hasil_produksi_harian_item`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill finishGoodAt HANYA dari histori yang benar-benar ada.
-- Unit tanpa baris RiwayatBarang FINISHGOOD tetap NULL (legacy/unlinked).
UPDATE `Barang` AS b
JOIN (
  SELECT `barangId`, MIN(`tanggal`) AS `finishPertama`
  FROM `RiwayatBarang`
  WHERE `status` = 'FINISHGOOD'
  GROUP BY `barangId`
) AS r ON r.`barangId` = b.`id`
SET b.`finishGoodAt` = r.`finishPertama`
WHERE b.`finishGoodAt` IS NULL;
