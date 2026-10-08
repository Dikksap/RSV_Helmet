import redis from "./redis.js";

// Notifikasi admin dipersist agar bertahan setelah refresh dan bisa dibaca
// dari device lain. ZSET dipakai supaya masa berlaku 24 jam berlaku per item
// (score = timestamp) — LIST + EXPIRE akan mereset umur seluruh riwayat setiap
// kali ada event baru, sehingga item tua tidak pernah benar-benar kedaluwarsa.

const LIST_KEY = "notif:list";
const SEQ_KEY = "notif:seq";

export const NOTIF_TTL_SECONDS = 24 * 60 * 60;
export const NOTIF_MAX_ITEMS = 100;
export const NOTIF_RETURN_COUNT = 20;

export type StoredNotif = {
  id: number;
  type: string;
  message: string;
  data: unknown;
  ts: number;
};

export async function pushNotif(
  event: Omit<StoredNotif, "id" | "ts">,
): Promise<number | null> {
  try {
    const id = await redis.incr(SEQ_KEY);
    const ts = Date.now();
    await redis.zadd(LIST_KEY, ts, JSON.stringify({ ...event, id, ts }));
    await redis.expire(LIST_KEY, NOTIF_TTL_SECONDS);
    return id;
  } catch {
    // fail-open: tanpa id pun event tetap harus sampai ke client lewat WS
    return null;
  }
}

export async function listNotifs(): Promise<StoredNotif[]> {
  try {
    await redis.zremrangebyscore(
      LIST_KEY,
      0,
      Date.now() - NOTIF_TTL_SECONDS * 1000,
    );
    const total = await redis.zcard(LIST_KEY);
    if (total > NOTIF_MAX_ITEMS) {
      await redis.zremrangebyrank(LIST_KEY, 0, -(NOTIF_MAX_ITEMS + 1));
    }
    const rows = await redis.zrevrange(LIST_KEY, 0, NOTIF_RETURN_COUNT - 1);
    // Parse per baris: satu member rusak tidak boleh menghapus seluruh riwayat
    return rows.flatMap((row) => {
      try {
        const notif = JSON.parse(row) as StoredNotif;
        return Number.isInteger(notif.id) ? [notif] : [];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

export async function clearNotifs(): Promise<void> {
  try {
    await redis.del(LIST_KEY);
  } catch {
    // fail-open
  }
}
