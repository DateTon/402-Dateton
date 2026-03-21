import { cookies } from 'next/headers'
import LoginForm from '../components/LoginForm'
import ConnectWallet from '../components/ConnectWallet'

export default async function HomePage() {
    const cookieStore = await cookies()
    const currentUser = cookieStore.get('chat_user')?.value || ''

    return (
        <main className="page">
            <section className="card">
                <h1>💘 DateTon</h1>
                <p className="subtitle">
                    Planifie un date sécurisé avec un dépôt escrow sur TON.
                </p>

                {!currentUser ? (
                    <LoginForm />
                ) : (
                    <div>
                        <p>👋 Bonjour <strong>{currentUser}</strong></p>
                        <p>Connecte ton wallet TON pour continuer :</p>
                        <ConnectWallet />
                    </div>
                )}
            </section>
        </main>
    )
}
