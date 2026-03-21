import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Script from 'next/script'
import './globals.css'
import TonConnectProvider from '../components/TonConnectProvider'
import { NavProvider } from '../components/NavContext'
import BottomNav from '../components/BottomNav'

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
            <NavProvider>
                <div className="app-shell">
                    {children}
                </div>
                <BottomNav />
            </NavProvider>
        </TonConnectProvider>
        </body>
        </html>
    )
}
