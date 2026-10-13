-- ============================================================
-- Migration: add_item_gudang_mutasi
-- Deskripsi:
--   Master Item + master Gudang + lokasi gudang per Barang +
--   riwayat mutasi gudang + itemId opsional di PermintaanBarangItem.
--   Semua kolom baru nullable/berdefault sehingga kompatibel dengan
--   data lama. Tidak menyentuh tabel/kolom yang sudah ada.
-- ============================================================

-- CreateTable Item
CREATE TABLE `Item` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `kode` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `divisiId` INT NULL,
    `unit` VARCHAR(191) NOT NULL DEFAULT 'pcs',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `Item_kode_key`(`kode`),
    INDEX `Item_divisiId_fkey`(`divisiId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable Gudang
CREATE TABLE `Gudang` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `kode` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `Gudang_kode_key`(`kode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable RiwayatMutasiGudang
CREATE TABLE `RiwayatMutasiGudang` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `barangId` INT NOT NULL,
    `gudangAsalId` INT NULL,
    `gudangTujuanId` INT NULL,
    `jumlah` INT NOT NULL DEFAULT 1,
    `tanggal` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `keterangan` VARCHAR(191) NULL,
    `userId` INT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RiwayatMutasiGudang_barangId_tanggal_idx`(`barangId`, `tanggal`),
    INDEX `RiwayatMutasiGudang_gudangAsalId_fkey`(`gudangAsalId`),
    INDEX `RiwayatMutasiGudang_gudangTujuanId_fkey`(`gudangTujuanId`),
    INDEX `RiwayatMutasiGudang_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable Barang: lokasi gudang saat ini (nullable)
ALTER TABLE `Barang` ADD COLUMN `gudangId` INT NULL,
    ADD INDEX `Barang_gudangId_fkey`(`gudangId`);

-- AlterTable PermintaanBarangItem: referensi master item (nullable)
ALTER TABLE `PermintaanBarangItem` ADD COLUMN `itemId` INT NULL,
    ADD INDEX `PermintaanBarangItem_itemId_fkey`(`itemId`);

-- Permission master untuk pencatatan mutasi (grant diatur via seed)
INSERT INTO `Permission` (`kode`, `nama`, `kelompok`, `createdAt`, `updatedAt`) VALUES
('MUTASI_GUDANG', 'Catat mutasi gudang', 'BARANG', NOW(3), NOW(3));

-- AddForeignKey
ALTER TABLE `Item` ADD CONSTRAINT `Item_divisiId_fkey` FOREIGN KEY (`divisiId`) REFERENCES `Divisi`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Barang` ADD CONSTRAINT `Barang_gudangId_fkey` FOREIGN KEY (`gudangId`) REFERENCES `Gudang`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `PermintaanBarangItem` ADD CONSTRAINT `PermintaanBarangItem_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `RiwayatMutasiGudang` ADD CONSTRAINT `RiwayatMutasiGudang_barangId_fkey` FOREIGN KEY (`barangId`) REFERENCES `Barang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `RiwayatMutasiGudang` ADD CONSTRAINT `RiwayatMutasiGudang_gudangAsalId_fkey` FOREIGN KEY (`gudangAsalId`) REFERENCES `Gudang`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `RiwayatMutasiGudang` ADD CONSTRAINT `RiwayatMutasiGudang_gudangTujuanId_fkey` FOREIGN KEY (`gudangTujuanId`) REFERENCES `Gudang`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `RiwayatMutasiGudang` ADD CONSTRAINT `RiwayatMutasiGudang_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
