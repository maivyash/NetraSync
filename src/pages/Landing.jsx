import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";

/* ── DATA ── */
const features = [
    {
        icon: "🎮",
        title: "Game-Based Training",
        desc: "Engaging neuro-therapeutic environments designed to stimulate oculomotor control and visual processing speed.",
        color: "#00f5ff",
        delay: 0,
    },
    {
        icon: "🧠",
        title: "AI-Driven Plans",
        desc: "Our proprietary NetraCore engine adapts game difficulty and visual stimuli in real-time based on patient response metrics.",
        color: "#a855f7",
        delay: 100,
    },
    {
        icon: "📊",
        title: "Real-Time Progress",
        desc: "Instant telemetry and diagnostic readouts visualizing saccadic accuracy, depth perception, and focus recovery.",
        color: "#00ff88",
        delay: 200,
    },
    {
        icon: "🔬",
        title: "Clinical Precision",
        desc: "Developed in collaboration with leading ophthalmologists and neuro-scientists for hospital-grade results at home.",
        color: "#ff6b35",
        delay: 300,
    },
];

const stats = [
    { value: 97, suffix: "%", label: "Patient improvement rate" },
    { value: 2.4, suffix: "M", label: "Sessions completed", decimals: 1 },
    { value: 12, suffix: "", label: "Clinical studies backed" },
    { value: 45, suffix: "°", label: "Avg. visual field gain" },
];

/* ── HOOKS ── */

/** Intersection Observer hook: triggers `isVisible` once element scrolls into view */
function useReveal(threshold = 0.15) {
    const ref = useRef(null);
    const [isVisible, setIsVisible] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); obs.disconnect(); } },
            { threshold }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, [threshold]);
    return [ref, isVisible];
}

/** Animated counter hook */
function useCounter(end, isActive, duration = 2000, decimals = 0) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (!isActive) return;
        let start = 0;
        const step = end / (duration / 16);
        const id = setInterval(() => {
            start += step;
            if (start >= end) { setCount(end); clearInterval(id); }
            else setCount(parseFloat(start.toFixed(decimals)));
        }, 16);
        return () => clearInterval(id);
    }, [end, isActive, duration, decimals]);
    return count;
}

/* ── PARTICLE CANVAS with node connections ── */
function ParticleCanvas() {
    const canvasRef = useRef(null);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        let w = canvas.width = window.innerWidth;
        let h = canvas.height = window.innerHeight;

        const particles = Array.from({ length: 90 }, () => ({
            x: Math.random() * w,
            y: Math.random() * h,
            r: Math.random() * 1.8 + 0.3,
            dx: (Math.random() - 0.5) * 0.35,
            dy: (Math.random() - 0.5) * 0.35,
            opacity: Math.random() * 0.5 + 0.15,
            color: ["#00f5ff", "#a855f7", "#00ff88"][Math.floor(Math.random() * 3)],
        }));

        let raf;
        function draw() {
            ctx.clearRect(0, 0, w, h);
            /* draw connections */
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 120) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(0,245,255,${0.06 * (1 - dist / 120)})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }
            /* draw particles */
            particles.forEach((p) => {
                p.x += p.dx;
                p.y += p.dy;
                if (p.x < 0 || p.x > w) p.dx *= -1;
                if (p.y < 0 || p.y > h) p.dy *= -1;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.opacity;
                ctx.fill();
                ctx.globalAlpha = 1;
            });
            raf = requestAnimationFrame(draw);
        }
        draw();

        const handleResize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
        window.addEventListener("resize", handleResize);
        return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", handleResize); };
    }, []);
    return <canvas ref={canvasRef} style={{ position: "fixed", top: 0, left: 0, pointerEvents: "none", zIndex: 0 }} />;
}

