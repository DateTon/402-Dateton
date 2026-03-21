'use client'
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import type { ReactNode } from 'react'

export default function TonConnectProvider({ children }: { children: ReactNode }) {
    return (
        <TonConnectUIProvider manifestUrl="https://jan-recuperative-carolyn.ngrok-free.dev">
            {children}
        </TonConnectUIProvider>
    )
}
