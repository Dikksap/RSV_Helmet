import type { NextFunction, Request, Response } from "express";
import { verifyToken, type TokenPayload } from "../lib/jwt.js";
import { isTokenRevoked } from "../lib/tokenBlacklist.js";

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
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

export async function adminOnly(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Token tidak ditemukan" });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Akses ditolak. Memerlukan akses admin." });
  }

  next();
}