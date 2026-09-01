import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { findUserByEmail } from "../../model/user/user.js";
import { signToken } from "../../lib/jwt.js";
import { revokeToken } from "../../lib/tokenBlacklist.js";

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Field 'email' wajib diisi" });
    }

    if (!password || typeof password !== "string") {
      return res.status(400).json({ message: "Field 'password' wajib diisi" });
    }

    const user = await findUserByEmail(email);

    if (!user) {
      return res.status(401).json({ message: "Email atau password salah" });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ message: "Email atau password salah" });
    }

    const token = signToken({ id: user.id, email: user.email, name: user.name, role: user.role });

    res.status(200).json({
      message: "Login berhasil",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Gagal login", error });
  }
}

export async function logout(req: Request, res: Response) {
  const header = req.headers.authorization;
  const token = header!.slice("Bearer ".length).trim();

  await revokeToken(token, req.user?.exp ?? Math.floor(Date.now() / 1000));

  res.status(200).json({ message: "Logout berhasil" });
}