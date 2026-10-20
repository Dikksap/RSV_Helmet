import {
  DIVISI,
  DIVISI_PROSES,
  STATUS_REPAIR_LABEL,
  TRANSISI_REPAIR,
  hariIni,
  kurangiWip,
  nextId,
  nomorDokumen,
  tambahWip,
  type KeputusanQc,
  type Perpindahan,
  type PosisiWip,
  type Repair,
  type StatusQcUlang,
  type StatusRepair,
  type StatusWip,
} from "./data";

// Seluruh mutasi saldo ada di modul murni ini supaya bisa diuji dan tidak dobel saat status diubah berulang.
export interface AlurState {
  wip: PosisiWip[];
  transfers: Perpindahan[];
  repairs: Repair[];
  keputusanQc: KeputusanQc[];
}

export type HasilAlur = { state: AlurState | null; error: string | null };

const ok = (state: AlurState): HasilAlur => ({ state, error: null });
const gagal = (error: string): HasilAlur => ({ state: null, error });

const ANTREAN: StatusWip = "Menunggu Proses Berikutnya";
// Antrean masuk QC langsung siap diperiksa; divisi lain menunggu proses berikutnya.
const antreanTujuan = (divisi: string): StatusWip => (divisi === "QC" ? "Menunggu Pemeriksaan" : ANTREAN);
const STATUS_WIP_REPAIR: Record<"MENUNGGU_REPAIR" | "SEDANG_REPAIR" | "MENUNGGU_QC", StatusWip> = {
  MENUNGGU_REPAIR: "Menunggu Repair",
  SEDANG_REPAIR: "Sedang Repair",
  MENUNGGU_QC: "Menunggu QC",
};

const bulat = (n: number) => Number.isInteger(n) && n >= 0;

export interface KirimBody {
  tanggal: string;
  itemKode: string;
  itemNama: string;
  asal: string;
  tujuan: string;
  dikirim: number;
  catatan: string;
}

export function kirimBatok(state: AlurState, body: KirimBody): HasilAlur {
  if (body.tanggal > hariIni()) return gagal("Tanggal tidak boleh melebihi hari ini.");
  if (!DIVISI.includes(body.asal) || !DIVISI.includes(body.tujuan)) return gagal("Divisi asal/tujuan tidak dikenal.");
  if (body.asal === body.tujuan) return gagal("Divisi asal dan tujuan tidak boleh sama.");
  if (!bulat(body.dikirim) || body.dikirim === 0) return gagal("Jumlah dikirim harus bilangan bulat lebih dari 0.");
  const sisa = kurangiWip(state.wip, body.itemKode, body.asal, body.dikirim, { jenis: "NORMAL" });
  if (!sisa) return gagal(`Saldo posisi ${body.asal} tidak cukup untuk mengirim ${body.dikirim} pcs.`);

  const trf: Perpindahan = {
    ...body,
    id: nextId(state.transfers),
    nomor: nomorDokumen("TRF", body.tanggal, state.transfers),
    diterima: null,
    status: "TRANSIT",
  };
  return ok({ ...state, wip: sisa, transfers: [trf, ...state.transfers] });
}

export function terimaBatok(state: AlurState, id: number, diterima: number): HasilAlur {
  const trf = state.transfers.find((t) => t.id === id);
  if (!trf) return gagal("Dokumen perpindahan tidak ditemukan.");
  if (trf.status !== "TRANSIT") return gagal(`${trf.nomor} sudah diproses (${trf.status.toLowerCase()}); penerimaan tidak bisa diulang.`);
  if (!bulat(diterima) || diterima === 0) return gagal("Jumlah diterima harus bilangan bulat lebih dari 0.");
  if (diterima > trf.dikirim) return gagal(`Jumlah diterima tidak boleh melebihi jumlah dikirim (${trf.dikirim} pcs).`);

  const wip = tambahWip(state.wip, trf, trf.tujuan, antreanTujuan(trf.tujuan), "NORMAL", diterima, trf.tanggal);
  if (diterima < trf.dikirim) {
    // Selisih transit: unit hilang di jalan tetap tercatat sebagai WIP selisih di tujuan.
    const wipSelisih = tambahWip(
      wip,
      trf,
      trf.tujuan,
      "Selisih Transit",
      "NORMAL",
      trf.dikirim - diterima,
      trf.tanggal,
    );
    const transfers = state.transfers.map((t) =>
      t.id === id ? { ...t, diterima, status: "SELISIH" as const } : t,
    );
    return ok({ ...state, wip: wipSelisih, transfers });
  }

  const transfers = state.transfers.map((t) =>
    t.id === id ? { ...t, diterima, status: "DITERIMA" as const } : t,
  );
  return ok({ ...state, wip, transfers });
}

export function batalKirim(state: AlurState, id: number): HasilAlur {
  const trf = state.transfers.find((t) => t.id === id);
  if (!trf) return gagal("Dokumen perpindahan tidak ditemukan.");
  if (trf.status !== "TRANSIT") return gagal(`${trf.nomor} sudah diproses; pembatalan hanya untuk dokumen transit.`);

  const wip = tambahWip(state.wip, trf, trf.asal, antreanTujuan(trf.asal), "NORMAL", trf.dikirim, trf.tanggal);
  return ok({ ...state, wip, transfers: state.transfers.map((t) => (t.id === id ? { ...t, status: "BATAL" } : t)) });
}

