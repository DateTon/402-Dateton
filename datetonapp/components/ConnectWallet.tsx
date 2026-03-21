'use client'
import { TonConnectButton, useTonWallet, useTonConnectUI } from '@tonconnect/ui-react'
import { useEffect } from 'react'

type ConnectWalletProps = {
    onWalletChange?: (address: string | null) => void
}

export default function ConnectWallet({ onWalletChange }: ConnectWalletProps) {
    const wallet = useTonWallet()
    const [tonConnectUI] = useTonConnectUI()

    useEffect(() => {
        if (!wallet) {
            onWalletChange?.(null)
            return
        }

        // '-3' = testnet, '-239' = mainnet
        if (wallet.account.chain !== '-3') {
            tonConnectUI.disconnect()
            onWalletChange?.(null)
            alert('⚠️ Passe ton wallet en mode Testnet avant de continuer !')
            return
        }

        onWalletChange?.(wallet.account.address)
    }, [wallet, onWalletChange, tonConnectUI])

    return (
        <div className="flex flex-col items-center gap-2">
            <TonConnectButton />
            {wallet && wallet.account.chain !== '-3' && (
                <p className="text-red-400 text-xs">⚠️ Testnet requis</p>
            )}
        </div>
    )
}
