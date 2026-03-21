'use client';

import type { FormEvent } from 'react';
import { useState } from 'react'

type LoginResponse = {
    ok?: boolean;
    name?: string;
    error?: string;
};

export default function LoginForm() {
    const [name, setName] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name }),
            });

            const data = (await response.json()) as LoginResponse;

            if (!response.ok) {
                setError(data.error || 'Impossible de se connecter');
                return;
            }

            window.location.reload();
        } catch {
            setError('Erreur réseau');
        } finally {
            setLoading(false);
        }
    }

    return (
        <form className="form" onSubmit={handleSubmit}>
            <input
                className="input"
                type="text"
                placeholder="Entre ton nom"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={30}
            />

            <button className="button" type="submit" disabled={loading}>
                {loading ? 'Connexion...' : 'Entrer dans le chat'}
            </button>

            <p className="helper">
                Ici, il n’y a pas de mot de passe. Le nom est simplement placé dans un cookie côté serveur.
            </p>

            {error ? <p className="error">{error}</p> : null}
        </form>
    );
}