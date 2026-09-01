import prisma from "../../lib/prisma.js";

// =============================================
// Query user
// =============================================

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}
