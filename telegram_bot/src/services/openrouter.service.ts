import { getBarang, getFinishgoodHariIni } from "./api.service.js";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  throw new Error("OPENROUTER_API_KEY belum diset");
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

// fallback dari API live 2026-09, dipakai kalau fetch gagal
const FALLBACK_FREE_MODELS = [
  "inclusionai/ling-3.0-flash-vl:free",
  "nex-agi/nex-n2.5-mini:free",
  "nex-agi/nex-n2.5-pro:free",
  "inclusionai/ling-3.0-flash-sante:free",
  "inclusionai/ling-3.0-flash-fin:free",
  "dots-studio/dots-3-note-preview:free",
  "liquid/lfm-2.5-2.6b:free",
  "nvidia/nemotron-3.5-lightning:free",
  "thinkingmachines/inkling-small:free",
  "poolside/laguna-s-2.1:free",
  "thinkingmachines/inkling:free",
  "poolside/laguna-xs-2.1:free",
  "cohere/north-mini-code:free",
  "nvidia/nemotron-3.5-content-safety:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
];

let freeCache: string[] | null = null;
let freeCacheAt = 0;

export async function getFreeModels(): Promise<string[]> {
  if (freeCache && Date.now() - freeCacheAt < 3_600_000) return freeCache;
  try {
    const res = await fetch(OPENROUTER_MODELS_URL);
    if (!res.ok) throw new Error(String(res.status));
    const json: any = await res.json();
    const ids: string[] = (json.data ?? [])
      .filter((m: any) => typeof m.id === "string" && m.id.endsWith(":free"))
      .map((m: any) => m.id);
    if (ids.length) {
      freeCache = ids;
      freeCacheAt = Date.now();
      return ids;
    }
  } catch {}
  return freeCache ?? FALLBACK_FREE_MODELS;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  reasoning_details?: any;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

export interface ChatResponse {
  choices: { message: { content: string; reasoning_details?: any; reasoning?: string; tool_calls?: any[] } ; finish_reason?: string }[];
}

const TOOLS: any[] = [
  {
    type: "function",
    function: {
      name: "get_barang_hari_ini",
      description: "Ambil data produksi FINISHGOOD hari ini dari API barang. Pakai untuk pertanyaan jumlah/stok/barang hari ini.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_barang",
      description: "Ambil data barang umum dari API. Bisa filter tanggal (YYYY-MM-DD) dan status.",
      parameters: {
        type: "object",
        properties: {
          tanggal: { type: "string", description: "Tanggal YYYY-MM-DD, kosongkan untuk hari ini" },
          status: { type: "string", description: "Status barang, contoh FINISHGOOD" },
          limit: { type: "string", description: "Limit jumlah data" },
        },
        required: [],
      },
    },
  },
];

let _lastToolRaw: any = null;
export function getLastToolRaw() { return _lastToolRaw; }

async function executeTool(name: string, args: any): Promise<string> {
  try {
    if (name === "get_barang_hari_ini") {
      const data: any = await getFinishgoodHariIni();
      _lastToolRaw = data;
      // kirim ke AI versi ringkas (max 30 baris) biar tidak pecah JSON
      const preview = Array.isArray(data.data) && data.data.length > 30 ? { ...data, data: data.data.slice(0, 30) } : data;
      return JSON.stringify(preview).slice(0, 4000);
    }
    if (name === "get_barang") {
      const data: any = await getBarang().catch(async () => await getFinishgoodHariIni());
      let out: any = data;
      if (args?.tanggal && Array.isArray(data?.data)) {
        out = { ...data, data: data.data.filter((d: any) => !args.tanggal || String(d.tanggal ?? d.date ?? "").includes(args.tanggal)) };
      }
      _lastToolRaw = out;
      const preview = Array.isArray(out.data) && out.data.length > 30 ? { ...out, data: out.data.slice(0, 30) } : out;
      return JSON.stringify(preview).slice(0, 4000);
    }
  } catch (e: any) {
    return `Error: ${e.message}`;
  }
  return `Unknown tool: ${name}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function chatWithOpenRouter(
  messages: ChatMessage[],
  model = "google/gemini-2.5-flash",
): Promise<{ content: string; reasoning_details?: any; excelData?: any }> {
  // ponytail: tool loop max 5 — cukup untuk 1-2 fetch barang
  _lastToolRaw = null;
  let curMessages: ChatMessage[] = [...messages];
  let lastToolRaw: any = null;
  for (let iter = 0; iter < 5; iter++) {
    let response: Response | null = null;
    let lastBody = "";
    // retry 429 up to 2x dengan backoff
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com",
          "X-Title": "Telegram Chatbot",
        },
        body: JSON.stringify({
          model,
          messages: curMessages,
          stream: false,
          reasoning: { enabled: true },
          tools: TOOLS,
          tool_choice: "auto",
        }),
      });
      if (response.ok) break;
      lastBody = await response.text().catch(() => "");
      if (response.status !== 429 || attempt === 2) break;
      const retryAfter = Number(response.headers.get("retry-after")) * 1000;
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 1500 * (attempt + 1);
      console.warn(`OpenRouter 429 rate-limited, retry ${attempt + 1}/2 in ${delay}ms`);
      await sleep(delay);
    }

    if (!response || !response.ok) {
      const status = response?.status ?? 429;
      const statusText = response?.statusText ?? "Rate limited";
      const err = new Error(`OpenRouter API error: ${status} ${statusText}${lastBody ? ` - ${lastBody.slice(0, 400)}` : ""}`) as Error & { status?: number };
      err.status = status;
      throw err;
    }

    const data: ChatResponse = await response.json();
    const msg: any = data.choices[0]?.message;

    if (msg?.tool_calls?.length) {
      curMessages.push({
        role: "assistant",
        content: msg.content ?? "",
        tool_calls: msg.tool_calls,
        ...(msg.reasoning_details ? { reasoning_details: msg.reasoning_details } : {}),
      } as ChatMessage);
      for (const tc of msg.tool_calls) {
        const name = tc.function?.name ?? tc.name;
        let args: any = {};
        try { args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {}; } catch {}
        const result = await executeTool(name, args);
        lastToolRaw = _lastToolRaw ?? lastToolRaw;
        curMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        } as ChatMessage);
      }
      continue;
    }

    return {
      content: msg?.content ?? "Maaf, saya tidak bisa merespons.",
      reasoning_details: msg?.reasoning_details,
      excelData: lastToolRaw ?? _lastToolRaw,
    };
  }
  // tool loop habis tapi tidak ada final content — kembalikan ringkasan terakhir, bukan error generic
  console.warn("Tool loop exhausted, fallback ke ringkasan barang");
  try {
    const fallbackData: any = lastToolRaw ?? (await getFinishgoodHariIni());
    const total = fallbackData?.meta?.total ?? fallbackData?.data?.length ?? 0;
    return {
      content: `Produksi FINISHGOOD hari ini: **${total}** barang. (fallback — model tidak merespons setelah tool)`,
      reasoning_details: undefined,
      excelData: fallbackData,
    };
  } catch {}
  const lastTool = [...curMessages].reverse().find((m) => m.role === "tool")?.content;
  if (lastTool) return { content: lastTool.slice(0, 3500), reasoning_details: undefined, excelData: lastToolRaw };
  return { content: "Maaf, gagal memproses permintaan. Coba tanya lagi atau /clear.", reasoning_details: undefined };
}
