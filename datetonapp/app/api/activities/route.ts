import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getDatabase } from '@/lib/mongodb'

// Parse "14h30" → 14.5 (decimal hours)
function parseTimeStr(t: string): number {
    const match = t.match(/^(\d{1,2})h(\d{2})$/)
    if (!match) return 0
    return parseInt(match[1]) + parseInt(match[2]) / 60
}

export async function GET(req: NextRequest) {
    const cookieStore = await cookies()
    if (!cookieStore.get('dateton_user')?.value)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const amount = parseFloat(searchParams.get('amount') ?? '0')
    // dayOfWeek: 0=Mon .. 6=Sun (JS getDay() is 0=Sun, convert)
    const jsDay = new Date().getDay() // 0=Sun
    const dayIndex = jsDay === 0 ? 6 : jsDay - 1 // convert to Mon=0..Sun=6

    const db = await getDatabase()

    const allActivities = await db.collection('activities').find({
        available: true,
        averagePrice: { $lte: amount },
    }).toArray()

    // Filter by schedule for current day
    const filtered = allActivities.filter(a => {
        const daySlot = a.schedule?.[dayIndex]
        return daySlot != null // not null = open today
    })

    return NextResponse.json(filtered)
}