/* ── SVG Eye Orb with morphing rings ── */
function EyeOrb() {
    const [scanY, setScanY] = useState(0);
    const [pulse, setPulse] = useState(0);

    useEffect(() => {
        let frame = 0;
        const id = setInterval(() => {
            frame++;
            setScanY((frame % 200) / 200 * 100);
            setPulse(Math.sin(frame * 0.03) * 8);
        }, 16);
        return () => clearInterval(id);
    }, []);

    return (
        <div style={{ position: "relative", width: 360, height: 360, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {/* SVG rings */}
            <svg viewBox="0 0 360 360" style={{ position: "absolute", inset: 0, animation: "spin-slow 20s linear infinite" }}>
                <defs>
                    <linearGradient id="ringGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#00f5ff" stopOpacity="0.6" />
                        <stop offset="50%" stopColor="#a855f7" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#00f5ff" stopOpacity="0.6" />
                    </linearGradient>
                    <linearGradient id="ringGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#00ff88" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#a855f7" stopOpacity="0.2" />
                    </linearGradient>
                </defs>
                {/* Outer ring */}
                <circle cx="180" cy="180" r={155 + pulse} fill="none" stroke="url(#ringGrad1)" strokeWidth="1.5"
                    strokeDasharray="12 6" style={{ filter: "drop-shadow(0 0 6px rgba(0,245,255,0.4))" }} />
                {/* Middle ring */}
                <circle cx="180" cy="180" r={120 - pulse * 0.5} fill="none" stroke="url(#ringGrad2)" strokeWidth="1"
                    strokeDasharray="8 4" />
                {/* Inner ring */}
                <circle cx="180" cy="180" r={85 + pulse * 0.3} fill="none" stroke="rgba(0,245,255,0.25)" strokeWidth="0.8" />
                {/* Data arcs */}
                <path d={`M 180 ${25 - pulse} A ${155 + pulse} ${155 + pulse} 0 0 1 ${335 + pulse} 180`}
                    fill="none" stroke="#00f5ff" strokeWidth="2" strokeLinecap="round" opacity="0.5"
                    style={{ filter: "drop-shadow(0 0 4px #00f5ff)" }} />
                {/* Orbit dots */}
                <circle cx={180 + (155 + pulse) * Math.cos(Date.now() * 0.001)} cy={180 + (155 + pulse) * Math.sin(Date.now() * 0.001)}
                    r="4" fill="#00f5ff" style={{ filter: "drop-shadow(0 0 8px #00f5ff)" }}>
                    <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
                </circle>
            </svg>

            {/* Inner eye circle with scan */}
            <div style={{
                width: 200, height: 200, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(0,245,255,0.08) 0%, rgba(5,8,16,0.9) 70%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative", overflow: "hidden",
                boxShadow: "inset 0 0 40px rgba(0,245,255,0.1), 0 0 60px rgba(0,245,255,0.08)",
            }}>
                {/* Scan line */}
                <div style={{
                    position: "absolute", left: 0, right: 0, height: 2,
                    background: "linear-gradient(90deg, transparent, rgba(0,245,255,0.9), transparent)",
                    top: `${scanY}%`, filter: "blur(1px)",
                    boxShadow: "0 0 15px rgba(0,245,255,0.5)",
                }} />
                {/* Horizontal data line */}
                <div style={{
                    position: "absolute", top: "50%", left: 0, right: 0, height: 1,
                    background: "linear-gradient(90deg, transparent, rgba(0,245,255,0.15), transparent)",
                }} />
                {/* Vertical data line */}
                <div style={{
                    position: "absolute", left: "50%", top: 0, bottom: 0, width: 1,
                    background: "linear-gradient(180deg, transparent, rgba(0,245,255,0.15), transparent)",
                }} />
                {/* Eye */}
                <div style={{
                    fontSize: 80, filter: "drop-shadow(0 0 24px rgba(0,245,255,0.8))",
                    animation: "pulse-glow-eye 3s ease-in-out infinite",
                }}>👁</div>
            </div>
        </div>
    );
}

/* ── 3D Tilt Card ── */
function TiltCard({ children, color, delay, isVisible }) {
    const cardRef = useRef(null);
    const [transform, setTransform] = useState("perspective(800px) rotateX(0deg) rotateY(0deg)");
    const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });

    const handleMouseMove = useCallback((e) => {
        const card = cardRef.current;
        if (!card) return;
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const rotateY = (x - 0.5) * 12;
        const rotateX = (0.5 - y) * 12;
        setTransform(`perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`);
        setGlowPos({ x: x * 100, y: y * 100 });
    }, []);

    const handleMouseLeave = useCallback(() => {
        setTransform("perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)");
        setGlowPos({ x: 50, y: 50 });
    }, []);

    return (
        <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
                background: `radial-gradient(circle at ${glowPos.x}% ${glowPos.y}%, ${color}08 0%, rgba(13,17,23,0.75) 60%)`,
                backdropFilter: "blur(20px)",
                borderRadius: 12,
                padding: 28,
                position: "relative",
                overflow: "hidden",
                transform,
                transition: "transform 0.15s ease-out, opacity 0.8s ease, box-shadow 0.3s ease",
                opacity: isVisible ? 1 : 0,
                transitionDelay: `${delay}ms`,
                cursor: "default",
                boxShadow: `inset 0 1px 0 ${color}15, 0 8px 32px rgba(0,0,0,0.5)`,
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `inset 0 1px 0 ${color}30, 0 0 30px ${color}15, 0 8px 32px rgba(0,0,0,0.5)`;
            }}
            onMouseLeave={(e) => {
                handleMouseLeave();
                e.currentTarget.style.boxShadow = `inset 0 1px 0 ${color}15, 0 8px 32px rgba(0,0,0,0.5)`;
            }}
        >
            {/* Top accent glow line */}
            <div style={{
                position: "absolute", top: 0, left: "10%", right: "10%", height: 1,
                background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
                opacity: 0.5,
            }} />
            {/* Biometric pulse line */}
            <svg width="100%" height="3" style={{ position: "absolute", top: 0, left: 0, right: 0, overflow: "visible" }}>
                <line x1="0" y1="1.5" x2="100%" y2="1.5" stroke={color} strokeWidth="2" opacity="0.3">
                    <animate attributeName="opacity" values="0.1;0.5;0.1" dur="3s" repeatCount="indefinite" />
                </line>
            </svg>
            {children}
        </div>
    );
}

