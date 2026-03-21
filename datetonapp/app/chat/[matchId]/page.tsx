"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTonConnectUI } from "@tonconnect/ui-react";
import { buildRefundTransaction, buildConfirmTransaction } from "../../../lib/contract";

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
    const [tonConnectUI] = useTonConnectUI();
    const [contractAddress, setContractAddress] = useState<string | null>(null);
    const [refunding, setRefunding] = useState(false);
    const [refundToast, setRefundToast] = useState<string | null>(null);
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

    // Date setup state (for header banner)
    const [dateSetup, setDateSetup] = useState<{
        step: string;
        selectedActivity?: {
            name: string;
            location: { name: string; city: string; address: string };
            schedule?: ([string, string] | null)[];
        } | null;
        proposedDate?: { date: string; time: string } | null;
        accomplishedDate?: boolean;
    } | null>(null);

    // Code validation state
    const [showValidation, setShowValidation] = useState(false);
    const [myCode, setMyCode] = useState<string | null>(null);
    const [codeInput, setCodeInput] = useState("");
    const [codeError, setCodeError] = useState<string | null>(null);
    const [validating, setValidating] = useState(false);
    const [hasConfirmed, setHasConfirmed] = useState(false);
    const [partnerConfirmed, setPartnerConfirmed] = useState(false);
    const [accomplishedDate, setAccomplishedDate] = useState(false);

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

    // Fetch contract address from match detail
    const fetchContractAddress = useCallback(async () => {
        try {
            const res = await fetch(`/api/match-detail?matchId=${matchId}`);
            if (!res.ok) return;
            const data = await res.json();
            if (data.contractAddress) setContractAddress(data.contractAddress);
        } catch { /* silent */ }
    }, [matchId]);

    // Fetch date setup for banner
    const fetchDateSetup = useCallback(async () => {
        try {
            const res = await fetch(`/api/date-setup?matchId=${matchId}`);
            if (!res.ok) return;
            const data = await res.json();
            setDateSetup(data.setup);
        } catch { /* silent */ }
    }, [matchId]);

    async function handleRefund() {
        if (!contractAddress) return;
        setRefunding(true);
        try {
            const tx = buildRefundTransaction(contractAddress);
            await tonConnectUI.sendTransaction(tx);
            // Clean up date_setup after successful refund
            await fetch("/api/date-setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ matchId, action: "cancel_date" }),
            });
            setRefundToast("Refund transaction sent!");
            setDateSetup(null);
            setBid(null);
            setContractAddress(null);
        } catch (e: any) {
            setRefundToast(e?.message || "Refund failed.");
        }
        setRefunding(false);
        setTimeout(() => setRefundToast(null), 3000);
    }

    // Check if we're within the validation time window (1h before/after, capped by activity hours)
    function isInValidationWindow(): boolean {
        if (!dateSetup?.proposedDate || dateSetup.step !== "done") return false;
        const { date, time } = dateSetup.proposedDate;
        const [hh, mm] = time.split(":").map(Number);
        const dateTime = new Date(`${date}T${time}:00`);
        const now = Date.now();

        let windowStart = dateTime.getTime() - 60 * 60 * 1000; // 1h before
        let windowEnd = dateTime.getTime() + 60 * 60 * 1000; // 1h after

        // Adjust to activity schedule if available
        const schedule = dateSetup.selectedActivity?.schedule;
        if (schedule) {
            const d = new Date(`${date}T00:00:00`);
            const jsDay = d.getDay();
            const idx = jsDay === 0 ? 6 : jsDay - 1;
            const slot = schedule[idx];
            if (slot) {
                const closeMatch = slot[1].match(/^(\d{1,2})h(\d{2})$/);
                if (closeMatch) {
                    const closeH = parseInt(closeMatch[1]);
                    const closeM = parseInt(closeMatch[2]);
                    const closeTime = new Date(`${date}T${String(closeH).padStart(2, "0")}:${String(closeM).padStart(2, "0")}:00`).getTime();
                    if (windowEnd > closeTime) windowEnd = closeTime;
                }
            }
        }

        return now >= windowStart && now <= windowEnd;
    }

    // Fetch codes for validation
    async function fetchMyCode() {
        try {
            const res = await fetch("/api/date-setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ matchId, action: "get_my_code" }),
            });
            if (!res.ok) return;
            const data = await res.json();
            setMyCode(data.myCode);
            setHasConfirmed(data.hasConfirmed || false);
            setPartnerConfirmed(data.partnerConfirmed || false);
            setAccomplishedDate(data.accomplishedDate || false);
        } catch { /* silent */ }
    }

    // Validate partner code and send ConfirmRelease transaction
    async function handleValidateCode() {
        if (!codeInput || codeInput.length !== 4) {
            setCodeError("Enter a 4-digit code");
            return;
        }
        setValidating(true);
        setCodeError(null);
        try {
            const res = await fetch("/api/date-setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ matchId, action: "validate_code", code: codeInput }),
            });
            const data = await res.json();
            if (!data.valid) {
                setCodeError("Wrong code. Try again.");
                setValidating(false);
                return;
            }
            // Code is valid — send ConfirmRelease on-chain
            if (contractAddress) {
                try {
                    const tx = buildConfirmTransaction(contractAddress);
                    await tonConnectUI.sendTransaction(tx);
                } catch (e: any) {
                    // Transaction may fail but code validation is done
                    console.error("ConfirmRelease tx error:", e);
                }
            }
            setHasConfirmed(true);
            setAccomplishedDate(data.accomplishedDate || false);
            setCodeInput("");
            await fetchMyCode(); // refresh state
        } catch {
            setCodeError("Connection error.");
        }
        setValidating(false);
    }

    // Open validation card
    function handleBannerClick() {
        if (accomplishedDate || dateSetup?.accomplishedDate) return; // already done
        if (!isInValidationWindow()) {
            setRefundToast("Validation available 1h before and after the scheduled time.");
            setTimeout(() => setRefundToast(null), 3000);
            return;
        }
        fetchMyCode();
        setShowValidation(true);
    }

    useEffect(() => {
        fetchMatchInfo();
        fetchMessages();
        fetchBid();
        fetchContractAddress();
        fetchDateSetup();
        const interval = setInterval(() => {
            fetchMessages();
            fetchBid();
            fetchDateSetup();
        }, 3000);
        return () => clearInterval(interval);
    }, [fetchMatchInfo, fetchMessages, fetchBid, fetchContractAddress, fetchDateSetup]);

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

    function handleEditBid() {
        if (bid) setBidInput(String(bid.amount));
        setShowBidPopup(true);
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

            {/* Date banner when date is set */}
            {dateSetup?.step === "done" && dateSetup.selectedActivity && dateSetup.proposedDate && (
                <div className="chat-date-banner" onClick={handleBannerClick} style={{ cursor: "pointer" }}>
                    <div className="chat-date-banner-info">
                        <span className="chat-date-banner-title">
                            {(accomplishedDate || dateSetup.accomplishedDate) ? "Date Accomplished!" : dateSetup.selectedActivity.name}
                        </span>
                        <span className="chat-date-banner-location">
                            {dateSetup.selectedActivity.location.name}, {dateSetup.selectedActivity.location.city}
                        </span>
                    </div>
                    <span className="chat-date-banner-datetime">
                        {dateSetup.proposedDate.date} - {dateSetup.proposedDate.time}
                    </span>
                    {!(accomplishedDate || dateSetup.accomplishedDate) && (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 18l6-6-6-6" />
                        </svg>
                    )}
                </div>
            )}

            {/* Code validation overlay */}
            {showValidation && (
                <div className="bid-popup-overlay" onClick={() => setShowValidation(false)}>
                    <div className="validation-card" onClick={(e) => e.stopPropagation()}>
                        {(accomplishedDate || hasConfirmed && partnerConfirmed) ? (
                            <div className="validation-done">
                                <h3>Date Validated!</h3>
                                <p>Both codes confirmed. Funds are being released.</p>
                            </div>
                        ) : (
                            <>
                                <div className="validation-section validation-top">
                                    <span className="validation-label">Your confirmation code</span>
                                    <span className="validation-code">{myCode || "..."}</span>
                                    <span className="validation-hint">Give this code to your partner</span>
                                </div>
                                <div className="validation-divider" />
                                <div className="validation-section validation-bottom">
                                    <span className="validation-label">Enter your partner&apos;s code</span>
                                    {hasConfirmed ? (
                                        <div className="validation-confirmed">
                                            <span>Code validated! Waiting for partner...</span>
                                        </div>
                                    ) : (
                                        <>
                                            <input
                                                type="number"
                                                className="validation-input"
                                                placeholder="0000"
                                                maxLength={4}
                                                value={codeInput}
                                                onChange={(e) => {
                                                    if (e.target.value.length <= 4) setCodeInput(e.target.value);
                                                }}
                                            />
                                            {codeError && <span className="validation-error">{codeError}</span>}
                                            <button
                                                className="button"
                                                style={{ width: "100%", marginTop: "0.5rem" }}
                                                onClick={handleValidateCode}
                                                disabled={validating || codeInput.length !== 4}
                                            >
                                                {validating ? (
                                                    <span className="loading loading-spinner loading-sm"></span>
                                                ) : (
                                                    "Validate"
                                                )}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

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
                                    className="bid-action-btn bid-action-edit"
                                    onClick={handleEditBid}
                                    disabled={bidLoading}
                                    title="Edit bid"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
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
                            <div className="bid-card-actions">
                                <button
                                    className="bid-action-btn bid-action-edit"
                                    onClick={handleEditBid}
                                    disabled={bidLoading}
                                    title="Edit bid"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                </button>
                                <p className="bid-card-waiting">Waiting for response...</p>
                            </div>
                        )}
                    </div>
                )}

                {bid && bid.status === "accepted" && dateSetup?.step !== "done" && (
                    <div className="bid-card bid-card-accepted">
                        <div className="bid-card-body">
                            <p className="bid-card-title">Date confirmed!</p>
                            <p className="bid-card-amount">
                                <strong>{bid.amount} TON</strong> per person
                            </p>
                        </div>
                        <a href={`/date/${matchId}`} className="button" style={{ marginTop: "0.75rem", display: "block", textAlign: "center", textDecoration: "none" }}>
                            Date Setup
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
                {/* Show + only when no bid exists, or after date is fully done */}
                {(!bid || bid.status === "rejected" || dateSetup?.step === "done") && (
                    <button
                        className="chat-plus-btn"
                        onClick={() => setShowBidPopup(true)}
                        title="Propose a date"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                    </button>
                )}
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

            {/* Refund button */}
            {contractAddress && (
                <div className="chat-refund-bar">
                    <button
                        className="refund-btn"
                        onClick={handleRefund}
                        disabled={refunding}
                    >
                        {refunding ? (
                            <span className="loading loading-spinner loading-sm"></span>
                        ) : (
                            "\uD83D\uDD01 Refund"
                        )}
                    </button>
                </div>
            )}

            {/* Refund toast */}
            {refundToast && (
                <div className="toast-container">
                    <div className="alert alert-info shadow-lg">
                        <span>{refundToast}</span>
                    </div>
                </div>
            )}
        </main>
    );
}
