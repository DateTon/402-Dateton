"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import ConnectWallet from '../components/ConnectWallet'
import { useNav } from '../components/NavContext'


type TelegramUser = {
    id?: number;
    first_name?: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    photo_url?: string;
};

type AppUser = {
    telegramId: number;
    firstName: string;
    lastName: string;
    age: number;
    bio: string;
    gender: string;
    interestedIn: string[];
    interests: string[];
    images: string[];
    walletAddress: string;
};

type AppState = "SPLASH" | "DENIED" | "LOADING" | "REGISTER" | "HOME" | "EDIT";

const INTEREST_OPTIONS = [
    "Coffee", "Brunch", "Night walks", "Travel", "Road trips", "Beach days",
    "Hiking", "Gym", "Running", "Yoga", "Pilates", "Dancing", "Live music",
    "Festivals", "Movies", "Netflix", "Documentaries", "Cooking", "Baking",
    "Wine", "Cocktails", "Sushi", "Tacos", "Foodie spots", "Photography",
    "Art galleries", "Museums", "Fashion", "Books", "Podcasts", "Astrology",
    "Dogs", "Cats", "Outdoors", "Picnics", "Sunset views", "City breaks",
    "Language learning", "Entrepreneurship", "Startups", "Tech", "AI",
    "Gaming", "Board games", "Karaoke", "Theater", "Skiing", "Surfing",
    "Tattoos", "Self-growth",
];

const GENDER_OPTIONS = [
    "Man", "Woman", "Non-binary", "Trans man", "Trans woman",
    "Genderfluid", "Agender", "Genderqueer", "Bigender",
    "Demiboy", "Demigirl", "Prefer not to say",
];

const TOTAL_STEPS = 4;

// Track across navigations whether the splash has already been shown
let splashShownOnce = false;

