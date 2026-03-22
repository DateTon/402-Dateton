const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
    if (!TELEGRAM_BOT_TOKEN) {
        console.error("[Telegram] TELEGRAM_BOT_TOKEN is not set");
        return;
    }
    try {
        const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: "HTML",
            }),
        });
        if (!res.ok) {
            const body = await res.text();
            console.error(`[Telegram] sendMessage failed (${res.status}): ${body}`);
        }
    } catch (err) {
        console.error("[Telegram] sendMessage error:", err);
    }
}
