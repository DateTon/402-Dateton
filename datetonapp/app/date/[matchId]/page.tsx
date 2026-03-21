"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
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

export default function DateEscrowPage() {
    const { matchId } = useParams<{ matchId: string }>();
    const [tonConnectUI] = useTonConnectUI();
    const wallet = useTonWallet();
    const [detail, setDetail] = useState<MatchDetail | null>(null);
    const [contractState, setContractState] = useState<ContractState | null>(null);
    const [loading, setLoading] = useState(true);
    const [deploying, setDeploying] = useState(false);
    const [funding, setFunding] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDetail = useCallback(async () => {
        try {
            const res = await fetch(`/api/match-detail?matchId=${matchId}`);
            if (res.ok) {
                const data = await res.json();
                setDetail(data);

                // If contract is deployed, fetch on-chain state
                if (data.contractAddress) {
                    try {
                        const stateRes = await fetch(`/api/matches/${data.contractAddress}`);
                        if (stateRes.ok) setContractState(await stateRes.json());
                    } catch { /* contract may not be active yet */ }
                }
            }
        } catch { /* silent */ }
        setLoading(false);
    }, [matchId]);

    useEffect(() => {
        fetchDetail();
        const interval = setInterval(fetchDetail, 5000);
        return () => clearInterval(interval);
    }, [fetchDetail]);

    // ── Deploy contract ──
    async function handleDeploy() {
        setDeploying(true);
        setError(null);
        try {
            const res = await fetch("/api/matches/deploy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ matchId }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Deploy failed");
            } else {
                await fetchDetail();
            }
        } catch {
            setError("Connection error");
        }
        setDeploying(false);
    }

    // ── Fund escrow ──
    async function handleFund() {
        if (!detail?.contractAddress || !detail.escrowAmount) return;
        setFunding(true);
        setError(null);
        try {
            // Build Fund transaction with proper opcode body
            const { buildFundTransaction } = await import("../../../lib/contract");
            const tx = buildFundTransaction(detail.contractAddress, detail.escrowAmount.toString());
            await tonConnectUI.sendTransaction(tx);
            // Wait a bit then refresh
            setTimeout(fetchDetail, 3000);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Fund failed";
            if (!msg.includes("Cancelled")) setError(msg);
        }
        setFunding(false);
    }

    // ── Confirm date ──
    async function handleConfirm() {
        if (!detail?.contractAddress) return;
        setConfirming(true);
        setError(null);
        try {
            const { buildConfirmTransaction } = await import("../../../lib/contract");
            const tx = buildConfirmTransaction(detail.contractAddress);
            await tonConnectUI.sendTransaction(tx);
            setTimeout(fetchDetail, 3000);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Confirm failed";
            if (!msg.includes("Cancelled")) setError(msg);
        }
        setConfirming(false);
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
    const state = contractState?.state ?? detail.status;
    const funded = contractState?.funded ?? 0;
    const confirmations = contractState?.confirmations ?? 0;

    // Determine which step we're on
    const bidAccepted = detail.bid?.status === "accepted";
    const hasContract = !!detail.contractAddress;
    const isFunded = state === "FUNDED";
    const isReleased = state === "RELEASED";
    const isRefunded = state === "REFUNDED";

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
                    <p className="escrow-state">Status: <strong>{state}</strong></p>
                    {hasContract && (
                        <p className="escrow-detail">
                            Funded: {funded}/2 &middot; Confirmations: {confirmations}/2
                        </p>
                    )}
                </div>

                {error && (
                    <div className="escrow-error">{error}</div>
                )}

                {/* Step indicators */}
                <div className="escrow-steps">
                    <div className={`escrow-step ${bidAccepted ? "done" : ""}`}>
                        <div className="escrow-step-dot" />
                        <span>Bid accepted</span>
                    </div>
                    <div className={`escrow-step ${hasContract ? "done" : ""}`}>
                        <div className="escrow-step-dot" />
                        <span>Contract deployed</span>
                    </div>
                    <div className={`escrow-step ${isFunded || isReleased ? "done" : ""}`}>
                        <div className="escrow-step-dot" />
                        <span>Both funded</span>
                    </div>
                    <div className={`escrow-step ${isReleased ? "done" : ""}`}>
                        <div className="escrow-step-dot" />
                        <span>Date confirmed</span>
                    </div>
                </div>

                {/* Action buttons based on current step */}
                <div className="escrow-actions">
                    {/* Step 1: Deploy */}
                    {bidAccepted && !hasContract && (
                        <button className="button" onClick={handleDeploy} disabled={deploying}>
                            {deploying ? (
                                <span className="loading loading-spinner loading-sm" />
                            ) : (
                                "Deploy Escrow Contract"
                            )}
                        </button>
                    )}

                    {/* Wallet connection required for Fund & Confirm */}
                    {hasContract && !isReleased && !isRefunded && !wallet && (
                        <div style={{ textAlign: "center" }}>
                            <p style={{ color: "var(--color-text-muted)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
                                Connect your TON wallet to fund or confirm
                            </p>
                            <button
                                className="button"
                                onClick={() => tonConnectUI.openModal()}
                            >
                                Connect Wallet
                            </button>
                        </div>
                    )}

                    {/* Step 2: Fund */}
                    {hasContract && !isFunded && !isReleased && !isRefunded && wallet && (
                        <button className="button" onClick={handleFund} disabled={funding}>
                            {funding ? (
                                <span className="loading loading-spinner loading-sm" />
                            ) : (
                                `Fund ${amount} TON`
                            )}
                        </button>
                    )}

                    {/* Step 3: Confirm (only when both funded) */}
                    {isFunded && !isReleased && wallet && (
                        <button className="button" onClick={handleConfirm} disabled={confirming}>
                            {confirming ? (
                                <span className="loading loading-spinner loading-sm" />
                            ) : (
                                "Confirm Date Happened"
                            )}
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
                            Escrow refunded. The date didn't happen in time.
                        </div>
                    )}
                </div>

                <a href={`/chat/${matchId}`} className="escrow-back-link">
                    Back to chat
                </a>
            </div>
        </main>
    );
}
