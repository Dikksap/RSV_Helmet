import { getFinishgoodHariIni } from "../services/api.service.js";

export async function getBarangMessage() {
  const response = await getFinishgoodHariIni();
  const jumlah = response.meta?.total ?? response.data?.length ?? 0;
  const sekarang = new Date();
  const tanggal = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(sekarang);
  const jam = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(sekarang);

  return (
    `📦 Produksi FINISHGOOD Hari Ini\n\n` +
    `Tanggal: ${tanggal}\n` +
    `Jam: ${jam} WIB\n` +
    `Jumlah: ${jumlah.toLocaleString("id-ID")} barang`
  );
}

export async function barangHandler(ctx: any) {
  try {
    await ctx.reply(await getBarangMessage());
  } catch (error) {
    console.error(error);

    await ctx.reply("❌ Gagal mengambil data barang dari API.");
  }
}
