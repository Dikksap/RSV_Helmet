ALTER TABLE `BomItem`
    ADD COLUMN `parentBomItemId` INTEGER NULL,
    ADD COLUMN `level` INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX `BomItem_bomId_id_key` ON `BomItem`(`bomId`, `id`);
CREATE INDEX `BomItem_bomId_parentBomItemId_idx` ON `BomItem`(`bomId`, `parentBomItemId`);

ALTER TABLE `BomItem`
    ADD CONSTRAINT `BomItem_bomId_parentBomItemId_fkey`
    FOREIGN KEY (`bomId`, `parentBomItemId`)
    REFERENCES `BomItem`(`bomId`, `id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE;
