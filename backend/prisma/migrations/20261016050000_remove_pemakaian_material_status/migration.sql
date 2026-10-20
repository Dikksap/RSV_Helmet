-- DropIndex
DROP INDEX `PemakaianMaterial_status_idx` ON `PemakaianMaterial`;

-- AlterTable
ALTER TABLE `PemakaianMaterial` DROP COLUMN `status`;
