import type { RoleAccess } from "../model/role/role.js";

export interface BatasDivisi {
  admin: boolean;
  divisiId: number | null;
}

/** Admin (dan pemanggil lama tanpa access) tidak dibatasi divisi; role lain memakai divisi user. */
export function getBatasDivisi(access?: RoleAccess): BatasDivisi {
  if (!access || access.role === "admin") return { admin: true, divisiId: null };
  return { admin: false, divisiId: access.divisiId ?? null };
}
