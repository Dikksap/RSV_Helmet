-- AlterTable
ALTER TABLE `PemakaianMaterial` ADD COLUMN `hasilProduksiHarianId` INTEGER NULL,
    ADD COLUMN `sumber` ENUM('PERMINTAAN_BARANG', 'HASIL_PRODUKSI', 'TRANSFER_WIP') NOT NULL DEFAULT 'PERMINTAAN_BARANG',
    ADD COLUMN `wipTransferId` INTEGER NULL,
    MODIFY `permintaanId` INTEGER NULL;

-- AlterTable
ALTER TABLE `PemakaianMaterialItem` ADD COLUMN `hasilProduksiHarianItemId` INTEGER NULL,
    MODIFY `permintaanBarangItemId` INTEGER NULL;

-- CreateTable
CREATE TABLE `WipTransfer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nomor` VARCHAR(191) NOT NULL,
    `tanggal` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `divisiAsalId` INTEGER NOT NULL,
    `divisiTujuanId` INTEGER NOT NULL,
    `status` ENUM('MENUNGGU', 'DISETUJUI', 'DITOLAK') NOT NULL DEFAULT 'MENUNGGU',
    `userId` INTEGER NULL,
    `approvedById` INTEGER NULL,
    `approvedAt` DATETIME(3) NULL,
    `keterangan` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WipTransfer_nomor_key`(`nomor`),
    INDEX `WipTransfer_tanggal_idx`(`tanggal`),
    INDEX `WipTransfer_divisiAsalId_tanggal_idx`(`divisiAsalId`, `tanggal`),
    INDEX `WipTransfer_divisiTujuanId_tanggal_idx`(`divisiTujuanId`, `tanggal`),
    INDEX `WipTransfer_status_idx`(`status`),
    INDEX `WipTransfer_userId_fkey`(`userId`),
    INDEX `WipTransfer_approvedById_fkey`(`approvedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WipTransferItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `transferId` INTEGER NOT NULL,
    `itemId` INTEGER NOT NULL,
    `jumlah` INTEGER NOT NULL,
    `satuan` VARCHAR(191) NULL,
    `jumlahDisetujui` INTEGER NULL,
    `pemakaianMaterialItemId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WipTransferItem_pemakaianMaterialItemId_key`(`pemakaianMaterialItemId`),
    INDEX `WipTransferItem_itemId_fkey`(`itemId`),
    UNIQUE INDEX `WipTransferItem_transferId_itemId_key`(`transferId`, `itemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WipTransferAlokasi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `transferItemId` INTEGER NOT NULL,
    `pemakaianMaterialItemId` INTEGER NOT NULL,
    `jumlah` DECIMAL(18, 6) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WipTransferAlokasi_transferItemId_fkey`(`transferItemId`),
    INDEX `WipTransferAlokasi_pemakaianMaterialItemId_fkey`(`pemakaianMaterialItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `PemakaianMaterial_hasilProduksiHarianId_key` ON `PemakaianMaterial`(`hasilProduksiHarianId`);

-- CreateIndex
CREATE UNIQUE INDEX `PemakaianMaterial_wipTransferId_key` ON `PemakaianMaterial`(`wipTransferId`);

-- CreateIndex
CREATE UNIQUE INDEX `PemakaianMaterialItem_hasilProduksiHarianItemId_key` ON `PemakaianMaterialItem`(`hasilProduksiHarianItemId`);

-- AddForeignKey
ALTER TABLE `PemakaianMaterial` ADD CONSTRAINT `PemakaianMaterial_hasilProduksiHarianId_fkey` FOREIGN KEY (`hasilProduksiHarianId`) REFERENCES `hasil_produksi_harian`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PemakaianMaterial` ADD CONSTRAINT `PemakaianMaterial_wipTransferId_fkey` FOREIGN KEY (`wipTransferId`) REFERENCES `WipTransfer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PemakaianMaterialItem` ADD CONSTRAINT `PemakaianMaterialItem_hasilProduksiHarianItemId_fkey` FOREIGN KEY (`hasilProduksiHarianItemId`) REFERENCES `hasil_produksi_harian_item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WipTransfer` ADD CONSTRAINT `WipTransfer_divisiAsalId_fkey` FOREIGN KEY (`divisiAsalId`) REFERENCES `Divisi`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WipTransfer` ADD CONSTRAINT `WipTransfer_divisiTujuanId_fkey` FOREIGN KEY (`divisiTujuanId`) REFERENCES `Divisi`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WipTransfer` ADD CONSTRAINT `WipTransfer_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WipTransfer` ADD CONSTRAINT `WipTransfer_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WipTransferItem` ADD CONSTRAINT `WipTransferItem_transferId_fkey` FOREIGN KEY (`transferId`) REFERENCES `WipTransfer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WipTransferItem` ADD CONSTRAINT `WipTransferItem_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WipTransferItem` ADD CONSTRAINT `WipTransferItem_pemakaianMaterialItemId_fkey` FOREIGN KEY (`pemakaianMaterialItemId`) REFERENCES `PemakaianMaterialItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WipTransferAlokasi` ADD CONSTRAINT `WipTransferAlokasi_transferItemId_fkey` FOREIGN KEY (`transferItemId`) REFERENCES `WipTransferItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WipTransferAlokasi` ADD CONSTRAINT `WipTransferAlokasi_pemakaianMaterialItemId_fkey` FOREIGN KEY (`pemakaianMaterialItemId`) REFERENCES `PemakaianMaterialItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