export type RepairBaru = Omit<Repair, "id" | "nomor" | "status" | "hasilBaik" | "rejectAkhir" | "statusQcUlang">;

export function catatKasusRepair(state: AlurState, body: RepairBaru): HasilAlur {
  if (body.tanggalPemeriksaan > hariIni()) return gagal("Tanggal pemeriksaan tidak boleh melebihi hari ini.");
  const posisiAsal = body.sumber === "QC" ? "QC" : body.posisiAsal;
  if (body.sumber === "INTERNAL") {
    // Repair internal: divisi yang menemukan cacat, memproses, dan menerima kembali sama.
    if (!DIVISI_PROSES.includes(posisiAsal)) {
      return gagal("Repair internal harus berasal dari Buffing, Base Coat, Decal, atau Top Coat.");
    }
    body = { ...body, divisiPenyebab: posisiAsal, prosesDiulang: posisiAsal };
  } else if (body.sumber === "QC") {
    // Posisi asal untuk QC akhir adalah "QC"; validasi saldo dilakukan di bawah.
  } else {
    return gagal("Sumber repair tidak dikenal.");
  }
  if (!DIVISI_PROSES.includes(body.divisiPenyebab)) return gagal("Divisi penyebab harus salah satu proses produksi.");
  if (!DIVISI_PROSES.includes(body.prosesDiulang)) return gagal("Proses yang diulang harus salah satu proses produksi.");
  if (!bulat(body.jumlah) || body.jumlah === 0) return gagal("Jumlah masuk repair harus bilangan bulat lebih dari 0.");

  const sisa = kurangiWip(state.wip, body.itemKode, posisiAsal, body.jumlah, {
    jenis: "NORMAL",
    status: posisiAsal === "QC" ? "Menunggu Pemeriksaan" : undefined,
  });
  if (!sisa) return gagal(`Saldo posisi ${posisiAsal} tidak cukup untuk ${body.jumlah} pcs masuk repair.`);

  const repair: Repair = {
    ...body,
    posisiAsal,
    id: nextId(state.repairs),
    nomor: nomorDokumen("RPR", body.tanggalPemeriksaan, state.repairs.map((r) => ({ nomor: r.nomor, tanggal: r.tanggalPemeriksaan }))),
    status: "MENUNGGU_REPAIR",
    hasilBaik: 0,
    rejectAkhir: 0,
    statusQcUlang: "BELUM",
  };
  const wip = tambahWip(sisa, repair, repair.prosesDiulang, "Menunggu Repair", "REPAIR", repair.jumlah, repair.tanggalPemeriksaan);
  return ok({ ...state, wip, repairs: [repair, ...state.repairs] });
}

