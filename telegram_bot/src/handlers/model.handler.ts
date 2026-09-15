import { getModelForChat, setModelForChat } from "./chat.handler.js";
import { getFreeModels } from "../services/openrouter.service.js";

function modelKeyboard(models: string[], current: string) {
  return {
    reply_markup: {
      inline_keyboard: models.map((m) => [
        { text: `${m === current ? "✅ " : ""}${m}`, callback_data: `model:${m}` },
      ]),
    },
  };
}

export async function modelHandler(ctx: any) {
  const chatId = ctx.chat?.id;
  const args = ctx.message?.text?.split(/\s+/).slice(1).join(" ").trim();
  const models = await getFreeModels();

  // /model <nama> langsung set
  if (args) {
    const found = models.find((m) => m.toLowerCase() === args.toLowerCase());
    if (!found) {
      await ctx.reply(`Model tidak dikenal.\nGratis dari API:\n${models.map((m) => `- ${m}`).join("\n")}\n\nKetik: /model <nama>`);
      return;
    }
    setModelForChat(chatId, found);
    await ctx.reply(`✅ Model diganti ke: ${found}`);
    return;
  }

  const current = getModelForChat(chatId);
  await ctx.reply(`🤖 Model saat ini: ${current}\nPilih model gratis (dari https://openrouter.ai/api/v1/models):`, modelKeyboard(models, current));
}

export async function modelCallbackHandler(ctx: any) {
  const model = ctx.match?.[1];
  try {
    // answer immediately — Telegram timeout ~3s, fetch must not block it
    await ctx.answerCbQuery(`Model: ${model}`).catch(() => {});
    const models = await getFreeModels();
    if (!models.includes(model)) {
      await ctx.answerCbQuery("Model tidak dikenal").catch(() => {});
      return;
    }
    setModelForChat(ctx.chat!.id, model);
    await ctx.editMessageText(`✅ Model diganti ke: ${model}`, modelKeyboard(models, model));
  } catch (e) {
    console.error(e);
    try { await ctx.answerCbQuery("Gagal ganti model").catch(() => {}); } catch {}
  }
}
