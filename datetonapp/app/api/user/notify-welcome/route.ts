import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sendTelegramMessage } from "../../../../lib/telegram";
import { findUserByTelegramId } from "../../../../lib/db";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

export async function POST() {
    try {
        const cookieStore = await cookies();
        const telegramIdStr = cookieStore.get("dateton_user")?.value;
        if (!telegramIdStr) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const telegramId = Number(telegramIdStr);
        const user = await findUserByTelegramId(telegramId);
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        await sendTelegramMessage(
            telegramId,
            `\u{1F44B} <b>Bienvenue sur DateTon, ${user.firstName || "toi"} !</b>\n\n` +
            `Tu recevras ici tes notifications de match et de rendez-vous. \u{1F498}\n\n` +
            `<a href="${APP_URL}">Ouvrir DateTon \u2192</a>`
        );

        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
