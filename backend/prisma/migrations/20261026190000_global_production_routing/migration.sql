UPDATE `ProductionRouting`
SET `isActive` = false;

ALTER TABLE `ProductionRouting`
  DROP FOREIGN KEY `ProductionRouting_productVariantId_fkey`,
  DROP FOREIGN KEY `ProductionRouting_bomId_fkey`,
  DROP INDEX `ProductionRouting_productVariantId_version_key`,
  DROP INDEX `ProductionRouting_bomId_isActive_idx`,
  DROP COLUMN `productVariantId`,
  DROP COLUMN `bomId`,
  ADD INDEX `ProductionRouting_isActive_idx` (`isActive`);
