-- AlterTable
ALTER TABLE `PermintaanBarang` ADD COLUMN `autoKey` VARCHAR(191) NULL,
    ADD COLUMN `divisiApproverId` INTEGER NULL,
    ADD COLUMN `divisiPemintaId` INTEGER NULL,
    ADD COLUMN `sumber` ENUM('MANUAL', 'HASIL_PRODUKSI') NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE `User` ADD COLUMN `divisiId` INTEGER NULL;

-- CreateTable
CREATE TABLE `HasilProduksiPemakaian` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `hasilProduksiHarianItemId` INTEGER NOT NULL,
    `pemakaianMaterialItemId` INTEGER NOT NULL,
    `jumlah` DECIMAL(18, 6) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `HasilProduksiPemakaian_pemakaianMaterialItemId_fkey`(`pemakaianMaterialItemId`),
    UNIQUE INDEX `HasilProduksiPemakaian_hasilProduksiHarianItemId_pemakaianMa_key`(`hasilProduksiHarianItemId`, `pemakaianMaterialItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `PermintaanBarang_autoKey_key` ON `PermintaanBarang`(`autoKey`);

-- CreateIndex
CREATE INDEX `PermintaanBarang_divisiPemintaId_fkey` ON `PermintaanBarang`(`divisiPemintaId`);

-- CreateIndex
CREATE INDEX `PermintaanBarang_divisiApproverId_fkey` ON `PermintaanBarang`(`divisiApproverId`);

-- CreateIndex
CREATE INDEX `PermintaanBarang_sumber_idx` ON `PermintaanBarang`(`sumber`);

-- CreateIndex
CREATE INDEX `User_divisiId_fkey` ON `User`(`divisiId`);

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_divisiId_fkey` FOREIGN KEY (`divisiId`) REFERENCES `Divisi`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PermintaanBarang` ADD CONSTRAINT `PermintaanBarang_divisiPemintaId_fkey` FOREIGN KEY (`divisiPemintaId`) REFERENCES `Divisi`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PermintaanBarang` ADD CONSTRAINT `PermintaanBarang_divisiApproverId_fkey` FOREIGN KEY (`divisiApproverId`) REFERENCES `Divisi`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HasilProduksiPemakaian` ADD CONSTRAINT `HasilProduksiPemakaian_hasilProduksiHarianItemId_fkey` FOREIGN KEY (`hasilProduksiHarianItemId`) REFERENCES `hasil_produksi_harian_item`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HasilProduksiPemakaian` ADD CONSTRAINT `HasilProduksiPemakaian_pemakaianMaterialItemId_fkey` FOREIGN KEY (`pemakaianMaterialItemId`) REFERENCES `PemakaianMaterialItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill divisi peminta dari nama departemen lama.
UPDATE `PermintaanBarang` pb
JOIN `Divisi` d
  ON LOWER(TRIM(pb.`departemen`)) = LOWER(TRIM(d.`nama`))
SET pb.`divisiPemintaId` = d.`id`
WHERE pb.`divisiPemintaId` IS NULL;

-- Backfill approver hanya bila semua item sudah punya master dan menunjuk satu divisi.
UPDATE `PermintaanBarang` pb
JOIN (
    SELECT pbi.`permintaanId`, MIN(i.`divisiId`) AS `divisiId`, COUNT(*) AS `itemCount`
    FROM `PermintaanBarangItem` pbi
    JOIN `Item` i ON i.`id` = pbi.`itemId`
    GROUP BY pbi.`permintaanId`
    HAVING COUNT(DISTINCT i.`divisiId`) = 1
       AND MIN(i.`divisiId`) IS NOT NULL
) x ON x.`permintaanId` = pb.`id`
JOIN (
    SELECT `permintaanId`, COUNT(*) AS `totalItems`
    FROM `PermintaanBarangItem`
    GROUP BY `permintaanId`
) total ON total.`permintaanId` = pb.`id`
SET pb.`divisiApproverId` = x.`divisiId`
WHERE pb.`divisiApproverId` IS NULL
  AND x.`itemCount` = total.`totalItems`;
