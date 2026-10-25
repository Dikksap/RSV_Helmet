-- Arah transfer WIP: KIRIM (asal mengirim) atau MINTA (tujuan meminta).
ALTER TABLE `WipTransfer`
  ADD COLUMN `arah` ENUM('KIRIM', 'MINTA') NOT NULL DEFAULT 'KIRIM';
