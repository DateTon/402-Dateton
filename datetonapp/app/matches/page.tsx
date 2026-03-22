"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type MatchItem = {
    matchId: string;
    otherUser: {
        telegramId: number;
        firstName: string;
        lastName: string;
        age: number;
        images: string[];
    } | null;
    status: string;
    createdAt: string;
};

export default function MatchesPage() {
    const [matches, setMatches] = useState<MatchItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        function fetchMatches() {
            fetch("/api/my-matches")
                .then((r) => r.json())
                .then((data) => {
                    if (Array.isArray(data)) setMatches(data);
                })
                .catch(() => {})
                .finally(() => setLoading(false));
        }
        fetchMatches();
        const interval = setInterval(fetchMatches, 5000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <main className="page">
                <span className="loading loading-spinner loading-lg text-cyan-400" />
            </main>
        );
    }

    if (matches.length === 0) {
        return (
            <main className="page">
                <section className="card" style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
                    <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                        Matches
                    </h1>
                    <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
                        No matches yet. Start swiping in the feed to find your first match!
                    </p>
                </section>
            </main>
        );
    }

    return (
        <main className="page" style={{ alignItems: "flex-start", paddingTop: "1.5rem" }}>
            <div style={{ maxWidth: 480, width: "100%", margin: "0 auto" }}>
                <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1rem", paddingLeft: "0.5rem" }}>
                    Matches
                </h1>
                <div className="matches-list">
                    {matches.map((m) => {
                        const other = m.otherUser;
                        if (!other) return null;
                        return (
                            <Link
                                key={m.matchId}
                                href={`/chat/${m.matchId}`}
                                className="match-card"
                            >
                                {other.images?.[0] ? (
                                    <img src={other.images[0]} alt={other.firstName} className="match-card-avatar" />
                                ) : (
                                    <div className="match-card-avatar-placeholder">
                                        {other.firstName?.charAt(0)?.toUpperCase() ?? "?"}
                                    </div>
                                )}
                                <div className="match-card-info">
                                    <span className="match-card-name">
                                        {other.firstName} {other.lastName?.charAt(0)}.
                                    </span>
                                    <span className="match-card-age">{other.age} years old</span>
                                </div>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--color-text-muted)", marginLeft: "auto" }}>
                                    <path d="M9 18l6-6-6-6" />
                                </svg>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </main>
    );
}
