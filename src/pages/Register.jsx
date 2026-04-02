import { useState, useRef, useCallback } from "react";
import { Form, Input, Select, message } from "antd";
import { useNavigate } from "react-router-dom";

const { Option } = Select;

const STEPS = ["Profile", "Eye Data", "Photo", "Confirm"];

export default function Register() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [photoMode, setPhotoMode] = useState(null); // null | 'camera' | 'upload'
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [uploading, setUploading] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  /* ── Camera helpers ── */
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      setCameraStream(stream);
      setPhotoMode("camera");
      setCameraReady(false);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setCameraReady(true);
        }
      }, 100);
    } catch {
      message.error("Camera access denied. Please allow camera permissions.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
    setPhotoMode(null);
    setCameraReady(false);
  }, [cameraStream]);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setCapturedPhoto(dataUrl);
    stopCamera();
  }, [stopCamera]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { message.error("Please select an image file."); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => { setCapturedPhoto(ev.target.result); setUploading(false); };
    reader.readAsDataURL(file);
    setPhotoMode("upload");
  };

  /* ── Step navigation ── */
  const nextStep = async () => {
    try {
      const vals = await form.validateFields();
      setFormData((p) => ({ ...p, ...vals }));
      setStep((s) => s + 1);
    } catch { /* validation will show errors */ }
  };

  const prevStep = () => setStep((s) => s - 1);

  const [submitting, setSubmitting] = useState(false);

  const onFinish = async () => {
    setSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        phone: formData.phone,
        age: formData.age,
        condition: formData.condition || null,
        eye: formData.eye || null,
        severity: formData.severity || null,
        photo: capturedPhoto || "none",
      };

      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Registration failed");
      }

      message.success({
        content: `✅ Registration Successful! Patient ID: ${data.userId}`,
        duration: 3,
      });

      // Navigate to dashboard with user info
      setTimeout(() => navigate("/dashboard", { state: { userId: data.userId, userName: formData.name } }), 1500);
    } catch (err) {
      console.error("Registration error:", err);
      message.error({
        content: err.message || "Registration failed. Please try again.",
        duration: 4,
      });
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Shared styles ── */
  const inputStyle = {
    background: "rgba(0,245,255,0.04)",
    border: "1px solid rgba(0,245,255,0.2)",
    borderRadius: 8,
    color: "#e8f4ff",
    fontFamily: "'Inter', sans-serif",
    padding: "10px 14px",
    width: "100%",
    outline: "none",
    transition: "all 0.3s",
    fontSize: 15,
  };

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg-dark)", position: "relative",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px",
    }}>
      {/* Grid bg */}
      <div className="grid-bg" style={{ position: "fixed", inset: 0, opacity: 0.4 }} />

      {/* Glow blobs */}
      <div style={{
        position: "fixed", width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(0,245,255,0.06) 0%, transparent 70%)",
        top: -100, left: -100, pointerEvents: "none",
      }} />
      <div style={{
        position: "fixed", width: 400, height: 400, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%)",
        bottom: -80, right: -80, pointerEvents: "none",
      }} />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 560 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>👁</div>
          <h2 style={{
            fontFamily: "var(--font-heading)", fontSize: "1.6rem", fontWeight: 900,
            background: "var(--grad-accent)", WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>NETRASYNC</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", letterSpacing: 2, marginTop: 4 }}>
            PATIENT REGISTRATION PORTAL
          </p>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", gap: 8, marginBottom: 32, justifyContent: "center" }}>
          {STEPS.map((label, i) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  border: `2px solid ${i <= step ? "#00f5ff" : "rgba(255,255,255,0.1)"}`,
                  background: i < step
                    ? "var(--grad-accent)"
                    : i === step
                    ? "rgba(0,245,255,0.15)"
                    : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-heading)", fontSize: "0.7rem", fontWeight: 700,
                  color: i <= step ? "#00f5ff" : "var(--text-muted)",
                  boxShadow: i === step ? "0 0 16px rgba(0,245,255,0.4)" : "none",
                  transition: "all 0.3s",
                }}>
                  {i < step ? "✓" : i + 1}
                </div>
                <div style={{
                  fontSize: "0.6rem", marginTop: 4, letterSpacing: 1, textTransform: "uppercase",
                  color: i === step ? "#00f5ff" : "var(--text-muted)",
                  fontFamily: "var(--font-heading)",
                }}>{label}</div>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{
                  width: 40, height: 1, marginBottom: 20,
                  background: i < step ? "var(--grad-accent)" : "rgba(255,255,255,0.08)",
                  transition: "all 0.3s",
                }} />
              )}
            </div>
          ))}
        </div>

        {/* Form card */}
        <div className="glass-card" style={{ padding: "36px 40px" }}>
          <Form form={form} layout="vertical">

            {/* ── STEP 0: Profile ── */}
            {step === 0 && (
              <div className="animate-fade-up">
                <SectionLabel icon="👤" text="Personal Information" />
                <AntField name="name" label="Full Name" rules={[{ required: true, message: "Name is required" }]}>
                  <Input placeholder="Enter your full legal name" style={inputStyle}
                    onFocus={e => e.target.style.borderColor = "#00f5ff"}
                    onBlur={e => e.target.style.borderColor = "rgba(0,245,255,0.2)"} />
                </AntField>
                <AntField name="phone" label="Phone Number"
                  rules={[{ required: true, message: "Phone is required" }]}>
                  <Input placeholder="+91 00000 00000" style={inputStyle}
                    onFocus={e => e.target.style.borderColor = "#00f5ff"}
                    onBlur={e => e.target.style.borderColor = "rgba(0,245,255,0.2)"} />
                </AntField>
                <AntField name="age" label="Age"
                  rules={[{ required: true, message: "Age is required" }]}>
                  <Input type="number" placeholder="Your age" style={inputStyle}
                    onFocus={e => e.target.style.borderColor = "#00f5ff"}
                    onBlur={e => e.target.style.borderColor = "rgba(0,245,255,0.2)"} />
                </AntField>
              </div>
            )}

            {/* ── STEP 1: Eye Data ── */}
            {step === 1 && (
              <div className="animate-fade-up">
                <SectionLabel icon="🔬" text="Clinical Eye Profile" />
                <AntField name="condition" label="Eye Condition"
                  rules={[{ required: true, message: "Select a condition" }]}>
                  <Select placeholder="Select condition" style={{ width: "100%" }}
                    dropdownStyle={{ background: "#0d1117", border: "1px solid rgba(0,245,255,0.2)" }}>
                    <Option value="amblyopia">🦥 Lazy Eye (Amblyopia)</Option>
                    <Option value="strabismus">↔️ Strabismus (Squint)</Option>
                    <Option value="convergence">🔄 Convergence Insufficiency</Option>
                    <Option value="myopia">🔭 Myopia Progression</Option>
                    <Option value="other">❓ Other / Unsure</Option>
                  </Select>
                </AntField>
                <AntField name="eye" label="Affected Eye"
                  rules={[{ required: true, message: "Select affected eye" }]}>
                  <Select placeholder="Which eye?" style={{ width: "100%" }}
                    dropdownStyle={{ background: "#0d1117", border: "1px solid rgba(0,245,255,0.2)" }}>
                    <Option value="left">👁 Left Eye</Option>
                    <Option value="right">👁 Right Eye</Option>
                    <Option value="both">👀 Both Eyes</Option>
                  </Select>
                </AntField>
                <AntField name="severity" label="Severity (self-reported)">
                  <Select placeholder="Rate severity" style={{ width: "100%" }}
                    dropdownStyle={{ background: "#0d1117", border: "1px solid rgba(0,245,255,0.2)" }}>
                    <Option value="mild">🟢 Mild</Option>
                    <Option value="moderate">🟡 Moderate</Option>
                    <Option value="severe">🔴 Severe</Option>
                  </Select>
                </AntField>
              </div>
            )}

            {/* ── STEP 2: Photo ── */}
            {step === 2 && (
              <div className="animate-fade-up">
                <SectionLabel icon="📷" text="Eye Photo Capture" />
                <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", marginBottom: 24,
                  lineHeight: 1.7 }}>
                  Our AI analyses your eye photograph to calibrate your personalized therapy program.
                  Use a clear, well-lit photo.
                </p>

                {/* Photo preview */}
                {capturedPhoto && (
                  <div style={{ marginBottom: 24, textAlign: "center" }}>
                    <div style={{
                      display: "inline-block", borderRadius: 12, overflow: "hidden",
                      border: "2px solid rgba(0,245,255,0.4)",
                      boxShadow: "0 0 24px rgba(0,245,255,0.2)",
                    }}>
                      <img src={capturedPhoto} alt="Eye capture"
                        style={{ width: 280, height: 210, objectFit: "cover", display: "block" }} />
                    </div>
                    <div style={{ marginTop: 10, color: "#00ff88", fontFamily: "var(--font-heading)",
                      fontSize: "0.72rem", letterSpacing: 1 }}>
                      ✓ PHOTO CAPTURED
                    </div>
                    <button onClick={() => { setCapturedPhoto(null); setPhotoMode(null); }}
                      style={{
                        marginTop: 8, background: "transparent", border: "none",
                        color: "var(--text-muted)", fontSize: "0.8rem", cursor: "pointer",
                        textDecoration: "underline",
                      }}>
                      Retake photo
                    </button>
                  </div>
                )}

                {/* Camera view */}
                {photoMode === "camera" && !capturedPhoto && (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{
                      borderRadius: 12, overflow: "hidden",
                      border: "2px solid rgba(0,245,255,0.4)",
                      position: "relative", background: "#000",
                    }}>
                      <video ref={videoRef} autoPlay muted playsInline
                        style={{ width: "100%", height: 240, objectFit: "cover", display: "block" }} />
                      {/* Scan overlay */}
                      <div style={{
                        position: "absolute", inset: 0, pointerEvents: "none",
                        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,245,255,0.03) 3px, rgba(0,245,255,0.03) 4px)",
                      }} />
                      {/* Corner marks */}
                      {["0% 0%/tl", "100% 0%/tr", "0% 100%/bl", "100% 100%/br"].map((pos) => {
                        const [x, y] = pos.split("/")[0].trim().split(" ");
                        const corner = pos.split("/")[1];
                        return (
                          <div key={corner} style={{
                            position: "absolute",
                            top: y === "0%" ? 8 : "auto", bottom: y === "100%" ? 8 : "auto",
                            left: x === "0%" ? 8 : "auto", right: x === "100%" ? 8 : "auto",
                            width: 20, height: 20,
                            borderTop: y === "0%" ? "2px solid #00f5ff" : "none",
                            borderBottom: y === "100%" ? "2px solid #00f5ff" : "none",
                            borderLeft: x === "0%" ? "2px solid #00f5ff" : "none",
                            borderRight: x === "100%" ? "2px solid #00f5ff" : "none",
                          }} />
                        );
                      })}
                      <div style={{
                        position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)",
                        color: "#00f5ff", fontFamily: "var(--font-heading)",
                        fontSize: "0.65rem", letterSpacing: 2,
                        background: "rgba(0,0,0,0.5)", padding: "4px 12px", borderRadius: 4,
                      }}>
                        {cameraReady ? "● LIVE" : "INITIALIZING..."}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                      <button className="btn-neon" onClick={capturePhoto}
                        style={{ flex: 1, padding: "12px", fontSize: "0.8rem" }}>
                        <span>📸 Capture</span>
                      </button>
                      <button onClick={stopCamera} style={{
                        padding: "12px 20px", border: "1px solid rgba(255,255,255,0.12)",
                        background: "transparent", color: "var(--text-secondary)",
                        borderRadius: 8, cursor: "pointer", fontSize: "0.8rem",
                      }}>Cancel</button>
                    </div>
                  </div>
                )}

                {/* Action buttons - show if no photo yet */}
                {!capturedPhoto && photoMode !== "camera" && (
                  <div style={{ display: "flex", gap: 16, flexDirection: "column" }}>
                    {/* Live Camera */}
                    <button onClick={startCamera} style={{
                      display: "flex", alignItems: "center", gap: 16,
                      padding: "20px 24px", borderRadius: 12, cursor: "pointer",
                      background: "rgba(0,245,255,0.05)",
                      border: "1px solid rgba(0,245,255,0.25)",
                      transition: "all 0.3s", width: "100%", textAlign: "left",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,245,255,0.1)"; e.currentTarget.style.borderColor = "#00f5ff"; e.currentTarget.style.boxShadow = "0 0 20px rgba(0,245,255,0.2)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,245,255,0.05)"; e.currentTarget.style.borderColor = "rgba(0,245,255,0.25)"; e.currentTarget.style.boxShadow = "none"; }}
                    >
                      <div style={{
                        width: 52, height: 52, borderRadius: 12,
                        background: "rgba(0,245,255,0.12)", border: "1px solid rgba(0,245,255,0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 24, flexShrink: 0,
                      }}>📷</div>
                      <div>
                        <div style={{ fontFamily: "var(--font-heading)", color: "#00f5ff",
                          fontSize: "0.85rem", letterSpacing: 0.5, marginBottom: 4 }}>
                          Take Live Photo
                        </div>
                        <div style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                          Use your device camera for real-time eye capture
                        </div>
                      </div>
                      <div style={{ marginLeft: "auto", color: "#00f5ff", fontSize: "1.2rem" }}>→</div>
                    </button>

                    {/* File Upload */}
                    <button onClick={() => fileInputRef.current?.click()} style={{
                      display: "flex", alignItems: "center", gap: 16,
                      padding: "20px 24px", borderRadius: 12, cursor: "pointer",
                      background: "rgba(168,85,247,0.05)",
                      border: "1px solid rgba(168,85,247,0.25)",
                      transition: "all 0.3s", width: "100%", textAlign: "left",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(168,85,247,0.1)"; e.currentTarget.style.borderColor = "#a855f7"; e.currentTarget.style.boxShadow = "0 0 20px rgba(168,85,247,0.2)"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(168,85,247,0.05)"; e.currentTarget.style.borderColor = "rgba(168,85,247,0.25)"; e.currentTarget.style.boxShadow = "none"; }}
                    >
                      <div style={{
                        width: 52, height: 52, borderRadius: 12,
                        background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 24, flexShrink: 0,
                      }}>🖼️</div>
                      <div>
                        <div style={{ fontFamily: "var(--font-heading)", color: "#a855f7",
                          fontSize: "0.85rem", letterSpacing: 0.5, marginBottom: 4 }}>
                          Upload Photo
                        </div>
                        <div style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                          Choose an existing image from your device (JPG, PNG)
                        </div>
                      </div>
                      <div style={{ marginLeft: "auto", color: "#a855f7", fontSize: "1.2rem" }}>→</div>
                    </button>

                    <input ref={fileInputRef} type="file" accept="image/*"
                      onChange={handleFileUpload} style={{ display: "none" }} />

                    {uploading && (
                      <div style={{ textAlign: "center", color: "#a855f7",
                        fontFamily: "var(--font-heading)", fontSize: "0.75rem", letterSpacing: 1 }}>
                        ⟳ Processing image...
                      </div>
                    )}

                    <button onClick={() => setStep(3)} style={{
                      background: "transparent", border: "none", color: "var(--text-muted)",
                      fontSize: "0.8rem", cursor: "pointer", textDecoration: "underline", marginTop: 4,
                    }}>
                      Skip for now
                    </button>
                  </div>
                )}

                <canvas ref={canvasRef} style={{ display: "none" }} />
              </div>
            )}

            {/* ── STEP 3: Confirm ── */}
            {step === 3 && (
              <div className="animate-fade-up">
                <SectionLabel icon="✅" text="Review & Confirm" />
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                  {[
                    { label: "Name", value: formData.name, icon: "👤" },
                    { label: "Phone", value: formData.phone, icon: "📱" },
                    { label: "Age", value: formData.age, icon: "🎂" },
                    { label: "Condition", value: formData.condition, icon: "🔬" },
                    { label: "Affected Eye", value: formData.eye, icon: "👁" },
                    { label: "Photo", value: capturedPhoto ? "✓ Attached" : "Not provided", icon: "📷" },
                  ].map((item) => (
                    <div key={item.label} style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "12px 16px", borderRadius: 10,
                      background: "rgba(0,245,255,0.04)", border: "1px solid rgba(0,245,255,0.1)",
                    }}>
                      <span style={{ fontSize: 18 }}>{item.icon}</span>
                      <span style={{ color: "var(--text-muted)", fontSize: "0.8rem",
                        fontFamily: "var(--font-heading)", letterSpacing: 1, minWidth: 80,
                        textTransform: "uppercase" }}>{item.label}</span>
                      <span style={{ color: "var(--text-primary)", fontSize: "0.9rem", fontWeight: 500 }}>
                        {item.value || "—"}
                      </span>
                    </div>
                  ))}
                </div>

                {capturedPhoto && (
                  <div style={{ textAlign: "center", marginBottom: 20 }}>
                    <img src={capturedPhoto} alt="preview" style={{
                      width: 120, height: 90, objectFit: "cover",
                      borderRadius: 8, border: "1px solid rgba(0,245,255,0.3)",
                    }} />
                  </div>
                )}
              </div>
            )}
          </Form>

          {/* Navigation */}
          <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
            {step > 0 && (
              <button onClick={prevStep} style={{
                flex: 1, padding: "13px", borderRadius: 8, cursor: "pointer",
                background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                color: "var(--text-secondary)", fontFamily: "var(--font-heading)",
                fontSize: "0.8rem", letterSpacing: 1,
              }}>
                ← Back
              </button>
            )}
            {step < STEPS.length - 1 && step !== 2 && (
              <button className="btn-neon" onClick={nextStep}
                style={{ flex: 1, padding: "13px", fontSize: "0.8rem" }}>
                <span>Next →</span>
              </button>
            )}
            {step === 2 && capturedPhoto && (
              <button className="btn-neon" onClick={() => setStep(3)}
                style={{ flex: 1, padding: "13px", fontSize: "0.8rem" }}>
                <span>Next →</span>
              </button>
            )}
            {step === STEPS.length - 1 && (
              <button className="btn-neon" onClick={onFinish}
                disabled={submitting}
                style={{ flex: 1, padding: "13px", fontSize: "0.85rem", opacity: submitting ? 0.7 : 1 }}>
                <span>{submitting ? "⏳ Registering..." : "⚡ Launch My Session"}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

/* ── Sub-components ── */
function SectionLabel({ icon, text }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, marginBottom: 24,
      paddingBottom: 16, borderBottom: "1px solid rgba(0,245,255,0.1)",
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{ fontFamily: "var(--font-heading)", color: "#00f5ff",
        fontSize: "0.8rem", letterSpacing: 2, textTransform: "uppercase" }}>{text}</span>
    </div>
  );
}

function AntField({ name, label, rules, children }) {
  return (
    <Form.Item name={name} label={label} rules={rules}
      style={{ marginBottom: 20 }}
      labelCol={{ style: { paddingBottom: 6 } }}>
      {children}
    </Form.Item>
  );
}