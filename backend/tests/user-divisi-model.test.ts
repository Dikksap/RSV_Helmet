import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  divisi: { findUnique: vi.fn() },
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../src/lib/prisma.js", () => ({ default: prismaMock }));

import {
  createUser,
  findUserByEmail,
  getUserById,
  updateUser,
  DIVISI_TIDAK_DITEMUKAN,
} from "../src/model/user/user.js";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.create.mockResolvedValue({ id: 2 });
  prismaMock.user.update.mockResolvedValue({ id: 2 });
});

describe("model user — divisi", () => {
  it("createUser memvalidasi divisi dan menyimpan relasinya", async () => {
    prismaMock.divisi.findUnique.mockResolvedValue({ id: 1 });

    await createUser({
      name: "Budi",
      email: "budi@example.com",
      password: "rahasia1",
      role: "user",
      divisiId: 1,
    });

    expect(prismaMock.divisi.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { id: true },
    });
    const arg = prismaMock.user.create.mock.calls[0][0];
    expect(arg.data).toMatchObject({
      name: "Budi",
      email: "budi@example.com",
      role: "user",
      divisiId: 1,
    });
    expect(arg.data.password).not.toBe("rahasia1");
    expect(arg.select.divisiId).toBe(true);
    expect(arg.select.divisi).toEqual({ select: { id: true, nama: true } });
  });

  it("createUser tanpa divisi tidak memeriksa tabel divisi", async () => {
    await createUser({
      name: "Budi",
      email: "budi@example.com",
      password: "rahasia1",
      role: "user",
    });

    expect(prismaMock.divisi.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.user.create.mock.calls[0][0].data).not.toHaveProperty("divisiId");
  });

  it("createUser menolak divisi yang tidak ada", async () => {
    prismaMock.divisi.findUnique.mockResolvedValue(null);

    await expect(
      createUser({
        name: "Budi",
        email: "budi@example.com",
        password: "rahasia1",
        role: "user",
        divisiId: 99,
      }),
    ).rejects.toMatchObject({ code: DIVISI_TIDAK_DITEMUKAN, name: "UserError" });
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("updateUser memvalidasi divisi baru", async () => {
    prismaMock.divisi.findUnique.mockResolvedValue({ id: 3 });

    await updateUser(2, { divisiId: 3 });

    expect(prismaMock.divisi.findUnique).toHaveBeenCalledWith({
      where: { id: 3 },
      select: { id: true },
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { divisiId: 3 },
      select: expect.objectContaining({ divisiId: true }),
    });
  });

  it("updateUser dengan divisiId null melepas divisi tanpa validasi", async () => {
    await updateUser(2, { divisiId: null });

    expect(prismaMock.divisi.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { divisiId: null },
      select: expect.objectContaining({ divisiId: true }),
    });
  });

  it("updateUser menolak divisi yang tidak ada", async () => {
    prismaMock.divisi.findUnique.mockResolvedValue(null);

    await expect(updateUser(2, { divisiId: 99 })).rejects.toMatchObject({
      code: DIVISI_TIDAK_DITEMUKAN,
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("query auth menyertakan divisi", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 1 });

    await findUserByEmail("budi@example.com");
    expect(prismaMock.user.findUnique.mock.calls[0][0].include).toEqual({
      divisi: { select: { id: true, nama: true } },
    });

    await getUserById(1);
    expect(prismaMock.user.findUnique.mock.calls[1][0].select.divisi).toEqual({
      select: { id: true, nama: true },
    });
    expect(prismaMock.user.findUnique.mock.calls[1][0].select.divisiId).toBe(true);
  });
});
