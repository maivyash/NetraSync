import { useState, useEffect } from "react";
import { Form, Input, Modal, message } from "antd";
import { useNavigate } from "react-router-dom";
import { isTokenValid } from "../utils/auth";

export default function Login() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [forgotForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Auto-login: if a valid token exists, skip straight to dashboard
  useEffect(() => {
    if (isTokenValid()) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotEmail, setForgotEmail] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  const openForgotPassword = () => {
    const emailFromLogin = form.getFieldValue("email") || "";
    forgotForm.resetFields();
    forgotForm.setFieldsValue({ email: emailFromLogin });
    setForgotEmail("");
    setForgotStep(1);
    setForgotOpen(true);
  };

  const handleSendOtp = async () => {
    try {
      const values = await forgotForm.validateFields(["email"]);
      setSendingOtp(true);

      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to send OTP");
      }

      setForgotEmail(values.email);
      message.success(`OTP sent to ${values.email}`);

      setForgotStep(2);
    } catch (error) {
      if (error?.errorFields) {
        return;
      }
      message.error(error.message || "Unable to send OTP right now.");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    try {
      const values = await forgotForm.validateFields(["otp"]);
      setVerifyingOtp(true);

      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail || forgotForm.getFieldValue("email"), otp: values.otp }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Invalid OTP");
      }

      message.success("OTP verified successfully.");
      setForgotStep(3);
    } catch (error) {
      if (error?.errorFields) {
        return;
      }
      message.error(error.message || "Could not verify OTP.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleSetNewPassword = async () => {
    try {
      const values = await forgotForm.validateFields(["newPassword", "confirmPassword"]);
      setResettingPassword(true);

      if (values.newPassword !== values.confirmPassword) {
        message.error("New password and retype password do not match.");
        return;
      }

      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: forgotEmail || forgotForm.getFieldValue("email"),
          newPassword: values.newPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Could not set new password");
      }

      Modal.success({
        title: "Password Updated",
        content: "New password set successfully.",
        okText: "Done",
      });

      setForgotOpen(false);
      setForgotStep(1);
      setForgotEmail("");
      forgotForm.resetFields();
    } catch (error) {
      if (error?.errorFields) {
        return;
      }
      message.error(error.message || "Could not set new password.");
    } finally {
      setResettingPassword(false);
    }
  };

  const handleLogin = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const email = String(values.email || "").trim().toLowerCase();
      const password = String(values.password || "").trim();

      if (!email || !password) {
        throw new Error("Please enter both email and password.");
      }

      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Invalid email or password");
      }

      // Store JWT token and user info in localStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("userId", data.userId);
      localStorage.setItem("userName", data.userName);
      localStorage.setItem("userEmail", data.email);

      message.success("Login successful. Redirecting to your dashboard...");
      navigate("/dashboard", { state: { userId: data.userId, userName: data.userName }, replace: true });
    } catch (error) {
      if (error?.errorFields) {
        return;
      }

      message.error(error?.message || "Unable to login right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-dark)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div className="grid-bg" style={{ position: "fixed", inset: 0, opacity: 0.45 }} />
      <div
        style={{
          position: "fixed",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,245,255,0.08) 0%, transparent 70%)",
          top: -120,
          right: -120,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "fixed",
          width: 420,
          height: 420,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(168,85,247,0.08) 0%, transparent 70%)",
          bottom: -100,
          left: -120,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          display: "grid",
          gridTemplateColumns: "1.05fr 0.95fr",
          alignItems: "center",
          gap: 32,
          padding: "40px 48px",
          maxWidth: 1320,
          margin: "0 auto",
        }}
      >
        <section className="animate-fade-up" style={{ maxWidth: 620 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 16px",
              borderRadius: 999,
              background: "rgba(0,245,255,0.08)",
              border: "1px solid rgba(0,245,255,0.18)",
              marginBottom: 24,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#00ff88", boxShadow: "0 0 10px #00ff88" }} />
            <span style={{ color: "#00ff88", fontFamily: "var(--font-heading)", fontSize: "0.72rem", letterSpacing: 2, textTransform: "uppercase" }}>
              Secure Access Portal
            </span>
          </div>

          <h1 style={{ marginBottom: 16 }}>
            Welcome back to
            <br />
            <span className="glow-text">NetraSync</span>
          </h1>

          <p style={{ maxWidth: 560, fontSize: "1.02rem", lineHeight: 1.85, color: "var(--text-secondary)", marginBottom: 28 }}>
            Sign in with your registered email and password to continue your eye therapy journey,
            track progress, and resume your training dashboard.
          </p>

        </section>

        <section className="animate-fade-up" style={{ display: "flex", justifyContent: "center" }}>
          <div className="glass-card" style={{ width: "100%", maxWidth: 520, padding: "34px 36px" }}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>👁</div>
              <h2 style={{ marginBottom: 8 }}>Login</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", letterSpacing: 1.3, textTransform: "uppercase" }}>
                Email + Password
              </p>
            </div>

            <Form form={form} layout="vertical" requiredMark={false}>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: "Please enter your email" },
                  { type: "email", message: "Enter a valid email" },
                ]}
              >
                <Input placeholder="Enter email" inputMode="email" style={{ height: 48 }} />
              </Form.Item>

              <Form.Item
                name="password"
                label="Password"
                rules={[{ required: true, message: "Please enter your password" }]}
              >
                <div style={{ position: "relative" }}>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    style={{ height: 48, paddingRight: 42 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: 4,
                      color: showPassword ? "#00f5ff" : "rgba(255,255,255,0.35)",
                      fontSize: 18,
                      display: "flex",
                      alignItems: "center",
                      transition: "color 0.2s",
                    }}
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>
                </div>
              </Form.Item>

              <div style={{ marginTop: -6, marginBottom: 16, textAlign: "right" }}>
                <button
                  type="button"
                  onClick={openForgotPassword}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    color: "#00f5ff",
                    cursor: "pointer",
                    fontFamily: "var(--font-heading)",
                    letterSpacing: 0.5,
                    textDecoration: "underline",
                    fontSize: "0.75rem",
                  }}
                >
                  Forgot password?
                </button>
              </div>

              <button className="btn-neon" type="button" onClick={handleLogin} disabled={loading} style={{ width: "100%", padding: "14px 18px", fontSize: "0.85rem", opacity: loading ? 0.75 : 1 }}>
                <span>{loading ? "Signing in..." : "Login"}</span>
              </button>
            </Form>

            <div style={{ marginTop: 22, textAlign: "center", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              Not registered yet?{' '}
              <button
                type="button"
                onClick={() => navigate("/register")}
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  color: "#00f5ff",
                  cursor: "pointer",
                  fontFamily: "var(--font-heading)",
                  letterSpacing: 0.5,
                  textDecoration: "underline",
                }}
              >
                Register here
              </button>
            </div>
          </div>
        </section>
      </div>

      <Modal
        title={
          <span style={{ fontFamily: "var(--font-heading)", letterSpacing: 1, color: "#00f5ff" }}>
            Forgot Password
          </span>
        }
        open={forgotOpen}
        onCancel={() => {
          setForgotOpen(false);
          setForgotStep(1);
          setForgotEmail("");
          forgotForm.resetFields();
        }}
        footer={null}
        centered
      >
        <Form form={forgotForm} layout="vertical" requiredMark={false}>
          {forgotStep === 1 && (
            <>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: "Please enter your email" },
                  { type: "email", message: "Enter a valid email" },
                ]}
              >
                <Input placeholder="Enter your email" inputMode="email" style={{ height: 44 }} />
              </Form.Item>

              <button
                className="btn-neon"
                type="button"
                onClick={handleSendOtp}
                disabled={sendingOtp}
                style={{ width: "100%", padding: "12px 14px", opacity: sendingOtp ? 0.75 : 1 }}
              >
                <span>{sendingOtp ? "Sending OTP..." : "Send OTP"}</span>
              </button>
            </>
          )}

          {forgotStep === 2 && (
            <>
              <Form.Item
                name="otp"
                label="Enter OTP"
                rules={[
                  { required: true, message: "Please enter OTP" },
                  { pattern: /^\d{6}$/, message: "OTP should be 6 digits" },
                ]}
              >
                <Input placeholder="Enter 6-digit OTP" maxLength={6} inputMode="numeric" style={{ height: 44 }} />
              </Form.Item>

              <div style={{ marginTop: -8, marginBottom: 12, color: "var(--text-muted)", fontSize: "0.78rem" }}>
                OTP sent to your email. Verify to continue.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  className="btn-neon"
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={verifyingOtp}
                  style={{ padding: "12px 14px", opacity: verifyingOtp ? 0.75 : 1 }}
                >
                  <span>{verifyingOtp ? "Verifying..." : "Verify OTP"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={sendingOtp}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "transparent",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    opacity: sendingOtp ? 0.75 : 1,
                  }}
                >
                  {sendingOtp ? "Resending..." : "Resend OTP"}
                </button>
              </div>
            </>
          )}

          {forgotStep === 3 && (
            <>
              <Form.Item
                name="newPassword"
                label="New Password"
                rules={[
                  { required: true, message: "Please enter new password" },
                  { min: 6, message: "Password should be at least 6 characters" },
                ]}
              >
                <div style={{ position: "relative" }}>
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    style={{ height: 44, paddingRight: 42 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: 4,
                      color: showNewPassword ? "#00f5ff" : "rgba(255,255,255,0.35)",
                      fontSize: 18,
                      display: "flex",
                      alignItems: "center",
                      transition: "color 0.2s",
                    }}
                    tabIndex={-1}
                  >
                    {showNewPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>
                </div>
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label="Retype New Password"
                rules={[
                  { required: true, message: "Please retype new password" },
                  { min: 6, message: "Password should be at least 6 characters" },
                ]}
              >
                <div style={{ position: "relative" }}>
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Retype new password"
                    style={{ height: 44, paddingRight: 42 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: 4,
                      color: showConfirmPassword ? "#00f5ff" : "rgba(255,255,255,0.35)",
                      fontSize: 18,
                      display: "flex",
                      alignItems: "center",
                      transition: "color 0.2s",
                    }}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>
                </div>
              </Form.Item>

              <button
                className="btn-neon"
                type="button"
                onClick={handleSetNewPassword}
                disabled={resettingPassword}
                style={{ width: "100%", padding: "12px 14px", opacity: resettingPassword ? 0.75 : 1 }}
              >
                <span>{resettingPassword ? "Setting Password..." : "Set New Password"}</span>
              </button>
            </>
          )}
        </Form>
      </Modal>
    </div>
  );
}