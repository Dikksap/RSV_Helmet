-- CreateIndex
CREATE INDEX `Barang_tanggal_variantId_status_idx` ON `Barang`(`tanggal`, `variantId`, `status`);

-- CreateIndex
CREATE INDEX `RiwayatBarang_status_fkey` ON `RiwayatBarang`(`status`);
