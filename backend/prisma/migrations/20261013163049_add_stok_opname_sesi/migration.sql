-- AlterTable
ALTER TABLE `StokItemMutasi` ADD COLUMN `sumberOpnameBarisId` INTEGER NULL;

-- CreateTable
CREATE TABLE `StokOpnameSesi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tanggal` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `keterangan` VARCHAR(191) NULL,
    `userId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StokOpnameSesi_tanggal_idx`(`tanggal`),
    INDEX `StokOpnameSesi_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StokOpnameBaris` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sesiId` INTEGER NOT NULL,
    `itemId` INTEGER NOT NULL,
    `stokSistem` INTEGER NOT NULL,
    `stokFisik` INTEGER NOT NULL,
    `selisih` INTEGER NOT NULL,

    INDEX `StokOpnameBaris_itemId_fkey`(`itemId`),
    UNIQUE INDEX `StokOpnameBaris_sesiId_itemId_key`(`sesiId`, `itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `StokItemMutasi_sumberOpnameBarisId_fkey` ON `StokItemMutasi`(`sumberOpnameBarisId`);

-- AddForeignKey
ALTER TABLE `StokItemMutasi` ADD CONSTRAINT `StokItemMutasi_sumberOpnameBarisId_fkey` FOREIGN KEY (`sumberOpnameBarisId`) REFERENCES `StokOpnameBaris`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StokOpnameSesi` ADD CONSTRAINT `StokOpnameSesi_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StokOpnameBaris` ADD CONSTRAINT `StokOpnameBaris_sesiId_fkey` FOREIGN KEY (`sesiId`) REFERENCES `StokOpnameSesi`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StokOpnameBaris` ADD CONSTRAINT `StokOpnameBaris_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
