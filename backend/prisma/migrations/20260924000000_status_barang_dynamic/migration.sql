-- CreateTable StatusBarang
CREATE TABLE `StatusBarang` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `kode` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `warna` VARCHAR(191) NULL,
    `urutan` INT NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `StatusBarang_kode_key` (`kode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed 5 status awal (enum lama)
INSERT INTO `StatusBarang` (`kode`, `nama`, `warna`, `urutan`, `isActive`, `createdAt`, `updatedAt`) VALUES
('REGISTER', 'Register', '#6B7280', 1, true, NOW(3), NOW(3)),
('FINISHGOOD', 'Finish Good', '#10B981', 2, true, NOW(3), NOW(3)),
('RETUR', 'Retur', '#F59E0B', 3, true, NOW(3), NOW(3)),
('OUT', 'Keluar', '#3B82F6', 4, true, NOW(3), NOW(3)),
('BAD', 'Bad', '#EF4444', 5, true, NOW(3), NOW(3));

-- AlterTable Barang.status dari Enum -> String
ALTER TABLE `Barang` MODIFY `status` VARCHAR(191) NOT NULL DEFAULT 'REGISTER';
-- AlterTable RiwayatBarang.status
ALTER TABLE `RiwayatBarang` MODIFY `status` VARCHAR(191) NOT NULL;

-- AddForeignKey Barang.status -> StatusBarang.kode
ALTER TABLE `Barang` ADD CONSTRAINT `Barang_status_fkey` FOREIGN KEY (`status`) REFERENCES `StatusBarang`(`kode`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey RiwayatBarang.status -> StatusBarang.kode
ALTER TABLE `RiwayatBarang` ADD CONSTRAINT `RiwayatBarang_status_fkey` FOREIGN KEY (`status`) REFERENCES `StatusBarang`(`kode`) ON DELETE RESTRICT ON UPDATE CASCADE;
