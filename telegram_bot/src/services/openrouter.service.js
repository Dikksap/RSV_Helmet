const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY belum diset");
}
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export async function chatWithOpenRouter(messages, model = "google/gemini-2.5-flash") {
    const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com",
            "X-Title": "Telegram Chatbot",
        },
        body: JSON.stringify({
            model,
            messages,
            stream: false,
        }),
    });
    if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data.choices[0]?.message?.content ?? "Maaf, saya tidak bisa merespons.";
}
