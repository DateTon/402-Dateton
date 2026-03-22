import { NextRequest } from 'next/server'
import { getDatabase } from '@/lib/mongodb'

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const hour = parseInt(searchParams.get('hour') ?? String(new Date().getHours()))

    const db = await getDatabase()

    // Bundles that wrap around midnight (from > to) need special handling
    const bundles = await db.collection('bundles').find({}).toArray()

    const filtered = bundles.filter(b => {
        const { from, to } = b.timeRange
        if (from <= to) {
            // Normal range: e.g. 14–23
            return hour >= from && hour < to
        } else {
            // Wraps midnight: e.g. 22–4 means 22,23,0,1,2,3
            return hour >= from || hour < to
        }
    })

    return Response.json(filtered)
}
