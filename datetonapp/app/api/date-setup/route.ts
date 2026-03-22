import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ObjectId } from 'mongodb'
import { getDatabase } from '../../../lib/mongodb'
import { findUserByTelegramId } from '../../../lib/db'
import { sendTelegramMessage } from '../../../lib/telegram'

// GET — get date setup state
export async function GET(req: NextRequest) {
    const cookieStore = await cookies()
    const telegramIdStr = cookieStore.get('dateton_user')?.value
    if (!telegramIdStr) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const matchId = req.nextUrl.searchParams.get('matchId')
    if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 })

    const db = await getDatabase()
    const setup = await db.collection('date_setup').findOne({ matchId })
    return NextResponse.json({ setup: setup ?? null })
}

// POST — update date setup (select activity, confirm/decline, propose date, accept/decline date)
export async function POST(req: NextRequest) {
    const cookieStore = await cookies()
    const telegramIdStr = cookieStore.get('dateton_user')?.value
    if (!telegramIdStr) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const telegramId = Number(telegramIdStr)
    const body = await req.json()
    const { matchId, action } = body
    if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 })

    const db = await getDatabase()

    // Cancel date — delete date_setup, bid, reset match to pending + notify other user
    if (action === 'cancel_date') {
        const setup = await db.collection('date_setup').findOne({ matchId })
        const hasFunded = (setup?.fundedBy?.length ?? 0) > 0

        let otherTelegramId: number | null = null
        try {
            const objectId = new ObjectId(matchId)
            const match = await db.collection('matches').findOne({ _id: objectId })
            if (match) {
                otherTelegramId = match.user1 === telegramId ? match.user2 : match.user1
            }
            await db.collection('matches').updateOne(
                { _id: objectId },
                { $set: { status: 'pending' }, $unset: { contractAddress: '' } }
            )
        } catch { /* invalid objectId, skip */ }

        await db.collection('date_setup').deleteOne({ matchId })
        await db.collection('bids').deleteOne({ matchId })

        // Anti-doublon: only skip if the same cancel message was sent in the last 10s (concurrent call)
        const tenSecondsAgo = new Date(Date.now() - 10_000)
        const recentCancel = await db.collection('match_messages').findOne({
            matchId,
            type: 'system',
            message: { $in: ['Refund emitted \u2014 Date Cancelled', 'Date cancelled'] },
            createdAt: { $gte: tenSecondsAgo },
        })

        if (!recentCancel) {
            const sysMsg = hasFunded ? 'Refund emitted \u2014 Date Cancelled' : 'Date cancelled'
            await db.collection('match_messages').insertOne({
                matchId,
                from: 0,
                message: sysMsg,
                type: 'system',
                createdAt: new Date(),
            })

            // Notify other user via Telegram
            if (otherTelegramId) {
                const currentUser = await findUserByTelegramId(telegramId)
                const chatUrl = `${process.env.NEXT_PUBLIC_APP_URL}/chat/${matchId}`
                if (hasFunded) {
                    await sendTelegramMessage(
                        otherTelegramId,
                        `\u{1F6AB} <b>Refund emitted \u2014 Date Cancelled</b>\n\n<a href="${chatUrl}">Open chat \u2192</a>`
                    )
                } else {
                    await sendTelegramMessage(
                        otherTelegramId,
                        `\u{274C} <b>${currentUser?.firstName ?? 'Your match'} cancelled the date</b>\n\n<a href="${chatUrl}">Open chat \u2192</a>`
                    )
                }
            }
        }

        return NextResponse.json({ ok: true })
    }

    const setup = await db.collection('date_setup').findOne({ matchId })
    if (!setup) return NextResponse.json({ error: 'Date setup not found' }, { status: 404 })

    // Go back one step
    if (action === 'go_back') {
        const prev: Record<string, { step: string; reset: Record<string, unknown> }> = {
            activity: { step: 'fund', reset: { selectedActivity: null, activityStatus: null, activityProposedBy: null } },
            datetime: { step: 'activity', reset: { proposedDate: null, dateStatus: null, dateProposedBy: null, selectedActivity: null, activityStatus: null, activityProposedBy: null } },
            done: { step: 'datetime', reset: { proposedDate: null, dateStatus: null, dateProposedBy: null, codeA: null, codeB: null, confirmedA: false, confirmedB: false, accomplishedDate: false } },
        }
        const current = setup.step as string
        const target = prev[current]
        if (!target) return NextResponse.json({ error: 'Cannot go back from this step' }, { status: 400 })
        await db.collection('date_setup').updateOne(
            { matchId },
            { $set: { step: target.step, ...target.reset, updatedAt: new Date() } }
        )
        return NextResponse.json({ ok: true })
    }

    // Mark user as funded
    if (action === 'mark_funded') {
        const fundedBy: number[] = setup.fundedBy || []
        if (!fundedBy.includes(telegramId)) {
            fundedBy.push(telegramId)
        }
        const newStep = fundedBy.length >= 2 ? 'activity' : 'fund'
        await db.collection('date_setup').updateOne(
            { matchId },
            { $set: { fundedBy, step: newStep, updatedAt: new Date() } }
        )
        return NextResponse.json({ ok: true })
    }

    // Select an activity (proposer)
    if (action === 'select_activity') {
        const { activity } = body
        if (!activity) return NextResponse.json({ error: 'activity required' }, { status: 400 })
        await db.collection('date_setup').updateOne(
            { matchId },
            {
                $set: {
                    selectedActivity: activity,
                    activityStatus: 'pending_confirm',
                    activityProposedBy: telegramId,
                    updatedAt: new Date(),
                },
            }
        )
        return NextResponse.json({ ok: true })
    }

    // Confirm activity
    if (action === 'confirm_activity') {
        await db.collection('date_setup').updateOne(
            { matchId },
            { $set: { activityStatus: 'confirmed', step: 'datetime', updatedAt: new Date() } }
        )
        return NextResponse.json({ ok: true })
    }

    // Decline activity
    if (action === 'decline_activity') {
        await db.collection('date_setup').updateOne(
            { matchId },
            {
                $set: {
                    selectedActivity: null,
                    activityStatus: null,
                    activityProposedBy: null,
                    updatedAt: new Date(),
                },
            }
        )
        return NextResponse.json({ ok: true })
    }

    // Propose date & time
    if (action === 'propose_datetime') {
        const { date, time } = body
        if (!date || !time) return NextResponse.json({ error: 'date and time required' }, { status: 400 })

        // Block past dates
        const proposed = new Date(`${date}T${time}:00`)
        if (proposed.getTime() < Date.now()) {
            return NextResponse.json({ error: 'Cannot propose a date in the past' }, { status: 400 })
        }

        await db.collection('date_setup').updateOne(
            { matchId },
            {
                $set: {
                    proposedDate: { date, time },
                    dateStatus: 'pending_confirm',
                    dateProposedBy: telegramId,
                    updatedAt: new Date(),
                },
            }
        )
        return NextResponse.json({ ok: true })
    }

    // Confirm date — generate 4-digit codes for both users
    if (action === 'confirm_datetime') {
        const codeA = String(Math.floor(1000 + Math.random() * 9000))
        const codeB = String(Math.floor(1000 + Math.random() * 9000))
        await db.collection('date_setup').updateOne(
            { matchId },
            {
                $set: {
                    dateStatus: 'confirmed',
                    step: 'done',
                    codeA,
                    codeB,
                    confirmedA: false,
                    confirmedB: false,
                    accomplishedDate: false,
                    updatedAt: new Date(),
                },
            }
        )
        return NextResponse.json({ ok: true })
    }

    // Decline date
    if (action === 'decline_datetime') {
        await db.collection('date_setup').updateOne(
            { matchId },
            {
                $set: {
                    proposedDate: null,
                    dateStatus: null,
                    dateProposedBy: null,
                    updatedAt: new Date(),
                },
            }
        )
        return NextResponse.json({ ok: true })
    }

    // Get my code to show to partner
    if (action === 'get_my_code') {
        if (!setup.codeA || !setup.codeB) {
            return NextResponse.json({ error: 'Codes not generated yet' }, { status: 400 })
        }
        // Determine if current user is user1 (A) or user2 (B)
        let objectId: ObjectId
        try { objectId = new ObjectId(matchId) } catch {
            return NextResponse.json({ error: 'Invalid matchId' }, { status: 400 })
        }
        const match = await db.collection('matches').findOne({ _id: objectId })
        if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

        const isUserA = match.user1 === telegramId
        // My code = the code I give to my partner (so they can enter it)
        const myCode = isUserA ? setup.codeA : setup.codeB
        const hasConfirmed = isUserA ? setup.confirmedA : setup.confirmedB
        const partnerConfirmed = isUserA ? setup.confirmedB : setup.confirmedA

        return NextResponse.json({
            myCode,
            hasConfirmed: hasConfirmed || false,
            partnerConfirmed: partnerConfirmed || false,
            accomplishedDate: setup.accomplishedDate || false,
        })
    }

    // Validate partner's code
    if (action === 'validate_code') {
        const { code } = body
        if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 })
        if (!setup.codeA || !setup.codeB) {
            return NextResponse.json({ error: 'Codes not generated yet' }, { status: 400 })
        }

        let objectId: ObjectId
        try { objectId = new ObjectId(matchId) } catch {
            return NextResponse.json({ error: 'Invalid matchId' }, { status: 400 })
        }
        const match = await db.collection('matches').findOne({ _id: objectId })
        if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

        const isUserA = match.user1 === telegramId
        // I need to enter my partner's code: if I'm A, partner's code is codeB
        const expectedCode = isUserA ? setup.codeB : setup.codeA

        if (String(code) !== String(expectedCode)) {
            return NextResponse.json({ error: 'Invalid code', valid: false })
        }

        // Mark this user as confirmed
        const confirmField = isUserA ? 'confirmedA' : 'confirmedB'
        const updateSet: Record<string, unknown> = { [confirmField]: true, updatedAt: new Date() }

        // Check if both are now confirmed
        const otherConfirmed = isUserA ? setup.confirmedB : setup.confirmedA
        if (otherConfirmed) {
            updateSet.accomplishedDate = true
        }

        await db.collection('date_setup').updateOne(
            { matchId },
            { $set: updateSet }
        )

        // If date achieved, notify both users via Telegram (awaited so Vercel doesn't kill the function)
        if (otherConfirmed) {
            const chatUrl = `${process.env.NEXT_PUBLIC_APP_URL}/chat/${matchId}`
            const otherTelegramId = isUserA ? match.user2 : match.user1
            const [currentUser, otherUser] = await Promise.all([
                findUserByTelegramId(telegramId),
                findUserByTelegramId(otherTelegramId as number),
            ])
            await Promise.allSettled([
                sendTelegramMessage(
                    telegramId,
                    `\u{2705} <b>Date achieved!</b>\n\nYour date with <b>${otherUser?.firstName ?? 'your match'}</b> has been validated. Funds are being released!\n\n<a href="${chatUrl}">Open chat \u2192</a>`
                ),
                sendTelegramMessage(
                    otherTelegramId as number,
                    `\u{2705} <b>Date achieved!</b>\n\nYour date with <b>${currentUser?.firstName ?? 'your match'}</b> has been validated. Funds are being released!\n\n<a href="${chatUrl}">Open chat \u2192</a>`
                ),
            ])
        }

        return NextResponse.json({
            valid: true,
            accomplishedDate: !!otherConfirmed,
        })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
