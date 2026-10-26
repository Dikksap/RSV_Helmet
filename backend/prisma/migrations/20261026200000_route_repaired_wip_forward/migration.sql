ALTER TABLE `WipReject`
  ADD COLUMN `repairStageId` INTEGER NULL,
  ADD INDEX `WipReject_repairStageId_idx` (`repairStageId`),
  ADD CONSTRAINT `WipReject_repairStageId_fkey`
    FOREIGN KEY (`repairStageId`) REFERENCES `ProductionRoutingStage`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `WipRejectRepairAttempt`
  ADD COLUMN `outputItemId` INTEGER NULL,
  ADD INDEX `WipRejectRepairAttempt_outputItemId_idx` (`outputItemId`),
  ADD CONSTRAINT `WipRejectRepairAttempt_outputItemId_fkey`
    FOREIGN KEY (`outputItemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
