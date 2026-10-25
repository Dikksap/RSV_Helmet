ALTER TABLE `QualityInspectionLine`
    ADD COLUMN `repairAttemptId` INTEGER NULL,
    ADD UNIQUE INDEX `QualityInspectionLine_repairAttemptId_key`(`repairAttemptId`);

ALTER TABLE `RepairAttempt`
    ADD COLUMN `reviewedById` INTEGER NULL,
    ADD COLUMN `reviewedAt` DATETIME(3) NULL,
    ADD COLUMN `reviewApproved` BOOLEAN NULL,
    ADD COLUMN `reviewNotes` TEXT NULL,
    ADD INDEX `RepairAttempt_reviewedById_idx`(`reviewedById`);

ALTER TABLE `QualityInspectionLine`
    ADD CONSTRAINT `QualityInspectionLine_repairAttemptId_fkey`
    FOREIGN KEY (`repairAttemptId`) REFERENCES `RepairAttempt`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `RepairAttempt`
    ADD CONSTRAINT `RepairAttempt_reviewedById_fkey`
    FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
