-- Pecah tahap: "PERSIAPAN (BUFFING + BASECOAT)" -> BUFFING + BASE COAT
--              "TOP COAT + PERAKITAN"           -> TOP COAT + PERAKITAN (mandiri)
-- Nilai kapasitas hasil split diduplikasi (bukan dibagi dua): tiap tahap dianggap lini sendiri.

INSERT INTO `ProductionCapacity`
  (`orderId`, `stage`, `kapasitasWeekday`, `kapasitasSabtu`, `mulai`, `selesai`, `hariKerja`, `totalKapasitas`, `catatan`, `urutan`, `createdAt`, `updatedAt`)
SELECT `orderId`, 'BASE COAT', `kapasitasWeekday`, `kapasitasSabtu`, `mulai`, `selesai`, `hariKerja`, `totalKapasitas`, `catatan`, `urutan`, NOW(), NOW()
FROM `ProductionCapacity`
WHERE `stage` LIKE '%PERSIAPAN%';

UPDATE `ProductionCapacity` SET `stage` = 'BUFFING' WHERE `stage` LIKE '%PERSIAPAN%';

INSERT INTO `ProductionCapacity`
  (`orderId`, `stage`, `kapasitasWeekday`, `kapasitasSabtu`, `mulai`, `selesai`, `hariKerja`, `totalKapasitas`, `catatan`, `urutan`, `createdAt`, `updatedAt`)
SELECT `orderId`, 'PERAKITAN', `kapasitasWeekday`, `kapasitasSabtu`, `mulai`, `selesai`, `hariKerja`, `totalKapasitas`, `catatan`, `urutan`, NOW(), NOW()
FROM `ProductionCapacity`
WHERE `stage` LIKE '%TOP COAT%PERAKITAN%';

UPDATE `ProductionCapacity` SET `stage` = 'TOP COAT' WHERE `stage` LIKE '%TOP COAT%PERAKITAN%';

UPDATE `ProductionCapacity` SET `urutan` = CASE `stage`
  WHEN 'BUFFING' THEN 1
  WHEN 'BASE COAT' THEN 2
  WHEN 'DECAL SOLID' THEN 3
  WHEN 'DECAL MOTIF' THEN 4
  WHEN 'TOP COAT' THEN 5
  WHEN 'PERAKITAN' THEN 6
  WHEN 'QC' THEN 7
  ELSE `urutan`
END;

-- Realisasi tahap lama 'persiapan' tidak bisa dipecah → semuanya masuk 'buffing'.
UPDATE `ProductionRealizationStage` SET `stage` = 'buffing' WHERE `stage` = 'persiapan';
