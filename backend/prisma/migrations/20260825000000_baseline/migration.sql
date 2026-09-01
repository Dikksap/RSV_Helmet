-- Baseline migration: merepresentasikan state database yang sudah ada
-- Database sudah dalam kondisi ini, migration ini hanya untuk sinkronisasi history

-- CreateTable
CREATE TABLE IF NOT EXISTS `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `Style` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Style_nama_key`(`nama`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `Color` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Color_nama_key`(`nama`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `Size` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(191) NOT NULL,
    `urutan` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Size_nama_key`(`nama`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `Product` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kode` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `prefix` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Product_kode_key`(`kode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE IF NOT EXISTS `ProductVariant` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `styleId` INTEGER NOT NULL,
    `colorId` INTEGER NOT NULL,
    `sizeId` INTEGER NOT NULL,
    `status` ENUM('tercetak', 'barang_keluar', 'finish_good') NOT NULL DEFAULT 'tercetak',
    `tanggal` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProductVariant_productId_idx`(`productId`),
    INDEX `ProductVariant_styleId_idx`(`styleId`),
    INDEX `ProductVariant_colorId_idx`(`colorId`),
    INDEX `ProductVariant_sizeId_idx`(`sizeId`),
    UNIQUE INDEX `ProductVariant_productId_styleId_colorId_sizeId_key`(`productId`, `styleId`, `colorId`, `sizeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProductVariant` ADD CONSTRAINT `ProductVariant_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductVariant` ADD CONSTRAINT `ProductVariant_styleId_fkey` FOREIGN KEY (`styleId`) REFERENCES `Style`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductVariant` ADD CONSTRAINT `ProductVariant_colorId_fkey` FOREIGN KEY (`colorId`) REFERENCES `Color`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductVariant` ADD CONSTRAINT `ProductVariant_sizeId_fkey` FOREIGN KEY (`sizeId`) REFERENCES `Size`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