/* ── Typewriter Effect ── */
function TypewriterText({ text, isActive, speed = 40 }) {
    const [displayed, setDisplayed] = useState("");
    const [showCursor, setShowCursor] = useState(true);

    useEffect(() => {
        if (!isActive) return;
        let i = 0;
        const id = setInterval(() => {
            i++;
            setDisplayed(text.slice(0, i));
            if (i >= text.length) {
                clearInterval(id);
                setTimeout(() => setShowCursor(false), 1500);
            }
        }, speed);
        return () => clearInterval(id);
    }, [text, isActive, speed]);

    return (
        <span>
            {displayed}
            {showCursor && <span style={{
                display: "inline-block", width: 2, height: "1em", background: "#00f5ff",
                marginLeft: 2, animation: "blink-cursor 0.8s step-end infinite",
                verticalAlign: "text-bottom", boxShadow: "0 0 8px #00f5ff",
            }} />}
        </span>
    );
}

/* ── Stat Counter Component ── */
function StatItem({ stat, isVisible }) {
    const count = useCounter(stat.value, isVisible, 2200, stat.decimals || 0);
    return (
        <div style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(20px)",
            transition: "all 0.8s cubic-bezier(0.4,0,0.2,1)",
        }}>
            <div style={{
                fontFamily: "var(--font-heading)", fontSize: "clamp(1.6rem,3vw,2.6rem)",
                fontWeight: 900, background: "var(--grad-accent)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 0 8px rgba(0,245,255,0.3))",
                letterSpacing: "0.05em",
            }}>
                {count}{stat.suffix}
            </div>
            <div style={{
                color: "var(--text-secondary)", fontSize: "0.8rem", marginTop: 6,
                fontFamily: "var(--font-body)", letterSpacing: "0.5px",
            }}>
                {stat.label}
            </div>
        </div>
    );
}

