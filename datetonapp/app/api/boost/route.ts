import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getDatabase } from '../../../lib/mongodb'

const BOOST_DURATION_MS = 60 * 60 * 1000 // 1 hour

// POST /api/boost — activate boost after TonConnect payment confirmed client-side
export async function POST() {
    const cookieStore = await cookies()
    const telegramIdStr = cookieStore.get('dateton_user')?.value
    if (!telegramIdStr) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const telegramId = Number(telegramIdStr)
    const db = await getDatabase()

    const boostedUntil = new Date(Date.now() + BOOST_DURATION_MS)

    await db.collection('users').updateOne(
        { telegramId },
        { $set: { boostedUntil } }
    )

    return NextResponse.json({ ok: true, boostedUntil: boostedUntil.toISOString() })
}
