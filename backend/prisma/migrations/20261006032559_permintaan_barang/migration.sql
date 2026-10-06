-- CreateTable
CREATE TABLE `PermintaanBarang` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `noPermintaan` VARCHAR(191) NOT NULL,
    `tanggal` DATETIME(3) NOT NULL,
    `departemen` VARCHAR(191) NOT NULL,
    `namaPeminta` VARCHAR(191) NOT NULL,
    `kebutuhanUntuk` VARCHAR(191) NOT NULL DEFAULT 'Produksi',
    `prioritas` VARCHAR(191) NOT NULL DEFAULT 'Normal',
    `tanggalDibutuhkan` DATETIME(3) NULL,
    `alasan` TEXT NOT NULL,
    `approval` ENUM('BELUM_DISETUJUI', 'DISETUJUI') NOT NULL DEFAULT 'BELUM_DISETUJUI',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PermintaanBarang_noPermintaan_key`(`noPermintaan`),
    INDEX `PermintaanBarang_tanggal_idx`(`tanggal`),
    INDEX `PermintaanBarang_approval_idx`(`approval`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PermintaanBarangItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `permintaanId` INTEGER NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `spesifikasi` VARCHAR(191) NULL,
    `jumlah` INTEGER NOT NULL,
    `satuan` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PermintaanBarangItem_permintaanId_fkey`(`permintaanId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PermintaanBarangItem` ADD CONSTRAINT `PermintaanBarangItem_permintaanId_fkey` FOREIGN KEY (`permintaanId`) REFERENCES `PermintaanBarang`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