/* ── Floating HUD Badge ── */
function HudBadge({ label, value, color, style, isVisible }) {
    return (
        <div style={{
            position: "absolute",
            ...style,
            background: "rgba(13,17,23,0.85)",
            backdropFilter: "blur(16px)",
            padding: "14px 22px",
            borderRadius: 8,
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translate(0,0) scale(1)" : "translate(20px, 20px) scale(0.8)",
            transition: "all 1s cubic-bezier(0.4,0,0.2,1)",
            boxShadow: `0 0 20px ${color}10, inset 0 1px 0 rgba(255,255,255,0.05)`,
            animation: isVisible ? "float 4s ease-in-out infinite" : "none",
            zIndex: 2,
        }}>
            <div style={{ fontSize: "1.4rem", fontFamily: "var(--font-heading)", color, fontWeight: 900, letterSpacing: "0.05em" }}>
                {value}
            </div>
            <div style={{
                fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase",
                letterSpacing: 1.5, fontFamily: "var(--font-heading)", marginTop: 2,
            }}>
                {label}
            </div>
            {/* Corner clip accent */}
            <div style={{
                position: "absolute", top: 0, right: 0, width: 12, height: 12,
                borderTop: `2px solid ${color}60`, borderRight: `2px solid ${color}60`,
                borderTopRightRadius: 8,
            }} />
            <div style={{
                position: "absolute", bottom: 0, left: 0, width: 12, height: 12,
                borderBottom: `2px solid ${color}30`, borderLeft: `2px solid ${color}30`,
                borderBottomLeftRadius: 8,
            }} />
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════ */
/* ── MAIN LANDING COMPONENT ── */
/* ══════════════════════════════════════════════════════════════ */
export default function Landing() {
    const navigate = useNavigate();
    const [heroRef, heroVisible] = useReveal(0.1);
    const [statsRef, statsVisible] = useReveal(0.3);
    const [featRef, featVisible] = useReveal(0.1);
    const [ctaRef, ctaVisible] = useReveal(0.2);
    const [navSolid, setNavSolid] = useState(false);

    /* Navbar solidify on scroll */
    useEffect(() => {
        const handleScroll = () => setNavSolid(window.scrollY > 60);
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <div style={{ background: "var(--bg-dark)", minHeight: "100vh", position: "relative", overflow: "hidden" }}>
            <ParticleCanvas />
            <div className="grid-bg" style={{ position: "fixed", inset: 0, zIndex: 0, opacity: 0.4 }} />

            {/* Scan-line texture overlay (Stitch design system: 3% opacity scan lines) */}
            <div style={{
                position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
                backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,245,255,0.015) 2px, rgba(0,245,255,0.015) 4px)",
            }} />

            {/* ── NAVBAR ── */}
            <nav id="main-nav" style={{
                position: "sticky", top: 0, zIndex: 100,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "16px 48px",
                background: navSolid ? "rgba(5,8,16,0.95)" : "rgba(5,8,16,0.6)",
                backdropFilter: "blur(24px)",
                borderBottom: navSolid ? "1px solid rgba(0,245,255,0.15)" : "1px solid transparent",
                transition: "all 0.4s cubic-bezier(0.4,0,0.2,1)",
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                        width: 38, height: 38, borderRadius: "50%",
                        background: "linear-gradient(135deg,#00f5ff,#a855f7)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 18, boxShadow: "0 0 20px rgba(0,245,255,0.5)",
                        animation: "pulse-glow 3s ease-in-out infinite",
                    }}>👁</div>
                    <span style={{
                        fontFamily: "var(--font-heading)", fontWeight: 900, fontSize: "1.25rem",
                        color: "#fff", letterSpacing: "0.05em",
                    }}>
                        NETRA<span className="glow-text">SYNC</span>
                    </span>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <a href="#features" style={{
                        color: "var(--text-secondary)", textDecoration: "none",
                        fontFamily: "var(--font-heading)", fontSize: "0.7rem",
                        letterSpacing: 2, textTransform: "uppercase",
                        transition: "color 0.3s", padding: "8px 16px",
                    }}
                        onMouseEnter={e => e.target.style.color = "#00f5ff"}
                        onMouseLeave={e => e.target.style.color = "var(--text-secondary)"}
                    >Features</a>
                    <a href="#science" style={{
                        color: "var(--text-secondary)", textDecoration: "none",
                        fontFamily: "var(--font-heading)", fontSize: "0.7rem",
                        letterSpacing: 2, textTransform: "uppercase",
                        transition: "color 0.3s", padding: "8px 16px",
                    }}
                        onMouseEnter={e => e.target.style.color = "#00f5ff"}
                        onMouseLeave={e => e.target.style.color = "var(--text-secondary)"}
                    >Science</a>
                    <button className="btn-neon" onClick={() => navigate("/register")}>
                        <span>Launch App</span>
                    </button>
                </div>
            </nav>

            {/* ── HERO SECTION ── */}
            <section ref={heroRef} style={{
                position: "relative", zIndex: 1,
                minHeight: "92vh", display: "flex", alignItems: "center",
                padding: "80px 48px",
                gap: 64,
            }}>
                {/* Left copy */}
                <div style={{ flex: 1, maxWidth: 640 }}>
                    {/* HUD Badge */}
                    <div style={{
                        display: "inline-flex", alignItems: "center", gap: 10,
                        padding: "8px 18px", marginBottom: 28,
                        background: "rgba(0,255,136,0.06)",
                        clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))",
                        opacity: heroVisible ? 1 : 0,
                        transform: heroVisible ? "translateY(0)" : "translateY(20px)",
                        transition: "all 0.6s cubic-bezier(0.4,0,0.2,1)",
                    }}>
                        <span style={{
                            width: 8, height: 8, borderRadius: "50%", background: "#00ff88",
                            boxShadow: "0 0 10px #00ff88", display: "inline-block",
                            animation: "pulse-dot 2s ease-in-out infinite",
                        }} />
                        <span style={{
                            color: "#00ff88", fontFamily: "var(--font-heading)", fontSize: "0.65rem",
                            letterSpacing: 2.5, textTransform: "uppercase", fontWeight: 700,
                        }}>
                            Clinical Grade Gaming Therapy
                        </span>
                    </div>

                    {/* Main Headline */}
                    <h1 style={{
                        opacity: heroVisible ? 1 : 0,
                        transform: heroVisible ? "translateY(0)" : "translateY(30px)",
                        transition: "all 0.8s cubic-bezier(0.4,0,0.2,1) 0.15s",
                        marginBottom: 12, letterSpacing: "0.02em",
                    }}>
                        Train Your Eyes.<br />
                        <span className="glow-text">
                            <TypewriterText text="Transform Your Vision." isActive={heroVisible} speed={50} />
                        </span>
                    </h1>

                    {/* Description */}
                    <p style={{
                        fontSize: "1.05rem", lineHeight: 1.8,
                        color: "var(--text-secondary)", marginTop: 16, maxWidth: 520,
                        opacity: heroVisible ? 1 : 0,
                        transform: heroVisible ? "translateY(0)" : "translateY(20px)",
                        transition: "all 0.8s cubic-bezier(0.4,0,0.2,1) 0.4s",
                    }}>
                        The first clinical-grade gaming platform designed to rehabilitate vision through
                        immersive, AI-driven therapy. Precision science meets performance gaming.
                    </p>

                    {/* Buttons */}
                    <div style={{
                        display: "flex", gap: 16, marginTop: 40, flexWrap: "wrap",
                        opacity: heroVisible ? 1 : 0,
                        transform: heroVisible ? "translateY(0)" : "translateY(20px)",
                        transition: "all 0.8s cubic-bezier(0.4,0,0.2,1) 0.55s",
                    }}>
                        <button className="btn-neon" style={{ fontSize: "0.95rem", padding: "14px 36px" }}
                            onClick={() => navigate("/register")}>
                            <span>⚡ Begin Training</span>
                        </button>
                        <button style={{
                            fontFamily: "var(--font-heading)", fontSize: "0.85rem", fontWeight: 600,
                            letterSpacing: 1, padding: "14px 36px", borderRadius: "var(--radius-btn)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            background: "rgba(255,255,255,0.03)", color: "var(--text-secondary)", cursor: "pointer",
                            transition: "var(--transition)",
                        }}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = "rgba(168,85,247,0.6)";
                                e.currentTarget.style.color = "#ddb7ff";
                                e.currentTarget.style.boxShadow = "0 0 20px rgba(168,85,247,0.15)";
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                                e.currentTarget.style.color = "var(--text-secondary)";
                                e.currentTarget.style.boxShadow = "none";
                            }}
                        >
                            How It Works →
                        </button>
                    </div>
                </div>

                {/* Right — Eye Orb */}
                <div style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative", minHeight: 420,
                    opacity: heroVisible ? 1 : 0,
                    transform: heroVisible ? "scale(1)" : "scale(0.85)",
                    transition: "all 1.2s cubic-bezier(0.4,0,0.2,1) 0.3s",
                }}>
                    <EyeOrb />

                    {/* Floating HUD Badges */}
                    <HudBadge label="Visual Acuity" value="+42%" color="#00ff88"
                        style={{ top: "5%", left: "-5%" }} isVisible={heroVisible} />
                    <HudBadge label="Convergence" value="↑ 3x" color="#00f5ff"
                        style={{ bottom: "10%", right: "-5%", animationDelay: "1s" }} isVisible={heroVisible} />
                    <HudBadge label="Neural Sync" value="98.7%" color="#a855f7"
                        style={{ bottom: "5%", left: "5%", animationDelay: "2s" }} isVisible={heroVisible} />
                </div>
            </section>

            {/* ── STATS BAR ── */}
            <div ref={statsRef} style={{
                position: "relative", zIndex: 1,
                background: "rgba(0,245,255,0.03)",
                padding: "40px 48px",
                display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24, textAlign: "center",
            }}>
                {/* Horizontal neon line top */}
                <div style={{
                    position: "absolute", top: 0, left: "5%", right: "5%", height: 1,
                    background: "linear-gradient(90deg, transparent, rgba(0,245,255,0.3), rgba(168,85,247,0.3), transparent)",
                }} />
                {stats.map((s, i) => (
                    <div key={s.label} style={{ transitionDelay: `${i * 150}ms` }}>
                        <StatItem stat={s} isVisible={statsVisible} />
                    </div>
                ))}
                {/* Horizontal neon line bottom */}
                <div style={{
                    position: "absolute", bottom: 0, left: "5%", right: "5%", height: 1,
                    background: "linear-gradient(90deg, transparent, rgba(168,85,247,0.3), rgba(0,245,255,0.3), transparent)",
                }} />
            </div>

            {/* ── FEATURES ── */}
            <section id="features" ref={featRef} style={{ position: "relative", zIndex: 1, padding: "100px 48px" }}>
                <div style={{
                    textAlign: "center", marginBottom: 64,
                    opacity: featVisible ? 1 : 0,
                    transform: featVisible ? "translateY(0)" : "translateY(30px)",
                    transition: "all 0.8s cubic-bezier(0.4,0,0.2,1)",
                }}>
                    <div style={{
                        fontFamily: "var(--font-heading)", fontSize: "0.65rem",
                        letterSpacing: 4, textTransform: "uppercase",
                        color: "#a855f7", marginBottom: 16,
                    }}>
                        Advanced Rehabilitation Modules
                    </div>
                    <h2 style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.03em" }}>
                        Why <span className="glow-text">NetraSync</span> Works
                    </h2>
                    <p style={{
                        color: "var(--text-secondary)", marginTop: 16, maxWidth: 520,
                        margin: "16px auto 0", fontSize: "0.95rem", lineHeight: 1.7,
                    }}>
                        Science-backed therapy wrapped in a gaming engine built for maximum neural engagement.
                    </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(270px,1fr))", gap: 24, maxWidth: 1200, margin: "0 auto" }}>
                    {features.map((f) => (
                        <TiltCard key={f.title} color={f.color} delay={f.delay} isVisible={featVisible}>
                            <div style={{
                                width: 52, height: 52, borderRadius: 10,
                                background: `${f.color}0a`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 26, marginBottom: 20,
                                position: "relative",
                            }}>
                                {f.icon}
                                {/* Corner brackets */}
                                <div style={{
                                    position: "absolute", top: -1, left: -1, width: 8, height: 8,
                                    borderTop: `2px solid ${f.color}60`, borderLeft: `2px solid ${f.color}60`,
                                }} />
                                <div style={{
                                    position: "absolute", bottom: -1, right: -1, width: 8, height: 8,
                                    borderBottom: `2px solid ${f.color}40`, borderRight: `2px solid ${f.color}40`,
                                }} />
                            </div>
                            <h3 style={{
                                fontFamily: "var(--font-heading)", color: f.color,
                                fontSize: "0.85rem", letterSpacing: "0.05em", marginBottom: 12,
                                textTransform: "uppercase",
                            }}>
                                {f.title}
                            </h3>
                            <p style={{ fontSize: "0.88rem", lineHeight: 1.75, color: "var(--text-secondary)" }}>
                                {f.desc}
                            </p>
                        </TiltCard>
                    ))}
                </div>
            </section>

            {/* ── HOW IT WORKS timeline ── */}
            <section id="science" style={{ position: "relative", zIndex: 1, padding: "80px 48px" }}>
                <HowItWorks />
            </section>

            {/* ── CTA ── */}
            <section ref={ctaRef} style={{
                position: "relative", zIndex: 1, textAlign: "center", padding: "80px 48px",
            }}>
                <div style={{
                    maxWidth: 720, margin: "0 auto", padding: "72px 48px",
                    background: "radial-gradient(ellipse at 50% 0%, rgba(0,245,255,0.08) 0%, rgba(168,85,247,0.04) 50%, transparent 80%)",
                    borderRadius: 16, position: "relative", overflow: "hidden",
                    boxShadow: "inset 0 1px 0 rgba(0,245,255,0.1), 0 0 60px rgba(0,245,255,0.03)",
                    opacity: ctaVisible ? 1 : 0,
                    transform: ctaVisible ? "translateY(0) scale(1)" : "translateY(40px) scale(0.95)",
                    transition: "all 1s cubic-bezier(0.4,0,0.2,1)",
                }}>
                    {/* Ambient glow orbs behind CTA */}
                    <div style={{
                        position: "absolute", top: "-40%", left: "20%", width: 200, height: 200,
                        borderRadius: "50%", background: "rgba(0,245,255,0.06)",
                        filter: "blur(60px)", pointerEvents: "none",
                    }} />
                    <div style={{
                        position: "absolute", bottom: "-30%", right: "20%", width: 160, height: 160,
                        borderRadius: "50%", background: "rgba(168,85,247,0.06)",
                        filter: "blur(50px)", pointerEvents: "none",
                    }} />

                    <div style={{ fontSize: 52, marginBottom: 24, filter: "drop-shadow(0 0 16px rgba(0,245,255,0.4))" }}>
                        👁‍🗨
                    </div>
                    <h2 style={{
                        fontFamily: "var(--font-heading)", fontSize: "clamp(1.4rem,3vw,2rem)",
                        letterSpacing: "0.03em",
                    }}>
                        Ready to <span className="glow-text">Level Up</span> Your Vision?
                    </h2>
                    <p style={{
                        color: "var(--text-secondary)", margin: "18px auto 36px",
                        maxWidth: 500, fontSize: "1rem", lineHeight: 1.7,
                    }}>
                        Join thousands of patients reclaiming their visual health through the world's most advanced
                        game-based therapy platform.
                    </p>
                    <button className="btn-neon" style={{ fontSize: "1rem", padding: "16px 52px" }}
                        onClick={() => navigate("/register")}>
                        <span>⚡ Start Your Journey</span>
                    </button>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer style={{
                position: "relative", zIndex: 1, textAlign: "center",
                padding: "28px 48px",
                color: "var(--text-muted)", fontSize: "0.75rem",
                fontFamily: "var(--font-heading)", letterSpacing: 1.5,
            }}>
                <div style={{
                    width: "60%", height: 1, margin: "0 auto 20px",
                    background: "linear-gradient(90deg, transparent, rgba(0,245,255,0.15), rgba(168,85,247,0.15), transparent)",
                }} />
                © 2026 NETRASYNC — CLINICAL GAMING THERAPY PLATFORM
            </footer>
        </div>
    );
}

