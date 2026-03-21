import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import TonConnectProvider from '../components/TonConnectProvider'

export const metadata: Metadata = {
    title: 'DateTon',
    description: 'Planifie un date sécurisé avec escrow TON',
}

type RootLayoutProps = {
    children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
    return (
        <html lang="fr">
        <body>
        <TonConnectProvider>
            {children}
        </TonConnectProvider>
        </body>
        </html>
    )
}