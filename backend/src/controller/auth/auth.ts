import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { findUserByEmail, findUserByIdWithPassword, getUserById, updateUser } from "../../model/user/user.js";
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
        divisiId: user.divisiId ?? null,
        divisi: user.divisi ?? null,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Gagal login", error });
  }
}

/**
 * Dibaca dari database, bukan dari payload token: nama/email di token basi
 * setelah user mengubah profilnya sendiri, dan `checkSession` frontend memakai
 * respons ini untuk menimpa penyimpanan lokal.
 */
export async function me(req: Request, res: Response) {
  const { id, exp } = req.user!;

  try {
    const user = await getUserById(id);

    if (!user) {
      return res.status(401).json({ message: "Akun tidak ditemukan" });
    }

    res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        divisiId: user.divisiId ?? null,
        divisi: user.divisi ?? null,
      },
      permissions: req.access?.permissions ?? [],
      statusView: req.access?.statusView ?? null,
      exp,
    });
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data user", error });
  }
}

// PUT /api/auth/me — ubah profil sendiri (nama/email dan/atau password)
export async function updateMe(req: Request, res: Response) {
  try {
    const id = req.user!.id;
    const { name, email, currentPassword, newPassword } = req.body ?? {};

    if (name === undefined && email === undefined && newPassword === undefined) {
      return res.status(400).json({ message: "Minimal satu field: name, email, atau newPassword" });
    }
    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return res.status(400).json({ message: "Field 'name' tidak valid" });
    }
    if (email !== undefined && (typeof email !== "string" || !email.trim())) {
      return res.status(400).json({ message: "Field 'email' tidak valid" });
    }
    if (newPassword !== undefined && (typeof newPassword !== "string" || newPassword.length < 6)) {
      return res.status(400).json({ message: "Field 'newPassword' minimal 6 karakter" });
    }

    let password: string | undefined;
    if (newPassword !== undefined) {
      if (typeof currentPassword !== "string" || !currentPassword) {
        return res.status(400).json({ message: "Field 'currentPassword' wajib diisi untuk ganti password" });
      }

      const current = await findUserByIdWithPassword(id);
      if (!current) {
        return res.status(401).json({ message: "Akun tidak ditemukan" });
      }
      if (!(await bcrypt.compare(currentPassword, current.password))) {
        return res.status(400).json({ message: "Password lama salah" });
      }

      password = newPassword;
    }

    const user = await updateUser(id, {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(email !== undefined ? { email: email.trim() } : {}),
      ...(password !== undefined ? { password } : {}),
    });

    res.status(200).json({ message: "Profil diperbarui", user });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Email sudah terdaftar" });
    }
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }
    res.status(500).json({ message: "Gagal memperbarui profil", error });
  }
}

export async function logout(req: Request, res: Response) {
  const header = req.headers.authorization;
  const token = header!.slice("Bearer ".length).trim();

  await revokeToken(token, req.user?.exp ?? Math.floor(Date.now() / 1000));

  res.status(200).json({ message: "Logout berhasil" });
}