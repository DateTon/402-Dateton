import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getDatabase } from '@/lib/mongodb'

export async function POST(req: NextRequest) {
    const cookieStore = await cookies()
    const name = cookieStore.get('chat_user')?.value
    if (!name) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

    const { walletAddress } = await req.json()
    if (!walletAddress) return NextResponse.json({ error: 'Adresse manquante' }, { status: 400 })

    const db = await getDatabase()
    await db.collection('users').updateOne(
        { name },
        { $set: { walletAddress, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true }
    )

    return NextResponse.json({ ok: true })
}
