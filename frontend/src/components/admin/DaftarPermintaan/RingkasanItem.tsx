import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBoxOpen } from "@fortawesome/free-solid-svg-icons";

import type { PermintaanBarangRecord } from "../../../api/permintaanBarang";
import {
  kelompokkanPerDivisi,
  ringkasItem,
  type RingkasanItem as RingkasanBaris,
} from "./ringkasan";

const angka = (value: number) => value.toLocaleString("id-ID");

function BagianRingkasan({
  judul,
  jumlahPermintaan,
  items,
  agregat = false,
}: {
  judul: string;
  jumlahPermintaan: number;
  items: RingkasanBaris[];
  agregat?: boolean;
}) {
  const totalDisetujui = items.reduce((total, item) => total + item.disetujui, 0);
  const totalBelum = items.reduce((total, item) => total + item.belum, 0);

  return (
    <section aria-label={`Ringkasan ${judul}`}>
      <header
        className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-5 ${
          agregat ? "bg-sky-50" : "bg-slate-50"
        }`}
      >
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#1E3A5F]">
          {judul}
          {agregat && (
            <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-sky-700">
              semua divisi
            </span>
          )}
        </h3>
        <p className="text-[11px] text-slate-500">
          {jumlahPermintaan} permintaan · {angka(items.length)} jenis ·
          disetujui{" "}
          <span className="font-semibold tabular-nums text-emerald-700">
            {angka(totalDisetujui)}
          </span>{" "}
          · belum{" "}
          <span className="font-semibold tabular-nums text-amber-700">
            {angka(totalBelum)}
          </span>
        </p>
      </header>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th
                scope="col"
                className="px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500"
              >
                Item
              </th>
              <th
                scope="col"
                className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500"
              >
                Disetujui
              </th>
              <th
                scope="col"
                className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500"
              >
                Belum
              </th>
              <th
                scope="col"
                className="px-5 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500"
              >
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.kunci}>
                <td className="px-5 py-3">
                  <p className="font-semibold text-slate-700">{item.nama}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {item.spesifikasi || "Tanpa spesifikasi"}
                  </p>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-emerald-700">
                  {angka(item.disetujui)}
                  {item.satuan && (
                    <span className="ml-1 text-xs text-slate-400">
                      {item.satuan}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-amber-700">
                  {angka(item.belum)}
                  {item.satuan && (
                    <span className="ml-1 text-xs text-slate-400">
                      {item.satuan}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-right font-semibold tabular-nums text-slate-700">
                  {angka(item.total)}
                  {item.satuan && (
                    <span className="ml-1 text-xs font-medium text-slate-400">
                      {item.satuan}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-slate-100 md:hidden">
        {items.map((item) => (
          <li key={item.kunci} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-700">
                  {item.nama}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  {item.spesifikasi || "Tanpa spesifikasi"}
                </p>
              </div>
              <p className="shrink-0 text-sm font-bold tabular-nums text-slate-700">
                {angka(item.total)}{" "}
                <span className="text-xs font-medium text-slate-400">
                  {item.satuan}
                </span>
              </p>
            </div>
            <p className="mt-1 flex flex-wrap gap-x-3 text-[11px]">
              <span className="text-emerald-700">
                Disetujui {angka(item.disetujui)}
              </span>
              <span className="text-amber-700">
                Belum {angka(item.belum)}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function RingkasanItem({
  rows,
}: {
  rows: PermintaanBarangRecord[];
}) {
  const kelompok = kelompokkanPerDivisi(rows)
    .map((grup) => ({ ...grup, items: ringkasItem(grup.permintaan) }))
    .filter((grup) => grup.items.length > 0);

  if (kelompok.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
        <div
          aria-hidden="true"
          className="grid h-12 w-12 place-items-center rounded-xl bg-slate-100 text-slate-400"
        >
          <FontAwesomeIcon icon={faBoxOpen} />
        </div>
        <h3 className="mt-3 text-sm font-bold text-slate-700">
          Belum ada item untuk diringkas
        </h3>
        <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">
          Item dari permintaan yang sudah disetujui maupun yang belum disetujui
          akan tampil di sini.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-200">
      {kelompok.length > 1 && (
        <BagianRingkasan
          judul="Total semua divisi"
          jumlahPermintaan={rows.length}
          items={ringkasItem(rows)}
          agregat
        />
      )}
      {kelompok.map((grup) => (
        <BagianRingkasan
          key={grup.nama}
          judul={grup.nama}
          jumlahPermintaan={grup.permintaan.length}
          items={grup.items}
        />
      ))}
    </div>
  );
}
