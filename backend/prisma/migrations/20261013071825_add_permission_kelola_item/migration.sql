/*
  Warnings:

  - You are about to drop the column `pdfGeneratedAt` on the `PermintaanBarang` table. All the data in the column will be lost.
  - You are about to drop the column `pdfPath` on the `PermintaanBarang` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `PermintaanBarang` DROP COLUMN `pdfGeneratedAt`,
    DROP COLUMN `pdfPath`;
