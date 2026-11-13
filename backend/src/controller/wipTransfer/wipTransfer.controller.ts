import type { Request, Response } from "express";
import prisma from "../../lib/prisma.js";
import {
  createWipTransfer,
  approveWipTransfer,
  WipTransferError,
  WipTransferKurangError,
  type WipTransferAccess,
} from "../../model/wipTransfer/wipTransfer.js";
import {
  ensureDivisionInventoryLocation,
} from "../../model/inventory/inventory.js";
import { awalHariBisnis } from "../../lib/tanggalBisnis.js";

function getAccess(req: Request): WipTransferAccess {
  const user = req.user;
  return {
    userId: user?.id ?? 0,
    admin: user?.role === "admin" || !user?.role,
    divisiId: user?.divisiId ?? null,
  };
}

/**
 * GET /api/wip-transfer/stok-sumber?itemId=21
 * Cek saldo WIP item di setiap divisi untuk rekomendasi transfer.
 */
export async function getStokSumberWipHandler(req: Request, res: Response) {
  try {
    const itemId = Number(req.query.itemId);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return res.status(400).json({ message: "Query itemId wajib dan harus bilangan bulat positif." });
    }

    const item = await prisma.item.findUnique({
      where: { id: itemId },
      select: { id: true, kode: true, nama: true, unit: true, jenis: true, divisiId: true, divisi: { select: { id: true, nama: true } } },
    });
    if (!item) {
      return res.status(404).json({ message: "Item tidak ditemukan." });
    }

    // Ambil saldo WIP per divisi
    const pmiRows = await prisma.pemakaianMaterialItem.findMany({
      where: {
        itemId,
        jumlahSisa: { gt: 0 },
      },
      select: {
        id: true,
        jumlahSisa: true,
        pemakaian: {
          select: {
            divisiId: true,
            divisi: { select: { id: true, nama: true } },
          },
        },
      },
    });

    const saldoPerDivisi = new Map<number, { divisiId: number; divisiNama: string; saldo: number }>();
    for (const row of pmiRows) {
      const dId = row.pemakaian.divisiId;
      const dNama = row.pemakaian.divisi?.nama ?? `Divisi ${dId}`;
      const sisa = Number(row.jumlahSisa);
      const existing = saldoPerDivisi.get(dId) ?? { divisiId: dId, divisiNama: dNama, saldo: 0 };
      existing.saldo += sisa;
      saldoPerDivisi.set(dId, existing);
    }

    const sumber = Array.from(saldoPerDivisi.values()).filter((s) => s.saldo > 0);

    return res.json({
      item,
      sumber,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal mengambil data stok sumber WIP.";
    return res.status(500).json({ message });
  }
}

/**
 * POST /api/wip-transfer
 * Membuat transfer WIP antar divisi, dengan opsi auto-approve untuk admin/otomatis.
 */
export async function createWipTransferHandler(req: Request, res: Response) {
  try {
    const access = getAccess(req);
    const {
      divisiAsalId,
      divisiTujuanId,
      items,
      keterangan,
      autoApprove = true,
    } = req.body;

    if (!divisiAsalId || !divisiTujuanId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: "divisiAsalId, divisiTujuanId, dan items (minimal 1) wajib diisi.",
      });
    }

    const transfer = await createWipTransfer(
      {
        divisiAsalId: Number(divisiAsalId),
        divisiTujuanId: Number(divisiTujuanId),
        items: items.map((it: { itemId: number; jumlah: number }) => ({
          itemId: Number(it.itemId),
          jumlah: Number(it.jumlah),
        })),
        keterangan: keterangan ? String(keterangan) : "Transfer WIP antar divisi",
      },
      access,
    );

    // Jika autoApprove aktif dan user punya hak akses approve
    if (autoApprove) {
      const approved = await approveWipTransfer(
        transfer.id,
        {
          status: "DISETUJUI" as any,
          items: transfer.items.map((it) => ({
            id: it.id,
            jumlahDisetujui: it.jumlah,
          })),
        },
        access,
      );
      return res.status(201).json({ ok: true, data: approved, message: "Transfer WIP berhasil diproses dan disetujui." });
    }

    return res.status(201).json({ ok: true, data: transfer, message: "Transfer WIP berhasil diajukan." });
  } catch (error) {
    if (error instanceof WipTransferKurangError) {
      return res.status(409).json({
        code: "WIP_KURANG",
        message: "Saldo WIP di divisi asal tidak mencukupi untuk ditransfer.",
        dataKekurangan: error.dataKekurangan,
      });
    }
    if (error instanceof WipTransferError) {
      return res.status(400).json({ code: error.code, message: error.message });
    }
    const message = error instanceof Error ? error.message : "Gagal memproses transfer WIP.";
    return res.status(500).json({ message });
  }
}

