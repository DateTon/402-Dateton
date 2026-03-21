"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";

type Message = {
    id: string;
    from: number;
    message: string;
    createdAt: string;
};

type Bid = {
    matchId: string;
    proposedBy: number;
    amount: number;
    status: "pending" | "accepted" | "rejected";
};

export default function MatchChatPage() {
    const { matchId } = useParams<{ matchId: string }>();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [otherName, setOtherName] = useState("Match");
    const [otherAvatar, setOtherAvatar] = useState<string | null>(null);
    const [myTelegramId, setMyTelegramId] = useState<number | null>(null);
    const [myFirstName, setMyFirstName] = useState("");
    const bottomRef = useRef<HTMLDivElement>(null);

    // Bid state
    const [bid, setBid] = useState<Bid | null>(null);
    const [showBidPopup, setShowBidPopup] = useState(false);
    const [bidInput, setBidInput] = useState("");
    const [bidLoading, setBidLoading] = useState(false);

    // Fetch current user
    useEffect(() => {
        fetch("/api/user")
            .then((r) => r.json())
            .then((d) => {
                if (d.user) {
                    setMyTelegramId(d.user.telegramId);
                    setMyFirstName(d.user.firstName || "");
                }
            })
            .catch(() => {});
    }, []);

    // Fetch match info (other user)
    const fetchMatchInfo = useCallback(async () => {
        try {
            const res = await fetch("/api/my-matches");
            if (!res.ok) return;
            const matches = await res.json();
            const match = matches.find((m: { matchId: string }) => m.matchId === matchId);
            if (match?.otherUser) {
                setOtherName(match.otherUser.firstName ?? "Match");
                setOtherAvatar(match.otherUser.images?.[0] ?? null);
            }
        } catch {
            /* silent */
        }
    }, [matchId]);

    // Fetch messages
    const fetchMessages = useCallback(async () => {
        try {
            const res = await fetch(`/api/chat-match?matchId=${matchId}`);
            if (!res.ok) return;
            const data = await res.json();
            setMessages(data.messages);
        } catch {
            /* silent */
        }
    }, [matchId]);

    // Fetch bid
    const fetchBid = useCallback(async () => {
        try {
            const res = await fetch(`/api/bid?matchId=${matchId}`);
            if (!res.ok) return;
            const data = await res.json();
            setBid(data.bid ?? null);
        } catch {
            /* silent */
        }
    }, [matchId]);

    useEffect(() => {
        fetchMatchInfo();
        fetchMessages();
        fetchBid();
        const interval = setInterval(() => {
            fetchMessages();
            fetchBid();
        }, 3000);
        return () => clearInterval(interval);
    }, [fetchMatchInfo, fetchMessages, fetchBid]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, bid]);

    // ── Send message ──
    async function sendMessage() {
        if (!input.trim() || sending) return;
        setSending(true);
        try {
            await fetch("/api/chat-match", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ matchId, message: input.trim() }),
            });
            setInput("");
            await fetchMessages();
        } catch {
            /* silent */
        }
        setSending(false);
    }

    // ── Bid actions ──
    async function bidAction(action: string, amount?: number) {
        setBidLoading(true);
        try {
            await fetch("/api/bid", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ matchId, action, amount }),
            });
            await fetchBid();
        } catch {
            /* silent */
        }
        setBidLoading(false);
    }

    function handleBidSubmit() {
        const val = parseFloat(bidInput);
        if (!val || val <= 0) return;
        bidAction("propose", val);
        setBidInput("");
        setShowBidPopup(false);
    }

    function handleCounter(direction: "up" | "down") {
        if (!bid) return;
        const step = 0.5;
        const newAmount = direction === "up" ? bid.amount + step : Math.max(0.1, bid.amount - step);
        bidAction("propose", newAmount);
    }

    // Who proposed?
    const iAmProposer = bid?.proposedBy === myTelegramId;
    const proposerName = iAmProposer ? myFirstName : otherName;

    return (
        <main className="chat-page">
            {/* Bid Popup */}
            {showBidPopup && (
                <div className="bid-popup-overlay" onClick={() => setShowBidPopup(false)}>
                    <div className="bid-popup" onClick={(e) => e.stopPropagation()}>
                        <h3 className="bid-popup-title">Propose a Date</h3>
                        <p className="bid-popup-desc">Set a budget per person in TON</p>
                        <div className="bid-popup-input-row">
                            <input
                                type="number"
                                min="0.1"
                                step="0.1"
                                placeholder="0.00"
                                value={bidInput}
                                onChange={(e) => setBidInput(e.target.value)}
                                className="bid-popup-input"
                            />
                            <span className="bid-popup-currency">TON</span>
                        </div>
                        <button
                            className="button"
                            style={{ width: "100%" }}
                            onClick={handleBidSubmit}
                            disabled={!bidInput || parseFloat(bidInput) <= 0}
                        >
                            Send Bid
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="chat-header">
                <a href="/matches" className="chat-back">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18l-6-6 6-6" />
                    </svg>
                </a>
                {otherAvatar ? (
                    <img src={otherAvatar} alt={otherName} className="chat-header-avatar" />
                ) : (
                    <div className="chat-header-avatar-placeholder">
                        {otherName.charAt(0).toUpperCase()}
                    </div>
                )}
                <span className="chat-header-name">{otherName}</span>
            </div>

            {/* Messages */}
            <div className="chat-messages">
                {messages.length === 0 && !bid && (
                    <p className="chat-empty">No messages yet. Say hello!</p>
                )}

                {messages.map((msg) => {
                    const isMe = msg.from === myTelegramId;
                    return (
                        <div key={msg.id} className={`chat-bubble ${isMe ? "chat-bubble-me" : "chat-bubble-them"}`}>
                            <p>{msg.message}</p>
                            <span className="chat-bubble-time">
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                        </div>
                    );
                })}

                {/* ── Bid Card ── */}
                {bid && bid.status === "pending" && (
                    <div className="bid-card">
                        <div className="bid-card-body">
                            <p className="bid-card-title">{proposerName} asks you out</p>
                            <p className="bid-card-amount">
                                Budget per person: <strong>{bid.amount} TON</strong>
                            </p>
                        </div>
                        {!iAmProposer && (
                            <div className="bid-card-actions">
                                <button
                                    className="bid-action-btn bid-action-reject"
                                    onClick={() => bidAction("reject")}
                                    disabled={bidLoading}
                                    title="Decline"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 6L6 18M6 6l12 12" />
                                    </svg>
                                </button>
                                <button
                                    className="bid-action-btn bid-action-down"
                                    onClick={() => handleCounter("down")}
                                    disabled={bidLoading}
                                    title="Lower amount"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M6 9l6 6 6-6" />
                                    </svg>
                                </button>
                                <button
                                    className="bid-action-btn bid-action-up"
                                    onClick={() => handleCounter("up")}
                                    disabled={bidLoading}
                                    title="Raise amount"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 15l-6-6-6 6" />
                                    </svg>
                                </button>
                                <button
                                    className="bid-action-btn bid-action-accept"
                                    onClick={() => bidAction("accept")}
                                    disabled={bidLoading}
                                    title="Accept"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M20 6L9 17l-5-5" />
                                    </svg>
                                </button>
                            </div>
                        )}
                        {iAmProposer && (
                            <p className="bid-card-waiting">Waiting for response...</p>
                        )}
                    </div>
                )}

                {bid && bid.status === "accepted" && (
                    <div className="bid-card bid-card-accepted">
                        <div className="bid-card-body">
                            <p className="bid-card-title">Date confirmed!</p>
                            <p className="bid-card-amount">
                                <strong>{bid.amount} TON</strong> per person
                            </p>
                        </div>
                        <a href={`/date/${matchId}`} className="button" style={{ marginTop: "0.75rem", display: "block", textAlign: "center", textDecoration: "none" }}>
                            Go to Escrow
                        </a>
                    </div>
                )}

                {bid && bid.status === "rejected" && (
                    <div className="bid-card bid-card-rejected">
                        <div className="bid-card-body">
                            <p className="bid-card-title">Bid declined</p>
                            <p className="bid-card-amount">
                                You can propose a new budget using the + button.
                            </p>
                        </div>
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            {/* Input bar with + button */}
            <div className="chat-input-bar">
                <button
                    className="chat-plus-btn"
                    onClick={() => setShowBidPopup(true)}
                    title="Propose a date"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                </button>
                <input
                    className="chat-input"
                    type="text"
                    placeholder="Type a message..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") sendMessage();
                    }}
                />
                <button
                    className="chat-send-btn"
                    onClick={sendMessage}
                    disabled={sending || !input.trim()}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 2L11 13" />
                        <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                    </svg>
                </button>
            </div>
        </main>
    );
}
