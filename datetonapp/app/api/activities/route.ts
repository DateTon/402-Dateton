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

    // Fetch activities AND bundles in parallel, same filters
    const [allActivities, allBundles] = await Promise.all([
        db.collection('activities').find({
            available: true,
            averagePrice: { $lte: amount },
        }).toArray(),
        db.collection('bundles').find({
            available: true,
            averagePrice: { $lte: amount },
        }).toArray(),
    ])

    // Filter by schedule for current day (same logic for both)
    const bySchedule = (a: any) => a.schedule?.[dayIndex] != null

    return NextResponse.json([
        ...allBundles.filter(bySchedule).map(b => ({ ...b, type: 'bundle' })),
        ...allActivities.filter(bySchedule).map(a => ({ ...a, type: 'activity' })),
    ])
}
