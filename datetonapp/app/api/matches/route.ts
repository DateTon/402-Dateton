import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getDatabase } from '@/lib/mongodb'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
    const cookieStore = await cookies()
    const name = cookieStore.get('chat_user')?.value
    if (!name) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

    const { userBName, amount } = await req.json()
    if (!userBName || !amount) return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })

    const db = await getDatabase()

    const userA = await db.collection('users').findOne({ name })
    const userB = await db.collection('users').findOne({ name: userBName })

    if (!userA?.walletAddress || !userB?.walletAddress) {
        return NextResponse.json({ error: "Un des users n'a pas de wallet connecté" }, { status: 400 })
    }

    const matchId = uuidv4()
    await db.collection('matches').insertOne({
        id: matchId,
        userA: name,
        userB: userBName,
        walletA: userA.walletAddress,
        walletB: userB.walletAddress,
        amountPerUser: amount,
        deadline: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
        contractAddress: null,
        status: 'PENDING_DEPLOY',
        createdAt: new Date(),
    })

    return NextResponse.json({ ok: true, matchId })
}
