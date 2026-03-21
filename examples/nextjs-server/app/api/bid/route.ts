import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getDatabase } from '@/lib/mongodb'

// GET — récupère le bid actuel entre deux users
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const matchId = searchParams.get('matchId')
    if (!matchId) return NextResponse.json({ error: 'matchId manquant' }, { status: 400 })

    const db = await getDatabase()
    const bid = await db.collection('bids').findOne({ matchId })
    return NextResponse.json({ bid: bid ?? null })
}

// POST — propose ou accepte un montant
export async function POST(req: NextRequest) {
    const cookieStore = await cookies()
    const name = cookieStore.get('chat_user')?.value
    if (!name) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

    const { matchId, amount, action } = await req.json()
    if (!matchId) return NextResponse.json({ error: 'matchId manquant' }, { status: 400 })

    const db = await getDatabase()

    if (action === 'propose') {
        await db.collection('bids').updateOne(
            { matchId },
            {
                $set: {
                    proposedBy: name,
                    amount,
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
            { $set: { status: 'accepted', acceptedBy: name, updatedAt: new Date() } }
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

    return NextResponse.json({ error: 'action invalide' }, { status: 400 })
}
