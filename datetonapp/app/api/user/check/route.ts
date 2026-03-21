import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { findUserByTelegramId } from '../../../../lib/db';

const COOKIE_NAME = 'dateton_user';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { telegramId } = body;

        if (!telegramId || typeof telegramId !== 'number') {
            return NextResponse.json({ error: 'telegramId is required' }, { status: 400 });
        }

        const user = await findUserByTelegramId(telegramId);

        if (user) {
            const cookieStore = await cookies();
            cookieStore.set(COOKIE_NAME, String(telegramId), {
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                path: '/',
                maxAge: 60 * 60 * 24 * 30,
            });
        }

        return NextResponse.json({ exists: !!user, user: user || null });
    } catch {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
