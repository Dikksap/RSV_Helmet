-- 1. Add kodeVariant column to ProductVariant (nullable first)
ALTER TABLE `ProductVariant` ADD COLUMN `kodeVariant` VARCHAR(191) NULL;

-- 2. Backfill existing ProductVariant records with unique kodeVariant
-- Using the format W001, W002, etc. based on id
UPDATE `ProductVariant` SET `kodeVariant` = CONCAT('W', LPAD(`id`, 3, '0')) WHERE `kodeVariant` IS NULL;

-- 3. Make kodeVariant NOT NULL and add unique constraint
ALTER TABLE `ProductVariant` MODIFY COLUMN `kodeVariant` VARCHAR(191) NOT NULL;
CREATE UNIQUE INDEX `ProductVariant_kodeVariant_key` ON `ProductVariant`(`kodeVariant`);

-- 4. Create BarangCounter table
CREATE TABLE `BarangCounter` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `variantId` INT NOT NULL,
    `tanggal` DATETIME(3) NOT NULL,
    `currentCount` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `BarangCounter_variantId_tanggal_key` ON `BarangCounter`(`variantId`, `tanggal`);
CREATE INDEX `BarangCounter_variantId_idx` ON `BarangCounter`(`variantId`);

ALTER TABLE `BarangCounter` ADD CONSTRAINT `BarangCounter_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Create Barang table
CREATE TABLE `Barang` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `kodeBarang` VARCHAR(191) NOT NULL,
    `variantId` INT NOT NULL,
    `status` ENUM('FINISHGOOD', 'RETUR', 'OUT', 'BAD') NOT NULL DEFAULT 'FINISHGOOD',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `Barang_kodeBarang_key` ON `Barang`(`kodeBarang`);
CREATE INDEX `Barang_variantId_idx` ON `Barang`(`variantId`);
CREATE INDEX `Barang_status_idx` ON `Barang`(`status`);

ALTER TABLE `Barang` ADD CONSTRAINT `Barang_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. Create RiwayatBarang table
CREATE TABLE `RiwayatBarang` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `barangId` INT NOT NULL,
    `status` ENUM('FINISHGOOD', 'RETUR', 'OUT', 'BAD') NOT NULL,
    `tanggal` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `keterangan` VARCHAR(191) NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `RiwayatBarang_barangId_idx` ON `RiwayatBarang`(`barangId`);
CREATE INDEX `RiwayatBarang_tanggal_idx` ON `RiwayatBarang`(`tanggal`);

ALTER TABLE `RiwayatBarang` ADD CONSTRAINT `RiwayatBarang_barangId_fkey` FOREIGN KEY (`barangId`) REFERENCES `Barang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;