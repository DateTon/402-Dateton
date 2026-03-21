import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDatabase } from '../../../lib/mongodb';
import { findUserByTelegramId } from '../../../lib/db';

/**
 * GET /api/my-matches
 * Returns all matches for the current user, with the other person's profile info.
 */
export async function GET() {
    const cookieStore = await cookies();
    const telegramIdStr = cookieStore.get('dateton_user')?.value;
    if (!telegramIdStr) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const telegramId = Number(telegramIdStr);
    const db = await getDatabase();

    const matchDocs = await db.collection('matches').find({
        $or: [{ user1: telegramId }, { user2: telegramId }],
    }).sort({ createdAt: -1 }).toArray();

    const matches = await Promise.all(
        matchDocs.map(async (m) => {
            const otherTelegramId = m.user1 === telegramId ? m.user2 : m.user1;
            const otherUser = await findUserByTelegramId(otherTelegramId as number);

            return {
                matchId: m._id.toString(),
                otherUser: otherUser ? {
                    telegramId: otherUser.telegramId,
                    firstName: otherUser.firstName,
                    lastName: otherUser.lastName,
                    age: otherUser.age,
                    images: otherUser.images,
                } : null,
                status: m.status,
                createdAt: m.createdAt,
            };
        })
    );

    return NextResponse.json(matches);
}
