import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';
import { getDatabase } from '../../../lib/mongodb';
import { findUserByTelegramId } from '../../../lib/db';

/**
 * GET /api/match-detail?matchId=xxx
 * Returns full match details including contract info and other user profile.
 */
export async function GET(req: NextRequest) {
    const cookieStore = await cookies();
    const telegramIdStr = cookieStore.get('dateton_user')?.value;
    if (!telegramIdStr) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const telegramId = Number(telegramIdStr);
    const matchId = req.nextUrl.searchParams.get('matchId');
    if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 });

    let objectId: ObjectId;
    try { objectId = new ObjectId(matchId); } catch {
        return NextResponse.json({ error: 'Invalid matchId' }, { status: 400 });
    }

    const db = await getDatabase();
    const match = await db.collection('matches').findOne({
        _id: objectId,
        $or: [{ user1: telegramId }, { user2: telegramId }],
    });

    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    const otherTelegramId = match.user1 === telegramId ? match.user2 : match.user1;
    const otherUser = await findUserByTelegramId(otherTelegramId as number);

    const bid = await db.collection('bids').findOne({ matchId });

    return NextResponse.json({
        matchId,
        status: bid?.escrowStatus ?? match.status,
        contractAddress: bid?.contractAddress ?? null,
        escrowAmount: bid?.amount ?? null,
        wallet1: match.wallet1,
        wallet2: match.wallet2,
        myTelegramId: telegramId,
        isUser1: match.user1 === telegramId,
        otherUser: otherUser ? {
            telegramId: otherUser.telegramId,
            firstName: otherUser.firstName,
            images: otherUser.images,
        } : null,
        bid: bid ? { amount: bid.amount, status: bid.status } : null,
    });
}
