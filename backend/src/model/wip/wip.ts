import prisma from "../../lib/prisma.js";
import { StatusWipTransfer } from "../../../generated/prisma/enums.js";
import {
  awalHariBisnis,
  tambahHariBisnis,
} from "../../lib/tanggalBisnis.js";

export type WipParams = {
  divisiId?: number;
  itemId?: number;
  dari?: Date;
  sampai?: Date;
};

export type WipRow = {
  itemId: number;
  kode: string;
  nama: string;
  unit: string;
  jenis: string | null;
  divisiId: number | null;
  divisiNama: string | null;
  saldoAwal: number;
  masuk: number;
  keluar: number;
  saldoAkhir: number;
};

type ItemInfo = {
  id: number;
  kode: string;
  nama: string;
  unit: string;
  jenis: string | null;
};

type PmiInfo = {
  divisiId: number;
  divisiNama: string;
  item: ItemInfo;
};

// saldoAwal/masuk/keluar dihitung dari tanggal dokumen. Pemakaian manual adalah
// jumlahDipakai dikurangi konsumsi produksi dan alokasi transfer WIP.
// ponytail: memuat seluruh riwayat WIP lalu agregasi di memori; pindahkan ke SQL
// bila volume PemakaianMaterialItem sudah besar.
export async function getWipRows(params: WipParams): Promise<WipRow[]> {
  const itemFilter = params.itemId !== undefined ? params.itemId : { not: null };

  const [pemakaianRows, konsumsiRows] = await Promise.all([
    prisma.pemakaianMaterialItem.findMany({
      where: {
        itemId: itemFilter,
        ...(params.divisiId !== undefined ? { pemakaian: { divisiId: params.divisiId } } : {}),
      },
      select: {
        id: true,
        itemId: true,
        jumlahDiterima: true,
        jumlahDipakai: true,
        pemakaian: {
          select: {
            tanggal: true,
            divisi: { select: { id: true, nama: true } },
          },
        },
        item: {
          select: { id: true, kode: true, nama: true, unit: true, jenis: true },
        },
        wipTransferAlokasi: {
          where: {
            transferItem: {
              transfer: { status: StatusWipTransfer.DISETUJUI },
            },
          },
          select: {
            jumlah: true,
            transferItem: {
              select: {
                transfer: { select: { approvedAt: true } },
              },
            },
          },
        },
      },
    }),
    prisma.hasilProduksiPemakaian.findMany({
      where: {
        pemakaianMaterialItem: {
          itemId: itemFilter,
          ...(params.divisiId !== undefined
            ? { pemakaian: { divisiId: params.divisiId } }
            : {}),
        },
      },
      select: {
        jumlah: true,
        pemakaianMaterialItemId: true,
        hasilProduksiHarianItem: {
          select: {
            hasilProduksiHarian: { select: { tanggalProduksi: true } },
          },
        },
      },
    }),
  ]);

  const awal = params.dari ? awalHariBisnis(params.dari) : null;
  const akhir = params.sampai ? tambahHariBisnis(params.sampai, 1) : null;

  const konsumsiPerPmi = new Map<number, number>();
  for (const row of konsumsiRows) {
    const jumlah = Number(row.jumlah) || 0;
    konsumsiPerPmi.set(
      row.pemakaianMaterialItemId,
      (konsumsiPerPmi.get(row.pemakaianMaterialItemId) ?? 0) + jumlah,
    );
  }

  const rows = new Map<string, WipRow>();
  const pmiInfo = new Map<number, PmiInfo>();

  const bucket = (divisiId: number, divisiNama: string, item: ItemInfo): WipRow => {
    const key = `${divisiId}:${item.id}`;
    let row = rows.get(key);
    if (!row) {
      row = {
        itemId: item.id,
        kode: item.kode,
        nama: item.nama,
        unit: item.unit,
        jenis: item.jenis,
        divisiId,
        divisiNama,
        saldoAwal: 0,
        masuk: 0,
        keluar: 0,
        saldoAkhir: 0,
      };
      rows.set(key, row);
    }
    return row;
  };

  for (const row of pemakaianRows) {
    if (row.itemId === null || !row.item) continue;
    const divisiId = row.pemakaian.divisi.id;
    const divisiNama = row.pemakaian.divisi.nama;
    pmiInfo.set(row.id, { divisiId, divisiNama, item: row.item });

    const tanggal = row.pemakaian.tanggal;
    if (akhir && tanggal >= akhir) continue;

    const diterima = Number(row.jumlahDiterima) || 0;
    const alokasi = row.wipTransferAlokasi.reduce(
      (total, item) => total + (Number(item.jumlah) || 0),
      0,
    );
    const manual =
      (Number(row.jumlahDipakai) || 0) -
      (konsumsiPerPmi.get(row.id) ?? 0) -
      alokasi;
    const target = bucket(divisiId, divisiNama, row.item);
    if (awal && tanggal < awal) {
      target.saldoAwal += diterima - manual;
    } else {
      target.masuk += diterima;
      target.keluar += manual;
    }

    // Transfer keluar dicatat pada tanggal approval, bukan tanggal PM asal.
    for (const item of row.wipTransferAlokasi) {
      const approvedAt = item.transferItem.transfer.approvedAt;
      if (!approvedAt) continue;
      if (akhir && approvedAt >= akhir) continue;
      const jumlah = Number(item.jumlah) || 0;
      if (awal && approvedAt < awal) {
        target.saldoAwal -= jumlah;
      } else {
        target.keluar += jumlah;
      }
    }
  }

  for (const row of konsumsiRows) {
    const info = pmiInfo.get(row.pemakaianMaterialItemId);
    if (!info) continue;
    const tanggal = row.hasilProduksiHarianItem.hasilProduksiHarian.tanggalProduksi;
    if (akhir && tanggal >= akhir) continue;

    const jumlah = Number(row.jumlah) || 0;
    const target = bucket(info.divisiId, info.divisiNama, info.item);
    if (awal && tanggal < awal) {
      target.saldoAwal -= jumlah;
    } else {
      target.keluar += jumlah;
    }
  }

  for (const row of rows.values()) {
    row.saldoAkhir = row.saldoAwal + row.masuk - row.keluar;
  }

  if (rows.size === 0 && params.itemId !== undefined) {
    const item = await prisma.item.findFirst({
      where: { id: params.itemId },
      select: {
        id: true,
        kode: true,
        nama: true,
        unit: true,
        jenis: true,
        divisi: { select: { id: true, nama: true } },
      },
    });
    if (!item) return [];

    let divisiId: number | null = item.divisi?.id ?? null;
    let divisiNama: string | null = item.divisi?.nama ?? null;
    if (params.divisiId !== undefined) {
      const divisi = await prisma.divisi.findUnique({
        where: { id: params.divisiId },
        select: { id: true, nama: true },
      });
      if (!divisi) return [];
      divisiId = divisi.id;
      divisiNama = divisi.nama;
    }

    return [
      {
        itemId: item.id,
        kode: item.kode,
        nama: item.nama,
        unit: item.unit,
        jenis: item.jenis,
        divisiId,
        divisiNama,
        saldoAwal: 0,
        masuk: 0,
        keluar: 0,
        saldoAkhir: 0,
      },
    ];
  }

  return [...rows.values()].sort(
    (a, b) =>
      (a.divisiNama ?? "").localeCompare(b.divisiNama ?? "") ||
      a.nama.localeCompare(b.nama) ||
      a.itemId - b.itemId,
  );
}
