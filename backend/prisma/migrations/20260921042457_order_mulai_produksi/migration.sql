/*
  Warnings:

  - You are about to drop the column `mulai` on the `ProductionOrderItem` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `ProductionOrder` ADD COLUMN `mulaiProduksi` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `ProductionOrderItem` DROP COLUMN `mulai`;
