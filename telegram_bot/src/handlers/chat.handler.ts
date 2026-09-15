import fs from "fs";
import os from "os";
import path from "path";
import { chatWithOpenRouter, getFreeModels, type ChatMessage } from "../services/openrouter.service.js";

const SYSTEM_PROMPT = `Anda adalah asisten chatbot Telegram. Jawab akurat, ringkas, bahasa Indonesia.
Tool: get_barang_hari_ini (FINISHGOOD hari ini) dan get_barang (filter tanggal/status). Pakai tool kalau tanya stok/jumlah/barang, jangan ngarang.
ATURAN FORMAT TELEGRAM KETAT: JANGAN tampilkan tabel dalam bentuk text/markdown (|, ---, grid). Jika data berbentuk tabel, ubah jadi bullet list • (satu baris per item, contoh: • Nama: X — Jumlah: Y) atau ringkasan total. Pakai **bold**, \`code\`, \`\`\`pre\`\`\` saja.`;

// ponytail: in-memory history, 10 turns max. Hilang restart — pakai DB kalau perlu persist.
const chatHistories = new Map<number, ChatMessage[]>();
const MAX_HISTORY = 20; // 20 messages = ~10 turns

export const FALLBACK_MODEL = "liquid/lfm-2.5-2.6b:free";

// ponytail: in-memory per-chat, hilang saat restart. Pakai DB/Redis kalau perlu persist.
const chatModels = new Map<number, string>();

export function getModelForChat(chatId: number): string {
  return chatModels.get(chatId) ?? FALLBACK_MODEL;
}
export function setModelForChat(chatId: number, model: string) {
  chatModels.set(chatId, model);
}

