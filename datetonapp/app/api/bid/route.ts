import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getDatabase } from '../../../lib/mongodb'

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
        await db.collection('bids').updateOne(
            { matchId },
            {
                $set: {
                    proposedBy: telegramId,
                    amount: Number(amount),
                    status: 'pending',
                    updatedAt: new Date(),
                },
                $setOnInsert: { createdAt: new Date() },
            },
            { upsert: true }
        )
        return NextResponse.json({ ok: true })
    }

    if (action === 'accept') {
        await db.collection('bids').updateOne(
            { matchId },
            { $set: { status: 'accepted', acceptedBy: telegramId, updatedAt: new Date() } }
        )
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
