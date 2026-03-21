'use client'
import { TonConnectUIProvider } from '@tonconnect/ui-react'
import type { ReactNode } from 'react'

export default function TonConnectProvider({ children }: { children: ReactNode }) {
    return (
        <TonConnectUIProvider manifestUrl="https://gist.githubusercontent.com/gabestcoo/542b9dba0abd6290e737deb1da35e6f9/raw/17646d830a78b1a3147b7b64d0f774f640c81682/tonconnect-manifest.json">
            {children}
        </TonConnectUIProvider>
    )
}
