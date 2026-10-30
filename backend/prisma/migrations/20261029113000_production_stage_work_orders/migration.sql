CREATE TABLE `ProductionWorkOrder` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `number` VARCHAR(191) NOT NULL,
  `orderId` INTEGER NOT NULL,
  `routingStageId` INTEGER NOT NULL,
  `plannedQty` INTEGER NOT NULL,
  `status` ENUM('DRAFT', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `releasedAt` DATETIME(3) NULL,
  `startedAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `closedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ProductionWorkOrder_number_key` (`number`),
  INDEX `ProductionWorkOrder_orderId_status_idx` (`orderId`, `status`),
  INDEX `ProductionWorkOrder_routingStageId_status_idx` (`routingStageId`, `status`),
  CONSTRAINT `ProductionWorkOrder_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `ProductionOrder` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `ProductionWorkOrder_routingStageId_fkey`
    FOREIGN KEY (`routingStageId`) REFERENCES `ProductionRoutingStage` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `hasil_produksi_harian`
  ADD COLUMN `productionWorkOrderId` INTEGER NULL,
  ADD INDEX `hasil_produksi_harian_productionWorkOrderId_tanggalProduksi_idx`
    (`productionWorkOrderId`, `tanggalProduksi`),
  ADD CONSTRAINT `hasil_produksi_harian_productionWorkOrderId_fkey`
    FOREIGN KEY (`productionWorkOrderId`) REFERENCES `ProductionWorkOrder` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
