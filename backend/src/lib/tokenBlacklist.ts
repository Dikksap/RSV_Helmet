import { createHash } from "node:crypto";
import redis from "./redis.js";

// =============================================
// Token blacklist (JWT revocation via Redis)
// Key: blacklist:<sha256(token)>
// Entry kadaluarsa otomatis — SETEX TTL = sisa
// umur token, tidak perlu job pembersihan.
// =============================================

const PREFIX = "blacklist:";

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Cabut token sampai waktu kedaluwarsanya (unix detik). Best-effort. */
export async function revokeToken(token: string, expSeconds: number): Promise<void> {
  const ttl = expSeconds - Math.floor(Date.now() / 1000);
  if (ttl <= 0) return;

  try {
    await redis.setex(PREFIX + tokenHash(token), ttl, "1");
  } catch (error) {
    // Fail-open: gagal revoke tidak boleh memblokir response logout.
    console.error("Gagal revoke token:", (error as Error).message);
  }
}

/** Cek apakah token sudah pernah logout. Fail-open saat Redis mati. */
export async function isTokenRevoked(token: string): Promise<boolean> {
  try {
    return (await redis.exists(PREFIX + tokenHash(token))) === 1;
  } catch (error) {
    console.error("Gagal cek blacklist token:", (error as Error).message);
    return false;
  }
}
