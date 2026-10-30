ALTER TABLE `Item`
  ADD COLUMN `defaultInventoryLocationId` INTEGER NULL;

ALTER TABLE `InventoryMovement`
  ADD COLUMN `batchId` INTEGER NULL,
  ADD COLUMN `group_uuid` CHAR(36) NULL;

CREATE TABLE `StockBalance` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `balanceKey` VARCHAR(191) NOT NULL,
  `itemId` INTEGER NULL,
  `barangId` INTEGER NULL,
  `batchId` INTEGER NULL,
  `pemakaianMaterialItemId` INTEGER NULL,
  `locationId` INTEGER NOT NULL,
  `quantity` DECIMAL(18, 6) NOT NULL DEFAULT 0,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `StockBalance_balanceKey_key` (`balanceKey`),
  INDEX `StockBalance_itemId_locationId_idx` (`itemId`, `locationId`),
  INDEX `StockBalance_barangId_locationId_idx` (`barangId`, `locationId`),
  INDEX `StockBalance_batchId_locationId_idx` (`batchId`, `locationId`),
  INDEX `StockBalance_pemakaianMaterialItemId_locationId_idx` (`pemakaianMaterialItemId`, `locationId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `StockAdjustment` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `itemId` INTEGER NOT NULL,
  `locationId` INTEGER NOT NULL,
  `batchId` INTEGER NULL,
  `systemQuantity` DECIMAL(18, 6) NOT NULL,
  `physicalQuantity` DECIMAL(18, 6) NOT NULL,
  `difference` DECIMAL(18, 6) NOT NULL,
  `snapshotMovementId` BIGINT NULL,
  `reason` TEXT NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `requestedById` INTEGER NOT NULL,
  `approvedById` INTEGER NULL,
  `movementId` BIGINT NULL,
  `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reviewedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `StockAdjustment_movementId_key` (`movementId`),
  INDEX `StockAdjustment_status_requestedAt_idx` (`status`, `requestedAt`),
  INDEX `StockAdjustment_itemId_locationId_requestedAt_idx` (`itemId`, `locationId`, `requestedAt`),
  INDEX `StockAdjustment_requestedById_idx` (`requestedById`),
  INDEX `StockAdjustment_approvedById_idx` (`approvedById`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `Item_defaultInventoryLocationId_fkey` ON `Item`(`defaultInventoryLocationId`);
CREATE INDEX `InventoryMovement_batchId_occurredAt_idx` ON `InventoryMovement`(`batchId`, `occurredAt`);
CREATE INDEX `InventoryMovement_group_uuid_idx` ON `InventoryMovement`(`group_uuid`);

ALTER TABLE `Item`
  ADD CONSTRAINT `Item_defaultInventoryLocationId_fkey`
  FOREIGN KEY (`defaultInventoryLocationId`) REFERENCES `InventoryLocation`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `InventoryMovement`
  ADD CONSTRAINT `InventoryMovement_batchId_fkey`
  FOREIGN KEY (`batchId`) REFERENCES `ProductionBatch`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `StockBalance`
  ADD CONSTRAINT `StockBalance_itemId_fkey`
  FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `StockBalance_barangId_fkey`
  FOREIGN KEY (`barangId`) REFERENCES `Barang`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `StockBalance_batchId_fkey`
  FOREIGN KEY (`batchId`) REFERENCES `ProductionBatch`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `StockBalance_pemakaianMaterialItemId_fkey`
  FOREIGN KEY (`pemakaianMaterialItemId`) REFERENCES `PemakaianMaterialItem`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `StockBalance_locationId_fkey`
  FOREIGN KEY (`locationId`) REFERENCES `InventoryLocation`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `StockAdjustment`
  ADD CONSTRAINT `StockAdjustment_itemId_fkey`
  FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `StockAdjustment_locationId_fkey`
  FOREIGN KEY (`locationId`) REFERENCES `InventoryLocation`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `StockAdjustment_batchId_fkey`
  FOREIGN KEY (`batchId`) REFERENCES `ProductionBatch`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `StockAdjustment_requestedById_fkey`
  FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `StockAdjustment_approvedById_fkey`
  FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `StockAdjustment_movementId_fkey`
  FOREIGN KEY (`movementId`) REFERENCES `InventoryMovement`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO `Gudang` (`kode`, `name`, `isActive`, `createdAt`, `updatedAt`)
VALUES ('GD_RAW', 'Gudang Raw', TRUE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `id` = `id`;

INSERT INTO `InventoryLocation` (`code`, `name`, `type`, `gudangId`, `isActive`, `createdAt`, `updatedAt`)
SELECT CONCAT('WH-', `id`), `name`, 'WAREHOUSE', `id`, `isActive`, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `Gudang`
WHERE `kode` = 'GD_RAW'
ON DUPLICATE KEY UPDATE `id` = `InventoryLocation`.`id`;

UPDATE `InventoryMovement` AS movement
JOIN `Barang` AS item ON item.`id` = movement.`barangId`
SET movement.`batchId` = item.`batchId`
WHERE movement.`barangId` IS NOT NULL AND movement.`batchId` IS NULL;

UPDATE `Item` AS item
JOIN `Gudang` AS warehouse ON warehouse.`kode` = 'GD_RAW'
JOIN `InventoryLocation` AS location ON location.`gudangId` = warehouse.`id`
SET item.`defaultInventoryLocationId` = location.`id`
WHERE item.`jenis` = 'RAW MATERIAL'
  AND item.`defaultInventoryLocationId` IS NULL;

INSERT INTO `InventoryMovement` (
  `itemId`, `barangId`, `batchId`, `fromLocationId`, `toLocationId`,
  `pemakaianMaterialItemId`, `hasilProduksiHarianId`, `type`, `quantity`,
  `idempotencyKey`, `sourceType`, `sourceId`, `reason`, `userId`,
  `occurredAt`, `reversalOfId`, `group_uuid`, `createdAt`
)
SELECT
  item.`id`, NULL, NULL, NULL, location.`id`,
  NULL, NULL, 'OPENING', legacy.`balance`,
  CONCAT('legacy-stockitem-opening:raw:', item.`id`),
  'LEGACY_STOCKITEM_OPENING', CAST(item.`id` AS CHAR),
  CONCAT('Saldo awal ledger legacy item ', item.`kode`, ' dipindahkan ke Gudang Raw'),
  NULL, CURRENT_TIMESTAMP(3), NULL, NULL, CURRENT_TIMESTAMP(3)
FROM `Item` AS item
JOIN (
  SELECT `itemId`, SUM(CASE WHEN `tipe` = 'MASUK' THEN `jumlah` ELSE -`jumlah` END) AS `balance`
  FROM `StokItemMutasi`
  GROUP BY `itemId`
) AS legacy ON legacy.`itemId` = item.`id`
JOIN `InventoryLocation` AS location ON location.`id` = item.`defaultInventoryLocationId`
WHERE item.`jenis` = 'RAW MATERIAL'
  AND legacy.`balance` > 0
  AND NOT EXISTS (
    SELECT 1
    FROM `InventoryMovement` AS prior
    WHERE prior.`idempotencyKey` = CONCAT('legacy-stockitem-opening:raw:', item.`id`)
  );

INSERT INTO `StockBalance` (
  `balanceKey`, `itemId`, `barangId`, `batchId`, `pemakaianMaterialItemId`,
  `locationId`, `quantity`, `updatedAt`
)
SELECT
  stock.`balanceKey`, stock.`itemId`, stock.`barangId`, stock.`batchId`,
  stock.`pemakaianMaterialItemId`, stock.`locationId`, SUM(stock.`delta`),
  CURRENT_TIMESTAMP(3)
FROM (
  SELECT
    CONCAT(
      CASE WHEN movement.`itemId` IS NOT NULL THEN CONCAT('I:', movement.`itemId`)
           ELSE CONCAT('B:', movement.`barangId`) END,
      ':', COALESCE(movement.`batchId`, barang.`batchId`, 0),
      ':', COALESCE(movement.`pemakaianMaterialItemId`, 0),
      ':', movement.`fromLocationId`
    ) AS `balanceKey`,
    movement.`itemId`, movement.`barangId`,
    COALESCE(movement.`batchId`, barang.`batchId`) AS `batchId`,
    movement.`pemakaianMaterialItemId`, movement.`fromLocationId` AS `locationId`,
    -movement.`quantity` AS `delta`
  FROM `InventoryMovement` AS movement
  LEFT JOIN `Barang` AS barang ON barang.`id` = movement.`barangId`
  WHERE movement.`fromLocationId` IS NOT NULL

  UNION ALL

  SELECT
    CONCAT(
      CASE WHEN movement.`itemId` IS NOT NULL THEN CONCAT('I:', movement.`itemId`)
           ELSE CONCAT('B:', movement.`barangId`) END,
      ':', COALESCE(movement.`batchId`, barang.`batchId`, 0),
      ':', COALESCE(movement.`pemakaianMaterialItemId`, 0),
      ':', movement.`toLocationId`
    ) AS `balanceKey`,
    movement.`itemId`, movement.`barangId`,
    COALESCE(movement.`batchId`, barang.`batchId`) AS `batchId`,
    movement.`pemakaianMaterialItemId`, movement.`toLocationId` AS `locationId`,
    movement.`quantity` AS `delta`
  FROM `InventoryMovement` AS movement
  LEFT JOIN `Barang` AS barang ON barang.`id` = movement.`barangId`
  WHERE movement.`toLocationId` IS NOT NULL
) AS stock
GROUP BY
  stock.`balanceKey`, stock.`itemId`, stock.`barangId`, stock.`batchId`,
  stock.`pemakaianMaterialItemId`, stock.`locationId`
HAVING SUM(stock.`delta`) <> 0;