/* ── How It Works Mini-Timeline ── */
function HowItWorks() {
    const [ref, isVisible] = useReveal(0.15);
    const steps = [
        { num: "01", title: "Diagnostic Scan", desc: "Complete a brief vision assessment powered by AI-calibrated stimuli.", color: "#00f5ff", icon: "🔍" },
        { num: "02", title: "Personalized Protocol", desc: "Receive a custom therapy plan mapped to your unique visual profile.", color: "#a855f7", icon: "🧬" },
        { num: "03", title: "Game Therapy Sessions", desc: "Play clinically-designed mini-games that train your visual pathways.", color: "#00ff88", icon: "🎯" },
        { num: "04", title: "Track & Evolve", desc: "Monitor real-time progress and watch your vision metrics improve daily.", color: "#ff6b35", icon: "📈" },
    ];

    return (
        <div ref={ref} style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{
                textAlign: "center", marginBottom: 56,
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? "translateY(0)" : "translateY(30px)",
                transition: "all 0.8s cubic-bezier(0.4,0,0.2,1)",
            }}>
                <div style={{
                    fontFamily: "var(--font-heading)", fontSize: "0.65rem",
                    letterSpacing: 4, textTransform: "uppercase",
                    color: "#00ff88", marginBottom: 16,
                }}>
                    The Protocol
                </div>
                <h2 style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.03em" }}>
                    How <span className="glow-text">It Works</span>
                </h2>
            </div>

            <div style={{ position: "relative" }}>
                {/* Vertical line */}
                <div style={{
                    position: "absolute", left: 32, top: 0, bottom: 0, width: 2,
                    background: "linear-gradient(180deg, rgba(0,245,255,0.3), rgba(168,85,247,0.3), rgba(0,255,136,0.3), rgba(255,107,53,0.2))",
                    opacity: isVisible ? 1 : 0,
                    transition: "opacity 1s ease 0.3s",
                }} />

                {steps.map((s, i) => (
                    <div key={s.num} style={{
                        display: "flex", alignItems: "flex-start", gap: 32,
                        marginBottom: i < steps.length - 1 ? 48 : 0,
                        paddingLeft: 12,
                        opacity: isVisible ? 1 : 0,
                        transform: isVisible ? "translateX(0)" : "translateX(-30px)",
                        transition: `all 0.7s cubic-bezier(0.4,0,0.2,1) ${0.3 + i * 0.15}s`,
                    }}>
                        {/* Numbered circle */}
                        <div style={{
                            width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                            background: `${s.color}15`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 20, position: "relative", zIndex: 1,
                            boxShadow: `0 0 20px ${s.color}20`,
                        }}>
                            {s.icon}
                        </div>
                        <div>
                            <div style={{
                                fontFamily: "var(--font-heading)", fontSize: "0.6rem",
                                color: s.color, letterSpacing: 3, marginBottom: 4,
                                opacity: 0.7,
                            }}>
                                STEP {s.num}
                            </div>
                            <h3 style={{
                                fontFamily: "var(--font-heading)", fontSize: "1rem",
                                color: "var(--text-primary)", letterSpacing: "0.03em",
                                marginBottom: 6,
                            }}>
                                {s.title}
                            </h3>
                            <p style={{
                                fontSize: "0.88rem", lineHeight: 1.7,
                                color: "var(--text-secondary)", maxWidth: 480,
                            }}>
                                {s.desc}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}