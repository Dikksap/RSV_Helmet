import { chatWithOpenRouter } from "../services/openrouter.service.js";
const SYSTEM_PROMPT = `Anda adalah asisten chatbot yang membantu pengguna dengan jawaban yang akurat dan berguna. Respons dalam bahasa Indonesia.`;
export async function chatHandler(ctx) {
    const text = ctx.message?.text ?? "";
    const chatId = ctx.chat?.id;
    if (!text || !chatId) {
        return;
    }
    try {
        const reply = await chatWithOpenRouter([
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: text },
        ]);
        await ctx.reply(reply);
    }
    catch (error) {
        console.error(error);
        await ctx.reply("❌ Terjadi kesalahan saat menghubungi asisten.");
    }
}
