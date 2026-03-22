"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";

type MatchDetail = {
    matchId: string;
    status: string;
    contractAddress: string | null;
    escrowAmount: number | null;
    wallet1: string;
    wallet2: string;
    myTelegramId: number;
    isUser1: boolean;
    otherUser: { telegramId: number; firstName: string; images: string[] } | null;
    bid: { amount: number; status: string } | null;
};

type ContractState = {
    state: string;
    funded: number;
    confirmations: number;
};

type Activity = {
    _id: string;
    name: string;
    type: string;
    description: string;
    imageUrl?: string;
    location?: { name: string; city: string; address: string };
    averagePrice?: number;
    schedule?: ([string, string] | null)[]; // 7 days, Mon=0..Sun=6, each [open, close] or null
    // Bundle-specific fields
    emoji?: string;
    partnerName?: string;
    partnerWallet?: string;
    price?: number;
    timeRange?: { from: number; to: number };
};

type DateSetup = {
    step: "fund" | "activity" | "datetime" | "done";
    fundedBy: number[];
    selectedActivity: Activity | null;
    activityStatus: string | null;
    activityProposedBy: number | null;
    proposedDate: { date: string; time: string } | null;
    dateStatus: string | null;
    dateProposedBy: number | null;
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Parse "14h30" → { hours: 14, minutes: 30 }
function parseTimeStr(t: string): { hours: number; minutes: number } {
    const match = t.match(/^(\d{1,2})h(\d{2})$/);
    if (!match) return { hours: 0, minutes: 0 };
    return { hours: parseInt(match[1]), minutes: parseInt(match[2]) };
}

// Get schedule slot for a given date string (YYYY-MM-DD)
function getScheduleForDate(schedule: ([string, string] | null)[], dateStr: string): [string, string] | null {
    const d = new Date(dateStr + "T00:00:00");
    const jsDay = d.getDay(); // 0=Sun
    const idx = jsDay === 0 ? 6 : jsDay - 1; // Mon=0..Sun=6
    return schedule[idx] ?? null;
}

export default function DateEscrowPage() {
    const { matchId } = useParams<{ matchId: string }>();
    const router = useRouter();
    const [tonConnectUI] = useTonConnectUI();
    const wallet = useTonWallet();
    const [detail, setDetail] = useState<MatchDetail | null>(null);
    const [contractState, setContractState] = useState<ContractState | null>(null);
    const [dateSetup, setDateSetup] = useState<DateSetup | null>(null);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [activityIndex, setActivityIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [funding, setFunding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    // Date/time proposal state
    const [proposedDate, setProposedDate] = useState("");
    const [proposedTime, setProposedTime] = useState("");

    const fetchDetail = useCallback(async () => {
        try {
            const res = await fetch(`/api/match-detail?matchId=${matchId}`);
            if (res.ok) {
                const data = await res.json();
                setDetail(data);
                if (data.contractAddress) {
                    try {
                        const stateRes = await fetch(`/api/matches/${data.contractAddress}`);
                        if (stateRes.ok) setContractState(await stateRes.json());
                    } catch { /* contract may not be active yet */ }
                } else {
                    setContractState(null);
                }
            }
        } catch { /* silent */ }
        setLoading(false);
    }, [matchId]);

    const fetchDateSetup = useCallback(async () => {
        try {
            const res = await fetch(`/api/date-setup?matchId=${matchId}`);
            if (res.ok) {
                const data = await res.json();
                setDateSetup(data.setup);
            }
        } catch { /* silent */ }
    }, [matchId]);

    const fetchActivities = useCallback(async () => {
        if (!detail?.escrowAmount) return;
        try {
            const res = await fetch(`/api/activities?amount=${detail.escrowAmount}`);
            if (res.ok) {
                const data = await res.json();
                setActivities(data);
            }
        } catch { /* silent */ }
    }, [detail?.escrowAmount]);

    useEffect(() => {
        fetchDetail();
        fetchDateSetup();
        const interval = setInterval(() => {
            fetchDetail();
            fetchDateSetup();
        }, 2500);
        return () => clearInterval(interval);
    }, [fetchDetail, fetchDateSetup]);

    useEffect(() => {
        if (dateSetup?.step === "activity" && activities.length === 0) {
            fetchActivities();
        }
    }, [dateSetup?.step, activities.length, fetchActivities]);

    // Fund escrow
    async function handleFund() {
        if (!detail?.contractAddress || !detail.escrowAmount) return;
        setFunding(true);
        setError(null);
        try {
            const { buildFundTransaction } = await import("../../../lib/contract");
            const tx = buildFundTransaction(detail.contractAddress, detail.escrowAmount.toString());
            await tonConnectUI.sendTransaction(tx);
            await fetch("/api/date-setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ matchId, action: "mark_funded" }),
            });
            setTimeout(() => { fetchDetail(); fetchDateSetup(); }, 3000);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Fund failed";
            if (!msg.includes("Cancelled")) setError(msg);
        }
        setFunding(false);
    }

    // Cancel date — if funded: refund on-chain (0.02 TON fee) + clean DB, else just clean DB
    async function handleCancelDate() {
        setCancelling(true);
        setError(null);
        try {
            const hasFunded = (dateSetup?.fundedBy?.length ?? 0) > 0;

            if (hasFunded && detail?.contractAddress) {
                // Funds were sent — need on-chain refund
                try {
                    const { buildRefundTransaction } = await import("../../../lib/contract");
                    const tx = buildRefundTransaction(detail.contractAddress);
                    await tonConnectUI.sendTransaction(tx);
                } catch (e: unknown) {
                    const msg = e instanceof Error ? e.message : "";
                    if (msg.includes("Cancelled")) {
                        setCancelling(false);
                        return; // User cancelled the tx, don't clean up
                    }
                }
            }

            // Clean up date_setup + bid + match status
            await fetch("/api/date-setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ matchId, action: "cancel_date" }),
            });
            router.push(`/chat/${matchId}`);
        } catch {
            setError("Cancel failed");
        }
        setCancelling(false);
    }

    // Date setup actions
    async function dateSetupAction(action: string, extra?: Record<string, unknown>) {
        setActionLoading(true);
        setError(null);
        try {
            await fetch("/api/date-setup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ matchId, action, ...extra }),
            });
            await fetchDateSetup();
        } catch {
            setError("Action failed");
        }
        setActionLoading(false);
    }

    function handleSelectActivity(activity: Activity) {
        dateSetupAction("select_activity", { activity });
    }

    function handleProposeDatetime() {
        if (!proposedDate || !proposedTime) return;
        // Block past datetimes
        const proposed = new Date(`${proposedDate}T${proposedTime}:00`);
        if (proposed.getTime() < Date.now()) {
            setError("Cannot propose a date in the past.");
            return;
        }
        // Validate time is within schedule slot
        if (scheduleSlot) {
            const open = parseTimeStr(scheduleSlot[0]);
            const close = parseTimeStr(scheduleSlot[1]);
            const [hh, mm] = proposedTime.split(":").map(Number);
            const timeMinutes = hh * 60 + mm;
            const openMinutes = open.hours * 60 + open.minutes;
            const closeMinutes = close.hours * 60 + close.minutes;

            if (closeMinutes > openMinutes) {
                // Normal range (e.g. 14h00-23h00)
                if (timeMinutes < openMinutes || timeMinutes > closeMinutes) {
                    setError(`Time must be between ${scheduleSlot[0]} and ${scheduleSlot[1]}.`);
                    return;
                }
            } else {
                // Overnight range (e.g. 23h00-02h00)
                if (timeMinutes < openMinutes && timeMinutes > closeMinutes) {
                    setError(`Time must be between ${scheduleSlot[0]} and ${scheduleSlot[1]}.`);
                    return;
                }
            }
        }
        dateSetupAction("propose_datetime", { date: proposedDate, time: proposedTime });
    }

    if (loading) {
        return (
            <main className="page">
                <span className="loading loading-spinner loading-lg text-cyan-400" />
            </main>
        );
    }

    if (!detail) {
        return (
            <main className="page">
                <section className="card" style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
                    <p>Match not found.</p>
                </section>
            </main>
        );
    }

    const otherName = detail.otherUser?.firstName ?? "your match";
    const amount = detail.escrowAmount ?? detail.bid?.amount ?? 0;
    const onChainState = contractState?.state;
    const funded = contractState?.funded ?? 0;
    // Only trust on-chain terminal states if dateSetup is in a matching terminal step
    // (prevents stale contract from a previous cycle showing REFUNDED/RELEASED)
    // Never show terminal on-chain states when there's an active dateSetup (new cycle)
    // because the contract address is deterministic — same users+amount reuses the old contract
    const isReleased = onChainState === "RELEASED" && !dateSetup;
    const isRefunded = onChainState === "REFUNDED" && !dateSetup;
    const hasContract = !!detail.contractAddress;
    const myId = detail.myTelegramId;
    const step = dateSetup?.step ?? "fund";
    const iFunded = dateSetup?.fundedBy?.includes(myId) ?? false;

    // Step labels for progress
    const steps = [
        { key: "fund", label: "Add Funds" },
        { key: "activity", label: "Choose Activity" },
        { key: "datetime", label: "Pick Date & Time" },
        { key: "done", label: "Date Ready" },
    ];
    const currentStepIndex = steps.findIndex(s => s.key === step);

    // Get time constraints for selected date
    const selectedActivity = dateSetup?.selectedActivity;
    const scheduleSlot = selectedActivity && proposedDate
        ? getScheduleForDate(selectedActivity.schedule, proposedDate)
        : null;

    return (
        <main className="page" style={{ alignItems: "flex-start", paddingTop: "1.5rem" }}>
            <div className="escrow-page">
                {/* Header */}
                <div className="escrow-header">
                    <a href={`/chat/${matchId}`} className="chat-back">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                    </a>
                    <h1 className="escrow-title">Date with {otherName}</h1>
                </div>

                {/* Amount card */}
                <div className="escrow-card">
                    <p className="escrow-label">Budget per person</p>
                    <p className="escrow-amount">{amount} TON</p>
                    {hasContract && (
                        <p className="escrow-detail">
                            Funded: {funded}/2
                        </p>
                    )}
                </div>

                {error && <div className="escrow-error">{error}</div>}

                {/* Step indicators */}
                <div className="escrow-steps">
                    {steps.map((s, i) => (
                        <div key={s.key} className={`escrow-step ${i < currentStepIndex ? "done" : i === currentStepIndex ? "active" : ""}`}>
                            <div className="escrow-step-dot" />
                            <span>{s.label}</span>
                        </div>
                    ))}
                </div>

                {/* Back to previous step */}
                {currentStepIndex > 0 && !isReleased && !isRefunded && (
                    <button
                        className="date-back-step-btn"
                        onClick={() => dateSetupAction("go_back")}
                        disabled={actionLoading}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                        Back to {steps[currentStepIndex - 1]?.label}
                    </button>
                )}

                {/* Final states */}
                {isReleased && (
                    <div className="escrow-final escrow-final-success">
                        Funds released! Enjoy your date.
                    </div>
                )}
                {isRefunded && (
                    <div className="escrow-final escrow-final-refund">
                        Escrow refunded.
                    </div>
                )}

                {/* ── STEP: FUND ── */}
                {step === "fund" && hasContract && !isReleased && !isRefunded && (
                    <div className="date-step-content">
                        {!wallet ? (
                            <div style={{ textAlign: "center" }}>
                                <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
                                    Connect your wallet to fund the escrow
                                </p>
                                <button className="button" onClick={() => tonConnectUI.openModal()}>
                                    Connect Wallet
                                </button>
                            </div>
                        ) : iFunded ? (
                            <div className="date-waiting-card">
                                <p>You have funded! Waiting for {otherName} to fund...</p>
                            </div>
                        ) : (
                            <>
                                <button className="button" onClick={handleFund} disabled={funding} style={{ width: "100%" }}>
                                    {funding ? (
                                        <span className="loading loading-spinner loading-sm" />
                                    ) : (
                                        `Fund ${amount} TON`
                                    )}
                                </button>
                                <p style={{ color: "var(--color-text-muted)", fontSize: "0.75rem", textAlign: "center", marginTop: "0.5rem" }}>
                                    A platform fee of 0.05 TON per person is included in this transaction.
                                </p>
                            </>
                        )}
                    </div>
                )}

                {/* ── STEP: ACTIVITY ── */}
                {step === "activity" && (
                    <div className="date-step-content">
                        {dateSetup?.activityStatus === "pending_confirm" && dateSetup.selectedActivity ? (
                            <div className="activity-confirm-card">
                                <div className="activity-card-image">
                                    <img src={dateSetup.selectedActivity.imageUrl} alt={dateSetup.selectedActivity.name} />
                                </div>
                                <div className="activity-card-info">
                                    <h3>{dateSetup.selectedActivity.name}</h3>
                                    {dateSetup.selectedActivity.type === 'bundle' ? (
                                        <p className="bundle-partner-name">{dateSetup.selectedActivity.partnerName}</p>
                                    ) : (
                                        <p className="activity-card-type">{dateSetup.selectedActivity.type}</p>
                                    )}
                                    {dateSetup.selectedActivity.location && (
                                        <p className="activity-card-location">
                                            {dateSetup.selectedActivity.location.name} - {dateSetup.selectedActivity.location.address}, {dateSetup.selectedActivity.location.city}
                                        </p>
                                    )}
                                    <p className="activity-card-desc">{dateSetup.selectedActivity.description}</p>
                                </div>
                                {dateSetup.activityProposedBy === myId ? (
                                    <p className="date-waiting-text">Waiting for {otherName} to confirm...</p>
                                ) : (
                                    <div className="activity-confirm-actions">
                                        <button
                                            className="button"
                                            onClick={() => dateSetupAction("confirm_activity")}
                                            disabled={actionLoading}
                                        >
                                            Accept
                                        </button>
                                        <button
                                            className="button-outline"
                                            onClick={() => dateSetupAction("decline_activity")}
                                            disabled={actionLoading}
                                        >
                                            Decline
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                {activities.length === 0 ? (
                                    <p style={{ color: "var(--color-text-muted)", textAlign: "center" }}>
                                        No activities available for this budget right now. Try again later!
                                    </p>
                                ) : (
                                    <div className="activity-carousel">
                                        <button
                                            className="activity-nav-btn"
                                            onClick={() => setActivityIndex(Math.max(0, activityIndex - 1))}
                                            disabled={activityIndex === 0}
                                        >
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M15 18l-6-6 6-6" />
                                            </svg>
                                        </button>

                                        {(() => {
                                            const item = activities[activityIndex]
                                            const isBundle = item.type === 'bundle'
                                            return (
                                                <div className={`activity-card${isBundle ? ' activity-card-bundle' : ''}`} onClick={() => handleSelectActivity(item)}>
                                                    {isBundle && <span className="bundle-badge">BUNDLE</span>}
                                                    <div className="activity-card-image">
                                                        <img src={item.imageUrl ?? `https://placehold.co/400x200/1e293b/7c3aed?text=${encodeURIComponent(item.emoji ?? '📦')}`} alt={item.name} />
                                                    </div>
                                                    <div className="activity-card-info">
                                                        <h3>{item.name}</h3>
                                                        {isBundle ? (
                                                            <p className="bundle-partner-name">{item.partnerName}</p>
                                                        ) : (
                                                            <p className="activity-card-type">{item.type}</p>
                                                        )}
                                                        {item.location && (
                                                            <p className="activity-card-location">
                                                                {item.location.name} - {item.location.address}, {item.location.city}
                                                            </p>
                                                        )}
                                                        <p className="activity-card-price">
                                                            {isBundle
                                                                ? `${item.price} TON pour 2`
                                                                : `~${item.averagePrice.toFixed(1)} TON avg`}
                                                        </p>
                                                    </div>
                                                    <p className="activity-card-select">Tap to select</p>
                                                </div>
                                            )
                                        })()}

                                        <button
                                            className="activity-nav-btn"
                                            onClick={() => setActivityIndex(Math.min(activities.length - 1, activityIndex + 1))}
                                            disabled={activityIndex === activities.length - 1}
                                        >
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M9 18l6-6-6-6" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                                <p className="activity-counter">
                                    {activities.length > 0 && `${activityIndex + 1} / ${activities.length}`}
                                </p>
                            </>
                        )}
                    </div>
                )}

                {/* ── STEP: DATETIME ── */}
                {step === "datetime" && selectedActivity && (
                    <div className="date-step-content">
                        {dateSetup?.dateStatus === "pending_confirm" && dateSetup.proposedDate ? (
                            <div className="datetime-confirm-card">
                                <h3>Proposed Date</h3>
                                <p className="datetime-value">
                                    {dateSetup.proposedDate.date} at {dateSetup.proposedDate.time}
                                </p>
                                <p className="datetime-activity">
                                    {selectedActivity.name}{selectedActivity.location ? ` - ${selectedActivity.location.name}, ${selectedActivity.location.city}` : ''}
                                </p>
                                <p className="datetime-unlock-info">
                                    Funds will be unlockable approximately 2 hours before and after the scheduled time. Both dates must be present for the funds to be released.
                                </p>
                                {dateSetup.dateProposedBy === myId ? (
                                    <p className="date-waiting-text">Waiting for {otherName} to confirm...</p>
                                ) : (
                                    <div className="activity-confirm-actions">
                                        <button
                                            className="button"
                                            onClick={() => dateSetupAction("confirm_datetime")}
                                            disabled={actionLoading}
                                        >
                                            Accept
                                        </button>
                                        <button
                                            className="button-outline"
                                            onClick={() => dateSetupAction("decline_datetime")}
                                            disabled={actionLoading}
                                        >
                                            Decline
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="datetime-propose-card">
                                <h3>Pick a date & time</h3>
                                <p className="datetime-activity">
                                    {selectedActivity.name}{selectedActivity.location ? ` - ${selectedActivity.location.name}, ${selectedActivity.location.city}` : ''}
                                </p>

                                {/* Weekly schedule table */}
                                {selectedActivity.schedule && (
                                    <table className="schedule-table">
                                        <tbody>
                                            {selectedActivity.schedule.map((slot, i) => (
                                                <tr key={i} className={slot ? "" : "closed"}>
                                                    <td className="schedule-day-name">{DAY_NAMES[i]}</td>
                                                    <td className="schedule-day-hours">
                                                        {slot ? `${slot[0]} - ${slot[1]}` : "Closed"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}

                                <div className="datetime-inputs">
                                    <input
                                        type="date"
                                        className="input"
                                        value={proposedDate}
                                        min={new Date().toISOString().split("T")[0]}
                                        onChange={(e) => {
                                            setProposedDate(e.target.value);
                                            setProposedTime(""); // reset time when date changes
                                        }}
                                    />
                                    {proposedDate && !scheduleSlot && (
                                        <p className="escrow-error" style={{ margin: 0 }}>Closed on this day</p>
                                    )}
                                    {scheduleSlot && (
                                        <input
                                            type="time"
                                            className="input"
                                            value={proposedTime}
                                            onChange={(e) => setProposedTime(e.target.value)}
                                            min={`${String(parseTimeStr(scheduleSlot[0]).hours).padStart(2, "0")}:${String(parseTimeStr(scheduleSlot[0]).minutes).padStart(2, "0")}`}
                                            max={`${String(parseTimeStr(scheduleSlot[1]).hours).padStart(2, "0")}:${String(parseTimeStr(scheduleSlot[1]).minutes).padStart(2, "0")}`}
                                        />
                                    )}
                                </div>

                                <p className="datetime-unlock-info">
                                    Funds will be unlockable approximately 2 hours before and after the scheduled time. Both dates must be present for the funds to be released.
                                </p>
                                <button
                                    className="button"
                                    style={{ width: "100%" }}
                                    onClick={handleProposeDatetime}
                                    disabled={!proposedDate || !proposedTime || !scheduleSlot || actionLoading}
                                >
                                    Propose this date
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ── STEP: DONE ── */}
                {step === "done" && selectedActivity && dateSetup?.proposedDate && (
                    <div className="date-step-content">
                        <div className="date-summary-card">
                            <div className="activity-card-image">
                                <img src={selectedActivity.imageUrl} alt={selectedActivity.name} />
                            </div>
                            <h3>Your Date is Set!</h3>
                            <p className="date-summary-detail">
                                <strong>{selectedActivity.name}</strong>
                            </p>
                            {selectedActivity.location && (
                                <p className="date-summary-detail">
                                    {selectedActivity.location.name} - {selectedActivity.location.address}, {selectedActivity.location.city}
                                </p>
                            )}
                            <p className="date-summary-detail">
                                {dateSetup.proposedDate.date} at {dateSetup.proposedDate.time}
                            </p>
                            <p className="date-summary-detail" style={{ color: "var(--color-text-muted)", fontSize: "0.85rem" }}>
                                Budget: {amount} TON per person
                            </p>
                            <p className="datetime-unlock-info">
                                Funds will be unlockable approximately 2 hours before and after {dateSetup.proposedDate.time}. Both dates must be present.
                            </p>
                        </div>
                    </div>
                )}

                {/* Waiting for contract deploy */}
                {!hasContract && detail.bid?.status === "accepted" && !isReleased && !isRefunded && (
                    <div className="date-waiting-card">
                        <span className="loading loading-spinner loading-sm" />
                        <p>Deploying escrow contract...</p>
                    </div>
                )}

                {/* Cancel date button */}
                {step !== "done" && !isReleased && !isRefunded && (
                    <button
                        className="cancel-date-btn"
                        onClick={handleCancelDate}
                        disabled={cancelling}
                    >
                        {cancelling ? "Cancelling..." : (dateSetup?.fundedBy?.length ?? 0) > 0 ? "Cancel Date (refund — 0.02 TON fee)" : "Cancel Date"}
                    </button>
                )}

                <a href={`/chat/${matchId}`} className="escrow-back-link">
                    Back to chat
                </a>
            </div>
        </main>
    );
}
