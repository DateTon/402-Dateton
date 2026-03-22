import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ObjectId } from 'mongodb'
import { TonClient, Address } from '@ton/ton'
import { getDatabase } from '../../../../lib/mongodb'
import { deployEscrowContract } from '../../../../lib/escrow'

const client = new TonClient({
    endpoint: process.env.TON_RPC_URL ?? 'https://testnet.toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.RPC_API_KEY,
})

/**
 * POST /api/matches/deploy
 *
 * Two-step flow:
 *   step: "pay"    → returns TON Connect transaction for 0.1 TON fee
 *   step: "deploy" → verifies fee on-chain, then deploys the escrow contract
 */
export async function POST(req: NextRequest) {
    const cookieStore = await cookies()
    const telegramIdStr = cookieStore.get('dateton_user')?.value
    if (!telegramIdStr) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const telegramId = Number(telegramIdStr)
    const body = await req.json()
    const { matchId, step } = body

    if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 })

    const db = await getDatabase()

    let objectId: ObjectId
    try { objectId = new ObjectId(matchId) } catch {
        return NextResponse.json({ error: 'Invalid matchId' }, { status: 400 })
    }

    const match = await db.collection('matches').findOne({ _id: objectId })
    const bid = await db.collection('bids').findOne({ matchId, status: 'accepted' })

    if (!match || !bid) {
        return NextResponse.json({ error: 'Match or accepted bid not found' }, { status: 404 })
    }

    // Already deployed?
    if (bid.contractAddress) {
        return NextResponse.json({ contractAddress: bid.contractAddress })
    }

    if (!match.wallet1 || !match.wallet2) {
        return NextResponse.json(
            { error: 'Both users must have a wallet connected before deploying' },
            { status: 400 }
        )
    }

    // ── Step 1: Return payment transaction ──
    if (step === 'pay') {
        const paymentAddress = process.env.PAYMENT_ADDRESS
        if (!paymentAddress) {
            return NextResponse.json({ error: 'PAYMENT_ADDRESS not configured' }, { status: 500 })
        }

        return NextResponse.json({
            step: 'pay',
            transaction: {
                validUntil: Math.floor(Date.now() / 1000) + 600,
                messages: [{
                    address: paymentAddress,
                    amount: '100000000', // 0.1 TON
                }],
            },
        })
    }

    // ── Step 2: Verify fee on-chain and deploy ──
    if (step === 'deploy') {
        // Check boost exemption
        const currentUser = await db.collection('users').findOne({ telegramId })
        const isBoosted = currentUser?.boostedUntil && new Date(currentUser.boostedUntil).getTime() > Date.now()

        if (!isBoosted) {
            // Verify that a 0.1 TON payment was received recently
            const paymentAddress = Address.parse(process.env.PAYMENT_ADDRESS!)
            try {
                const txs = await client.getTransactions(paymentAddress, { limit: 10 })
                const feeReceived = txs.some(tx => {
                    const inMsg = tx.inMessage
                    if (!inMsg || inMsg.info.type !== 'internal') return false
                    const age = Date.now() / 1000 - tx.now
                    return inMsg.info.value.coins >= BigInt(100000000) && age < 300
                })
                if (!feeReceived) {
                    return NextResponse.json({ error: 'Fee not confirmed on-chain' }, { status: 402 })
                }
            } catch (err) {
                console.error('Fee verification error:', err)
                return NextResponse.json({ error: 'Fee verification failed' }, { status: 402 })
            }
        }

        // Deploy the escrow contract
        try {
            const contractAddress = await deployEscrowContract({
                wallet1: match.wallet1,
                wallet2: match.wallet2,
                amountTon: bid.amount,
            })

            await db.collection('bids').updateOne(
                { matchId, status: 'accepted' },
                {
                    $set: {
                        contractAddress,
                        escrowStatus: 'PENDING_FUND',
                        updatedAt: new Date(),
                    },
                }
            )

            // Initialize date setup state
            await db.collection('date_setup').updateOne(
                { matchId },
                {
                    $set: {
                        step: 'fund',
                        fundedBy: [],
                        selectedActivity: null,
                        activityStatus: null,
                        proposedDate: null,
                        dateStatus: null,
                        proposedBy: null,
                        updatedAt: new Date(),
                    },
                    $setOnInsert: { createdAt: new Date() },
                },
                { upsert: true }
            )

            return NextResponse.json({ contractAddress })
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Deploy failed'
            return NextResponse.json({ error: message }, { status: 500 })
        }
    }

    return NextResponse.json({ error: 'Invalid step (use "pay" or "deploy")' }, { status: 400 })
}
