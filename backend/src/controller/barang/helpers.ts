import prisma from "../../lib/prisma.js";
import type { Request } from "express";
import type { StatusBarang } from "../../model/barang/barang.status.js";

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function errorStatus(message: string): number {
  if (message.includes("tidak ditemukan")) return 404;
  if (
    message.includes("tidak valid") ||
    message.includes("Jumlah") ||
    message.includes("wajib")
  )
    return 400;
  return 500;
}

export async function isValidStatus(status: unknown): Promise<boolean> {
  if (typeof status !== "string" || !status.trim()) return false;
  const kode = status.trim().toUpperCase();
  const row = await prisma.statusBarang.findUnique({ where: { kode } });
  return !!row && row.isActive;
}

export async function getValidStatusList(): Promise<string> {
  const rows = await prisma.statusBarang.findMany({
    where: { isActive: true },
    select: { kode: true },
    orderBy: { urutan: "asc" },
  });
  return rows.map((r) => r.kode).join(", ");
}

/**
 * Scope visibilitas status barang pemanggil. `null` = semua status boleh
 * dilihat (role admin). Tanpa `req.access` (authorize belum dipasang)
 * dianggap deny semua supaya gagal tertutup, bukan terbuka.
 */
export function barangScope(req: Request): string[] | null {
  return req.access ? req.access.statusView : [];
}

export function isStatusInView(scope: string[] | null, status: unknown): boolean {
  if (scope === null) return true;
  return typeof status === "string" && scope.includes(status.trim().toUpperCase());
}

export function statusDeniedMessage(status: string): string {
  return `Status '${status}' tidak diizinkan untuk role Anda`;
}

