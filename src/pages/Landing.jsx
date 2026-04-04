import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

const features = [
    {
        icon: "🎮",
        title: "Game-Based Training",
        desc: "Immersive therapy sessions disguised as high-octane mini-games built for neural engagement.",
        color: "#00f5ff",
        delay: "0s",
    },
    {
        icon: "🧠",
        title: "AI-Driven Plans",
        desc: "Adaptive algorithms craft a personalized treatment roadmap unique to your visual profile.",
        color: "#a855f7",
        delay: "0.1s",
    },
    {
        icon: "📊",
        title: "Real-Time Progress",
        desc: "Biometric dashboards track improvement streaks, XP gains, and clinical milestones daily.",
        color: "#00ff88",
        delay: "0.2s",
    },
    {
        icon: "🔬",
        title: "Clinical Precision",
        desc: "Evidence-based protocols developed with ophthalmologists for maximum therapeutic efficacy.",
        color: "#ff6b35",
        delay: "0.3s",
    },
];

const stats = [
    { value: "97%", label: "Patient improvement rate" },
    { value: "2.4M", label: "Sessions completed" },
    { value: "12", label: "Clinical studies backed" },
    { value: "45°", label: "Avg. visual field gain" },
];

export default function Landing() {
    const navigate = useNavigate();
    const canvasRef = useRef(null);
    const [scanPos, setScanPos] = useState(0);

    /* particle background */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles = Array.from({ length: 80 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 1.5 + 0.4,
            dx: (Math.random() - 0.5) * 0.4,
            dy: (Math.random() - 0.5) * 0.4,
            opacity: Math.random() * 0.6 + 0.1,
            color: Math.random() > 0.5 ? "#00f5ff" : "#a855f7",
        }));

        let raf;
        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach((p) => {
                p.x += p.dx;
                p.y += p.dy;
                if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
                if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.opacity;
                ctx.fill();
            });
            raf = requestAnimationFrame(draw);
        }
        draw();

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        window.addEventListener("resize", resize);
        return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
    }, []);

    /* scan-line effect on eye ring */
    useEffect(() => {
        const id = setInterval(() => setScanPos((p) => (p >= 100 ? 0 : p + 1)), 20);
        return () => clearInterval(id);
    }, []);

    return (
        <div style={{ background: "var(--bg-dark)", minHeight: "100vh", position: "relative", overflow: "hidden" }}>
            {/* Particle canvas */}
            <canvas
                ref={canvasRef}
                style={{ position: "fixed", top: 0, left: 0, pointerEvents: "none", zIndex: 0 }}
            />

            {/* Grid bg */}
            <div className="grid-bg" style={{ position: "fixed", inset: 0, zIndex: 0, opacity: 0.5 }} />

            {/* ── NAVBAR ── */}
            <nav style={{
                position: "sticky", top: 0, zIndex: 100,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "16px 48px",
                background: "rgba(5,8,16,0.85)",
                backdropFilter: "blur(20px)",
                borderBottom: "1px solid rgba(0,245,255,0.12)",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: "50%",
                        background: "linear-gradient(135deg,#00f5ff,#a855f7)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 18, boxShadow: "0 0 16px rgba(0,245,255,0.5)",
                    }}>👁</div>
                    <span style={{ fontFamily: "var(--font-heading)", fontWeight: 900, fontSize: "1.2rem", color: "#fff" }}>
                        NETRA<span className="glow-text">SYNC</span>
                    </span>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                    <button
                        style={{
                            fontFamily: "var(--font-heading)", fontSize: "0.85rem", fontWeight: 600,
                            letterSpacing: 1, padding: "12px 24px", borderRadius: "var(--radius-btn)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            background: "rgba(255,255,255,0.04)", color: "var(--text-secondary)", cursor: "pointer",
                            transition: "var(--transition)",
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(0,245,255,0.4)"}
                        onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"}
                        onClick={() => navigate("/login")}
                    >
                        Login
                    </button>
                    <button className="btn-neon" onClick={() => navigate("/register")}>
                        <span>Launch App</span>
                    </button>
                </div>
            </nav>

            {/* ── HERO ── */}
            <section style={{
                position: "relative", zIndex: 1,
                minHeight: "90vh", display: "flex", alignItems: "center",
                padding: "80px 48px",
                gap: 64,
            }}>
                {/* Left text */}
                <div style={{ flex: 1, maxWidth: 620 }}>
                    <div className="animate-fade-up" style={{ animationDelay: "0s" }}>
                        <div style={{
                            display: "inline-flex", alignItems: "center", gap: 8,
                            background: "rgba(0,245,255,0.08)", border: "1px solid rgba(0,245,255,0.2)",
                            borderRadius: 20, padding: "6px 16px", marginBottom: 24,
                        }}>
                            <span style={{
                                width: 8, height: 8, borderRadius: "50%", background: "#00ff88",
                                boxShadow: "0 0 8px #00ff88", display: "inline-block"
                            }} />
                            <span style={{
                                color: "#00ff88", fontFamily: "var(--font-heading)", fontSize: "0.7rem",
                                letterSpacing: 2, textTransform: "uppercase"
                            }}>
                                Clinical Grade Gaming Therapy
                            </span>
                        </div>
                    </div>

                    <h1 className="animate-fade-up" style={{ animationDelay: "0.1s", marginBottom: 12 }}>
                        Train Your Eyes.<br />
                        <span className="glow-text">Transform Your Vision.</span>
                    </h1>

                    <p className="animate-fade-up" style={{
                        animationDelay: "0.2s", fontSize: "1.1rem", lineHeight: 1.8,
                        color: "var(--text-secondary)", marginTop: 16, maxWidth: 500,
                    }}>
                    </p>

                    <div className="animate-fade-up" style={{
                        animationDelay: "0.35s", display: "flex", gap: 16, marginTop: 40, flexWrap: "wrap",
                    }}>
                        <button className="btn-neon" style={{ fontSize: "0.95rem", padding: "14px 36px" }}
                            onClick={() => navigate("/register")}>
                            <span>⚡ Begin Training</span>
                        </button>
                        <button style={{
                            fontFamily: "var(--font-heading)", fontSize: "0.85rem", fontWeight: 600,
                            letterSpacing: 1, padding: "14px 36px", borderRadius: "var(--radius-btn)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            background: "rgba(255,255,255,0.04)", color: "var(--text-secondary)", cursor: "pointer",
                            transition: "var(--transition)",
                        }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(0,245,255,0.4)"}
                            onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"}
                        >
                            How It Works →
                        </button>
                    </div>
                </div>

                {/* Right — eye orb */}
                <div className="animate-float" style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative", minHeight: 400,
                }}>
                    {/* outer ring */}
                    <div style={{
                        width: 320, height: 320, borderRadius: "50%",
                        border: "2px solid rgba(0,245,255,0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        position: "relative",
                        animation: "border-dance 4s ease-in-out infinite",
                        boxShadow: "0 0 40px rgba(0,245,255,0.1)",
                    }}>
                        {/* middle ring */}
                        <div style={{
                            width: 240, height: 240, borderRadius: "50%",
                            border: "1px solid rgba(168,85,247,0.4)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            position: "relative", overflow: "hidden",
                        }}>
                            {/* Scan line inside */}
                            <div style={{
                                position: "absolute", left: 0, right: 0, height: 2,
                                background: "linear-gradient(90deg, transparent, rgba(0,245,255,0.8), transparent)",
                                top: `${scanPos}%`,
                                filter: "blur(1px)",
                                transition: "top 0.02s linear",
                            }} />
                            {/* Eye icon */}
                            <div style={{ fontSize: 90, filter: "drop-shadow(0 0 20px rgba(0,245,255,0.8))" }}>👁</div>
                        </div>

                        {/* orbit dot */}
                        <div style={{
                            position: "absolute",
                            width: 12, height: 12, borderRadius: "50%",
                            background: "#00f5ff", boxShadow: "0 0 12px #00f5ff",
                            top: "10%", right: "15%",
                            animation: "spin-slow 6s linear infinite",
                        }} />
                    </div>

                    {/* floating badges */}
                    {[
                        { label: "Visual Acuity", value: "+42%", color: "#00ff88", top: "10%", left: "-10%" },
                        { label: "Convergence", value: "↑ 3x", color: "#00f5ff", bottom: "15%", right: "-10%" },
                    ].map((b) => (
                        <div key={b.label} className="glass-card" style={{
                            position: "absolute", padding: "12px 20px",
                            top: b.top, bottom: b.bottom, left: b.left, right: b.right,
                        }}>
                            <div style={{
                                fontSize: "1.3rem", fontFamily: "var(--font-heading)", color: b.color,
                                fontWeight: 900
                            }}>{b.value}</div>
                            <div style={{
                                fontSize: "0.7rem", color: "var(--text-muted)", textTransform: "uppercase",
                                letterSpacing: 1
                            }}>{b.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── STATS BAR ── */}
            <div style={{
                position: "relative", zIndex: 1,
                background: "rgba(0,245,255,0.04)",
                borderTop: "1px solid rgba(0,245,255,0.1)",
                borderBottom: "1px solid rgba(0,245,255,0.1)",
                padding: "32px 48px",
                display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24, textAlign: "center",
            }}>
                {stats.map((s) => (
                    <div key={s.label}>
                        <div style={{
                            fontFamily: "var(--font-heading)", fontSize: "clamp(1.6rem,3vw,2.4rem)",
                            fontWeight: 900, background: "var(--grad-accent)",
                            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent"
                        }}>{s.value}</div>
                        <div style={{ color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: 4 }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* ── FEATURES ── */}
            <section style={{ position: "relative", zIndex: 1, padding: "80px 48px" }}>
                <div style={{ textAlign: "center", marginBottom: 56 }}>
                    <h2 style={{ fontFamily: "var(--font-heading)" }}>
                        Why <span className="glow-text">NetraSync</span> Works
                    </h2>
                    <p style={{ color: "var(--text-secondary)", marginTop: 12, maxWidth: 500, margin: "12px auto 0" }}>
                        Science-backed therapy wrapped in a gaming engine built for maximum neural engagement.
                    </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 24 }}>
                    {features.map((f) => (
                        <div key={f.title} className="glass-card" style={{
                            padding: 28,
                            animationDelay: f.delay,
                            borderTop: `2px solid ${f.color}30`,
                        }}>
                            <div style={{
                                width: 56, height: 56, borderRadius: 14,
                                background: `${f.color}15`, border: `1px solid ${f.color}30`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 28, marginBottom: 18,
                            }}>
                                {f.icon}
                            </div>
                            <h3 style={{
                                fontFamily: "var(--font-heading)", color: f.color,
                                fontSize: "0.95rem", letterSpacing: 0.5, marginBottom: 10
                            }}>
                                {f.title}
                            </h3>
                            <p style={{ fontSize: "0.9rem", lineHeight: 1.7, color: "var(--text-secondary)" }}>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── CTA ── */}
            <section style={{
                position: "relative", zIndex: 1, textAlign: "center", padding: "80px 48px",
            }}>
                <div className="glass-card" style={{
                    maxWidth: 700, margin: "0 auto", padding: "64px 48px",
                    background: "linear-gradient(135deg, rgba(0,245,255,0.05), rgba(168,85,247,0.05))",
                    border: "1px solid rgba(0,245,255,0.2)",
                }}>
                    <div style={{ fontSize: 48, marginBottom: 20 }}>👁‍🗨</div>
                    <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "clamp(1.4rem,3vw,2rem)" }}>
                        Ready to <span className="glow-text">Level Up</span> Your Vision?
                    </h2>
                    <p style={{ color: "var(--text-secondary)", margin: "16px auto 32px", maxWidth: 480, fontSize: "1rem" }}>
                        Join thousands of patients reclaiming their visual health through the world's most advanced
                        game-based therapy platform.
                    </p>
                    <button className="btn-neon" style={{ fontSize: "1rem", padding: "16px 48px" }}
                        onClick={() => navigate("/register")}>
                        <span>⚡ Start Your Journey</span>
                    </button>
                </div>
            </section>

            {/* Footer */}
            <footer style={{
                position: "relative", zIndex: 1, textAlign: "center",
                padding: "24px 48px",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                color: "var(--text-muted)", fontSize: "0.8rem",
                fontFamily: "var(--font-heading)", letterSpacing: 1,
            }}>
                © 2026 NETRASYNC — CLINICAL GAMING THERAPY PLATFORM
            </footer>
        </div>
    );
}