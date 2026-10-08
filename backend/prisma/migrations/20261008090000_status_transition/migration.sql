-- CreateTable
CREATE TABLE `StatusTransition` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fromKode` VARCHAR(191) NOT NULL,
    `toKode` VARCHAR(191) NOT NULL,

    INDEX `StatusTransition_fromKode_idx`(`fromKode`),
    INDEX `StatusTransition_toKode_idx`(`toKode`),
    UNIQUE INDEX `StatusTransition_fromKode_toKode_key`(`fromKode`, `toKode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StatusTransition` ADD CONSTRAINT `StatusTransition_fromKode_fkey` FOREIGN KEY (`fromKode`) REFERENCES `StatusBarang`(`kode`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `StatusTransition` ADD CONSTRAINT `StatusTransition_toKode_fkey` FOREIGN KEY (`toKode`) REFERENCES `StatusBarang`(`kode`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed transisi awal (dari kanon sebelumnya)
INSERT INTO `StatusTransition` (`fromKode`, `toKode`) VALUES
('REGISTER','FINISHGOOD'),('REGISTER','OUT'),('REGISTER','RETUR'),('REGISTER','BAD'),
('FINISHGOOD','OUT'),('FINISHGOOD','RETUR'),('FINISHGOOD','BAD'),('FINISHGOOD','FINISHGOOD'),
('RETUR','FINISHGOOD'),('RETUR','OUT'),('RETUR','BAD'),
('OUT','RETUR'),('OUT','FINISHGOOD'),('OUT','BAD'),
('BAD','FINISHGOOD');
