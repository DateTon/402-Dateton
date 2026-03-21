export default function DatePage() {
    return (
        <main className="page">
            <section className="card" style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
                <h1 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                    Dates
                </h1>
                <p style={{ color: "var(--color-text-muted)", fontSize: "0.9rem" }}>
                    No upcoming dates. When a bid is accepted in a chat, the escrow page will appear there.
                </p>
            </section>
        </main>
    );
}
