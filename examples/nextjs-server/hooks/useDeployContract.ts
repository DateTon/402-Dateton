'use client'
import { useState } from 'react'

type DeployState = 'idle' | 'loading' | 'done' | 'error'

export function useDeployContract() {
    const [state, setState] = useState<DeployState>('idle')
    const [matchId, setMatchId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    async function deploy(userBName: string, amount: number) {
        setState('loading')
        setError(null)
        try {
            const res = await fetch('/api/matches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userBName, amount }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setMatchId(data.matchId)
            setState('done')
            return data.matchId as string
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Erreur inconnue')
            setState('error')
            return null
        }
    }

    return { deploy, state, matchId, error }
}
