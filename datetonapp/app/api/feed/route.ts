import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDatabase } from '../../../lib/mongodb';
import { findUserByTelegramId } from '../../../lib/db';
import { decryptText, type EncryptedPayload } from '../../../lib/crypto';

function isEncrypted(val: unknown): val is EncryptedPayload {
    return !!val && typeof val === 'object' && 'cipherText' in val;
}

function safeDecrypt(val: unknown): string {
    if (isEncrypted(val)) { try { return decryptText(val); } catch { return ''; } }
    return typeof val === 'string' ? val : '';
}

function safeDecryptArray(val: unknown): string[] {
    if (isEncrypted(val)) { try { return JSON.parse(decryptText(val)); } catch { return []; } }
    if (Array.isArray(val)) return val as string[];
    return [];
}

/**
 * GET /api/feed
 *
 * 1. Auth via dateton_user cookie
 * 2. Exclude already-swiped and already-matched users
 * 3. Decrypt profiles
 * 4. Filter by interestedIn preference
 * 5. Rank by shared interests (highest first)
 */
export async function GET() {
    const cookieStore = await cookies();
    const telegramIdStr = cookieStore.get('dateton_user')?.value;
    if (!telegramIdStr) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const telegramId = Number(telegramIdStr);
    const currentUser = await findUserByTelegramId(telegramId);
    if (!currentUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const db = await getDatabase();

    // IDs already swiped
    const swipedDocs = await db
        .collection('swipes')
        .find({ from: telegramId }, { projection: { to: 1 } })
        .toArray();
    const swipedIds = swipedDocs.map((s) => s.to as number);

    // IDs already matched
    const matchDocs = await db
        .collection('matches')
        .find({ $or: [{ user1: telegramId }, { user2: telegramId }] }, { projection: { user1: 1, user2: 1 } })
        .toArray();
    const matchedIds = matchDocs.map((m) =>
        m.user1 === telegramId ? (m.user2 as number) : (m.user1 as number)
    );

    const excludedIds = Array.from(new Set([telegramId, ...swipedIds, ...matchedIds]));

    const rawUsers = await db
        .collection('users')
        .find({ telegramId: { $nin: excludedIds } })
        .limit(20)
        .toArray();

    // Decrypt & filter by interestedIn
    const myInterests = new Set(currentUser.interests.map((i) => i.toLowerCase()));

    const profiles = rawUsers
        .map((doc) => {
            const gender = safeDecrypt(doc.gender);
            const interests = (doc.interests as string[]) ?? [];
            const sharedInterests = interests.filter((i) => myInterests.has(i.toLowerCase()));

            const boostedUntil = doc.boostedUntil ? new Date(doc.boostedUntil) : null;
            const boosted = !!boostedUntil && boostedUntil.getTime() > Date.now();

            return {
                telegramId: doc.telegramId as number,
                firstName: safeDecrypt(doc.firstName),
                lastName: safeDecrypt(doc.lastName),
                age: (doc.age as number) ?? 0,
                bio: safeDecrypt(doc.bio),
                gender,
                interestedIn: safeDecryptArray(doc.interestedIn),
                interests,
                images: safeDecryptArray(doc.images),
                score: sharedInterests.length,
                sharedInterests,
                boosted,
            };
        })
        .filter((u) => {
            // Only show profiles whose gender matches what currentUser is interested in
            if (currentUser.interestedIn.length === 0) return true;
            return currentUser.interestedIn.includes(u.gender);
        })
        // Boosted profiles first, then by shared interests, then alphabetically
        .sort((a, b) => {
            if (a.boosted !== b.boosted) return a.boosted ? -1 : 1;
            return b.score - a.score || a.firstName.localeCompare(b.firstName);
        });

    return NextResponse.json(profiles);
}
