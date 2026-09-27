-- AlterTable
ALTER TABLE `Barang` ADD COLUMN `groupId` INTEGER NULL;

-- CreateTable
CREATE TABLE `BarangGroup` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BarangGroup_nama_key`(`nama`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Barang_groupId_idx` ON `Barang`(`groupId`);

-- AddForeignKey
ALTER TABLE `Barang` ADD CONSTRAINT `Barang_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `BarangGroup`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
