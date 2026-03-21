import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getDatabase } from '@/lib/mongodb'

export async function GET(req: NextRequest) {
    const cookieStore = await cookies()
    if (!cookieStore.get('dateton_user')?.value)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const amount = parseFloat(searchParams.get('amount') ?? '0')
    const hour = parseInt(searchParams.get('hour') ?? String(new Date().getHours()))

    const db = await getDatabase()

    const activities = await db.collection('activities').find({
        available: true,
        'priceRange.min': { $lte: amount },
        'priceRange.max': { $gte: amount },
        'timeRange.from': { $lte: hour },
        'timeRange.to': { $gte: hour },
    }).toArray()

    return NextResponse.json(activities)
}