/**
 * POST /api/wip-transfer/adjust
 * Inisialisasi / penambahan saldo WIP langsung ke suatu divisi (Admin & Gudang).
 * Berguna saat saldo WIP belum ada di sistem atau penyesuaian stok awal fisik.
 */
export async function directAddWipHandler(req: Request, res: Response) {
  try {
    const access = getAccess(req);
    const { divisiId, itemId, jumlah, keterangan } = req.body;

    const targetDivisiId = Number(divisiId);
    const targetItemId = Number(itemId);
    const qty = Number(jumlah);

    if (!Number.isInteger(targetDivisiId) || targetDivisiId <= 0) {
      return res.status(400).json({ message: "divisiId wajib dan harus bilangan bulat positif." });
    }
    if (!Number.isInteger(targetItemId) || targetItemId <= 0) {
      return res.status(400).json({ message: "itemId wajib dan harus bilangan bulat positif." });
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ message: "jumlah harus lebih dari 0." });
    }

    const [divisi, item] = await Promise.all([
      prisma.divisi.findUnique({ where: { id: targetDivisiId } }),
      prisma.item.findUnique({ where: { id: targetItemId } }),
    ]);

    if (!divisi) return res.status(404).json({ message: "Divisi tidak ditemukan." });
    if (!item) return res.status(404).json({ message: "Item tidak ditemukan." });

    const result = await prisma.$transaction(async (tx) => {
      const tanggal = awalHariBisnis(new Date());
      const divisionLocation = await ensureDivisionInventoryLocation(tx, targetDivisiId);

      const nomor = `WIP-ADJ-${Date.now()}`;
      const pm = await tx.pemakaianMaterial.create({
        data: {
          nomor,
          divisiId: targetDivisiId,
          tanggal,
          userId: access.userId > 0 ? access.userId : null,
          sumber: "HASIL_PRODUKSI" as any,
          keterangan: keterangan ? String(keterangan) : `Penambahan saldo WIP ${item.nama} di ${divisi.nama}`,
          items: {
            create: [
              {
                itemId: targetItemId,
                jumlahDiterima: qty,
                jumlahDipakai: 0,
                jumlahSisa: qty,
                satuan: item.unit ?? "Pcs",
              },
            ],
          },
        },
        include: { items: true },
      });

      const pmi = pm.items[0];
      // Pastikan StockBalance ada untuk inventory tracking
      const balanceKey = `I:${targetItemId}:0:${pmi.id}:${divisionLocation.id}`;
      await tx.stockBalance.upsert({
        where: { balanceKey },
        update: { quantity: { increment: qty } },
        create: {
          balanceKey,
          itemId: targetItemId,
          pemakaianMaterialItemId: pmi.id,
          locationId: divisionLocation.id,
          quantity: qty,
        },
      });

      return { pm, pmi };
    });

    return res.status(201).json({
      ok: true,
      message: `Berhasil menambahkan saldo WIP ${qty} ${item.unit} untuk ${item.nama} di divisi ${divisi.nama}.`,
      data: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gagal menambahkan saldo WIP.";
    return res.status(500).json({ message });
  }
}

