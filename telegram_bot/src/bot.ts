import "dotenv/config";
import cron from "node-cron";
import { Telegraf } from "telegraf";
import { barangHandler, getBarangMessage } from "./handlers/barang.handler.js";
import { chatHandler, clearHistory } from "./handlers/chat.handler.js";
import { modelCallbackHandler, modelHandler } from "./handlers/model.handler.js";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN belum diset");
}

const bot = new Telegraf(token);

bot.start((ctx) => {
  ctx.reply(
    "Halo! 👋\n\n" +
      "Saya adalah bot Telegram.\n\n" +
      "Gunakan /help untuk melihat menu.",
  );
});

bot.help((ctx) => {
  ctx.reply(
    "📋 Menu\n\n" +
      "/start - Mulai bot\n" +
      "/help - Bantuan\n" +
      "/barang - Ambil data barang dari API\n" +
      "/model - Pilih model AI\n" +
      "/clear - Hapus history chat\n" +
      "Kirim pesan untuk chat dengan asisten AI",
  );
});

bot.command("barang", barangHandler);
bot.command("model", modelHandler);
bot.command("clear", (ctx) => {
  clearHistory(ctx.chat.id);
  ctx.reply("🗑️ History dihapus.");
});
bot.action(/^model:(.+)$/, modelCallbackHandler);
bot.on("text", chatHandler);

bot.catch((err: any, ctx) => {
  console.error(`Unhandled error for ${ctx.updateType}`, err);
});

bot.launch();

console.log("🤖 Telegram bot berjalan...");
