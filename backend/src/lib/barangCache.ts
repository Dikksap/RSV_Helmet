import redis from "./redis.js";

// Cache read-heavy barang agar list/search/stats tidak selalu ke DB.
// TTL pendek (15-30 dtk) + invalidasi tiap write, pola sama seperti
// products:all / variantproduk:* di model lain.

const PREFIX = "barang:";
export const BARANG_TTL_LIST = 15;
export const BARANG_TTL_STATS = 30;

export function barangListKey(filter: Record<string, unknown>): string {
  const parts = Object.keys(filter)
    .sort()
    .map((k) => {
      const v = filter[k];
      return `${k}=${v instanceof Date ? v.toISOString() : String(v)}`;
    });
  return `${PREFIX}list:${parts.join("&") || "all"}`;
}

export function barangSearchKey(q: string, limit: number): string {
  return `${PREFIX}search:${q.toLowerCase()}:${limit}`;
}

export function barangStatsKey(scope: string, filter: Record<string, unknown>): string {
  const parts = Object.keys(filter)
    .sort()
    .map((k) => `${k}=${String(filter[k])}`);
  return `${PREFIX}${scope}:${parts.join("&") || "all"}`;
}

export async function getBarangCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setBarangCache(key: string, value: unknown, ttl: number): Promise<void> {
  try {
    await redis.setex(key, ttl, JSON.stringify(value));
  } catch {
    // fail-open: cache gagal tidak boleh menggagalkan request
  }
}

export async function clearBarangCache(): Promise<void> {
  try {
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", `${PREFIX}*`, "COUNT", 100);
      cursor = next;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== "0");
  } catch {
    // fail-open
  }
}
