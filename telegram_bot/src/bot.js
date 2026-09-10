import "dotenv/config";
import cron from "node-cron";
import { Telegraf } from "telegraf";
import { barangHandler, getBarangMessage } from "./handlers/barang.handler.js";
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN belum diset");
}
const bot = new Telegraf(token);
bot.start((ctx) => {
    ctx.reply("Halo! 👋\n\n" +
        "Saya adalah bot Telegram.\n\n" +
        "Gunakan /help untuk melihat menu.");
});
bot.help((ctx) => {
    ctx.reply("📋 Menu\n\n" +
        "/start - Mulai bot\n" +
        "/help - Bantuan\n" +
        "/barang - Ambil data barang dari API");
});
bot.command("barang", barangHandler);
const chatId = process.env.TELEGRAM_CHAT_ID;
if (chatId) {
    cron.schedule("30 16 * * *", async () => {
        try {
            await bot.telegram.sendMessage(chatId, await getBarangMessage());
        }
        catch (error) {
            console.error("Gagal mengirim laporan otomatis:", error);
        }
    }, { timezone: "Asia/Jakarta" });
    console.log("⏰ Laporan otomatis dijadwalkan setiap hari pukul 16:30 WIB.");
}
else {
    console.warn("TELEGRAM_CHAT_ID belum diset; laporan otomatis dinonaktifkan.");
}
bot.on("text", (ctx) => {
    ctx.reply(`Anda mengirim: ${ctx.message.text}`);
});
bot.launch();
console.log("🤖 Telegram bot berjalan...");
