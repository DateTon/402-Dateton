import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ObjectId } from 'mongodb'
import { getDatabase } from '../../../lib/mongodb'
import { deployEscrowContract } from '../../../lib/escrow'

// GET — get the current bid for a match
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const matchId = searchParams.get('matchId')
    if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 })

    const db = await getDatabase()
    const bid = await db.collection('bids').findOne({ matchId })
    return NextResponse.json({ bid: bid ?? null })
}

// POST — propose, accept, reject, or counter a bid
export async function POST(req: NextRequest) {
    const cookieStore = await cookies()
    const telegramIdStr = cookieStore.get('dateton_user')?.value
    if (!telegramIdStr) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const telegramId = Number(telegramIdStr)
    const { matchId, amount, action } = await req.json()
    if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 })

    const db = await getDatabase()

    if (action === 'propose') {
        if (!amount || isNaN(Number(amount))) {
            return NextResponse.json({ error: 'Valid amount required' }, { status: 400 })
        }
        // Delete any existing bid first to ensure a clean slate
        // (old bids may carry stale contractAddress/escrowStatus from a previous cycle)
        await db.collection('bids').deleteOne({ matchId })
        await db.collection('bids').insertOne({
            matchId,
            proposedBy: telegramId,
            amount: Number(amount),
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
        })
        return NextResponse.json({ ok: true })
    }

    if (action === 'accept') {
        await db.collection('bids').updateOne(
            { matchId },
            { $set: { status: 'accepted', acceptedBy: telegramId, updatedAt: new Date() } }
        )

        // Auto-deploy escrow contract
        try {
            let objectId: ObjectId
            try { objectId = new ObjectId(matchId) } catch {
                return NextResponse.json({ ok: true })
            }

            const match = await db.collection('matches').findOne({ _id: objectId })
            const bid = await db.collection('bids').findOne({ matchId, status: 'accepted' })

            if (match && bid && match.wallet1 && match.wallet2 && !bid.contractAddress) {
                const contractAddress = await deployEscrowContract({
                    wallet1: match.wallet1,
                    wallet2: match.wallet2,
                    amountTon: bid.amount,
                })

                await db.collection('bids').updateOne(
                    { matchId, status: 'accepted' },
                    {
                        $set: {
                            contractAddress,
                            escrowStatus: 'PENDING_FUND',
                            updatedAt: new Date(),
                        },
                    }
                )

                await db.collection('date_setup').updateOne(
                    { matchId },
                    {
                        $set: {
                            step: 'fund',
                            fundedBy: [],
                            selectedActivity: null,
                            activityStatus: null,
                            proposedDate: null,
                            dateStatus: null,
                            proposedBy: null,
                            updatedAt: new Date(),
                        },
                        $setOnInsert: { createdAt: new Date() },
                    },
                    { upsert: true }
                )
            }
        } catch (err) {
            console.error('Auto-deploy failed:', err)
        }

        return NextResponse.json({ ok: true })
    }

    if (action === 'reject') {
        await db.collection('bids').updateOne(
            { matchId },
            { $set: { status: 'rejected', updatedAt: new Date() } }
        )
        return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
