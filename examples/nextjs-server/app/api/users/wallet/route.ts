import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { findUserByTelegramId, updateUser } from '../../../../lib/db'

const COOKIE_NAME = 'dateton_user'

export async function POST(req: NextRequest) {
    try {
        const cookieStore = await cookies()
        const telegramIdStr = cookieStore.get(COOKIE_NAME)?.value
        if (!telegramIdStr) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const telegramId = Number(telegramIdStr)
        if (isNaN(telegramId)) {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
        }

        const { walletAddress } = await req.json()
        if (!walletAddress || typeof walletAddress !== 'string') {
            return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 })
        }

        const user = await findUserByTelegramId(telegramId)
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        await updateUser(telegramId, { walletAddress })

        return NextResponse.json({ ok: true })
    } catch {
        return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }
}
