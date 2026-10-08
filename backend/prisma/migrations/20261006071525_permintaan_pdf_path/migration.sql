-- AlterTable
ALTER TABLE `PermintaanBarang` ADD COLUMN `pdfGeneratedAt` DATETIME(3) NULL,
    ADD COLUMN `pdfPath` VARCHAR(191) NULL;
