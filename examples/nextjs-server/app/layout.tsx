import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
    title: 'Simple Encrypted Chat',
    description: 'Chat Next.js + MongoDB avec login simple par cookie',
};

type RootLayoutProps = {
    children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
    return (
        <html lang="fr">
        <body>{children}</body>
        </html>
    );
}