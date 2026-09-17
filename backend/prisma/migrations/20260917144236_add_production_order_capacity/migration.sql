-- CreateTable
CREATE TABLE `ProductionOrder` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nomor` VARCHAR(191) NOT NULL,
    `periode` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NULL,
    `totalQty` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('DRAFT', 'AKTIF', 'SELESAI', 'BATAL') NOT NULL DEFAULT 'AKTIF',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductionOrder_nomor_key`(`nomor`),
    INDEX `ProductionOrder_periode_idx`(`periode`),
    INDEX `ProductionOrder_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductionOrderItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `variantId` INTEGER NOT NULL,
    `qty` INTEGER NOT NULL DEFAULT 0,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProductionOrderItem_orderId_idx`(`orderId`),
    INDEX `ProductionOrderItem_variantId_idx`(`variantId`),
    UNIQUE INDEX `ProductionOrderItem_orderId_variantId_key`(`orderId`, `variantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductionCapacity` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `stage` VARCHAR(191) NOT NULL,
    `kapasitasWeekday` INTEGER NOT NULL DEFAULT 0,
    `kapasitasSabtu` INTEGER NOT NULL DEFAULT 0,
    `mulai` DATETIME(3) NULL,
    `selesai` DATETIME(3) NULL,
    `hariKerja` INTEGER NOT NULL DEFAULT 0,
    `totalKapasitas` INTEGER NOT NULL DEFAULT 0,
    `urutan` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProductionCapacity_orderId_idx`(`orderId`),
    UNIQUE INDEX `ProductionCapacity_orderId_stage_key`(`orderId`, `stage`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProductionOrderItem` ADD CONSTRAINT `ProductionOrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `ProductionOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionOrderItem` ADD CONSTRAINT `ProductionOrderItem_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionCapacity` ADD CONSTRAINT `ProductionCapacity_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `ProductionOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
