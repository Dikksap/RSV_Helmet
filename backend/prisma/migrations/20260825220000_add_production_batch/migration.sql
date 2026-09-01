-- ============================================================
-- Migration: add_production_batch
-- Deskripsi:
--   1. Buat tabel ProductionBatch + enum StatusBatch
--   2. Backfill: insert BC001 dengan totalProduksi = jumlah Barang existing
--   3. Tambah kolom batchId (nullable dulu) ke Barang
--   4. Backfill batchId = 1 untuk semua Barang existing
--   5. Jadikan batchId NOT NULL + tambah FK + index
--   6. Hapus BarangCounter lama (data counter lama tidak relevan karena
--      key berubah dari (variantId, tanggal) menjadi (batchId, variantId, tanggal))
--   7. Buat ulang BarangCounter dengan key baru
-- ============================================================

-- Step 1: Buat enum StatusBatch (MySQL menggunakan ENUM inline di kolom)
-- Step 1 + 2: Buat tabel ProductionBatch
CREATE TABLE `ProductionBatch` (
    `id`            INT          NOT NULL AUTO_INCREMENT,
    `nomorBatch`    INT          NOT NULL,
    `totalProduksi` INT          NOT NULL DEFAULT 0,
    `kapasitas`     INT          NOT NULL DEFAULT 5000,
    `status`        ENUM('AKTIF','SELESAI') NOT NULL DEFAULT 'AKTIF',
    `createdAt`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `ProductionBatch_nomorBatch_key` ON `ProductionBatch`(`nomorBatch`);
CREATE INDEX `ProductionBatch_status_idx` ON `ProductionBatch`(`status`);

-- Step 3: Insert BC001 — totalProduksi diisi dengan jumlah Barang existing
-- Jika tidak ada data existing, totalProduksi = 0
INSERT INTO `ProductionBatch` (`nomorBatch`, `totalProduksi`, `kapasitas`, `status`, `createdAt`, `updatedAt`)
VALUES (1, (SELECT COUNT(*) FROM `Barang`), 5000, 'AKTIF', NOW(3), NOW(3));

-- Step 4: Tambah kolom batchId ke Barang (nullable dulu agar tidak error pada data existing)
ALTER TABLE `Barang` ADD COLUMN `batchId` INT NULL;

-- Step 5: Backfill — set semua Barang existing ke batchId = 1 (BC001)
UPDATE `Barang` SET `batchId` = 1;

-- Step 6: Jadikan batchId NOT NULL setelah backfill
ALTER TABLE `Barang` MODIFY COLUMN `batchId` INT NOT NULL;

-- Step 7: Tambah FK dan index batchId di Barang
ALTER TABLE `Barang`
    ADD CONSTRAINT `Barang_batchId_fkey`
    FOREIGN KEY (`batchId`) REFERENCES `ProductionBatch`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX `Barang_batchId_idx` ON `Barang`(`batchId`);

-- Step 8: Drop BarangCounter lama (key lama tidak kompatibel dengan key baru)
-- Data counter lama sudah tidak relevan karena batchId menjadi bagian dari key
DROP TABLE IF EXISTS `BarangCounter`;

-- Step 9: Buat ulang BarangCounter dengan key (batchId, variantId, tanggal)
CREATE TABLE `BarangCounter` (
    `id`           INT         NOT NULL AUTO_INCREMENT,
    `batchId`      INT         NOT NULL,
    `variantId`    INT         NOT NULL,
    `tanggal`      DATETIME(3) NOT NULL,
    `currentCount` INT         NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `BarangCounter_batchId_variantId_tanggal_key`
    ON `BarangCounter`(`batchId`, `variantId`, `tanggal`);

CREATE INDEX `BarangCounter_batchId_idx`   ON `BarangCounter`(`batchId`);
CREATE INDEX `BarangCounter_variantId_idx` ON `BarangCounter`(`variantId`);

ALTER TABLE `BarangCounter`
    ADD CONSTRAINT `BarangCounter_batchId_fkey`
    FOREIGN KEY (`batchId`) REFERENCES `ProductionBatch`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BarangCounter`
    ADD CONSTRAINT `BarangCounter_variantId_fkey`
    FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