export function ubahRepair(
  state: AlurState,
  id: number,
  status: StatusRepair,
  hasilBaik: number,
  rejectAkhir: number,
  statusQcUlang: StatusQcUlang,
): HasilAlur {
  const r = state.repairs.find((x) => x.id === id);
  if (!r) return gagal("Kasus repair tidak ditemukan.");
  if (r.status === "REJECT") return gagal(`${r.nomor} sudah reject final.`);
  if (!bulat(hasilBaik) || !bulat(rejectAkhir)) return gagal("Hasil baik dan reject akhir tidak boleh negatif.");
  if (hasilBaik + rejectAkhir > r.jumlah) return gagal("Hasil baik + reject akhir tidak boleh melebihi jumlah masuk repair.");
  if (r.status !== "SELESAI" && status === "SELESAI" && hasilBaik + rejectAkhir !== r.jumlah) {
    return gagal("Hasil baik + reject akhir harus sama dengan jumlah masuk repair agar tidak ada unit menggantung.");
  }

  const qc = status === "REJECT" ? "REJECT" : statusQcUlang;
  if (r.status === status && hasilBaik === r.hasilBaik && rejectAkhir === r.rejectAkhir && qc === r.statusQcUlang) {
    return ok(state); // permintaan sama, tidak memutasi saldo
  }
  if (!TRANSISI_REPAIR[r.status].includes(status)) {
    return gagal(`Transisi ${STATUS_REPAIR_LABEL[r.status]} → ${STATUS_REPAIR_LABEL[status]} tidak valid.`);
  }
  if (r.status === "SELESAI" && (hasilBaik !== r.hasilBaik || rejectAkhir !== r.rejectAkhir)) {
    return gagal("Hasil repair sudah diproses; koreksi kuantitas butuh transaksi pembalik (belum tersedia).");
  }

  let wip = state.wip;
  let keputusanQc = state.keputusanQc;
  let hasil = { hasilBaik: r.hasilBaik, rejectAkhir: r.rejectAkhir, statusQcUlang: r.statusQcUlang };

  if (status === "REJECT") {
    const sisa = kurangiWip(wip, r.itemKode, r.prosesDiulang, r.jumlah, { jenis: "REPAIR" });
    if (!sisa) return gagal(`Saldo repair ${r.prosesDiulang} tidak cukup untuk ${r.nomor}.`);
    wip = sisa;
    hasil = { ...hasil, statusQcUlang: "REJECT" };
  } else if (status === "SELESAI" && r.status !== "SELESAI") {
    const keluar = hasilBaik + rejectAkhir;
    const sisa = kurangiWip(wip, r.itemKode, r.prosesDiulang, keluar, { jenis: "REPAIR" });
    if (!sisa) return gagal(`Saldo repair ${r.prosesDiulang} tidak cukup untuk ${r.nomor}.`);
    wip = sisa;

    if (r.sumber === "INTERNAL") {
      // Repair internal kembali ke antrean divisi asal; bukan produk selesai.
      if (statusQcUlang !== "BELUM") return gagal("Repair internal tidak memakai QC ulang.");
      wip = tambahWip(wip, r, r.posisiAsal, ANTREAN, "NORMAL", hasilBaik, hariIni());
      hasil = { hasilBaik, rejectAkhir, statusQcUlang: "BELUM" };
    } else {
      // Hasil baik menunggu QC ulang dan tetap WIP; keputusan lulus/reject dilakukan di penyimpanan berikutnya.
      wip = tambahWip(wip, r, "QC", "Menunggu QC Ulang", "NORMAL", hasilBaik, hariIni());
      hasil = { hasilBaik, rejectAkhir, statusQcUlang: hasilBaik > 0 ? "MENUNGGU" : "BELUM" };
    }
  } else if (status === "SELESAI") {
    // r.status sudah SELESAI: hanya keputusan QC ulang yang boleh berubah, kuantitas terkunci.
    if (r.statusQcUlang === "LULUS" || r.statusQcUlang === "REJECT") return gagal("Status QC ulang yang sudah final tidak bisa diubah.");
    if (r.sumber === "INTERNAL" && statusQcUlang !== "BELUM") return gagal("Repair internal tidak memakai QC ulang.");
    if (statusQcUlang === "LULUS" || statusQcUlang === "REJECT") {
      const sisa = kurangiWip(wip, r.itemKode, "QC", r.hasilBaik, { jenis: "NORMAL" });
      if (!sisa) return gagal(`Saldo QC untuk ${r.nomor} tidak cukup.`);
      wip = sisa;
      keputusanQc = [
        {
          id: nextId(keputusanQc),
          tanggal: hariIni(),
          itemKode: r.itemKode,
          itemNama: r.itemNama,
          jumlah: r.hasilBaik,
          hasil: statusQcUlang === "LULUS" ? "SELESAI" : "REJECT",
          sumber: "REPAIR",
          catatan: `${r.nomor} · QC ulang`,
        },
        ...keputusanQc,
      ];
    }
    hasil = { ...hasil, statusQcUlang };
  } else {
    const statusWip = STATUS_WIP_REPAIR[status as keyof typeof STATUS_WIP_REPAIR];
    wip = wip.map((w) =>
      w.itemKode === r.itemKode && w.posisi === r.prosesDiulang && w.jenis === "REPAIR" ? { ...w, status: statusWip } : w,
    );
  }

  const repairs = state.repairs.map((x) => (x.id === id ? { ...x, ...hasil, status } : x));
  return ok({ ...state, wip, repairs, keputusanQc });
}

export interface PutuskanQcBody {
  tanggal: string;
  itemKode: string;
  jumlah: number;
  hasil: "SELESAI" | "REJECT";
  catatan: string;
}

// Hanya untuk unit normal di posisi QC; unit QC ulang hasil repair diputuskan lewat ubahRepair.
export function putuskanQc(state: AlurState, body: PutuskanQcBody): HasilAlur {
  if (body.tanggal > hariIni()) return gagal("Tanggal keputusan tidak boleh melebihi hari ini.");
  if (body.hasil !== "SELESAI" && body.hasil !== "REJECT") return gagal("Keputusan QC tidak dikenal.");
  if (!bulat(body.jumlah) || body.jumlah === 0) return gagal("Jumlah keputusan QC harus bilangan bulat lebih dari 0.");
  const unit = state.wip.find((w) => w.itemKode === body.itemKode && w.posisi === "QC" && w.status === "Menunggu Pemeriksaan");
  if (!unit) return gagal("Item tidak ada di antrean pemeriksaan QC.");

  const sisa = kurangiWip(state.wip, body.itemKode, "QC", body.jumlah, { status: "Menunggu Pemeriksaan" });
  if (!sisa) return gagal(`Saldo QC yang menunggu pemeriksaan tidak cukup untuk ${body.jumlah} pcs.`);

  const keputusan: KeputusanQc = {
    tanggal: body.tanggal,
    itemKode: body.itemKode,
    itemNama: unit.itemNama,
    jumlah: body.jumlah,
    hasil: body.hasil,
    sumber: "NORMAL",
    catatan: body.catatan,
    id: nextId(state.keputusanQc),
  };
  return ok({ ...state, wip: sisa, keputusanQc: [keputusan, ...state.keputusanQc] });
}
