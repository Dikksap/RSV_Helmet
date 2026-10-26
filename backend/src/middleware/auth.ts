import type { NextFunction, Request, Response } from "express";
import { verifyToken, type TokenPayload } from "../lib/jwt.js";
import { isTokenRevoked } from "../lib/tokenBlacklist.js";
import { getUserRole } from "../model/user/user.js";
import { ADMIN_ROLE, getRoleAccess, type RoleAccess } from "../model/role/role.js";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      access?: RoleAccess;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token tidak ditemukan" });
  }

  const token = header.slice("Bearer ".length).trim();

  try {
    const payload = verifyToken(token);

    if (await isTokenRevoked(token)) {
      return res.status(401).json({ message: "Token sudah logout" });
    }

    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: "Token tidak valid atau kedaluwarsa" });
  }
}

/**
 * Gate akses berbasis role. Role dibaca ulang dari database, bukan dari token,
 * supaya perubahan role (atau penghapusan akun) langsung berlaku tanpa menunggu
 * JWT kedaluwarsa. Wajib dipasang setelah `authenticate`.
 */
export function requireRole(...allowed: readonly string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Token tidak ditemukan" });
    }

    let role: string | null;
    try {
      role = await getUserRole(req.user.id);
    } catch (error) {
      res.status(500).json({ message: "Gagal memverifikasi role", error });
      return;
    }

    if (!role) {
      return res.status(401).json({ message: "Akun tidak ditemukan" });
    }

    req.user.role = role;

    if (!allowed.includes(role)) {
      return res.status(403).json({ message: `Akses ditolak. Memerlukan role: ${allowed.join(", ")}.` });
    }

    next();
  };
}

export const adminOnly = requireRole("admin");

/**
 * Muat role, permission, dan scope visibilitas status barang dari database,
 * lalu tempel di `req.access`. Wajib dipasang setelah `authenticate` dan
 * sebelum `requirePermission`. Role di `req.user` ikut disegarkan supaya
 * `me` dan log audit tidak memakai role basi dari token.
 */
export async function authorize(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Token tidak ditemukan" });
  }

  let access: RoleAccess | null;
  try {
    access = await getRoleAccess(req.user.id);
  } catch (error) {
    res.status(500).json({ message: "Gagal memverifikasi permission", error });
    return;
  }

  if (!access) {
    return res.status(401).json({ message: "Akun tidak ditemukan" });
  }

  req.user.role = access.role;
  req.access = access;
  next();
}

/**
 * Gate akses berbasis permission. Semantik sama dengan `requireRole`:
 * beberapa kode berarti "salah satu cukup". Role admin otomatis punya
 * seluruh permission (lihat model/role/role.ts).
 */
export function requirePermission(...allowed: readonly string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const access = req.access;
    if (!access) {
      return res.status(401).json({ message: "Token tidak ditemukan" });
    }

    if (
      access.role !== ADMIN_ROLE &&
      !allowed.some((kode) => access.permissions.includes(kode))
    ) {
      return res.status(403).json({ message: `Akses ditolak. Memerlukan permission: ${allowed.join(", ")}.` });
    }

    next();
  };
}