export default function HomePage() {
    const { setNavVisible } = useNav();
    const skipSplash = splashShownOnce;
    const [state, setState] = useState<AppState>(skipSplash ? "LOADING" : "SPLASH");
    const [tgUser, setTgUser] = useState<TelegramUser | null>(null);
    const [appUser, setAppUser] = useState<AppUser | null>(null);
    const [splashFading, setSplashFading] = useState(false);

    // Multi-step form: 1=info, 2=interests, 3=images, 4=submit
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        age: "",
        bio: "",
        gender: "",
    });
    const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
    const [interestedIn, setInterestedIn] = useState<string[]>([]);
    const [interestedInAll, setInterestedInAll] = useState(false);
    const [images, setImages] = useState<(string | null)[]>([null, null, null, null]);
    const [uploading, setUploading] = useState<boolean[]>([false, false, false, false]);
    const [toast, setToast] = useState<string | null>(null);
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const showToast = useCallback((msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    }, []);

    // Hide navbar on non-HOME states
    useEffect(() => {
        setNavVisible(state === "HOME");
    }, [state, setNavVisible]);

    function handleEditProfile() {
        if (!appUser) return;
        setFormData({
            firstName: appUser.firstName,
            lastName: appUser.lastName,
            age: String(appUser.age),
            bio: appUser.bio,
            gender: appUser.gender,
        });
        setSelectedInterests([...appUser.interests]);
        setInterestedIn([...appUser.interestedIn]);
        setInterestedInAll(
            GENDER_OPTIONS.every((g) => appUser.interestedIn.includes(g))
        );
        const imgArr: (string | null)[] = [...appUser.images];
        while (imgArr.length < 4) imgArr.push(null);
        setImages(imgArr.slice(0, 4));
        setWalletAddress(appUser.walletAddress || null);
        setStep(1);
        setState("EDIT");
    }

    async function handleUpdate() {
        setSubmitting(true);
        try {
            const res = await fetch("/api/user", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    firstName: formData.firstName.trim(),
                    lastName: formData.lastName.trim(),
                    age: Number(formData.age),
                    bio: formData.bio.trim(),
                    gender: formData.gender,
                    interestedIn,
                    interests: selectedInterests,
                    images: images.filter(Boolean),
                    walletAddress: walletAddress || '',
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                showToast(data.error || "Update failed.");
                setSubmitting(false);
                return;
            }
            setAppUser(data.user);
            setState("HOME");
        } catch {
            showToast("Connection error.");
        } finally {
            setSubmitting(false);
        }
    }

    // Splash screen timer (skipped on return navigation)
    useEffect(() => {
        if (skipSplash) {
            checkTelegram();
            return;
        }
        splashShownOnce = true;
        const fadeTimer = setTimeout(() => setSplashFading(true), 2500);
        const endTimer = setTimeout(() => checkTelegram(), 3000);
        return () => {
            clearTimeout(fadeTimer);
            clearTimeout(endTimer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function checkTelegram() {
        const tg = (window as any)?.Telegram?.WebApp;

        if (!tg || !tg.initData) {
            setState("DENIED");
            return;
        }

        tg.ready();
        tg.expand();

        const user = (tg.initDataUnsafe?.user as TelegramUser) || null;
        setTgUser(user);
        setState("LOADING");
        checkAuth(user);
    }

    async function checkAuth(telegramUser: TelegramUser | null) {
        try {
            const res = await fetch("/api/user");
            if (res.ok) {
                const data = await res.json();
                if (data.user) {
                    setAppUser(data.user);
                    setState("HOME");
                    return;
                }
            }

            if (telegramUser?.id) {
                const checkRes = await fetch("/api/user/check", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ telegramId: telegramUser.id }),
                });
                const checkData = await checkRes.json();

                if (checkData.exists && checkData.user) {
                    setAppUser(checkData.user);
                    setState("HOME");
                    return;
                }
            }

            setFormData({
                firstName: telegramUser?.first_name ?? "",
                lastName: telegramUser?.last_name ?? "",
                age: "",
                bio: "",
                gender: "",
            });
            setState("REGISTER");
        } catch {
            setFormData({
                firstName: "",
                lastName: "",
                age: "",
                bio: "",
                gender: "",
            });
            setState("REGISTER");
        }
    }

    function toggleInterest(interest: string) {
        setSelectedInterests((prev) => {
            if (prev.includes(interest)) return prev.filter((i) => i !== interest);
            if (prev.length >= 4) return prev;
            return [...prev, interest];
        });
    }

    function toggleInterestedIn(gender: string) {
        if (interestedInAll) {
            setInterestedInAll(false);
            setInterestedIn([gender]);
            return;
        }
        setInterestedIn((prev) =>
            prev.includes(gender) ? prev.filter((g) => g !== gender) : [...prev, gender]
        );
    }

    function toggleInterestedInAll() {
        if (interestedInAll) {
            setInterestedInAll(false);
            setInterestedIn([]);
        } else {
            setInterestedInAll(true);
            setInterestedIn([...GENDER_OPTIONS]);
        }
    }

    function validateStep(s: number): string | null {
        if (s === 1) {
            if (!formData.firstName.trim()) return "First name is required.";
            if (!formData.lastName.trim()) return "Last name is required.";
            const age = Number(formData.age);
            if (!formData.age || isNaN(age) || age < 18) return "Age is required (minimum 18).";
            if (age > 70) return "Maximum age is 70.";
            if (!formData.gender) return "Gender is required.";
            const bioLen = formData.bio.trim().length;
            if (bioLen < 16) return "Bio must be at least 16 characters.";
            if (bioLen > 80) return "Bio must be 80 characters or less.";
        }
        if (s === 2) {
            if (interestedIn.length === 0) return "Select at least one option in 'Interested in'.";
            if (selectedInterests.length < 2) return "Select at least 2 interests.";
        }
        if (s === 3) {
            const count = images.filter(Boolean).length;
            if (count < 2) return "Upload at least 2 photos.";
        }
        return null;
    }

    function goNext() {
        const error = validateStep(step);
        if (error) {
            showToast(error);
            return;
        }
        setStep((s) => Math.min(s + 1, TOTAL_STEPS));
    }

    function goPrev() {
        setStep((s) => Math.max(s - 1, 1));
    }

    async function handleImageUpload(index: number, file: File) {
        const newUploading = [...uploading];
        newUploading[index] = true;
        setUploading(newUploading);

        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/upload", { method: "POST", body: fd });
            const data = await res.json();

            if (!res.ok) {
                showToast(data.error || "Upload failed.");
                return;
            }

            const newImages = [...images];
            newImages[index] = data.url;
            setImages(newImages);
        } catch {
            showToast("Connection error.");
        } finally {
            const reset = [...uploading];
            reset[index] = false;
            setUploading(reset);
        }
    }

    function removeImage(index: number) {
        const newImages = [...images];
        newImages[index] = null;
        setImages(newImages);
    }

    async function handleSubmit() {
        setSubmitting(true);

        try {
            const res = await fetch("/api/user", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    telegramId: tgUser?.id,
                    firstName: formData.firstName.trim(),
                    lastName: formData.lastName.trim(),
                    age: Number(formData.age),
                    bio: formData.bio.trim(),
                    gender: formData.gender,
                    interestedIn,
                    interests: selectedInterests,
                    images: images.filter(Boolean),
                    walletAddress: walletAddress || '',
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                showToast(data.error || "Registration failed.");
                setSubmitting(false);
                return;
            }

            setAppUser(data.user);
            setState("HOME");
        } catch {
            showToast("Connection error.");
            setSubmitting(false);
        }
    }

    // ── Toast ──
    const toastEl = toast && (
        <div className="toast-container">
            <div className="alert alert-error shadow-lg">
                <span>{toast}</span>
            </div>
        </div>
    );

    // ── SPLASH ──
    if (state === "SPLASH") {
        return (
            <main className={`splash ${splashFading ? "splash-fade-out" : ""}`}>
                <div className="splash-content">
                    <Image
                        src="/logo-text-white.png"
                        alt="DateTon Logo"
                        width={80}
                        height={80}
                        className="splash-logo"
                        priority
                    />
                    <h1 className="splash-title">DateTon</h1>
                    <p className="splash-desc">
                        Find your date, secured by blockchain.
                    </p>
                </div>
            </main>
        );
    }

    // ── DENIED ──
    if (state === "DENIED") {
        return (
            <main className="page">
                <section className="card">
                    <h1>Access denied</h1>
                    <p>This app must be opened from Telegram.</p>
                </section>
            </main>
        );
    }

    // ── LOADING ──
    if (state === "LOADING") {
        return (
            <main className="page">
                <span className="loading loading-spinner loading-lg text-cyan-400"></span>
            </main>
        );
    }

    // ── REGISTER ──
    if (state === "REGISTER") {
        return (
            <main className="page">
                {toastEl}
                <section className="card register-card">
                    <div className="register-header">
                        <h1 className="register-title">
                            {step === 1 && "Create your profile"}
                            {step === 2 && "Your preferences"}
                            {step === 3 && "Add your photos"}
                            {step === 4 && "All set!"}
                        </h1>
                        <div className="step-indicator">
                            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                                <span key={i} className={`step-dot ${step >= i + 1 ? "active" : ""}`} />
                            ))}
                        </div>
                    </div>

                    {/* ── STEP 1: Personal info ── */}
                    {step === 1 && (
                        <div className="register-form">
                            <div className="form-group">
                                <label htmlFor="firstName">First name <span className="required">*</span></label>
                                <input
                                    id="firstName"
                                    className="input"
                                    type="text"
                                    value={formData.firstName}
                                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                    placeholder="Your first name"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="lastName">Last name <span className="required">*</span></label>
                                <input
                                    id="lastName"
                                    className="input"
                                    type="text"
                                    value={formData.lastName}
                                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                    placeholder="Your last name"
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="age">Age <span className="required">*</span></label>
                                    <input
                                        id="age"
                                        className="input"
                                        type="number"
                                        min="18"
                                        max="70"
                                        value={formData.age}
                                        onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                                        placeholder="25"
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="gender">Gender <span className="required">*</span></label>
                                    <select
                                        id="gender"
                                        className="input"
                                        value={formData.gender}
                                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                    >
                                        <option value="">Select...</option>
                                        {GENDER_OPTIONS.map((g) => (
                                            <option key={g} value={g}>{g}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="bio">
                                    Bio <span className="required">*</span>
                                    <span className="char-count">{formData.bio.length}/80</span>
                                </label>
                                <textarea
                                    id="bio"
                                    className="input textarea"
                                    value={formData.bio}
                                    onChange={(e) => {
                                        if (e.target.value.length <= 80) {
                                            setFormData({ ...formData, bio: e.target.value });
                                        }
                                    }}
                                    placeholder="Tell us about yourself... (min 16 characters)"
                                    rows={3}
                                />
                            </div>

                            <div className="form-nav">
                                <div />
                                <button type="button" className="nav-arrow" onClick={goNext}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 18l6-6-6-6" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 2: Interests + Interested in ── */}
                    {step === 2 && (
                        <div className="register-form">
                            <div className="form-group">
                                <label>
                                    Interested in <span className="required">*</span>
                                </label>
                                <span className="helper">Who are you interested in?</span>
                                <div className="interests-grid">
                                    <button
                                        type="button"
                                        className={`interest-chip ${interestedInAll ? "selected" : ""}`}
                                        onClick={toggleInterestedInAll}
                                    >
                                        All
                                    </button>
                                    {GENDER_OPTIONS.map((g) => (
                                        <button
                                            key={g}
                                            type="button"
                                            className={`interest-chip ${interestedIn.includes(g) ? "selected" : ""}`}
                                            onClick={() => toggleInterestedIn(g)}
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group">
                                <label>
                                    Interests <span className="required">*</span>
                                    <span className="char-count">{selectedInterests.length}/4</span>
                                </label>
                                <span className="helper">Select between 2 and 4</span>
                                <div className="interests-grid">
                                    {INTEREST_OPTIONS.map((interest) => (
                                        <button
                                            key={interest}
                                            type="button"
                                            className={`interest-chip ${selectedInterests.includes(interest) ? "selected" : ""}`}
                                            onClick={() => toggleInterest(interest)}
                                            disabled={!selectedInterests.includes(interest) && selectedInterests.length >= 4}
                                        >
                                            {interest}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-nav">
                                <button type="button" className="nav-arrow" onClick={goPrev}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M15 18l-6-6 6-6" />
                                    </svg>
                                </button>
                                <button type="button" className="nav-arrow" onClick={goNext}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 18l6-6-6-6" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 3: Images ── */}
                    {step === 3 && (
                        <div className="register-form">
                            <p className="register-subtitle">
                                Upload your photos (2 required, up to 4)
                            </p>

                            <div className="images-grid">
                                {[0, 1, 2, 3].map((index) => (
                                    <div key={index} className="image-slot">
                                        {images[index] ? (
                                            <div className="image-preview">
                                                <img src={images[index]!} alt={`Photo ${index + 1}`} />
                                                <button
                                                    type="button"
                                                    className="image-remove"
                                                    onClick={() => removeImage(index)}
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M18 6L6 18M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                className="image-add"
                                                disabled={uploading[index]}
                                                onClick={() => fileInputRefs.current[index]?.click()}
                                            >
                                                {uploading[index] ? (
                                                    <span className="loading loading-spinner loading-md"></span>
                                                ) : (
                                                    <>
                                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M12 5v14M5 12h14" />
                                                        </svg>
                                                        <span className="image-label">
                                                            {index < 2 ? "Required" : "Optional"}
                                                        </span>
                                                    </>
                                                )}
                                            </button>
                                        )}
                                        <input
                                            ref={(el) => { fileInputRefs.current[index] = el; }}
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp"
                                            style={{ display: "none" }}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleImageUpload(index, file);
                                                e.target.value = "";
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="form-nav">
                                <button type="button" className="nav-arrow" onClick={goPrev}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M15 18l-6-6 6-6" />
                                    </svg>
                                </button>
                                <button type="button" className="nav-arrow" onClick={goNext}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 18l6-6-6-6" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 4: Submit ── */}
                    {step === 4 && (
                        <div className="submit-page">
                            <h2>Ready to go?</h2>
                            <p>Your profile is complete. Hit the button below to create your account.</p>

                            <div style={{ marginBottom: '1rem' }}>
                                <p style={{ marginBottom: '0.5rem' }}>Connect your TON wallet :</p>
                                <ConnectWallet onWalletChange={setWalletAddress} />
                            </div>

                            <button
                                type="button"
                                className="button"
                                disabled={submitting}
                                onClick={handleSubmit}
                            >
                                {submitting ? (
                                    <span className="loading loading-spinner loading-sm"></span>
                                ) : (
                                    "Create my account"
                                )}
                            </button>

                            <div className="form-nav" style={{ width: "100%" }}>
                                <button type="button" className="nav-arrow" onClick={goPrev}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M15 18l-6-6 6-6" />
                                    </svg>
                                </button>
                                <div />
                            </div>
                        </div>
                    )}
                </section>
            </main>
        );
    }

    // ── EDIT ──
    if (state === "EDIT") {
        return (
            <main className="page">
                {toastEl}
                <section className="card register-card" style={{ position: "relative" }}>
                    <button
                        type="button"
                        className="edit-cancel-btn"
                        onClick={() => setState("HOME")}
                    >
                        Cancel
                    </button>
                    <div className="register-header">
                        <h1 className="register-title">
                            {step === 1 && "Create your profile"}
                            {step === 2 && "Your preferences"}
                            {step === 3 && "Add your photos"}
                            {step === 4 && "Update your profile"}
                        </h1>
                        <div className="step-indicator">
                            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                                <span key={i} className={`step-dot ${step >= i + 1 ? "active" : ""}`} />
                            ))}
                        </div>
                    </div>

                    {/* ── STEP 1: Personal info ── */}
                    {step === 1 && (
                        <div className="register-form">
                            <div className="form-group">
                                <label htmlFor="firstName">First name <span className="required">*</span></label>
                                <input
                                    id="firstName"
                                    className="input"
                                    type="text"
                                    value={formData.firstName}
                                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                    placeholder="Your first name"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="lastName">Last name <span className="required">*</span></label>
                                <input
                                    id="lastName"
                                    className="input"
                                    type="text"
                                    value={formData.lastName}
                                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                    placeholder="Your last name"
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="age">Age <span className="required">*</span></label>
                                    <input
                                        id="age"
                                        className="input"
                                        type="number"
                                        min="18"
                                        max="70"
                                        value={formData.age}
                                        onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                                        placeholder="25"
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="gender">Gender <span className="required">*</span></label>
                                    <select
                                        id="gender"
                                        className="input"
                                        value={formData.gender}
                                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                    >
                                        <option value="">Select...</option>
                                        {GENDER_OPTIONS.map((g) => (
                                            <option key={g} value={g}>{g}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="bio">
                                    Bio <span className="required">*</span>
                                    <span className="char-count">{formData.bio.length}/80</span>
                                </label>
                                <textarea
                                    id="bio"
                                    className="input textarea"
                                    value={formData.bio}
                                    onChange={(e) => {
                                        if (e.target.value.length <= 80) {
                                            setFormData({ ...formData, bio: e.target.value });
                                        }
                                    }}
                                    placeholder="Tell us about yourself... (min 16 characters)"
                                    rows={3}
                                />
                            </div>

                            <div className="form-nav">
                                <div />
                                <button type="button" className="nav-arrow" onClick={goNext}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 18l6-6-6-6" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 2: Interests + Interested in ── */}
                    {step === 2 && (
                        <div className="register-form">
                            <div className="form-group">
                                <label>
                                    Interested in <span className="required">*</span>
                                </label>
                                <span className="helper">Who are you interested in?</span>
                                <div className="interests-grid">
                                    <button
                                        type="button"
                                        className={`interest-chip ${interestedInAll ? "selected" : ""}`}
                                        onClick={toggleInterestedInAll}
                                    >
                                        All
                                    </button>
                                    {GENDER_OPTIONS.map((g) => (
                                        <button
                                            key={g}
                                            type="button"
                                            className={`interest-chip ${interestedIn.includes(g) ? "selected" : ""}`}
                                            onClick={() => toggleInterestedIn(g)}
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-group">
                                <label>
                                    Interests <span className="required">*</span>
                                    <span className="char-count">{selectedInterests.length}/4</span>
                                </label>
                                <span className="helper">Select between 2 and 4</span>
                                <div className="interests-grid">
                                    {INTEREST_OPTIONS.map((interest) => (
                                        <button
                                            key={interest}
                                            type="button"
                                            className={`interest-chip ${selectedInterests.includes(interest) ? "selected" : ""}`}
                                            onClick={() => toggleInterest(interest)}
                                            disabled={!selectedInterests.includes(interest) && selectedInterests.length >= 4}
                                        >
                                            {interest}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="form-nav">
                                <button type="button" className="nav-arrow" onClick={goPrev}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M15 18l-6-6 6-6" />
                                    </svg>
                                </button>
                                <button type="button" className="nav-arrow" onClick={goNext}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 18l6-6-6-6" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 3: Images ── */}
                    {step === 3 && (
                        <div className="register-form">
                            <p className="register-subtitle">
                                Upload your photos (2 required, up to 4)
                            </p>

                            <div className="images-grid">
                                {[0, 1, 2, 3].map((index) => (
                                    <div key={index} className="image-slot">
                                        {images[index] ? (
                                            <div className="image-preview">
                                                <img src={images[index]!} alt={`Photo ${index + 1}`} />
                                                <button
                                                    type="button"
                                                    className="image-remove"
                                                    onClick={() => removeImage(index)}
                                                >
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M18 6L6 18M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                className="image-add"
                                                disabled={uploading[index]}
                                                onClick={() => fileInputRefs.current[index]?.click()}
                                            >
                                                {uploading[index] ? (
                                                    <span className="loading loading-spinner loading-md"></span>
                                                ) : (
                                                    <>
                                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M12 5v14M5 12h14" />
                                                        </svg>
                                                        <span className="image-label">
                                                            {index < 2 ? "Required" : "Optional"}
                                                        </span>
                                                    </>
                                                )}
                                            </button>
                                        )}
                                        <input
                                            ref={(el) => { fileInputRefs.current[index] = el; }}
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp"
                                            style={{ display: "none" }}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleImageUpload(index, file);
                                                e.target.value = "";
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="form-nav">
                                <button type="button" className="nav-arrow" onClick={goPrev}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M15 18l-6-6 6-6" />
                                    </svg>
                                </button>
                                <button type="button" className="nav-arrow" onClick={goNext}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 18l6-6-6-6" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 4: Submit ── */}
                    {step === 4 && (
                        <div className="submit-page">
                            <h2>Ready to save?</h2>
                            <p>Review your changes and hit the button below to update your profile.</p>

                            <div style={{ marginBottom: '1rem' }}>
                                <p style={{ marginBottom: '0.5rem' }}>Connect your TON wallet :</p>
                                <ConnectWallet onWalletChange={setWalletAddress} />
                            </div>

                            <button
                                type="button"
                                className="button"
                                disabled={submitting}
                                onClick={handleUpdate}
                            >
                                {submitting ? (
                                    <span className="loading loading-spinner loading-sm"></span>
                                ) : (
                                    "Save changes"
                                )}
                            </button>

                            <div className="form-nav" style={{ width: "100%" }}>
                                <button type="button" className="nav-arrow" onClick={goPrev}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M15 18l-6-6 6-6" />
                                    </svg>
                                </button>
                                <div />
                            </div>
                        </div>
                    )}
                </section>
            </main>
        );
    }

    // ── HOME ──
    return (
        <main className="page">
            <section className="card profile-card">
                <div className="profile-header">
                    {appUser?.images?.[0] ? (
                        <img
                            src={appUser.images[0]}
                            alt="Profile"
                            className="profile-avatar"
                        />
                    ) : (
                        <div className="profile-avatar-placeholder">
                            {appUser?.firstName?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                    )}
                    <div>
                        <h1 className="profile-name">
                            {appUser?.firstName} {appUser?.lastName}
                        </h1>
                        <button type="button" className="edit-profile-btn" onClick={handleEditProfile}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Edit profile
                        </button>
                    </div>
                </div>

                <div className="profile-details">
                    {appUser?.age && (
                        <div className="profile-detail">
                            <span className="profile-label">Age</span>
                            <span>{appUser.age} years old</span>
                        </div>
                    )}
                    {appUser?.gender && (
                        <div className="profile-detail">
                            <span className="profile-label">Gender</span>
                            <span>{appUser.gender}</span>
                        </div>
                    )}
                    {appUser?.interestedIn && appUser.interestedIn.length > 0 && (
                        <div className="profile-detail">
                            <span className="profile-label">Interested in</span>
                            <div className="profile-tags">
                                {appUser.interestedIn.map((g, i) => (
                                    <span key={i} className="profile-tag">{g}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    {appUser?.bio && (
                        <div className="profile-detail">
                            <span className="profile-label">Bio</span>
                            <span>{appUser.bio}</span>
                        </div>
                    )}
                    {appUser?.interests && appUser.interests.length > 0 && (
                        <div className="profile-detail">
                            <span className="profile-label">Interests</span>
                            <div className="profile-tags">
                                {appUser.interests.map((interest, i) => (
                                    <span key={i} className="profile-tag">{interest}</span>
                                ))}
                            </div>
                        </div>
                    )}
                    {appUser?.images && appUser.images.length > 0 && (
                        <div className="profile-detail">
                            <span className="profile-label">Photos</span>
                            <div className="profile-images">
                                {appUser.images.map((url, i) => (
                                    <img key={i} src={url} alt={`Photo ${i + 1}`} className="profile-image-thumb" />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
}