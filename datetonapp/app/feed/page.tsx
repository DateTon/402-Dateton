"use client";

import { useEffect, useState, useRef, useCallback } from "react";

type FeedProfile = {
    telegramId: number;
    firstName: string;
    lastName: string;
    age: number;
    gender: string;
    bio: string;
    interests: string[];
    images: string[];
    score: number;
    sharedInterests: string[];
};

export default function FeedPage() {
    const [profiles, setProfiles] = useState<FeedProfile[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [swipeDir, setSwipeDir] = useState<"left" | "right" | null>(null);
    const [photoIndex, setPhotoIndex] = useState(0);
    const [matchPopup, setMatchPopup] = useState<FeedProfile | null>(null);

    // Touch/drag state
    const cardRef = useRef<HTMLDivElement>(null);
    const startX = useRef(0);
    const currentX = useRef(0);
    const dragging = useRef(false);
    const swiping = useRef(false); // prevents double-swipe

    const fetchFeed = useCallback(async () => {
        try {
            const res = await fetch("/api/feed");
            if (!res.ok) return;
            const data = await res.json();
            setProfiles(data);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFeed();
    }, [fetchFeed]);

    // Reset photo index when card changes
    useEffect(() => {
        setPhotoIndex(0);
    }, [currentIndex]);

    const profile = profiles[currentIndex] ?? null;

    // Record swipe to backend
    async function recordSwipe(target: number, action: "like" | "pass") {
        try {
            const res = await fetch("/api/swipe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ targetTelegramId: target, action }),
            });
            const data = await res.json();
            if (data.matched) {
                // Show match popup for the profile we just swiped on
                const matchedProfile = profiles[currentIndex];
                if (matchedProfile) setMatchPopup(matchedProfile);
            }
        } catch {
            // silent fail — swipe still advances locally
        }
    }

    function advanceCard(direction: "left" | "right") {
        if (swiping.current || !profile) return;
        swiping.current = true;

        setSwipeDir(direction);

        // left = LIKE, right = DISLIKE (conventional)
        const action = direction === "left" ? "pass" : "like";
        recordSwipe(profile.telegramId, action);

        setTimeout(() => {
            setSwipeDir(null);
            setCurrentIndex((i) => i + 1);
            swiping.current = false;
            // Reset card transform
            if (cardRef.current) {
                cardRef.current.style.transition = "none";
                cardRef.current.style.transform = "translateX(0) rotate(0)";
            }
        }, 400);
    }

    // ── Touch handlers ──
    function onPointerDown(e: React.PointerEvent) {
        if (swiping.current) return;
        dragging.current = true;
        startX.current = e.clientX;
        currentX.current = e.clientX;
        if (cardRef.current) {
            cardRef.current.style.transition = "none";
        }
    }

    function onPointerMove(e: React.PointerEvent) {
        if (!dragging.current) return;
        currentX.current = e.clientX;
        const dx = currentX.current - startX.current;
        if (cardRef.current) {
            cardRef.current.style.transform = `translateX(${dx}px) rotate(${dx * 0.05}deg)`;
        }
    }

    function onPointerUp() {
        if (!dragging.current) return;
        dragging.current = false;
        const dx = currentX.current - startX.current;

        if (cardRef.current) {
            cardRef.current.style.transition = "transform 0.3s ease";
        }

        const threshold = 100;
        if (dx < -threshold) {
            advanceCard("left");
        } else if (dx > threshold) {
            advanceCard("right");
        } else {
            // Snap back to center
            if (cardRef.current) {
                cardRef.current.style.transform = "translateX(0) rotate(0)";
            }
        }
    }

    // ── Loading state ──
    if (loading) {
        return (
            <main className="feed-page">
                <span className="loading loading-spinner loading-lg text-cyan-400" />
            </main>
        );
    }

    // ── No more profiles ──
    if (!profile) {
        return (
            <main className="feed-page">
                <div className="feed-empty">
                    <p>No more profiles to show.</p>
                    <p className="text-text-muted" style={{ fontSize: "0.85rem" }}>
                        Check back later!
                    </p>
                </div>
            </main>
        );
    }

    const photos = profile.images ?? [];
    const currentPhoto = photos[photoIndex] ?? null;

    return (
        <main className="feed-page">
            {/* Match popup */}
            {matchPopup && (
                <div className="match-popup-overlay" onClick={() => setMatchPopup(null)}>
                    <div className="match-popup" onClick={(e) => e.stopPropagation()}>
                        <h2 className="match-popup-title">It&apos;s a Match!</h2>
                        <p className="match-popup-text">
                            You and <strong>{matchPopup.firstName}</strong> liked each other!
                        </p>
                        {matchPopup.images?.[0] && (
                            <img src={matchPopup.images[0]} alt={matchPopup.firstName} className="match-popup-avatar" />
                        )}
                        <div className="match-popup-actions">
                            <a href="/matches" className="button">View Matches</a>
                            <button className="match-popup-close" onClick={() => setMatchPopup(null)}>
                                Keep Swiping
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Swipe overlay animations */}
            {swipeDir === "right" && (
                <div className="swipe-overlay swipe-like">
                    <span className="swipe-label">LIKE</span>
                </div>
            )}
            {swipeDir === "left" && (
                <div className="swipe-overlay swipe-dislike">
                    <span className="swipe-label">NOPE</span>
                </div>
            )}

            <div
                ref={cardRef}
                className={`feed-card ${swipeDir === "left" ? "feed-card-exit-left" : ""} ${swipeDir === "right" ? "feed-card-exit-right" : ""}`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
                style={{ touchAction: "none" }}
            >
                {/* Photo area */}
                <div className="feed-photo-area">
                    {currentPhoto ? (
                        <img
                            src={currentPhoto}
                            alt={`${profile.firstName}'s photo`}
                            className="feed-photo"
                            draggable={false}
                        />
                    ) : (
                        <div className="feed-photo-placeholder">
                            {profile.firstName?.charAt(0)?.toUpperCase() ?? "?"}
                        </div>
                    )}

                    {/* Photo dots */}
                    {photos.length > 1 && (
                        <div className="feed-photo-dots">
                            {photos.map((_, i) => (
                                <button
                                    key={i}
                                    className={`feed-photo-dot ${i === photoIndex ? "active" : ""}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setPhotoIndex(i);
                                    }}
                                />
                            ))}
                        </div>
                    )}

                    {/* Tap left/right to switch photos */}
                    {photos.length > 1 && (
                        <>
                            <div
                                className="feed-photo-tap feed-photo-tap-left"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setPhotoIndex((i) => Math.max(0, i - 1));
                                }}
                            />
                            <div
                                className="feed-photo-tap feed-photo-tap-right"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setPhotoIndex((i) => Math.min(photos.length - 1, i + 1));
                                }}
                            />
                        </>
                    )}

                    {/* Name & age overlay on photo */}
                    <div className="feed-photo-info">
                        <h2 className="feed-name">
                            {profile.firstName}, {profile.age}
                        </h2>
                        <p className="feed-gender">{profile.gender}</p>
                    </div>
                </div>

                {/* Details below photo */}
                <div className="feed-details">
                    {profile.bio && <p className="feed-bio">{profile.bio}</p>}

                    {profile.interests.length > 0 && (
                        <div className="feed-interests">
                            {profile.interests.map((interest) => (
                                <span
                                    key={interest}
                                    className={`feed-interest-chip ${profile.sharedInterests?.includes(interest) ? "shared" : ""}`}
                                >
                                    {interest}
                                </span>
                            ))}
                        </div>
                    )}

                    {profile.score > 0 && (
                        <p className="feed-match-score">
                            {profile.score} shared interest{profile.score > 1 ? "s" : ""}
                        </p>
                    )}
                </div>
            </div>

            {/* Action buttons — left = NOPE, right = LIKE */}
            <div className="feed-actions">
                <button
                    className="feed-action-btn feed-action-dislike"
                    onClick={() => advanceCard("left")}
                    aria-label="Dislike"
                >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                </button>
                <button
                    className="feed-action-btn feed-action-like"
                    onClick={() => advanceCard("right")}
                    aria-label="Like"
                >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                </button>
            </div>

            {/* Card counter */}
            <p className="feed-counter">
                {currentIndex + 1} / {profiles.length}
            </p>
        </main>
    );
}
