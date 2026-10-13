-- ============================================================
-- Migration: add_rbac_role_permission
-- Deskripsi:
--   RBAC berbasis database: Role + Permission master, matriks grant
--   (RolePermission) dan visibilitas status barang per role
--   (RoleBarangStatusPermission). User.role jadi FK ke Role.kode.
--   Data master (role & permission awal) ikut di sini mengikuti pola
--   StatusBarang/StatusTransition; matriks grant diatur lewat seed.
-- ============================================================

-- CreateTable Role
CREATE TABLE `Role` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `kode` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `Role_kode_key`(`kode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable Permission
CREATE TABLE `Permission` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `kode` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `kelompok` VARCHAR(191) NOT NULL DEFAULT 'BARANG',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `Permission_kode_key`(`kode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable RolePermission
CREATE TABLE `RolePermission` (
    `roleId` INT NOT NULL,
    `permissionId` INT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RolePermission_permissionId_fkey`(`permissionId`),
    PRIMARY KEY (`roleId`, `permissionId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable RoleBarangStatusPermission
CREATE TABLE `RoleBarangStatusPermission` (
    `roleId` INT NOT NULL,
    `statusKode` VARCHAR(191) NOT NULL,
    `canView` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RoleBarangStatusPermission_statusKode_fkey`(`statusKode`),
    PRIMARY KEY (`roleId`, `statusKode`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Seed role awal (kode kanonik lowercase, sama seperti kolom User.role lama)
INSERT INTO `Role` (`kode`, `nama`, `createdAt`, `updatedAt`) VALUES
('admin', 'Administrator', NOW(3), NOW(3)),
('user', 'Operator', NOW(3), NOW(3)),
('gudang', 'Warehouse', NOW(3), NOW(3)),
('produksi', 'Produksi', NOW(3), NOW(3)),
('qc', 'Quality Control', NOW(3), NOW(3));

-- Seed permission awal
INSERT INTO `Permission` (`kode`, `nama`, `kelompok`, `createdAt`, `updatedAt`) VALUES
('BARANG_LIHAT', 'Lihat data barang', 'BARANG', NOW(3), NOW(3)),
('BARANG_STATISTIK_LIHAT', 'Lihat statistik dan agregat barang', 'BARANG', NOW(3), NOW(3)),
('BARANG_SCAN', 'Scan barcode barang', 'BARANG', NOW(3), NOW(3)),
('BARANG_UBAH_STATUS', 'Ubah status barang', 'BARANG', NOW(3), NOW(3)),
('BARANG_GENERATE', 'Generate kode barang', 'BARANG', NOW(3), NOW(3)),
('BARANG_KELOLA', 'Kelola (tambah/ubah/hapus) barang manual', 'BARANG', NOW(3), NOW(3)),
('ROLE_KELOLA', 'Kelola role dan permission', 'ADMIN', NOW(3), NOW(3));

-- Rapikan User.role yang tidak dikenal supaya foreign key bisa dipasang
UPDATE `User` SET `role` = 'user'
WHERE `role` NOT IN ('admin', 'user', 'gudang', 'produksi', 'qc');

-- CreateIndex (nama dipaksa sama dengan backing index MariaDB supaya tidak drift)
CREATE INDEX `User_role_fkey` ON `User`(`role`);

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_role_fkey` FOREIGN KEY (`role`) REFERENCES `Role`(`kode`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `RoleBarangStatusPermission` ADD CONSTRAINT `RoleBarangStatusPermission_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `RoleBarangStatusPermission` ADD CONSTRAINT `RoleBarangStatusPermission_statusKode_fkey` FOREIGN KEY (`statusKode`) REFERENCES `StatusBarang`(`kode`) ON DELETE CASCADE ON UPDATE CASCADE;
