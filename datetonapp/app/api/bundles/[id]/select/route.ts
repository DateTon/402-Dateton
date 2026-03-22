import { NextRequest } from 'next/server'
import { ObjectId } from 'mongodb'
import { getDatabase } from '@/lib/mongodb'
import { paymentGate } from '@ton-x402/middleware'
import { getPaymentConfig } from '@/lib/payment-config'

const handler = async (request: Request) => {
    const body = await request.json()
    const { matchId } = body

    if (!matchId) {
        return Response.json({ error: 'matchId is required' }, { status: 400 })
    }

    // Extract bundle ID from URL
    const url = new URL(request.url)
    const segments = url.pathname.split('/')
    const idIndex = segments.indexOf('bundles') + 1
    const id = segments[idIndex]

    if (!id || !ObjectId.isValid(id)) {
        return Response.json({ error: 'Invalid bundle ID' }, { status: 400 })
    }

    const db = await getDatabase()

    const bundle = await db.collection('bundles').findOne({ _id: new ObjectId(id) })
    if (!bundle) {
        return Response.json({ error: 'Bundle not found' }, { status: 404 })
    }

    // Register the bundle selection on the date setup
    await db.collection('date_setup').updateOne(
        { matchId },
        { $set: { bundleId: id, bundlePrice: bundle.price, updatedAt: new Date() } }
    )

    return Response.json({ success: true, bundle })
}

export const POST = paymentGate(handler, {
    config: getPaymentConfig({
        amount: "100000000", // 0.1 TON lead fee
        description: "DateTon lead fee — bundle selected",
    }),
})
