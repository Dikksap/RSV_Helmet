CREATE TABLE `ProductionRoutingStageInput` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `routingStageId` INTEGER NOT NULL,
  `itemId` INTEGER NOT NULL,

  UNIQUE INDEX `ProductionRoutingStageInput_routingStageId_itemId_key`(`routingStageId`, `itemId`),
  INDEX `ProductionRoutingStageInput_itemId_idx`(`itemId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProductionRoutingStageOutput` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `routingStageId` INTEGER NOT NULL,
  `itemId` INTEGER NOT NULL,

  UNIQUE INDEX `ProductionRoutingStageOutput_routingStageId_itemId_key`(`routingStageId`, `itemId`),
  INDEX `ProductionRoutingStageOutput_itemId_idx`(`itemId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `ProductionRoutingStageInput` (`routingStageId`, `itemId`)
SELECT `id`, `inputItemId` FROM `ProductionRoutingStage`;

INSERT INTO `ProductionRoutingStageOutput` (`routingStageId`, `itemId`)
SELECT `id`, `outputItemId` FROM `ProductionRoutingStage`;

ALTER TABLE `ProductionRoutingStage`
  DROP FOREIGN KEY `ProductionRoutingStage_inputItemId_fkey`,
  DROP FOREIGN KEY `ProductionRoutingStage_outputItemId_fkey`,
  DROP INDEX `ProductionRoutingStage_divisiId_inputItemId_idx`,
  DROP INDEX `ProductionRoutingStage_outputItemId_idx`,
  DROP COLUMN `inputItemId`,
  DROP COLUMN `outputItemId`,
  ADD INDEX `ProductionRoutingStage_divisiId_idx`(`divisiId`);

ALTER TABLE `ProductionRoutingStageInput`
  ADD CONSTRAINT `ProductionRoutingStageInput_routingStageId_fkey`
    FOREIGN KEY (`routingStageId`) REFERENCES `ProductionRoutingStage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductionRoutingStageInput_itemId_fkey`
    FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ProductionRoutingStageOutput`
  ADD CONSTRAINT `ProductionRoutingStageOutput_routingStageId_fkey`
    FOREIGN KEY (`routingStageId`) REFERENCES `ProductionRoutingStage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ProductionRoutingStageOutput_itemId_fkey`
    FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
