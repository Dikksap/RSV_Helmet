INSERT INTO `Permission` (`kode`, `nama`, `kelompok`, `createdAt`, `updatedAt`)
VALUES (
  'QUALITY_ROUTING_MANAGE',
  'Mengelola routing proses QC dan BOM',
  'QUALITY',
  NOW(3),
  NOW(3)
)
ON DUPLICATE KEY UPDATE
  `nama` = VALUES(`nama`),
  `kelompok` = VALUES(`kelompok`);
