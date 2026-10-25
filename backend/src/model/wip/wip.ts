import prisma from "../../lib/prisma.js";
import { StatusWipTransfer } from "../../../generated/prisma/enums.js";
import {
  awalHariBisnis,
  tambahHariBisnis,
  tanggalBisnis,
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

export type WipLedgerHarianParams = {
  divisiId?: number;
  itemId?: number;
  dari: Date;
  sampai: Date;
};

export type WipLedgerHarianRow = {
  tanggal: string;
  itemId: number;
  kode: string;
  nama: string;
  unit: string;
  jenis: string | null;
  divisiId: number;
  divisiNama: string;
  stokAwal: number;
  masuk: number;
  keluarProduksi: number;
  keluarTransfer: number;
  keluarLain: number;
  sisa: number;
};

export type WipLedgerHarianTotal = {
  itemId: number;
  kode: string;
  nama: string;
  unit: string;
  stokAwal: number;
  masuk: number;
  keluarProduksi: number;
  keluarTransfer: number;
  keluarLain: number;
  sisa: number;
};

export type WipLedgerHarianResult = {
  data: WipLedgerHarianRow[];
  total: WipLedgerHarianTotal | null;
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

type LedgerEvent = {
  tanggal: Date;
  masuk: number;
  keluarProduksi: number;
  keluarTransfer: number;
  keluarLain: number;
};

type LedgerSeries = {
  divisiId: number;
  divisiNama: string;
  item: ItemInfo;
  events: Map<string, LedgerEvent>;
};

const eventKey = (tanggal: Date): string => tanggalBisnis(tanggal);

const addLedgerEvent = (
  series: LedgerSeries,
  tanggal: Date,
  field: keyof Omit<LedgerEvent, "tanggal">,
  jumlah: number,
): void => {
  if (!Number.isFinite(jumlah) || jumlah === 0) return;
  const key = eventKey(tanggal);
  const event = series.events.get(key) ?? {
    tanggal: awalHariBisnis(tanggal),
    masuk: 0,
    keluarProduksi: 0,
    keluarTransfer: 0,
    keluarLain: 0,
  };
  event[field] += jumlah;
  series.events.set(key, event);
};

// Rekap harian dihitung dari event yang sudah ada; tidak ada tabel ledger baru.
export async function getWipLedgerHarian(
  params: WipLedgerHarianParams,
): Promise<WipLedgerHarianResult> {
  const itemFilter = params.itemId !== undefined ? params.itemId : { not: null };
  const rows = await prisma.pemakaianMaterialItem.findMany({
    where: {
      itemId: itemFilter,
      ...(params.divisiId !== undefined
        ? { pemakaian: { divisiId: params.divisiId } }
        : {}),
    },
    select: {
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
      hasilProduksiPemakaian: {
        select: {
          jumlah: true,
          hasilProduksiHarianItem: {
            select: {
              hasilProduksiHarian: { select: { tanggalProduksi: true } },
            },
          },
        },
      },
      wipTransferAlokasi: {
        where: {
          transferItem: {
            transfer: {
              status: StatusWipTransfer.DISETUJUI,
              approvedAt: { not: null },
            },
          },
        },
        select: {
          jumlah: true,
          transferItem: {
            select: { transfer: { select: { approvedAt: true } } },
          },
        },
      },
    },
  });

  const awal = awalHariBisnis(params.dari);
  const akhir = tambahHariBisnis(params.sampai, 1);
  const seriesMap = new Map<string, LedgerSeries>();

  for (const row of rows) {
    if (row.itemId === null || !row.item) continue;
    if (row.pemakaian.tanggal >= akhir) continue;

    const divisiId = row.pemakaian.divisi.id;
    const divisiNama = row.pemakaian.divisi.nama;
    const key = `${divisiId}:${row.itemId}`;
    const series = seriesMap.get(key) ?? {
      divisiId,
      divisiNama,
      item: row.item,
      events: new Map(),
    };
    seriesMap.set(key, series);

    const konsumsi = row.hasilProduksiPemakaian.reduce(
      (total, item) => total + (Number(item.jumlah) || 0),
      0,
    );
    const alokasi = row.wipTransferAlokasi.reduce(
      (total, item) => total + (Number(item.jumlah) || 0),
      0,
    );
    const manual =
      (Number(row.jumlahDipakai) || 0) - konsumsi - alokasi;

    addLedgerEvent(
      series,
      row.pemakaian.tanggal,
      "masuk",
      Number(row.jumlahDiterima) || 0,
    );
    addLedgerEvent(series, row.pemakaian.tanggal, "keluarLain", manual);

    for (const item of row.hasilProduksiPemakaian) {
      addLedgerEvent(
        series,
        item.hasilProduksiHarianItem.hasilProduksiHarian.tanggalProduksi,
        "keluarProduksi",
        Number(item.jumlah) || 0,
      );
    }
    for (const item of row.wipTransferAlokasi) {
      const approvedAt = item.transferItem.transfer.approvedAt;
      if (!approvedAt) continue;
      addLedgerEvent(
        series,
        approvedAt,
        "keluarTransfer",
        Number(item.jumlah) || 0,
      );
    }
  }

  const data: WipLedgerHarianRow[] = [];
  let total: WipLedgerHarianTotal | null = null;

  for (const series of seriesMap.values()) {
    const events = [...series.events.values()].sort(
      (a, b) => a.tanggal.getTime() - b.tanggal.getTime(),
    );
    let saldo = 0;
    let stokAwalPertama: number | null = null;
    let masuk = 0;
    let keluarProduksi = 0;
    let keluarTransfer = 0;
    let keluarLain = 0;

    for (const event of events) {
      if (event.tanggal < awal) {
        saldo +=
          event.masuk -
          event.keluarProduksi -
          event.keluarTransfer -
          event.keluarLain;
        continue;
      }
      if (event.tanggal >= akhir) break;

      if (stokAwalPertama === null) stokAwalPertama = saldo;
      const sisa =
        saldo +
        event.masuk -
        event.keluarProduksi -
        event.keluarTransfer -
        event.keluarLain;
      data.push({
        tanggal: eventKey(event.tanggal),
        itemId: series.item.id,
        kode: series.item.kode,
        nama: series.item.nama,
        unit: series.item.unit,
        jenis: series.item.jenis,
        divisiId: series.divisiId,
        divisiNama: series.divisiNama,
        stokAwal: saldo,
        masuk: event.masuk,
        keluarProduksi: event.keluarProduksi,
        keluarTransfer: event.keluarTransfer,
        keluarLain: event.keluarLain,
        sisa,
      });
      masuk += event.masuk;
      keluarProduksi += event.keluarProduksi;
      keluarTransfer += event.keluarTransfer;
      keluarLain += event.keluarLain;
      saldo = sisa;
    }

    if (params.itemId !== undefined && (stokAwalPertama !== null || saldo !== 0)) {
      if (!total) {
        total = {
          itemId: series.item.id,
          kode: series.item.kode,
          nama: series.item.nama,
          unit: series.item.unit,
          stokAwal: 0,
          masuk: 0,
          keluarProduksi: 0,
          keluarTransfer: 0,
          keluarLain: 0,
          sisa: 0,
        };
      }
      total.stokAwal += stokAwalPertama ?? saldo;
      total.masuk += masuk;
      total.keluarProduksi += keluarProduksi;
      total.keluarTransfer += keluarTransfer;
      total.keluarLain += keluarLain;
      total.sisa += saldo;
    }
  }

  data.sort(
    (a, b) =>
      b.tanggal.localeCompare(a.tanggal) ||
      a.divisiNama.localeCompare(b.divisiNama) ||
      a.nama.localeCompare(b.nama) ||
      a.itemId - b.itemId,
  );

  return { data, total };
}
