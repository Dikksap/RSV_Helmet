import type { Request, Response } from "express";
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from "../../model/user/user.js";

const ROLES = ["admin", "user"] as const;

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /api/users
export async function getUsersHandler(_req: Request, res: Response) {
  try {
    const users = await getAllUsers();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data user", error });
  }
}

// GET /api/users/:id
export async function getUserDetail(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "ID harus angka bulat positif" });
    }
    const user = await getUserById(id);
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data user", error });
  }
}

function validateCreate(body: any): { error: string } | { data: { name: string; email: string; password: string; role: string } } {
  const { name, email, password, role } = body ?? {};
  if (!name || typeof name !== "string" || !name.trim()) return { error: "Field 'name' wajib diisi" };
  if (!email || typeof email !== "string" || !email.trim()) return { error: "Field 'email' wajib diisi" };
  if (!password || typeof password !== "string" || password.length < 6) return { error: "Field 'password' wajib diisi minimal 6 karakter" };
  if (role !== undefined && !ROLES.includes(role)) return { error: "Field 'role' harus 'admin' atau 'user'" };
  return { data: { name: name.trim(), email: email.trim(), password, role: role ?? "user" } };
}

// POST /api/users
export async function createUserHandler(req: Request, res: Response) {
  try {
    const parsed = validateCreate(req.body);
    if ("error" in parsed) {
      return res.status(400).json({ message: parsed.error });
    }
    const user = await createUser(parsed.data);
    res.status(201).json(user);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Email sudah terdaftar" });
    }
    res.status(500).json({ message: "Gagal membuat user", error });
  }
}

// PUT /api/users/:id
export async function updateUserHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "ID harus angka bulat positif" });
    }
    const { name, email, password, role } = req.body ?? {};
    if (name === undefined && email === undefined && password === undefined && role === undefined) {
      return res.status(400).json({ message: "Minimal satu field: name, email, password, role" });
    }
    if (name !== undefined && (typeof name !== "string" || !name.trim())) return res.status(400).json({ message: "Field 'name' tidak valid" });
    if (email !== undefined && (typeof email !== "string" || !email.trim())) return res.status(400).json({ message: "Field 'email' tidak valid" });
    if (password !== undefined && (typeof password !== "string" || password.length < 6)) return res.status(400).json({ message: "Field 'password' minimal 6 karakter" });
    if (role !== undefined && !ROLES.includes(role)) return res.status(400).json({ message: "Field 'role' harus 'admin' atau 'user'" });
    const user = await updateUser(id, {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(email !== undefined ? { email: email.trim() } : {}),
      ...(password !== undefined ? { password } : {}),
      ...(role !== undefined ? { role } : {}),
    });
    res.status(200).json(user);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Email sudah terdaftar" });
    }
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }
    res.status(500).json({ message: "Gagal mengupdate user", error });
  }
}

// DELETE /api/users/:id
export async function deleteUserHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ message: "ID harus angka bulat positif" });
    }
    await deleteUser(id);
    res.status(200).json({ message: "User berhasil dihapus" });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }
    res.status(500).json({ message: "Gagal menghapus user", error });
  }
}
