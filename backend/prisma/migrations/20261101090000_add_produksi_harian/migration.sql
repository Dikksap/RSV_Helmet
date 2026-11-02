ALTER TABLE `Item`
  ADD COLUMN `stok` DECIMAL(18, 6) NOT NULL DEFAULT 0;

CREATE TABLE `GudangJenisItem` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `gudangId` INTEGER NOT NULL,
  `jenis` VARCHAR(50) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `GudangJenisItem_gudangId_jenis_key`(`gudangId`, `jenis`),
  INDEX `GudangJenisItem_jenis_idx`(`jenis`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProduksiHarian` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `nomor` VARCHAR(191) NOT NULL,
  `tanggalProduksi` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `divisiId` INTEGER NOT NULL,
  `tujuanLocationId` INTEGER NOT NULL,
  `userId` INTEGER NULL,
  `keterangan` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `ProduksiHarian_nomor_key`(`nomor`),
  INDEX `ProduksiHarian_tanggalProduksi_idx`(`tanggalProduksi`),
  INDEX `ProduksiHarian_divisiId_tanggalProduksi_idx`(`divisiId`, `tanggalProduksi`),
  INDEX `ProduksiHarian_tujuanLocationId_idx`(`tujuanLocationId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ProduksiHarianItem` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `produksiHarianId` INTEGER NOT NULL,
  `itemId` INTEGER NOT NULL,
  `tipe` ENUM('BAHAN', 'HASIL') NOT NULL,
  `jumlah` DECIMAL(18, 6) NOT NULL,
  `sumberLocationId` INTEGER NULL,
  `keterangan` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `ProduksiHarianItem_produksiHarianId_idx`(`produksiHarianId`),
  INDEX `ProduksiHarianItem_itemId_idx`(`itemId`),
  INDEX `ProduksiHarianItem_sumberLocationId_idx`(`sumberLocationId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `InventoryMovement`
  ADD COLUMN `produksiHarianId` INTEGER NULL;

CREATE INDEX `InventoryMovement_produksiHarianId_idx`
  ON `InventoryMovement`(`produksiHarianId`);

ALTER TABLE `GudangJenisItem`
  ADD CONSTRAINT `GudangJenisItem_gudangId_fkey`
  FOREIGN KEY (`gudangId`) REFERENCES `Gudang`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ProduksiHarian`
  ADD CONSTRAINT `ProduksiHarian_divisiId_fkey`
  FOREIGN KEY (`divisiId`) REFERENCES `Divisi`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ProduksiHarian_tujuanLocationId_fkey`
  FOREIGN KEY (`tujuanLocationId`) REFERENCES `InventoryLocation`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ProduksiHarian_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ProduksiHarianItem`
  ADD CONSTRAINT `ProduksiHarianItem_produksiHarianId_fkey`
  FOREIGN KEY (`produksiHarianId`) REFERENCES `ProduksiHarian`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `ProduksiHarianItem_itemId_fkey`
  FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `ProduksiHarianItem_sumberLocationId_fkey`
  FOREIGN KEY (`sumberLocationId`) REFERENCES `InventoryLocation`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `InventoryMovement`
  ADD CONSTRAINT `InventoryMovement_produksiHarianId_fkey`
  FOREIGN KEY (`produksiHarianId`) REFERENCES `ProduksiHarian`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Stok total = saldo ledger lama + sisa WIP yang belum masuk ledger.
UPDATE `Item` i
SET i.`stok` = COALESCE((
  SELECT SUM(CASE WHEN m.`tipe` = 'MASUK' THEN m.`jumlah` ELSE -m.`jumlah` END)
  FROM `StokItemMutasi` m
  WHERE m.`itemId` = i.`id`
), 0) + COALESCE((
  SELECT SUM(p.`jumlahSisa`)
  FROM `PemakaianMaterialItem` p
  WHERE p.`itemId` = i.`id`
), 0);
