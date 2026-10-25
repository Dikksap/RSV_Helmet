ALTER TABLE `PemakaianMaterial`
  MODIFY `sumber` ENUM('PERMINTAAN_BARANG', 'HASIL_PRODUKSI', 'TRANSFER_WIP', 'REPAIR', 'OPNAME') NOT NULL DEFAULT 'PERMINTAAN_BARANG';

CREATE TABLE `WipStocktakeSession` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `number` VARCHAR(191) NOT NULL,
  `locationId` INTEGER NOT NULL,
  `countedById` INTEGER NOT NULL,
  `notes` TEXT NULL,
  `countedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `WipStocktakeSession_number_key`(`number`),
  INDEX `WipStocktakeSession_locationId_countedAt_idx`(`locationId`, `countedAt`),
  INDEX `WipStocktakeSession_countedById_countedAt_idx`(`countedById`, `countedAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `WipStocktakeLine` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `sessionId` INTEGER NOT NULL,
  `itemId` INTEGER NOT NULL,
  `systemQuantity` DECIMAL(18, 6) NOT NULL,
  `physicalQuantity` DECIMAL(18, 6) NOT NULL,
  `difference` DECIMAL(18, 6) NOT NULL,
  `reason` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `WipStocktakeLine_sessionId_itemId_key`(`sessionId`, `itemId`),
  INDEX `WipStocktakeLine_itemId_createdAt_idx`(`itemId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `WipStocktakeSession`
  ADD CONSTRAINT `WipStocktakeSession_locationId_fkey`
    FOREIGN KEY (`locationId`) REFERENCES `InventoryLocation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `WipStocktakeSession_countedById_fkey`
    FOREIGN KEY (`countedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `WipStocktakeLine`
  ADD CONSTRAINT `WipStocktakeLine_sessionId_fkey`
    FOREIGN KEY (`sessionId`) REFERENCES `WipStocktakeSession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `WipStocktakeLine_itemId_fkey`
    FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
