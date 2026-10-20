-- CreateTable
CREATE TABLE `PemakaianMaterial` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nomor` VARCHAR(191) NOT NULL,
    `permintaanId` INTEGER NOT NULL,
    `divisiId` INTEGER NOT NULL,
    `tanggal` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NULL,
    `status` ENUM('DRAFT', 'DICATAT', 'DIVERIFIKASI') NOT NULL DEFAULT 'DRAFT',
    `keterangan` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PemakaianMaterial_nomor_key`(`nomor`),
    INDEX `PemakaianMaterial_permintaanId_idx`(`permintaanId`),
    INDEX `PemakaianMaterial_divisiId_tanggal_idx`(`divisiId`, `tanggal`),
    INDEX `PemakaianMaterial_userId_idx`(`userId`),
    INDEX `PemakaianMaterial_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PemakaianMaterialItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pemakaianId` INTEGER NOT NULL,
    `permintaanBarangItemId` INTEGER NOT NULL,
    `itemId` INTEGER NULL,
    `jumlahDiterima` DECIMAL(18, 6) NOT NULL DEFAULT 0,
    `jumlahDipakai` DECIMAL(18, 6) NOT NULL DEFAULT 0,
    `jumlahSisa` DECIMAL(18, 6) NOT NULL DEFAULT 0,
    `satuan` VARCHAR(191) NULL,
    `keteranganSisa` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PemakaianMaterialItem_pemakaianId_idx`(`pemakaianId`),
    INDEX `PemakaianMaterialItem_permintaanBarangItemId_idx`(`permintaanBarangItemId`),
    INDEX `PemakaianMaterialItem_itemId_idx`(`itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PemakaianMaterial` ADD CONSTRAINT `PemakaianMaterial_permintaanId_fkey` FOREIGN KEY (`permintaanId`) REFERENCES `PermintaanBarang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PemakaianMaterial` ADD CONSTRAINT `PemakaianMaterial_divisiId_fkey` FOREIGN KEY (`divisiId`) REFERENCES `Divisi`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PemakaianMaterial` ADD CONSTRAINT `PemakaianMaterial_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PemakaianMaterialItem` ADD CONSTRAINT `PemakaianMaterialItem_pemakaianId_fkey` FOREIGN KEY (`pemakaianId`) REFERENCES `PemakaianMaterial`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PemakaianMaterialItem` ADD CONSTRAINT `PemakaianMaterialItem_permintaanBarangItemId_fkey` FOREIGN KEY (`permintaanBarangItemId`) REFERENCES `PermintaanBarangItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PemakaianMaterialItem` ADD CONSTRAINT `PemakaianMaterialItem_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
