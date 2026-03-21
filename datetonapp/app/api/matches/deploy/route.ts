import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';
import { getDatabase } from '../../../../lib/mongodb';
import { deployEscrowContract } from '../../../../lib/escrow';

/**
 * POST /api/matches/deploy
 * Body: { matchId: string }
 *
 * Deploys a DateEscrow contract for an accepted bid.
 * Stores the contract address in the match document.
 */
export async function POST(req: NextRequest) {
    const cookieStore = await cookies();
    if (!cookieStore.get('dateton_user')?.value) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { matchId } = (await req.json()) as { matchId: string };
    if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 });

    const db = await getDatabase();

    let objectId: ObjectId;
    try { objectId = new ObjectId(matchId); } catch {
        return NextResponse.json({ error: 'Invalid matchId' }, { status: 400 });
    }

    const match = await db.collection('matches').findOne({ _id: objectId });
    const bid = await db.collection('bids').findOne({ matchId, status: 'accepted' });

    if (!match || !bid) {
        return NextResponse.json({ error: 'Match or accepted bid not found' }, { status: 404 });
    }

    // Already deployed?
    if (bid.contractAddress) {
        return NextResponse.json({ contractAddress: bid.contractAddress });
    }

    // Both wallets required
    if (!match.wallet1 || !match.wallet2) {
        return NextResponse.json(
            { error: 'Both users must have a wallet connected before deploying the escrow' },
            { status: 400 }
        );
    }

    const deadline = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7; // 7 days

    try {
        const contractAddress = await deployEscrowContract({
            wallet1: match.wallet1,
            wallet2: match.wallet2,
            amountTon: bid.amount,
            deadline,
        });

        // Store contract info on bid, not match
        await db.collection('bids').updateOne(
            { matchId, status: 'accepted' },
            {
                $set: {
                    contractAddress,
                    escrowStatus: 'PENDING_FUND',
                    escrowDeadline: deadline,
                    updatedAt: new Date(),
                },
            }
        );

        return NextResponse.json({ contractAddress });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Deploy failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
