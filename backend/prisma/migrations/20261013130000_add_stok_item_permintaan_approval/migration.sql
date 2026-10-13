-- AlterTable
ALTER TABLE `PermintaanBarangItem` ADD COLUMN `jumlahDisetujui` INTEGER NULL,
    ADD COLUMN `statusKeputusan` ENUM('MENUNGGU', 'DISETUJUI', 'DITOLAK') NOT NULL DEFAULT 'MENUNGGU';

-- CreateTable
CREATE TABLE `StokItemMutasi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `itemId` INTEGER NOT NULL,
    `tipe` ENUM('MASUK', 'KELUAR') NOT NULL,
    `jumlah` INTEGER NOT NULL,
    `sumberPermintaanItemId` INTEGER NULL,
    `keterangan` VARCHAR(191) NULL,
    `userId` INTEGER NULL,
    `tanggal` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StokItemMutasi_itemId_tanggal_idx`(`itemId`, `tanggal`),
    INDEX `StokItemMutasi_sumberPermintaanItemId_fkey`(`sumberPermintaanItemId`),
    INDEX `StokItemMutasi_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StokItemMutasi` ADD CONSTRAINT `StokItemMutasi_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StokItemMutasi` ADD CONSTRAINT `StokItemMutasi_sumberPermintaanItemId_fkey` FOREIGN KEY (`sumberPermintaanItemId`) REFERENCES `PermintaanBarangItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StokItemMutasi` ADD CONSTRAINT `StokItemMutasi_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
