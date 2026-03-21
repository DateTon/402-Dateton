'use client'
import { TonConnectButton, useTonWallet } from '@tonconnect/ui-react'
import { useEffect } from 'react'

export default function ConnectWallet() {
    const wallet = useTonWallet()

    useEffect(() => {
        if (wallet?.account?.address) {
            fetch('/api/users/wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress: wallet.account.address }),
            })
        }
    }, [wallet])

    return <TonConnectButton />
}
