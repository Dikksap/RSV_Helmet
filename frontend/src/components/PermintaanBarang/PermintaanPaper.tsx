import type { Baris, PermintaanDraft } from "./types";

const BULAN_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function formatTanggalID(iso: string): string {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${BULAN_ID[m - 1]} ${y}`;
}

export function PermintaanPaper({
  draft,
  noPermintaan = "",
}: {
  draft: PermintaanDraft;
  noPermintaan?: string;
}) {
  const items: Baris[] = draft.baris;
  return (
    <div
      id="permintaan-paper"
      className="paper-zoom mx-auto flex w-[210mm] flex-col bg-white px-[16mm] py-[14mm] font-[Arial,Helvetica,sans-serif] text-[9.5pt] leading-normal text-[#1f2937] shadow-[0_1px_3px_rgba(0,0,0,0.15)]"
    >
      <div className="mb-[4mm] flex items-end justify-between">
        <div>
          <div className="text-[26pt] font-black leading-none tracking-tight text-[#0B0B0B]">
            RSV
          </div>
          <div className="mt-[1mm] text-[9pt] font-bold uppercase tracking-[0.3em] text-[#0B0B0B]">
            Helmet Indonesia
          </div>
          <div className="mt-[1mm] text-[8pt] text-[#6b7280]">
            PT. RSV MANUFACTURE INDONESIA — Inventory &amp; Procurement System
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11pt] font-bold uppercase tracking-wide text-[#0B0B0B]">
            Form Permintaan Barang
          </div>
          <div className="mt-[1mm] font-mono text-[10pt] font-bold text-[#E30613]">
            {noPermintaan || "PR-........"}
          </div>
        </div>
      </div>
      <div className="mb-[6mm] h-[2.5mm] w-full bg-[#E30613]" />

      <div className="mb-[2mm] text-[9.5pt] font-bold uppercase tracking-[0.18em] text-[#0B0B0B]">
        Document Information
      </div>
      <div className="mb-[6mm] rounded border border-[#d7e0ee] bg-[#f8fafc] px-[4mm] py-[3mm]">
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className="w-[24%] py-[0.5mm] text-[#6b7280]">No. Permintaan</td>
              <td className="w-[26%] font-bold">{noPermintaan || "-"}</td>
              <td className="w-[24%] text-[#6b7280]">Tanggal Form</td>
              <td className="font-bold">{formatTanggalID(draft.tanggal)}</td>
            </tr>
            <tr>
              <td className="py-[0.5mm] text-[#6b7280]">Departemen</td>
              <td className="font-bold">{draft.departemen || "-"}</td>
              <td className="text-[#6b7280]">Tgl. Dibutuhkan</td>
              <td className="font-bold">{formatTanggalID(draft.tanggalDibutuhkan)}</td>
            </tr>
            <tr>
              <td className="py-[0.5mm] text-[#6b7280]">Peminta</td>
              <td className="font-bold">{draft.namaPeminta || "-"}</td>
              <td className="text-[#6b7280]">Prioritas</td>
              <td className="font-bold">{draft.prioritas}</td>
            </tr>
            <tr>
              <td className="py-[0.5mm] text-[#6b7280]">Kebutuhan Untuk</td>
              <td className="font-bold" colSpan={3}>
                {draft.kebutuhanUntuk}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mb-[2mm] text-[9.5pt] font-bold uppercase tracking-[0.18em] text-[#0B0B0B]">
        Item Details
      </div>
      <table className="mb-[6mm] w-full border-collapse text-[9pt]">
        <thead>
          <tr className="bg-[#0B0B0B] text-white">
            <th className="w-[6%] border border-[#0B0B0B] border-b-[#E30613] px-[2.5mm] py-[2mm] text-center">
              No
            </th>
            <th className="border border-[#0B0B0B] border-b-[#E30613] px-[2.5mm] py-[2mm] text-left">
              Nama Barang / Bahan
            </th>
            <th className="border border-[#0B0B0B] border-b-[#E30613] px-[2.5mm] py-[2mm] text-left">
              Spesifikasi
            </th>
            <th className="w-[10%] border border-[#0B0B0B] border-b-[#E30613] px-[2.5mm] py-[2mm] text-center">
              Jml
            </th>
            <th className="w-[14%] border border-[#0B0B0B] border-b-[#E30613] px-[2.5mm] py-[2mm] text-center">
              Satuan
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((b, i) => (
            <tr key={i} className={i % 2 === 1 ? "bg-[#f8fafc]" : "bg-white"}>
              <td className="border border-[#d7e0ee] px-[2.5mm] py-[2mm] text-center font-bold text-[#E30613]">
                {String(i + 1).padStart(2, "0")}
              </td>
              <td className="border border-[#d7e0ee] px-[2.5mm] py-[2mm]">
                {b.nama || "-"}
              </td>
              <td className="border border-[#d7e0ee] px-[2.5mm] py-[2mm]">
                {b.spesifikasi || "-"}
              </td>
              <td className="border border-[#d7e0ee] px-[2.5mm] py-[2mm] text-center">
                {b.jumlah || "-"}
              </td>
              <td className="border border-[#d7e0ee] px-[2.5mm] py-[2mm] text-center">
                {b.satuan || "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mb-[2mm] text-[9.5pt] font-bold uppercase tracking-[0.18em] text-[#0B0B0B]">
        Request Reason
      </div>
      <div className="mb-[10mm] min-h-[14mm] whitespace-pre-line rounded border border-[#d7e0ee] px-[4mm] py-[3mm]">
        {draft.alasan || "-"}
      </div>

      <div className="grid grid-cols-3 text-center text-[9pt]">
        {[
          { label: "Dibuat Oleh\n(PIC)", name: draft.namaPeminta.toUpperCase() },
          { label: "Diperiksa Oleh\n(Kepala Produksi)", name: "" },
          { label: "Disetujui Oleh\n(Inventori Kontrol)", name: "" },
        ].map((s) => (
          <div key={s.label} className="sig-col px-[2mm]">
            <div className="mb-[16mm] whitespace-pre-line text-[#374151]">
              {s.label}
            </div>
            <div
              className={`border-t border-[#1f2937] pt-[1.5mm] ${
                s.name ? "font-bold" : ""
              }`}
            >
              {s.name || "(............................)"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
