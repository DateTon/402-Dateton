'use client';

import type { FormEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

type ChatMessage = {
    id: string;
    userName: string;
    createdAt: string;
    message: string;
};

type MessagesResponse = {
    messages?: ChatMessage[];
    error?: string;
};

type SendMessageResponse = {
    ok?: boolean;
    insertedId?: string;
    error?: string;
};

type ChatClientProps = {
    currentUser: string;
};

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString('fr-FR');
}

export default function ChatClient({ currentUser }: ChatClientProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [message, setMessage] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [sending, setSending] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const chatBottomRef = useRef<HTMLDivElement | null>(null);

    async function loadMessages() {
        try {
            const response = await fetch('/api/messages', {
                cache: 'no-store',
            });

            const data = (await response.json()) as MessagesResponse;

            if (!response.ok) {
                setError(data.error || 'Impossible de charger les messages');
                return;
            }

            setMessages(data.messages || []);
            setError('');
        } catch {
            setError('Erreur réseau pendant le chargement');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadMessages();

        const interval = setInterval(loadMessages, 2500);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    async function handleSend(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!message.trim()) return;

        setSending(true);
        setError('');

        try {
            const response = await fetch('/api/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message }),
            });

            const data = (await response.json()) as SendMessageResponse;

            if (!response.ok) {
                setError(data.error || 'Impossible d’envoyer le message');
                return;
            }

            setMessage('');
            await loadMessages();
        } catch {
            setError('Erreur réseau pendant l’envoi');
        } finally {
            setSending(false);
        }
    }

    async function handleLogout() {
        await fetch('/api/logout', {
            method: 'POST',
        });

        window.location.reload();
    }

    const messageCountText = useMemo(() => {
        return `${messages.length} message${messages.length > 1 ? 's' : ''}`;
    }, [messages]);

    return (
        <div>
            <div className="infoRow">
                <div>
                    <strong>Connecté en tant que :</strong> {currentUser}
                    <div className="helper">{messageCountText}</div>
                </div>

                <div className="chatControls">
                    <button className="secondaryButton" type="button" onClick={loadMessages}>
                        Rafraîchir
                    </button>
                    <button className="dangerButton" type="button" onClick={handleLogout}>
                        Déconnexion
                    </button>
                </div>
            </div>

            <div className="chatBox">
                {loading ? <p>Chargement...</p> : null}

                {!loading && messages.length === 0 ? (
                    <p className="helper">Aucun message pour l’instant.</p>
                ) : null}

                {messages.map((item) => (
                    <article
                        key={item.id}
                        className={`message ${item.userName === currentUser ? 'mine' : ''}`}
                    >
                        <div className="messageHeader">
                            <strong>{item.userName}</strong>
                            <span>{formatDate(item.createdAt)}</span>
                        </div>
                        <p className="messageText">{item.message}</p>
                    </article>
                ))}

                <div ref={chatBottomRef} />
            </div>

            <form className="chatComposer" onSubmit={handleSend}>
        <textarea
            className="textarea"
            placeholder="Écris ton message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
        />

                <button className="button" type="submit" disabled={sending}>
                    {sending ? 'Envoi...' : 'Envoyer'}
                </button>
            </form>

            {error ? <p className="error">{error}</p> : null}
        </div>
    );
}