import { cookies } from 'next/headers';
import LoginForm from '../../components/LoginForm';
import ChatClient from '../../components/ChatClient';

export default async function HomePage() {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('chat_user');
    const currentUser = userCookie?.value || '';

    return (
        <main className="page">
            <section className="card">
                <h1>Simple Encrypted Chat</h1>
                <p className="subtitle">
                    Login ultra simple par nom + cookie, messages stockés chiffrés dans MongoDB.
                </p>

                {currentUser ? (
                    <ChatClient currentUser={currentUser} />
                ) : (
                    <LoginForm />
                )}
            </section>
        </main>
    );
}