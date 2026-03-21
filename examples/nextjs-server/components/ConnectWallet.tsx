'use client'
import { TonConnectButton, useTonWallet } from '@tonconnect/ui-react'
import { useEffect } from 'react'

type ConnectWalletProps = {
    onWalletChange?: (address: string | null) => void
}

export default function ConnectWallet({ onWalletChange }: ConnectWalletProps) {
    const wallet = useTonWallet()

    useEffect(() => {
        if (wallet?.account?.address) {
            onWalletChange?.(wallet.account.address)
        } else {
            onWalletChange?.(null)
        }
    }, [wallet, onWalletChange])

    return <TonConnectButton />
}
