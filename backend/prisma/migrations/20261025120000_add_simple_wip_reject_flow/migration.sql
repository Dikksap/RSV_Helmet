CREATE TABLE `QualityRejectReason` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `QualityRejectReason_name_key`(`name`),
    INDEX `QualityRejectReason_createdById_fkey`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WipReject` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(191) NOT NULL,
    `itemId` INTEGER NOT NULL,
    `quantity` DECIMAL(18, 6) NOT NULL,
    `reasonId` INTEGER NOT NULL,
    `repairDivisionId` INTEGER NOT NULL,
    `recordedById` INTEGER NOT NULL,
    `claimedById` INTEGER NULL,
    `status` ENUM('OPEN', 'IN_PROGRESS', 'WAITING_QC', 'COMPLETED') NOT NULL DEFAULT 'OPEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `claimedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,

    UNIQUE INDEX `WipReject_number_key`(`number`),
    INDEX `WipReject_repairDivisionId_status_createdAt_idx`(`repairDivisionId`, `status`, `createdAt`),
    INDEX `WipReject_itemId_createdAt_idx`(`itemId`, `createdAt`),
    INDEX `WipReject_reasonId_idx`(`reasonId`),
    INDEX `WipReject_recordedById_idx`(`recordedById`),
    INDEX `WipReject_claimedById_idx`(`claimedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WipRejectLot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rejectId` INTEGER NOT NULL,
    `pemakaianMaterialItemId` INTEGER NOT NULL,
    `quantity` DECIMAL(18, 6) NOT NULL,

    UNIQUE INDEX `WipRejectLot_rejectId_pemakaianMaterialItemId_key`(`rejectId`, `pemakaianMaterialItemId`),
    INDEX `WipRejectLot_pemakaianMaterialItemId_idx`(`pemakaianMaterialItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WipRejectRepairAttempt` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rejectId` INTEGER NOT NULL,
    `performedById` INTEGER NOT NULL,
    `quantityAttempted` DECIMAL(18, 6) NOT NULL,
    `quantityRepaired` DECIMAL(18, 6) NOT NULL,
    `notes` TEXT NULL,
    `performedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedById` INTEGER NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewApproved` BOOLEAN NULL,
    `reviewNotes` TEXT NULL,

    INDEX `WipRejectRepairAttempt_rejectId_performedAt_idx`(`rejectId`, `performedAt`),
    INDEX `WipRejectRepairAttempt_performedById_idx`(`performedById`),
    INDEX `WipRejectRepairAttempt_reviewedById_idx`(`reviewedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WipRejectRepairLot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `attemptId` INTEGER NOT NULL,
    `rejectLotId` INTEGER NOT NULL,
    `quantity` DECIMAL(18, 6) NOT NULL,

    UNIQUE INDEX `WipRejectRepairLot_attemptId_rejectLotId_key`(`attemptId`, `rejectLotId`),
    INDEX `WipRejectRepairLot_rejectLotId_idx`(`rejectLotId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `QualityRejectReason` ADD CONSTRAINT `QualityRejectReason_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WipReject` ADD CONSTRAINT `WipReject_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WipReject` ADD CONSTRAINT `WipReject_reasonId_fkey` FOREIGN KEY (`reasonId`) REFERENCES `QualityRejectReason`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WipReject` ADD CONSTRAINT `WipReject_repairDivisionId_fkey` FOREIGN KEY (`repairDivisionId`) REFERENCES `Divisi`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WipReject` ADD CONSTRAINT `WipReject_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WipReject` ADD CONSTRAINT `WipReject_claimedById_fkey` FOREIGN KEY (`claimedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WipRejectLot` ADD CONSTRAINT `WipRejectLot_rejectId_fkey` FOREIGN KEY (`rejectId`) REFERENCES `WipReject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WipRejectLot` ADD CONSTRAINT `WipRejectLot_pemakaianMaterialItemId_fkey` FOREIGN KEY (`pemakaianMaterialItemId`) REFERENCES `PemakaianMaterialItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WipRejectRepairAttempt` ADD CONSTRAINT `WipRejectRepairAttempt_rejectId_fkey` FOREIGN KEY (`rejectId`) REFERENCES `WipReject`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WipRejectRepairAttempt` ADD CONSTRAINT `WipRejectRepairAttempt_performedById_fkey` FOREIGN KEY (`performedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WipRejectRepairAttempt` ADD CONSTRAINT `WipRejectRepairAttempt_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WipRejectRepairLot` ADD CONSTRAINT `WipRejectRepairLot_attemptId_fkey` FOREIGN KEY (`attemptId`) REFERENCES `WipRejectRepairAttempt`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `WipRejectRepairLot` ADD CONSTRAINT `WipRejectRepairLot_rejectLotId_fkey` FOREIGN KEY (`rejectLotId`) REFERENCES `WipRejectLot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
