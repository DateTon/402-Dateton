import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { normalizeName } from '../../../lib/auth';

type LoginRequestBody = {
    name?: unknown;
};

export async function POST(request: NextRequest) {
    try {
        const body = (await request.json()) as LoginRequestBody;
        const name = normalizeName(body.name);

        if (!name) {
            return NextResponse.json(
                { error: 'Le nom est obligatoire' },
                { status: 400 }
            );
        }

        const cookieStore = await cookies();

        cookieStore.set('chat_user', name, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 60 * 60 * 24 * 7,
        });

        return NextResponse.json({ ok: true, name });
    } catch {
        return NextResponse.json(
            { error: 'Requête invalide' },
            { status: 400 }
        );
    }
}
