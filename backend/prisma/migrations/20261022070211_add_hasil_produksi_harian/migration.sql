/*
  Warnings:

  - A unique constraint covering the columns `[sumberHasilProduksiItemId]` on the table `StokItemMutasi` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `StokItemMutasi` ADD COLUMN `sumberHasilProduksiItemId` INTEGER NULL;

-- CreateTable
CREATE TABLE `hasil_produksi_harian` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nomor` VARCHAR(191) NOT NULL,
    `tanggalProduksi` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `divisiId` INTEGER NOT NULL,
    `keterangan` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `hasil_produksi_harian_nomor_key`(`nomor`),
    INDEX `hasil_produksi_harian_tanggalProduksi_idx`(`tanggalProduksi`),
    INDEX `hasil_produksi_harian_divisiId_tanggalProduksi_idx`(`divisiId`, `tanggalProduksi`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hasil_produksi_harian_item` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `hasilProduksiHarianId` INTEGER NOT NULL,
    `itemId` INTEGER NOT NULL,
    `tipe` ENUM('MASUK', 'KELUAR', 'HASIL') NOT NULL,
    `jumlah` DECIMAL(18, 6) NOT NULL,
    `keterangan` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `hasil_produksi_harian_item_hasilProduksiHarianId_idx`(`hasilProduksiHarianId`),
    INDEX `hasil_produksi_harian_item_itemId_idx`(`itemId`),
    INDEX `hasil_produksi_harian_item_itemId_tipe_idx`(`itemId`, `tipe`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `StokItemMutasi_sumberHasilProduksiItemId_key` ON `StokItemMutasi`(`sumberHasilProduksiItemId`);

-- AddForeignKey
ALTER TABLE `StokItemMutasi` ADD CONSTRAINT `StokItemMutasi_sumberHasilProduksiItemId_fkey` FOREIGN KEY (`sumberHasilProduksiItemId`) REFERENCES `hasil_produksi_harian_item`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hasil_produksi_harian` ADD CONSTRAINT `hasil_produksi_harian_divisiId_fkey` FOREIGN KEY (`divisiId`) REFERENCES `Divisi`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hasil_produksi_harian_item` ADD CONSTRAINT `hasil_produksi_harian_item_hasilProduksiHarianId_fkey` FOREIGN KEY (`hasilProduksiHarianId`) REFERENCES `hasil_produksi_harian`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hasil_produksi_harian_item` ADD CONSTRAINT `hasil_produksi_harian_item_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
