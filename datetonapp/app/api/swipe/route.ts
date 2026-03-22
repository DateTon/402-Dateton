import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDatabase } from '../../../lib/mongodb';
import { findUserByTelegramId } from '../../../lib/db';
import { sendTelegramMessage } from '../../../lib/telegram';

/**
 * POST /api/swipe
 * Body: { targetTelegramId: number, action: 'like' | 'pass' }
 *
 * Records a swipe. If mutual like detected, creates a match.
 */
export async function POST(req: NextRequest) {
    const cookieStore = await cookies();
    const telegramIdStr = cookieStore.get('dateton_user')?.value;
    if (!telegramIdStr) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const telegramId = Number(telegramIdStr);
    const { targetTelegramId, action } = (await req.json()) as {
        targetTelegramId: number;
        action: 'like' | 'pass';
    };

    if (!targetTelegramId || !['like', 'pass'].includes(action)) {
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const db = await getDatabase();

    // Idempotent: don't duplicate swipes
    const existing = await db.collection('swipes').findOne({ from: telegramId, to: targetTelegramId });
    if (existing) return NextResponse.json({ message: 'Already swiped', matched: false });

    await db.collection('swipes').insertOne({
        from: telegramId,
        to: targetTelegramId,
        action,
        createdAt: new Date(),
    });

    let matched = false;
    let matchId: string | null = null;

    if (action === 'like') {
        // Check if the other person also liked us
        const mutualLike = await db.collection('swipes').findOne({
            from: targetTelegramId,
            to: telegramId,
            action: 'like',
        });

        if (mutualLike) {
            // Avoid duplicate match
            const existingMatch = await db.collection('matches').findOne({
                $or: [
                    { user1: telegramId, user2: targetTelegramId },
                    { user1: targetTelegramId, user2: telegramId },
                ],
            });

            if (!existingMatch) {
                const [u1, u2] = await Promise.all([
                    findUserByTelegramId(telegramId),
                    findUserByTelegramId(targetTelegramId),
                ]);

                const result = await db.collection('matches').insertOne({
                    user1: telegramId,
                    user2: targetTelegramId,
                    wallet1: u1?.walletAddress ?? '',
                    wallet2: u2?.walletAddress ?? '',
                    status: 'pending',
                    createdAt: new Date(),
                });

                matched = true;
                matchId = result.insertedId.toString();

                // Notify both users via Telegram (awaited so Vercel doesn't kill the function)
                const matchUrl = `${process.env.NEXT_PUBLIC_APP_URL}/chat/${matchId}`;
                await Promise.allSettled([
                    sendTelegramMessage(
                        telegramId,
                        `\u{1F499} <b>It's a match !</b>\n\nTu as match\u00e9 avec <b>${u2?.firstName ?? "quelqu'un"}</b> !\n\n<a href="${matchUrl}">\u{1F4AC} Ouvrir le chat \u2192</a>`
                    ),
                    sendTelegramMessage(
                        targetTelegramId,
                        `\u{1F499} <b>It's a match !</b>\n\nTu as match\u00e9 avec <b>${u1?.firstName ?? "quelqu'un"}</b> !\n\n<a href="${matchUrl}">\u{1F4AC} Ouvrir le chat \u2192</a>`
                    ),
                ]);
            }
        }
    }

    return NextResponse.json({ matched, matchId });
}
