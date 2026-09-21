-- CreateTable
CREATE TABLE `ProductionRealizationStage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `tanggal` DATETIME(3) NOT NULL,
    `stage` VARCHAR(191) NOT NULL,
    `qty` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProductionRealizationStage_orderId_tanggal_idx`(`orderId`, `tanggal`),
    UNIQUE INDEX `ProductionRealizationStage_orderId_tanggal_stage_key`(`orderId`, `tanggal`, `stage`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProductionRealizationStage` ADD CONSTRAINT `ProductionRealizationStage_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `ProductionOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
