import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';
import { getDatabase } from '../../../lib/mongodb';
import { encryptText, decryptText, type EncryptedPayload } from '../../../lib/crypto';

function isEncrypted(val: unknown): val is EncryptedPayload {
    return !!val && typeof val === 'object' && 'cipherText' in val;
}

/**
 * GET /api/chat-match?matchId=xxx
 * Returns messages for a specific match.
 *
 * POST /api/chat-match
 * Body: { matchId: string, message: string }
 * Sends a message in a match chat.
 */
export async function GET(req: NextRequest) {
    const cookieStore = await cookies();
    const telegramIdStr = cookieStore.get('dateton_user')?.value;
    if (!telegramIdStr) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const telegramId = Number(telegramIdStr);
    const matchId = req.nextUrl.searchParams.get('matchId');
    if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 });

    const db = await getDatabase();

    // Verify this user is part of this match
    let objectId: ObjectId;
    try { objectId = new ObjectId(matchId); } catch { return NextResponse.json({ error: 'Invalid matchId' }, { status: 400 }); }

    const match = await db.collection('matches').findOne({
        _id: objectId,
        $or: [{ user1: telegramId }, { user2: telegramId }],
    });
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    const docs = await db.collection('match_messages')
        .find({ matchId })
        .sort({ createdAt: 1 })
        .limit(200)
        .toArray();

    const messages = docs.map((doc) => ({
        id: doc._id.toString(),
        from: doc.from as number,
        message: isEncrypted(doc.encryptedMessage) ? decryptText(doc.encryptedMessage) : (doc.message as string ?? ''),
        createdAt: doc.createdAt,
        type: (doc.type as string) ?? 'user',
    }));

    return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
    const cookieStore = await cookies();
    const telegramIdStr = cookieStore.get('dateton_user')?.value;
    if (!telegramIdStr) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const telegramId = Number(telegramIdStr);
    const { matchId, message, type } = (await req.json()) as { matchId: string; message: string; type?: string };

    if (!matchId || !message?.trim()) {
        return NextResponse.json({ error: 'matchId and message required' }, { status: 400 });
    }

    const db = await getDatabase();

    let objectId: ObjectId;
    try { objectId = new ObjectId(matchId); } catch { return NextResponse.json({ error: 'Invalid matchId' }, { status: 400 }); }

    const match = await db.collection('matches').findOne({
        _id: objectId,
        $or: [{ user1: telegramId }, { user2: telegramId }],
    });
    if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 });

    if (type === 'system') {
        // System messages are stored as plain text, not encrypted
        await db.collection('match_messages').insertOne({
            matchId,
            from: 0, // system
            message: message.trim(),
            type: 'system',
            createdAt: new Date(),
        });
    } else {
        const encrypted = encryptText(message.trim());
        await db.collection('match_messages').insertOne({
            matchId,
            from: telegramId,
            encryptedMessage: encrypted,
            createdAt: new Date(),
        });
    }

    return NextResponse.json({ ok: true });
}
