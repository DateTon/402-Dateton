'use client'
import { useEffect, useState } from 'react'

type Bid = {
    matchId: string
    proposedBy: string
    amount: number
    status: 'pending' | 'accepted' | 'rejected'
}

type Props = {
    matchId: string
    currentUser: string
    onAgreed: (amount: number) => void  // appelé quand les deux sont d'accord → lance le contrat
}

export default function BidNegotiation({ matchId, currentUser, onAgreed }: Props) {
    const [bid, setBid] = useState<Bid | null>(null)
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)

    async function fetchBid() {
        const res = await fetch(`/api/bid?matchId=${matchId}`)
        const data = await res.json()
        setBid(data.bid)
        if (data.bid?.status === 'accepted') {
            onAgreed(data.bid.amount)
        }
    }

    useEffect(() => {
        fetchBid()
        const interval = setInterval(fetchBid, 2500)
        return () => clearInterval(interval)
    }, [matchId])

    async function handlePropose() {
        if (!input || isNaN(Number(input))) return
        setLoading(true)
        await fetch('/api/bid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matchId, amount: Number(input), action: 'propose' }),
        })
        setInput('')
        await fetchBid()
        setLoading(false)
    }

    async function handleAccept() {
        setLoading(true)
        await fetch('/api/bid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matchId, action: 'accept' }),
        })
        await fetchBid()
        setLoading(false)
    }

    async function handleReject() {
        setLoading(true)
        await fetch('/api/bid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matchId, action: 'reject' }),
        })
        await fetchBid()
        setLoading(false)
    }

    const isProposer = bid?.proposedBy === currentUser
    const hasPendingBid = bid?.status === 'pending'

    return (
        <div>
            <h3>💰 Négociation du montant</h3>

            {bid && hasPendingBid && (
                <div>
                    <p>
                        <strong>{bid.proposedBy}</strong> propose <strong>{bid.amount} TON</strong>
                    </p>
                    {!isProposer && (
                        <div>
                            <button onClick={handleAccept} disabled={loading}>✅ Accepter</button>
                            <button onClick={handleReject} disabled={loading}>❌ Refuser</button>
                        </div>
                    )}
                    {isProposer && <p>En attente de la réponse de l'autre...</p>}
                </div>
            )}

            {bid?.status === 'accepted' && (
                <p>✅ Accord trouvé : <strong>{bid.amount} TON</strong> chacun !</p>
            )}

            {(!bid || bid.status === 'rejected' || (bid.status === 'pending' && isProposer === false)) && (
                <div>
                    <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        placeholder="Montant en TON"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                    />
                    <button onClick={handlePropose} disabled={loading}>
                        {loading ? '...' : 'Proposer'}
                    </button>
                </div>
            )}
        </div>
    )
}
