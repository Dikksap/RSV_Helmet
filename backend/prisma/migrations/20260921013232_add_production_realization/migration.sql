-- CreateTable
CREATE TABLE `ProductionRealization` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `variantId` INTEGER NOT NULL,
    `tanggal` DATETIME(3) NOT NULL,
    `qty` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProductionRealization_orderId_tanggal_idx`(`orderId`, `tanggal`),
    UNIQUE INDEX `ProductionRealization_orderId_variantId_tanggal_key`(`orderId`, `variantId`, `tanggal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProductionRealization` ADD CONSTRAINT `ProductionRealization_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `ProductionOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionRealization` ADD CONSTRAINT `ProductionRealization_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
