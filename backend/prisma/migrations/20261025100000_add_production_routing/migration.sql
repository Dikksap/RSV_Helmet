ALTER TABLE `PemakaianMaterial`
  MODIFY `sumber` ENUM('PERMINTAAN_BARANG', 'HASIL_PRODUKSI', 'TRANSFER_WIP', 'REPAIR') NOT NULL DEFAULT 'PERMINTAAN_BARANG';

CREATE TABLE `ProductionRouting` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `productVariantId` INTEGER NOT NULL,
  `bomId` INTEGER NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `ProductionRouting_productVariantId_version_key`(`productVariantId`, `version`),
  INDEX `ProductionRouting_bomId_isActive_idx`(`bomId`, `isActive`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `QualityInspectionLine`
  ADD COLUMN `productionRoutingId` INTEGER NULL;

CREATE INDEX `QualityInspectionLine_productionRoutingId_idx`
  ON `QualityInspectionLine`(`productionRoutingId`);

CREATE TABLE `ProductionRoutingStage` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `routingId` INTEGER NOT NULL,
  `stage` ENUM('BUFFING', 'BASE_COAT', 'DECAL_SOLID', 'DECAL_MOTIF', 'TOP_COAT') NOT NULL,
  `sequence` INTEGER NOT NULL,
  `divisiId` INTEGER NOT NULL,
  `inputItemId` INTEGER NOT NULL,
  `outputItemId` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `ProductionRoutingStage_routingId_stage_key`(`routingId`, `stage`),
  UNIQUE INDEX `ProductionRoutingStage_routingId_sequence_key`(`routingId`, `sequence`),
  INDEX `ProductionRoutingStage_divisiId_inputItemId_idx`(`divisiId`, `inputItemId`),
  INDEX `ProductionRoutingStage_outputItemId_idx`(`outputItemId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ProductionRouting`
  ADD CONSTRAINT `ProductionRouting_productVariantId_fkey`
  FOREIGN KEY (`productVariantId`) REFERENCES `ProductVariant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductionRouting_bomId_fkey`
  FOREIGN KEY (`bomId`) REFERENCES `Bom`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ProductionRoutingStage`
  ADD CONSTRAINT `ProductionRoutingStage_routingId_fkey`
  FOREIGN KEY (`routingId`) REFERENCES `ProductionRouting`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductionRoutingStage_divisiId_fkey`
  FOREIGN KEY (`divisiId`) REFERENCES `Divisi`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductionRoutingStage_inputItemId_fkey`
  FOREIGN KEY (`inputItemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductionRoutingStage_outputItemId_fkey`
  FOREIGN KEY (`outputItemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `QualityInspectionLine`
  ADD CONSTRAINT `QualityInspectionLine_productionRoutingId_fkey`
  FOREIGN KEY (`productionRoutingId`) REFERENCES `ProductionRouting`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
