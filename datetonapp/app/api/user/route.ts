import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { findUserByTelegramId, createUser, updateUser } from '../../../lib/db';

const COOKIE_NAME = 'dateton_user';

export async function GET() {
    try {
        const cookieStore = await cookies();
        const telegramIdStr = cookieStore.get(COOKIE_NAME)?.value;

        if (!telegramIdStr) {
            return NextResponse.json({ user: null }, { status: 401 });
        }

        const telegramId = Number(telegramIdStr);
        if (isNaN(telegramId)) {
            cookieStore.delete(COOKIE_NAME);
            return NextResponse.json({ user: null }, { status: 401 });
        }

        const user = await findUserByTelegramId(telegramId);
        if (!user) {
            cookieStore.delete(COOKIE_NAME);
            return NextResponse.json({ user: null }, { status: 401 });
        }

        return NextResponse.json({ user });
    } catch {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const telegramIdStr = cookieStore.get(COOKIE_NAME)?.value;

        if (!telegramIdStr) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const telegramId = Number(telegramIdStr);
        if (isNaN(telegramId)) {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        }

        const body = await request.json();
        const { firstName, lastName, age, bio, gender, interestedIn, interests, images, walletAddress } = body;

        const user = await updateUser(telegramId, {
            firstName: firstName || '',
            lastName: lastName || '',
            age: age ? Number(age) : 18,
            bio: bio || '',
            gender: gender || '',
            interestedIn: Array.isArray(interestedIn) ? interestedIn : [],
            interests: Array.isArray(interests) ? interests : [],
            images: Array.isArray(images) ? images : [],
            walletAddress: walletAddress || '',
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({ user });
    } catch {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { telegramId, firstName, lastName, age, bio, gender, interestedIn, interests, images, walletAddress } = body;

        if (!telegramId || typeof telegramId !== 'number') {
            return NextResponse.json({ error: 'telegramId is required' }, { status: 400 });
        }

        const existing = await findUserByTelegramId(telegramId);
        if (existing) {
            return NextResponse.json({ error: 'User already registered' }, { status: 409 });
        }

        const user = await createUser({
            telegramId,
            firstName: firstName || '',
            lastName: lastName || '',
            age: age ? Number(age) : 18,
            bio: bio || '',
            gender: gender || '',
            interestedIn: Array.isArray(interestedIn) ? interestedIn : [],
            interests: Array.isArray(interests) ? interests : [],
            images: Array.isArray(images) ? images : [],
            walletAddress: walletAddress || '',
        });

        const cookieStore = await cookies();
        cookieStore.set(COOKIE_NAME, String(telegramId), {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 60 * 60 * 24 * 30,
        });

        return NextResponse.json({ user });
    } catch {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
