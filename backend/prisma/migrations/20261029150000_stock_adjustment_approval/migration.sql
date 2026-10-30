ALTER TABLE `StockAdjustment`
  ADD COLUMN `reviewedById` INTEGER NULL,
  ADD COLUMN `reviewNotes` TEXT NULL;

CREATE INDEX `StockAdjustment_reviewedById_idx`
  ON `StockAdjustment`(`reviewedById`);

ALTER TABLE `StockAdjustment`
  ADD CONSTRAINT `StockAdjustment_reviewedById_fkey`
  FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO `Role` (`kode`, `nama`, `createdAt`, `updatedAt`)
VALUES ('supervisor', 'Supervisor', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `nama` = VALUES(`nama`);

INSERT INTO `Permission` (`kode`, `nama`, `kelompok`, `createdAt`, `updatedAt`)
VALUES (
  'INVENTORY_ADJUST_APPROVE',
  'Menyetujui atau menolak adjustment inventory',
  'INVENTORY',
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
)
ON DUPLICATE KEY UPDATE `nama` = VALUES(`nama`), `kelompok` = VALUES(`kelompok`);

INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`, `createdAt`)
SELECT role.`id`, permission.`id`, CURRENT_TIMESTAMP(3)
FROM `Role` role
JOIN `Permission` permission ON permission.`kode` = 'INVENTORY_ADJUST_APPROVE'
WHERE role.`kode` = 'supervisor';