export function clearHistory(chatId: number) {
  chatHistories.delete(chatId);
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function stripTables(s: string): string {
  // ponytail: hilangkan tabel text, ubah jadi bullet list
  const lines = s.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    // skip separator |---|---|
    if (/^[\|\s:\-]+$/.test(t) && t.includes("|") && t.includes("-")) continue;
    if (t.includes("|") && t.split("|").length >= 3) {
      const cells = t.split("|").map((c) => c.trim()).filter(Boolean);
      if (cells.length === 0) continue;
      // header row pertama biarkan sekali, sisanya jadi bullet
      if (out.length === 0 || !out[out.length - 1]?.startsWith("•")) {
        // deteksi header: jika belum ada bullet dan baris berikutnya separator, skip header di iterasi sebelumnya sudah skip
      }
      out.push(`• ${cells.join(" — ")}`);
      continue;
    }
    out.push(line);
  }
  // buang header tabel yang terlanjur jadi bullet ganda — biarkan, lebih baik daripada tabel
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}
function mdToHtml(s: string): string {
  // ponytail: minimal md->HTML untuk Telegram, cukup bold/code/pre
  const noTable = stripTables(s);
  let h = escapeHtml(noTable);
  h = h.replace(/```([\s\S]*?)```/g, (_m, p1) => `<pre>${p1}</pre>`);
  h = h.replace(/`([^`]+?)`/g, "<code>$1</code>");
  h = h.replace(/\*\*([^\n*]+?)\*\*/g, "<b>$1</b>");
  h = h.replace(/__([^\n_]+?)__/g, "<b>$1</b>");
  return h;
}
async function sendTelegram(ctx: any, text: string) {
  const raw = text.trim() || "Maaf, tidak ada respons.";
  const chunks = raw.length <= 4000 ? [raw] : raw.match(/[\s\S]{1,4000}/g) ?? [raw];
  for (const chunk of chunks) {
    const html = mdToHtml(chunk);
    try {
      await ctx.reply(html, { parse_mode: "HTML" });
    } catch {
      // fallback plain kalau HTML invalid / parse error
      await ctx.reply(chunk);
    }
  }
}

function toCsv(rows: any[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}
async function sendExcelIfNeeded(ctx: any, excelData: any) {
  const rows = excelData?.data;
  if (!Array.isArray(rows) || rows.length === 0) return;
  // ringkasan 1 baris tetap text saja, tabel >=2 baris kirim excel
  if (rows.length === 1 && !ctx._forceExcel) {
    // tetap kirim jika data punya banyak kolom (indikasi tabel) — pakai threshold 2
    if (Object.keys(rows[0] ?? {}).length < 3) return;
  }
  if (rows.length < 2) return;
  try {
    console.log(`[excel] kirim ${rows.length} baris`);
    const csv = toCsv(rows);
    const dir = "C:\\Users\\user\\AppData\\Local\\Temp\\opencode";
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `barang_${Date.now()}.csv`);
    fs.writeFileSync(file, "\uFEFF" + csv, "utf8");
    // Telegraf butuh ReadStream/Buffer, bukan path string mentah
    await ctx.replyWithDocument(
      { source: fs.createReadStream(file), filename: `barang_${new Date().toISOString().slice(0, 10)}.csv` },
      { caption: `📊 Data tabel — ${rows.length} baris (buka di Excel)` } as any,
    );
    setTimeout(() => { try { fs.unlinkSync(file); } catch {} }, 30_000);
  } catch (e) {
    console.error("Excel send failed", e);
    try { await ctx.reply("⚠️ Gagal kirim file Excel, tampilkan ringkasan di chat."); } catch {}
  }
}

export async function chatHandler(ctx: any) {
  const text = ctx.message?.text ?? "";
  const chatId = ctx.chat?.id;

  if (!text || !chatId) {
    return;
  }

  let model = getModelForChat(chatId);
  let history = chatHistories.get(chatId) ?? [];
  let messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: text },
  ];

  try {
    const result = await chatWithOpenRouter(messages, model);

    // preserve reasoning_details unmodified for next turn
    history.push({ role: "user", content: text });
    history.push({
      role: "assistant",
      content: result.content,
      ...(result.reasoning_details ? { reasoning_details: result.reasoning_details } : {}),
    } as ChatMessage);

    // trim old turns
    while (history.length > MAX_HISTORY) history.shift();
    chatHistories.set(chatId, history);

    await sendTelegram(ctx, result.content);
    if (result.excelData) await sendExcelIfNeeded(ctx, result.excelData);
  } catch (error: any) {
    if (error?.status === 402) {
      console.warn("OpenRouter 402: credits habis / payment required");
      await ctx.reply(
        "⚠️ Layanan AI sedang tidak tersedia (saldo OpenRouter habis).\nHubungi admin untuk isi ulang di https://openrouter.ai/settings/credits",
      );
      return;
    }
    if (error?.status === 429) {
      console.warn("OpenRouter 429: rate-limited", String(error.message).slice(0, 200));
      // auto fallback ke model free lain (non-Google dulu)
      try {
        const models = await getFreeModels();
        const alt = models.find((m) => m !== model && !m.includes("google/")) ?? models.find((m) => m !== model);
        if (alt && alt !== model) {
          console.warn(`429 fallback ${model} -> ${alt}`);
          await ctx.reply(`⏳ ${model} rate-limited, coba fallback ke ${alt}...`);
          setModelForChat(chatId, alt);
          // retry sekali dengan model baru
          messages = [
            { role: "system", content: SYSTEM_PROMPT },
            ...history,
            { role: "user", content: text },
          ];
          const retry = await chatWithOpenRouter(messages, alt);
          history.push({ role: "user", content: text });
          history.push({
            role: "assistant",
            content: retry.content,
            ...(retry.reasoning_details ? { reasoning_details: retry.reasoning_details } : {}),
          } as ChatMessage);
          while (history.length > MAX_HISTORY) history.shift();
          chatHistories.set(chatId, history);
          await sendTelegram(ctx, retry.content);
          if ((retry as any).excelData) await sendExcelIfNeeded(ctx, (retry as any).excelData);
          return;
        }
      } catch (e) {
        console.error("Fallback 429 gagal", e);
      }
      await ctx.reply(
        "⏳ Model gratis sedang rate-limited (banyak yang pakai).\n" +
          "Coba lagi 10-20 detik, atau ganti model: /model\n" +
          "Tips: pilih model non-Google (mis. nvidia/..., liquid/...) atau tambah key di https://openrouter.ai/settings/integrations",
      );
      return;
    }
    console.error(error);
    await ctx.reply("❌ Terjadi kesalahan saat menghubungi asisten.");
  }
}
