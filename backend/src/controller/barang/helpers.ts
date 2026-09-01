import {
  VALID_STATUSES,
  type StatusBarang,
} from "../../model/barang/barang.js";

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

export function isValidStatus(status: unknown): status is StatusBarang {
  return (
    typeof status === "string" &&
    VALID_STATUSES.includes(status as StatusBarang)
  );
}
