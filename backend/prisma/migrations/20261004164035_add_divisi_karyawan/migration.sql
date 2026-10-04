-- AlterTable
ALTER TABLE `Karyawan` ADD COLUMN `divisiId` INTEGER NULL;

-- CreateTable
CREATE TABLE `Divisi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Divisi_nama_key`(`nama`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Karyawan_divisiId_idx` ON `Karyawan`(`divisiId`);

-- AddForeignKey
ALTER TABLE `Karyawan` ADD CONSTRAINT `Karyawan_divisiId_fkey` FOREIGN KEY (`divisiId`) REFERENCES `Divisi`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
