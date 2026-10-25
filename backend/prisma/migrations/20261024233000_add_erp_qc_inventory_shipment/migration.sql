-- AlterTable
ALTER TABLE `Barang` ADD COLUMN `qualityInspectionLineId` INTEGER NULL;

-- AlterTable
ALTER TABLE `hasil_produksi_harian` ADD COLUMN `orderId` INTEGER NULL;

-- CreateTable
CREATE TABLE `InventoryLocation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('WAREHOUSE', 'DIVISION') NOT NULL,
    `gudangId` INTEGER NULL,
    `divisiId` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `InventoryLocation_code_key`(`code`),
    UNIQUE INDEX `InventoryLocation_gudangId_key`(`gudangId`),
    UNIQUE INDEX `InventoryLocation_divisiId_key`(`divisiId`),
    INDEX `InventoryLocation_type_isActive_idx`(`type`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InventoryMovement` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `itemId` INTEGER NULL,
    `barangId` INTEGER NULL,
    `fromLocationId` INTEGER NULL,
    `toLocationId` INTEGER NULL,
    `pemakaianMaterialItemId` INTEGER NULL,
    `hasilProduksiHarianId` INTEGER NULL,
    `type` ENUM('OPENING', 'PRODUCTION', 'TRANSFER', 'QC', 'REPAIR', 'SHIPMENT', 'RETURN', 'ADJUSTMENT', 'REVERSAL') NOT NULL,
    `quantity` DECIMAL(18, 6) NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `sourceType` VARCHAR(191) NOT NULL,
    `sourceId` VARCHAR(191) NOT NULL,
    `reason` TEXT NULL,
    `userId` INTEGER NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reversalOfId` BIGINT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `InventoryMovement_idempotencyKey_key`(`idempotencyKey`),
    UNIQUE INDEX `InventoryMovement_reversalOfId_key`(`reversalOfId`),
    INDEX `InventoryMovement_itemId_occurredAt_idx`(`itemId`, `occurredAt`),
    INDEX `InventoryMovement_barangId_occurredAt_idx`(`barangId`, `occurredAt`),
    INDEX `InventoryMovement_fromLocationId_itemId_occurredAt_idx`(`fromLocationId`, `itemId`, `occurredAt`),
    INDEX `InventoryMovement_fromLocationId_barangId_occurredAt_idx`(`fromLocationId`, `barangId`, `occurredAt`),
    INDEX `InventoryMovement_toLocationId_itemId_occurredAt_idx`(`toLocationId`, `itemId`, `occurredAt`),
    INDEX `InventoryMovement_toLocationId_barangId_occurredAt_idx`(`toLocationId`, `barangId`, `occurredAt`),
    INDEX `InventoryMovement_pemakaianMaterialItemId_idx`(`pemakaianMaterialItemId`),
    INDEX `InventoryMovement_hasilProduksiHarianId_idx`(`hasilProduksiHarianId`),
    INDEX `InventoryMovement_sourceType_sourceId_idx`(`sourceType`, `sourceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QualityInspection` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'COMPLETED') NOT NULL DEFAULT 'DRAFT',
    `inspectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `inspectorId` INTEGER NOT NULL,
    `reopenedFromId` INTEGER NULL,
    `reopenReason` TEXT NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `QualityInspection_number_key`(`number`),
    INDEX `QualityInspection_status_inspectedAt_idx`(`status`, `inspectedAt`),
    INDEX `QualityInspection_inspectorId_idx`(`inspectorId`),
    INDEX `QualityInspection_reopenedFromId_idx`(`reopenedFromId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QualityInspectionLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `inspectionId` INTEGER NOT NULL,
    `pemakaianMaterialItemId` INTEGER NULL,
    `barangId` INTEGER NULL,
    `reopenedFromLineId` INTEGER NULL,
    `productVariantId` INTEGER NULL,
    `inspectedQuantity` DECIMAL(18, 6) NOT NULL,
    `passedQuantity` DECIMAL(18, 6) NOT NULL DEFAULT 0,
    `repairQuantity` DECIMAL(18, 6) NOT NULL DEFAULT 0,
    `rejectedQuantity` DECIMAL(18, 6) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QualityInspectionLine_inspectionId_idx`(`inspectionId`),
    INDEX `QualityInspectionLine_pemakaianMaterialItemId_idx`(`pemakaianMaterialItemId`),
    INDEX `QualityInspectionLine_barangId_idx`(`barangId`),
    INDEX `QualityInspectionLine_reopenedFromLineId_idx`(`reopenedFromLineId`),
    INDEX `QualityInspectionLine_productVariantId_idx`(`productVariantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QualityDefect` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `inspectionLineId` INTEGER NOT NULL,
    `description` TEXT NOT NULL,
    `quantity` DECIMAL(18, 6) NOT NULL,
    `foundAtDivisionId` INTEGER NULL,
    `originDivisionId` INTEGER NULL,
    `repairDivisionId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QualityDefect_inspectionLineId_idx`(`inspectionLineId`),
    INDEX `QualityDefect_foundAtDivisionId_idx`(`foundAtDivisionId`),
    INDEX `QualityDefect_originDivisionId_idx`(`originDivisionId`),
    INDEX `QualityDefect_repairDivisionId_idx`(`repairDivisionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RepairAssignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `inspectionLineId` INTEGER NOT NULL,
    `defectId` INTEGER NOT NULL,
    `repairDivisionId` INTEGER NOT NULL,
    `quantity` DECIMAL(18, 6) NOT NULL,
    `status` ENUM('ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'ASSIGNED',
    `assignedById` INTEGER NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `reviewedById` INTEGER NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RepairAssignment_repairDivisionId_status_idx`(`repairDivisionId`, `status`),
    INDEX `RepairAssignment_inspectionLineId_idx`(`inspectionLineId`),
    INDEX `RepairAssignment_defectId_idx`(`defectId`),
    INDEX `RepairAssignment_assignedById_idx`(`assignedById`),
    INDEX `RepairAssignment_reviewedById_idx`(`reviewedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RepairAttempt` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `assignmentId` INTEGER NOT NULL,
    `performedById` INTEGER NOT NULL,
    `outcome` ENUM('REPAIRED', 'PARTIAL', 'FAILED') NOT NULL,
    `quantityAttempted` DECIMAL(18, 6) NOT NULL,
    `quantityRepaired` DECIMAL(18, 6) NOT NULL DEFAULT 0,
    `quantityRemaining` DECIMAL(18, 6) NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `performedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RepairAttempt_assignmentId_performedAt_idx`(`assignmentId`, `performedAt`),
    INDEX `RepairAttempt_performedById_idx`(`performedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Penerimaan FG adalah transaksi eksplisit yang terpisah dari keputusan QC.
CREATE TABLE `FinishedGoodsReceipt` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(191) NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `locationId` INTEGER NOT NULL,
    `receivedById` INTEGER NOT NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `FinishedGoodsReceipt_number_key`(`number`),
    UNIQUE INDEX `FinishedGoodsReceipt_idempotencyKey_key`(`idempotencyKey`),
    INDEX `FinishedGoodsReceipt_locationId_receivedAt_idx`(`locationId`, `receivedAt`),
    INDEX `FinishedGoodsReceipt_receivedById_idx`(`receivedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `FinishedGoodsReceiptLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `receiptId` INTEGER NOT NULL,
    `qualityInspectionLineId` INTEGER NOT NULL,
    `barangId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `FinishedGoodsReceiptLine_receiptId_barangId_key`(`receiptId`, `barangId`),
    INDEX `FinishedGoodsReceiptLine_qualityInspectionLineId_idx`(`qualityInspectionLineId`),
    INDEX `FinishedGoodsReceiptLine_barangId_idx`(`barangId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerShipment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(191) NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `fromLocationId` INTEGER NOT NULL,
    `recipientName` VARCHAR(191) NOT NULL,
    `recipientAddress` TEXT NOT NULL,
    `reference` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'POSTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `createdById` INTEGER NOT NULL,
    `postedById` INTEGER NULL,
    `shippedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancellationReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CustomerShipment_number_key`(`number`),
    UNIQUE INDEX `CustomerShipment_idempotencyKey_key`(`idempotencyKey`),
    INDEX `CustomerShipment_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `CustomerShipment_createdById_idx`(`createdById`),
    INDEX `CustomerShipment_postedById_idx`(`postedById`),
    INDEX `CustomerShipment_fromLocationId_status_idx`(`fromLocationId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerShipmentLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `shipmentId` INTEGER NOT NULL,
    `barangId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CustomerShipmentLine_barangId_idx`(`barangId`),
    UNIQUE INDEX `CustomerShipmentLine_shipmentId_barangId_key`(`shipmentId`, `barangId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShipmentReturn` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(191) NOT NULL,
    `shipmentId` INTEGER NOT NULL,
    `toLocationId` INTEGER NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `receivedById` INTEGER NOT NULL,
    `status` ENUM('RECEIVED', 'INSPECTED', 'REJECTED') NOT NULL DEFAULT 'RECEIVED',
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reason` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ShipmentReturn_number_key`(`number`),
    UNIQUE INDEX `ShipmentReturn_idempotencyKey_key`(`idempotencyKey`),
    INDEX `ShipmentReturn_shipmentId_receivedAt_idx`(`shipmentId`, `receivedAt`),
    INDEX `ShipmentReturn_receivedById_idx`(`receivedById`),
    INDEX `ShipmentReturn_toLocationId_receivedAt_idx`(`toLocationId`, `receivedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShipmentReturnLine` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `returnId` INTEGER NOT NULL,
    `shipmentLineId` INTEGER NOT NULL,
    `condition` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ShipmentReturnLine_shipmentLineId_key`(`shipmentLineId`),
    INDEX `ShipmentReturnLine_returnId_idx`(`returnId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `QualityInspectionLine` ADD CONSTRAINT `QualityInspectionLine_quantity_check` CHECK (
    `inspectedQuantity` > 0 AND
    `passedQuantity` >= 0 AND
    `repairQuantity` >= 0 AND
    `rejectedQuantity` >= 0
);

-- Permission inventory: admin memperoleh seluruh permission melalui authorize;
-- role gudang diberi akses baca, transfer, dan penyesuaian.
INSERT IGNORE INTO `Permission` (`kode`, `nama`, `kelompok`, `createdAt`, `updatedAt`) VALUES
('INVENTORY_VIEW', 'Lihat saldo dan mutasi inventory', 'INVENTORY', NOW(3), NOW(3)),
('INVENTORY_MOVE', 'Memindahkan stok antar lokasi', 'INVENTORY', NOW(3), NOW(3)),
('INVENTORY_ADJUST', 'Mencatat saldo awal dan penyesuaian inventory', 'INVENTORY', NOW(3), NOW(3)),
('INVENTORY_LOCATION_MANAGE', 'Memetakan master ke lokasi inventory', 'INVENTORY', NOW(3), NOW(3)),
('QUALITY_VIEW', 'Melihat inspeksi QC', 'QUALITY', NOW(3), NOW(3)),
('QUALITY_INSPECT', 'Mencatat hasil inspeksi QC', 'QUALITY', NOW(3), NOW(3)),
('QUALITY_FINALIZE', 'Memfinalkan keputusan QC', 'QUALITY', NOW(3), NOW(3)),
('QUALITY_REOPEN', 'Membuka ulang reject final QC', 'QUALITY', NOW(3), NOW(3)),
('REPAIR_ASSIGN', 'Menugaskan perbaikan hasil QC', 'REPAIR', NOW(3), NOW(3)),
('REPAIR_WORK', 'Mengerjakan penugasan repair sesuai divisi', 'REPAIR', NOW(3), NOW(3)),
('SHIPMENT_VIEW', 'Melihat shipment pelanggan', 'SHIPMENT', NOW(3), NOW(3)),
('SHIPMENT_MANAGE', 'Mengelola draft shipment pelanggan', 'SHIPMENT', NOW(3), NOW(3)),
('SHIPMENT_POST', 'Memosting pengiriman pelanggan', 'SHIPMENT', NOW(3), NOW(3)),
('SHIPMENT_RETURN', 'Mencatat retur shipment pelanggan', 'SHIPMENT', NOW(3), NOW(3));

INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
SELECT role.`id`, permission.`id`
FROM `Role` AS role
JOIN `Permission` AS permission ON
    (role.`kode` = 'gudang' AND permission.`kode` IN (
        'INVENTORY_VIEW', 'INVENTORY_MOVE', 'INVENTORY_ADJUST',
        'SHIPMENT_VIEW', 'SHIPMENT_MANAGE', 'SHIPMENT_POST', 'SHIPMENT_RETURN'
    )) OR
    (role.`kode` = 'qc' AND permission.`kode` IN (
        'QUALITY_VIEW', 'QUALITY_INSPECT', 'QUALITY_FINALIZE', 'QUALITY_REOPEN', 'REPAIR_ASSIGN'
    )) OR
    (role.`kode` = 'produksi' AND permission.`kode` = 'REPAIR_WORK');

-- CreateIndex
CREATE INDEX `Barang_qualityInspectionLineId_idx` ON `Barang`(`qualityInspectionLineId`);

-- CreateIndex
CREATE INDEX `hasil_produksi_harian_orderId_tanggalProduksi_idx` ON `hasil_produksi_harian`(`orderId`, `tanggalProduksi`);

-- AddForeignKey
ALTER TABLE `Barang` ADD CONSTRAINT `Barang_qualityInspectionLineId_fkey` FOREIGN KEY (`qualityInspectionLineId`) REFERENCES `QualityInspectionLine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hasil_produksi_harian` ADD CONSTRAINT `hasil_produksi_harian_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `ProductionOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryLocation` ADD CONSTRAINT `InventoryLocation_gudangId_fkey` FOREIGN KEY (`gudangId`) REFERENCES `Gudang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryLocation` ADD CONSTRAINT `InventoryLocation_divisiId_fkey` FOREIGN KEY (`divisiId`) REFERENCES `Divisi`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_itemId_fkey` FOREIGN KEY (`itemId`) REFERENCES `Item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Satu gerakan mewakili tepat satu jenis saldo: item kuantitas atau helm individual.
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_barangId_fkey` FOREIGN KEY (`barangId`) REFERENCES `Barang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_quantity_check` CHECK (`quantity` > 0);

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_fromLocationId_fkey` FOREIGN KEY (`fromLocationId`) REFERENCES `InventoryLocation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_toLocationId_fkey` FOREIGN KEY (`toLocationId`) REFERENCES `InventoryLocation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_pemakaianMaterialItemId_fkey` FOREIGN KEY (`pemakaianMaterialItemId`) REFERENCES `PemakaianMaterialItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_hasilProduksiHarianId_fkey` FOREIGN KEY (`hasilProduksiHarianId`) REFERENCES `hasil_produksi_harian`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InventoryMovement` ADD CONSTRAINT `InventoryMovement_reversalOfId_fkey` FOREIGN KEY (`reversalOfId`) REFERENCES `InventoryMovement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QualityInspection` ADD CONSTRAINT `QualityInspection_inspectorId_fkey` FOREIGN KEY (`inspectorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QualityInspection` ADD CONSTRAINT `QualityInspection_reopenedFromId_fkey` FOREIGN KEY (`reopenedFromId`) REFERENCES `QualityInspection`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QualityInspectionLine` ADD CONSTRAINT `QualityInspectionLine_inspectionId_fkey` FOREIGN KEY (`inspectionId`) REFERENCES `QualityInspection`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QualityInspectionLine` ADD CONSTRAINT `QualityInspectionLine_pemakaianMaterialItemId_fkey` FOREIGN KEY (`pemakaianMaterialItemId`) REFERENCES `PemakaianMaterialItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `QualityInspectionLine` ADD CONSTRAINT `QualityInspectionLine_barangId_fkey` FOREIGN KEY (`barangId`) REFERENCES `Barang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `QualityInspectionLine` ADD CONSTRAINT `QualityInspectionLine_reopenedFromLineId_fkey` FOREIGN KEY (`reopenedFromLineId`) REFERENCES `QualityInspectionLine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QualityInspectionLine` ADD CONSTRAINT `QualityInspectionLine_productVariantId_fkey` FOREIGN KEY (`productVariantId`) REFERENCES `ProductVariant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QualityDefect` ADD CONSTRAINT `QualityDefect_inspectionLineId_fkey` FOREIGN KEY (`inspectionLineId`) REFERENCES `QualityInspectionLine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QualityDefect` ADD CONSTRAINT `QualityDefect_foundAtDivisionId_fkey` FOREIGN KEY (`foundAtDivisionId`) REFERENCES `Divisi`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QualityDefect` ADD CONSTRAINT `QualityDefect_originDivisionId_fkey` FOREIGN KEY (`originDivisionId`) REFERENCES `Divisi`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QualityDefect` ADD CONSTRAINT `QualityDefect_repairDivisionId_fkey` FOREIGN KEY (`repairDivisionId`) REFERENCES `Divisi`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RepairAssignment` ADD CONSTRAINT `RepairAssignment_inspectionLineId_fkey` FOREIGN KEY (`inspectionLineId`) REFERENCES `QualityInspectionLine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RepairAssignment` ADD CONSTRAINT `RepairAssignment_defectId_fkey` FOREIGN KEY (`defectId`) REFERENCES `QualityDefect`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RepairAssignment` ADD CONSTRAINT `RepairAssignment_repairDivisionId_fkey` FOREIGN KEY (`repairDivisionId`) REFERENCES `Divisi`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RepairAssignment` ADD CONSTRAINT `RepairAssignment_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `RepairAssignment` ADD CONSTRAINT `RepairAssignment_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RepairAttempt` ADD CONSTRAINT `RepairAttempt_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `RepairAssignment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RepairAttempt` ADD CONSTRAINT `RepairAttempt_performedById_fkey` FOREIGN KEY (`performedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `RepairAttempt` ADD CONSTRAINT `RepairAttempt_quantity_check` CHECK (
    `quantityAttempted` > 0 AND
    `quantityRepaired` >= 0 AND
    `quantityRemaining` >= 0 AND
    `quantityRepaired` + `quantityRemaining` = `quantityAttempted`
);

ALTER TABLE `FinishedGoodsReceipt` ADD CONSTRAINT `FinishedGoodsReceipt_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `InventoryLocation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `FinishedGoodsReceipt` ADD CONSTRAINT `FinishedGoodsReceipt_receivedById_fkey` FOREIGN KEY (`receivedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `FinishedGoodsReceiptLine` ADD CONSTRAINT `FinishedGoodsReceiptLine_receiptId_fkey` FOREIGN KEY (`receiptId`) REFERENCES `FinishedGoodsReceipt`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `FinishedGoodsReceiptLine` ADD CONSTRAINT `FinishedGoodsReceiptLine_qualityInspectionLineId_fkey` FOREIGN KEY (`qualityInspectionLineId`) REFERENCES `QualityInspectionLine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `FinishedGoodsReceiptLine` ADD CONSTRAINT `FinishedGoodsReceiptLine_barangId_fkey` FOREIGN KEY (`barangId`) REFERENCES `Barang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerShipment` ADD CONSTRAINT `CustomerShipment_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerShipment` ADD CONSTRAINT `CustomerShipment_postedById_fkey` FOREIGN KEY (`postedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `CustomerShipment` ADD CONSTRAINT `CustomerShipment_fromLocationId_fkey` FOREIGN KEY (`fromLocationId`) REFERENCES `InventoryLocation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerShipmentLine` ADD CONSTRAINT `CustomerShipmentLine_shipmentId_fkey` FOREIGN KEY (`shipmentId`) REFERENCES `CustomerShipment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerShipmentLine` ADD CONSTRAINT `CustomerShipmentLine_barangId_fkey` FOREIGN KEY (`barangId`) REFERENCES `Barang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentReturn` ADD CONSTRAINT `ShipmentReturn_shipmentId_fkey` FOREIGN KEY (`shipmentId`) REFERENCES `CustomerShipment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentReturn` ADD CONSTRAINT `ShipmentReturn_receivedById_fkey` FOREIGN KEY (`receivedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ShipmentReturn` ADD CONSTRAINT `ShipmentReturn_toLocationId_fkey` FOREIGN KEY (`toLocationId`) REFERENCES `InventoryLocation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentReturnLine` ADD CONSTRAINT `ShipmentReturnLine_returnId_fkey` FOREIGN KEY (`returnId`) REFERENCES `ShipmentReturn`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentReturnLine` ADD CONSTRAINT `ShipmentReturnLine_shipmentLineId_fkey` FOREIGN KEY (`shipmentLineId`) REFERENCES `CustomerShipmentLine`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
