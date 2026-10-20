-- CreateTable
CREATE TABLE `Subassembly` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kode` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `productVariantId` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Subassembly_kode_key`(`kode`),
    INDEX `Subassembly_productVariantId_idx`(`productVariantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Bom` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kode` VARCHAR(191) NULL,
    `nama` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `berlakuMulai` DATETIME(3) NULL,
    `berlakuSelesai` DATETIME(3) NULL,
    `productVariantId` INTEGER NULL,
    `subassemblyId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Bom_kode_key`(`kode`),
    INDEX `Bom_productVariantId_idx`(`productVariantId`),
    INDEX `Bom_subassemblyId_idx`(`subassemblyId`),
    INDEX `Bom_isActive_idx`(`isActive`),
    UNIQUE INDEX `Bom_productVariantId_version_key`(`productVariantId`, `version`),
    UNIQUE INDEX `Bom_subassemblyId_version_key`(`subassemblyId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BomItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bomId` INTEGER NOT NULL,
    `urutan` INTEGER NULL,
    `itemId` INTEGER NULL,
    `subassemblyId` INTEGER NULL,
    `quantity` DECIMAL(18, 6) NOT NULL,
    `unit` VARCHAR(191) NULL,
    `scrapPercent` DECIMAL(5, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BomItem_bomId_idx`(`bomId`),
    INDEX `BomItem_itemId_idx`(`itemId`),
    INDEX `BomItem_subassemblyId_idx`(`subassemblyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Subassembly` ADD CONSTRAINT `Subassembly_productVariantId_fkey` FOREIGN KEY (`productVariantId`) REFERENCES `ProductVariant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bom` ADD CONSTRAINT `Bom_productVariantId_fkey` FOREIGN KEY (`productVariantId`) REFERENCES `ProductVariant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bom` ADD CONSTRAINT `Bom_subassemblyId_fkey` FOREIGN KEY (`subassemblyId`) REFERENCES `Subassembly`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BomItem` ADD CONSTRAINT `BomItem_bomId_fkey` FOREIGN KEY (`bomId`) REFERENCES `Bom`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BomItem` ADD CONSTRAINT `BomItem_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BomItem` ADD CONSTRAINT `BomItem_subassemblyId_fkey` FOREIGN KEY (`subassemblyId`) REFERENCES `Subassembly`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
