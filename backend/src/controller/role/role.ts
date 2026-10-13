import type { Request, Response } from "express";
import {
  ADMIN_ROLE,
  createRole,
  getAllPermissions,
  getAllRoles,
  getRoleById,
  getStatusBarangKodes,
  setRoleBarangStatus,
  setRolePermissions,
} from "../../model/role/role.js";

const KODE_RE = /^[a-z][a-z0-9_]*$/;

function parseId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function validateKode(kode: unknown): string | null {
  if (!kode || typeof kode !== "string" || !kode.trim()) return "Field 'kode' wajib diisi";
  const v = kode.trim().toLowerCase();
  if (v.length > 30) return "Field 'kode' maksimal 30 karakter";
  if (!KODE_RE.test(v)) return "Field 'kode' harus huruf kecil, angka, underscore, diawali huruf";
  return null;
}

// GET /api/roles
export async function listRolesHandler(_req: Request, res: Response) {
  try {
    res.status(200).json(await getAllRoles());
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data role", error });
  }
}

// GET /api/permissions
export async function listPermissionsHandler(_req: Request, res: Response) {
  try {
    res.status(200).json(await getAllPermissions());
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data permission", error });
  }
}

// GET /api/roles/:id
export async function getRoleDetailHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });
    const role = await getRoleById(id);
    if (!role) return res.status(404).json({ message: "Role tidak ditemukan" });
    res.status(200).json(role);
  } catch (error) {
    res.status(500).json({ message: "Gagal mengambil data role", error });
  }
}

// POST /api/roles
export async function createRoleHandler(req: Request, res: Response) {
  try {
    const { kode, nama } = req.body ?? {};
    const kodeErr = validateKode(kode);
    if (kodeErr) return res.status(400).json({ message: kodeErr });
    if (!nama || typeof nama !== "string" || !nama.trim()) {
      return res.status(400).json({ message: "Field 'nama' wajib diisi" });
    }
    const role = await createRole({ kode: kode.trim().toLowerCase(), nama: nama.trim() });
    res.status(201).json({ ...role, permissions: [], barangStatus: [] });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({ message: "Kode role sudah ada" });
    }
    res.status(500).json({ message: "Gagal membuat role", error });
  }
}

// PUT /api/roles/:id/permissions
export async function setRolePermissionsHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });

    const { permissions } = req.body ?? {};
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ message: "Field 'permissions' harus array kode permission" });
    }

    const kodes = [...new Set(permissions.map((p) => String(p).trim().toUpperCase()))].filter(Boolean);
    const known = new Set((await getAllPermissions()).map((p) => p.kode));
    const unknown = kodes.filter((k) => !known.has(k));
    if (unknown.length > 0) {
      return res.status(400).json({ message: `Permission tidak dikenal: ${unknown.join(", ")}` });
    }

    if (!(await getRoleById(id))) return res.status(404).json({ message: "Role tidak ditemukan" });

    const saved = await setRolePermissions(id, kodes);
    res.status(200).json({ id, permissions: saved });
  } catch (error) {
    res.status(500).json({ message: "Gagal menyimpan permission role", error });
  }
}

// PUT /api/roles/:id/barang-status
export async function setRoleBarangStatusHandler(req: Request, res: Response) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID harus angka bulat positif" });

    const role = await getRoleById(id);
    if (!role) return res.status(404).json({ message: "Role tidak ditemukan" });
    if (role.kode === ADMIN_ROLE) {
      return res.status(400).json({ message: `Role ${ADMIN_ROLE} selalu melihat semua status, matriks tidak berlaku` });
    }

    const statusView = req.body?.statusView;
    if (!statusView || typeof statusView !== "object" || Array.isArray(statusView)) {
      return res.status(400).json({ message: "Field 'statusView' harus object { statusKode: boolean }" });
    }

    const entries = Object.entries(statusView);
    if (entries.some(([, canView]) => typeof canView !== "boolean")) {
      return res.status(400).json({ message: "Nilai 'statusView' harus boolean" });
    }

    const known = new Set(await getStatusBarangKodes());
    const unknown = entries.map(([kode]) => kode).filter((k) => !known.has(k));
    if (unknown.length > 0) {
      return res.status(400).json({ message: `Status tidak dikenal: ${unknown.join(", ")}` });
    }

    const saved = await setRoleBarangStatus(id, Object.fromEntries(entries) as Record<string, boolean>);
    res.status(200).json({ id, statusView: saved });
  } catch (error) {
    res.status(500).json({ message: "Gagal menyimpan permission status barang", error });
  }
}
