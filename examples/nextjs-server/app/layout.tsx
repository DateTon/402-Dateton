import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Script from 'next/script'
import './globals.css'
import TonConnectProvider from '../components/TonConnectProvider'

export const metadata: Metadata = {
    title: 'DateTon',
    description: 'Telegram Mini App DateTon',
}

type RootLayoutProps = {
    children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
    return (
        <html lang="en" suppressHydrationWarning>
        <body suppressHydrationWarning>
        <Script
            src="https://telegram.org/js/telegram-web-app.js"
            strategy="beforeInteractive"
        />
        <TonConnectProvider>
            {children}
        </TonConnectProvider>
        </body>
        </html>
    )
}
