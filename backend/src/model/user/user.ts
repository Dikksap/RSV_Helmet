import prisma from "../../lib/prisma.js";
import bcrypt from "bcryptjs";

export const DIVISI_TIDAK_DITEMUKAN = "DIVISI_TIDAK_DITEMUKAN";

export class UserError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "UserError";
    this.code = code;
  }
}

async function pastikanDivisiAda(divisiId: number | null | undefined): Promise<void> {
  if (divisiId === undefined || divisiId === null) return;
  const divisi = await prisma.divisi.findUnique({
    where: { id: divisiId },
    select: { id: true },
  });
  if (!divisi) throw new UserError(DIVISI_TIDAK_DITEMUKAN, "Divisi tidak ditemukan");
}

// =============================================
// Query user
// =============================================

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: { divisi: { select: { id: true, nama: true } } },
  });
}

export async function getUserRole(id: number): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  return user?.role ?? null;
}

const publicFields = {
  id: true,
  name: true,
  email: true,
  role: true,
  divisiId: true,
  divisi: { select: { id: true, nama: true } },
  createdAt: true,
  updatedAt: true,
} as const;

export async function getAllUsers() {
  return prisma.user.findMany({
    orderBy: { id: "asc" },
    select: publicFields,
  });
}

export async function getUserById(id: number) {
  return prisma.user.findUnique({ where: { id }, select: publicFields });
}

/** Sertakan hash password; hanya untuk verifikasi password lama saat ganti password sendiri. */
export async function findUserByIdWithPassword(id: number) {
  return prisma.user.findUnique({ where: { id } });
}

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  role: string;
  divisiId?: number | null;
}) {
  await pastikanDivisiAda(data.divisiId);
  const password = await bcrypt.hash(data.password, 10);
  return prisma.user.create({ data: { ...data, password }, select: publicFields });
}

export async function updateUser(
  id: number,
  data: { name?: string; email?: string; password?: string; role?: string; divisiId?: number | null },
) {
  await pastikanDivisiAda(data.divisiId);
  const payload: Record<string, unknown> = { ...data };
  if (data.password) {
    payload.password = await bcrypt.hash(data.password, 10);
  } else {
    delete payload.password;
  }
  return prisma.user.update({ where: { id }, data: payload, select: publicFields });
}

export async function deleteUser(id: number) {
  await prisma.user.delete({ where: { id } });
}
