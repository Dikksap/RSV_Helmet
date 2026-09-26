-- CreateTable
CREATE TABLE `ProductionScheduleTargetEdit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `tanggal` DATETIME(3) NOT NULL,
    `stage` VARCHAR(191) NOT NULL,
    `qty` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProductionScheduleTargetEdit_orderId_tanggal_idx`(`orderId`, `tanggal`),
    UNIQUE INDEX `ProductionScheduleTargetEdit_orderId_tanggal_stage_key`(`orderId`, `tanggal`, `stage`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductionScheduleAllocEdit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `variantId` INTEGER NOT NULL,
    `tanggal` DATETIME(3) NOT NULL,
    `qty` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProductionScheduleAllocEdit_orderId_tanggal_idx`(`orderId`, `tanggal`),
    INDEX `ProductionScheduleAllocEdit_variantId_fkey`(`variantId`),
    UNIQUE INDEX `ProductionScheduleAllocEdit_orderId_tanggal_variantId_key`(`orderId`, `tanggal`, `variantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProductionScheduleTargetEdit` ADD CONSTRAINT `ProductionScheduleTargetEdit_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `ProductionOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionScheduleAllocEdit` ADD CONSTRAINT `ProductionScheduleAllocEdit_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `ProductionOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionScheduleAllocEdit` ADD CONSTRAINT `ProductionScheduleAllocEdit_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
