import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { findUserByEmail, findUserByIdWithPassword, getUserById, updateUser } from "../../model/user/user.js";
import { signToken } from "../../lib/jwt.js";
import { revokeToken } from "../../lib/tokenBlacklist.js";
import {
  InvalidImageError,
  removeStoredImage,
  resolveStoredImagePath,
  saveOptimizedImage,
} from "../../lib/imageStorage.js";
import { getUserAvatarPath, setUserAvatarPath } from "../../model/user/user.js";

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
        avatarUrl: user.avatarPath ? "/api/auth/me/avatar" : null,
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
        avatarUrl: (await getUserAvatarPath(id)) ? "/api/auth/me/avatar" : null,
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

    const avatarPath = await getUserAvatarPath(id);
    res.status(200).json({
      message: "Profil diperbarui",
      user: { ...user, avatarUrl: avatarPath ? "/api/auth/me/avatar" : null },
    });
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

// GET /api/auth/me/avatar — file hanya untuk sesi pengguna yang sedang login.
export async function getMyAvatar(req: Request, res: Response) {
  try {
    const avatarPath = await getUserAvatarPath(req.user!.id);
    if (!avatarPath) return res.status(404).json({ message: "Avatar belum diunggah" });
    res.set({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
    res.type("image/webp").sendFile(resolveStoredImagePath(avatarPath), (error) => {
      if (!error || res.headersSent) return;
      if ("code" in error && error.code === "ENOENT") {
        res.status(404).json({ message: "File avatar tidak ditemukan" });
        return;
      }
      console.error("Gagal mengirim gambar avatar:", error);
      res.status(500).json({ message: "Gagal mengambil gambar avatar" });
    });
  } catch (error) {
    console.error("Gagal mengambil gambar avatar:", error);
    res.status(500).json({ message: "Gagal mengambil gambar avatar" });
  }
}

// POST /api/auth/me/avatar — setiap avatar dinormalisasi menjadi WebP.
export async function uploadMyAvatar(req: Request, res: Response) {
  if (!req.file) return res.status(400).json({ message: "Pilih gambar untuk diunggah" });
  let newPath: string | null = null;
  try {
    newPath = await saveOptimizedImage(req.file.buffer, "avatars");
    const userId = req.user!.id;
    const oldPath = await getUserAvatarPath(userId);
    await setUserAvatarPath(userId, newPath);
    try {
      await removeStoredImage(oldPath);
    } catch (error) {
      console.error("Avatar lama gagal dibersihkan:", error);
    }
    return res.status(200).json({
      message: "Avatar berhasil diperbarui",
      avatarUrl: "/api/auth/me/avatar",
    });
  } catch (error) {
    if (newPath) {
      try {
        await removeStoredImage(newPath);
      } catch (cleanupError) {
        console.error("Gambar avatar yang gagal disimpan tidak dapat dibersihkan:", cleanupError);
      }
    }
    if (error instanceof InvalidImageError) {
      return res.status(400).json({ message: error.message });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") {
      return res.status(404).json({ message: "Akun tidak ditemukan" });
    }
    console.error("Gagal menyimpan avatar:", error);
    return res.status(500).json({ message: "Gagal menyimpan avatar" });
  }
}

export async function deleteMyAvatar(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const oldPath = await getUserAvatarPath(userId);
    await setUserAvatarPath(userId, null);
    try {
      await removeStoredImage(oldPath);
    } catch (error) {
      console.error("File avatar lama gagal dibersihkan:", error);
    }
    return res.status(200).json({ message: "Avatar berhasil dihapus" });
  } catch (error) {
    console.error("Gagal menghapus avatar:", error);
    return res.status(500).json({ message: "Gagal menghapus avatar" });
  }
}

export async function logout(req: Request, res: Response) {
  const header = req.headers.authorization;
  const token = header!.slice("Bearer ".length).trim();

  await revokeToken(token, req.user?.exp ?? Math.floor(Date.now() / 1000));

  res.status(200).json({ message: "Logout berhasil" });
}