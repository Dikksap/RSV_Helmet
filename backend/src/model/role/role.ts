import prisma from "../../lib/prisma.js";

export const ADMIN_ROLE = "admin";

export interface RoleAccess {
  role: string;
  permissions: string[];
  // null = semua status terlihat (role admin melewati matriks)
  statusView: string[] | null;
}

/**
 * Baca role, permission, dan scope visibilitas status barang seorang user.
 * Dibaca ulang dari database setiap request supaya perubahan permission
 * langsung berlaku, mengikuti pola requireRole().
 * ponytail: 1 query per request; cache Redis + invalidasi saat grant berubah
 * kalau volume barang GET menuntut.
 */
export async function getRoleAccess(userId: number): Promise<RoleAccess | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      roleRef: {
        select: {
          kode: true,
          permissions: { select: { permission: { select: { kode: true } } } },
          barangStatus: { where: { canView: true }, select: { statusKode: true } },
        },
      },
    },
  });

  if (!user) return null;

  const role = user.roleRef.kode;

  if (role === ADMIN_ROLE) {
    const all = await prisma.permission.findMany({ select: { kode: true }, orderBy: { id: "asc" } });
    return { role, permissions: all.map((p) => p.kode), statusView: null };
  }

  return {
    role,
    permissions: user.roleRef.permissions.map((rp) => rp.permission.kode),
    statusView: user.roleRef.barangStatus.map((s) => s.statusKode),
  };
}

export async function getRoleKodes(): Promise<string[]> {
  const rows = await prisma.role.findMany({ select: { kode: true }, orderBy: { id: "asc" } });
  return rows.map((r) => r.kode);
}

export async function getAllPermissions() {
  return prisma.permission.findMany({ orderBy: [{ kelompok: "asc" }, { id: "asc" }] });
}

const roleInclude = {
  permissions: { select: { permission: { select: { id: true, kode: true, nama: true, kelompok: true } } } },
  barangStatus: { select: { statusKode: true, canView: true }, orderBy: { statusKode: "asc" as const } },
};

export async function getAllRoles() {
  const roles = await prisma.role.findMany({
    orderBy: { id: "asc" },
    include: roleInclude,
  });
  return roles.map((r) => ({
    id: r.id,
    kode: r.kode,
    nama: r.nama,
    permissions: r.permissions.map((rp) => rp.permission),
    barangStatus: r.barangStatus,
  }));
}

export async function getRoleById(id: number) {
  const role = await prisma.role.findUnique({ where: { id }, include: roleInclude });
  if (!role) return null;
  return {
    id: role.id,
    kode: role.kode,
    nama: role.nama,
    permissions: role.permissions.map((rp) => rp.permission),
    barangStatus: role.barangStatus,
  };
}

export async function createRole(data: { kode: string; nama: string }) {
  return prisma.role.create({ data });
}

export async function getStatusBarangKodes(): Promise<string[]> {
  const rows = await prisma.statusBarang.findMany({ select: { kode: true } });
  return rows.map((r) => r.kode);
}

/** Ganti seluruh grant permission sebuah role. Return permission kode yang tersimpan. */
export async function setRolePermissions(roleId: number, kodes: string[]) {
  const permissions = await prisma.permission.findMany({
    where: { kode: { in: kodes } },
    select: { id: true, kode: true },
  });

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId, permissionId: p.id })),
    }),
  ]);

  return permissions.map((p) => p.kode).sort();
}

/**
 * Ganti seluruh matriks visibilitas status barang sebuah role.
 * Hanya status yang dikenal StatusBarang yang disimpan; status tanpa baris
 * berarti canView=false (default deny).
 */
export async function setRoleBarangStatus(roleId: number, statusView: Record<string, boolean>) {
  const entries = Object.entries(statusView);
  const rows = await prisma.statusBarang.findMany({
    where: { kode: { in: entries.map(([kode]) => kode) } },
    select: { kode: true },
  });
  const known = new Set(rows.map((r) => r.kode));

  await prisma.$transaction([
    prisma.roleBarangStatusPermission.deleteMany({ where: { roleId } }),
    prisma.roleBarangStatusPermission.createMany({
      data: entries
        .filter(([kode]) => known.has(kode))
        .map(([kode, canView]) => ({ roleId, statusKode: kode, canView })),
    }),
  ]);

  return entries
    .filter(([kode]) => known.has(kode))
    .map(([kode, canView]) => ({ statusKode: kode, canView }));
}
