import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import Script from 'next/script'
import { cookies } from 'next/headers'
import './globals.css'
import TonConnectProvider from '../components/TonConnectProvider'
import { NavProvider } from '../components/NavContext'
import BottomNav from '../components/BottomNav'

export const metadata: Metadata = {
    title: 'DateTon',
    description: 'Telegram Mini App DateTon',
}

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
}

type RootLayoutProps = {
    children: ReactNode
}

export default async function RootLayout({ children }: RootLayoutProps) {
    const cookieStore = await cookies()
    const theme = cookieStore.get('dateton_theme')?.value || 'dark'

    return (
        <html lang="en" data-theme={theme} suppressHydrationWarning>
        <head>
            <script dangerouslySetInnerHTML={{ __html: `
                (function(){
                    var t = document.cookie.match(/dateton_theme=([^;]+)/);
                    if(t && t[1]) document.documentElement.setAttribute('data-theme', t[1]);
                })();
            `}} />
        </head>
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
