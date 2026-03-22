"use client";

import { useState, useEffect } from "react";

function getCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? match[1] : null;
}

export default function ThemeToggle() {
    const [theme, setTheme] = useState<"dark" | "light">("dark");

    useEffect(() => {
        const saved = getCookie("dateton_theme") || document.documentElement.getAttribute("data-theme") || "dark";
        setTheme(saved as "dark" | "light");
    }, []);

    function toggle() {
        const next = theme === "dark" ? "light" : "dark";
        setTheme(next);
        document.documentElement.setAttribute("data-theme", next);
        document.cookie = `dateton_theme=${next};path=/;max-age=${60 * 60 * 24 * 365}`;
    }

    return (
        <div className="theme-toggle">
            <span>Dark</span>
            <button type="button" className={`theme-toggle-track ${theme === "light" ? "light" : ""}`} onClick={toggle}>
                <span className="theme-toggle-thumb" />
            </button>
            <span>Light</span>
        </div>
    );
}
