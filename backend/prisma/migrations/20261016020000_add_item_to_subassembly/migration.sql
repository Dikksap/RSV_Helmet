-- AlterTable
ALTER TABLE `Subassembly` ADD COLUMN `itemId` INTEGER NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Subassembly_itemId_key` ON `Subassembly`(`itemId`);

-- CreateIndex
CREATE INDEX `Subassembly_itemId_idx` ON `Subassembly`(`itemId`);

-- AddForeignKey
ALTER TABLE `Subassembly` ADD CONSTRAINT `Subassembly_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- BackfillSubassemblyFromItems
INSERT INTO `Subassembly` (`kode`, `nama`, `itemId`, `productVariantId`, `isActive`, `createdAt`, `updatedAt`)
SELECT `kode`, `nama`, `id`, NULL, `isActive`, NOW(), NOW()
FROM `Item`
WHERE (`jenis` = 'SM' OR `kode` LIKE 'SM%')
  AND `isActive` = TRUE
  AND NOT EXISTS (SELECT 1 FROM `Subassembly` s WHERE s.`itemId` = `Item`.`id`)
ON DUPLICATE KEY UPDATE
  `nama` = VALUES(`nama`),
  `isActive` = VALUES(`isActive`);
