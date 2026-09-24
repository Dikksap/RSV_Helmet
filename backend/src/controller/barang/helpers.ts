import prisma from "../../lib/prisma.js";
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
