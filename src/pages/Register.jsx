import { useCallback, useRef, useState } from "react";
import { Form, Input, Select, message } from "antd";
import { useNavigate } from "react-router-dom";

const { Option } = Select;

export default function Register() {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [alignmentScore, setAlignmentScore] = useState(null);
  const [scoreStatus, setScoreStatus] = useState(null);
  const [scoring, setScoring] = useState(false);
  const [photoMode, setPhotoMode] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [uploading, setUploading] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const classifyScore = useCallback((pct) => {
    if (pct < 15) return { label: "Excellent — Well Aligned", color: "#00ff88" };
    if (pct < 40) return { label: "Mild Misalignment", color: "#00f5ff" };
    if (pct < 70) return { label: "Moderate Misalignment", color: "#f59e0b" };
    return { label: "Severe Misalignment", color: "#ff6b35" };
  }, []);

  const processCapturedImage = useCallback(
    async (dataUrl, mode) => {
      try {
        setScoring(true);
        setCapturedPhoto(dataUrl);
        setPhotoMode(mode);

        // Get selected dominant eye from form (default: right)
        const dominantEye = form.getFieldValue("eye") || "right";

        // Convert dataUrl → Blob for multipart upload
        const response = await fetch(dataUrl);
        const blob = await response.blob();

        const formData = new FormData();
        formData.append("photo", blob, "eye_capture.jpg");
        formData.append("dominant", dominantEye);


        const scanRes = await fetch("/api/scanImage", {
          method: "POST",
          body: formData,
        });

        const rawResponse = await scanRes.text();
        let data = {};

        if (rawResponse) {
          try {
            data = JSON.parse(rawResponse);
          } catch {
            throw new Error(rawResponse || "AI scan failed");
          }
        }

        if (!scanRes.ok || !data.success) {
          throw new Error(data.error || "AI scan failed");
        }

        if (!data.faceDetected) {
          throw new Error("No face detected. Please take a clearer photo facing the camera.");
        }

        const pct = data.alignment ?? 0;
        const status = classifyScore(pct);
        setAlignmentScore(pct);
        setScoreStatus({
          ...status,
          severity: data.severity,
          direction: data.direction,
          strabismus: data.strabismus,
        });
      } catch (error) {
        setCapturedPhoto(null);
        setAlignmentScore(null);
        setScoreStatus(null);
        message.error(error.message || "Could not process photo");
      } finally {
        setScoring(false);
      }
    },
    [classifyScore, form]
  );

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setCameraReady(false);
    if (photoMode === "camera") {
      setPhotoMode(null);
    }
  }, [cameraStream, photoMode]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 520 } },
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
      }, 80);
    } catch {
      message.error("Unable to access camera. Please allow camera permissions.");
    }
  }, []);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 520;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    stopCamera();
    await processCapturedImage(dataUrl, "camera");
  }, [processCapturedImage, stopCamera]);

  const handleUpload = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        message.error("Please upload a valid image file.");
        return;
      }
      setUploading(true);
      const reader = new FileReader();
      reader.onload = async (loadEvent) => {
        const imageData = loadEvent.target?.result;
        if (!imageData) {
          setUploading(false);
          message.error("Could not read selected image.");
          return;
        }
        await processCapturedImage(imageData, "upload");
        setUploading(false);
      };
      reader.onerror = () => {
        setUploading(false);
        message.error("Could not read selected image.");
      };
      reader.readAsDataURL(file);
    },
    [processCapturedImage]
  );

  const retakePhoto = useCallback(() => {
    setCapturedPhoto(null);
    setAlignmentScore(null);
    setScoreStatus(null);
    setPhotoMode(null);
    setCameraReady(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    stopCamera();
  }, [stopCamera]);

  const onFinish = async () => {
    try {
      const vals = await form.validateFields();

      if (!capturedPhoto || alignmentScore === null) {
        message.error("Please upload or capture a photo and check alignment score before registering.");
        return;
      }

      setSubmitting(true);

      const payload = {
        name: vals.name,
        email: vals.email,
        password: vals.password,
        age: vals.age,
        eye: vals.eye,
        condition: null,
        severity: null,
        photo: capturedPhoto,
        alignmentScore,
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
        content: `Registration Successful! Patient ID: ${data.userId}`,
        duration: 3,
      });

      setTimeout(() => {
        navigate("/dashboard", { state: { userId: data.userId, userName: vals.name }, replace: true });
      }, 1200);
    } catch (err) {
      if (err?.errorFields) {
        return;
      }

      message.error({
        content: err.message || "Registration failed. Please try again.",
        duration: 4,
      });
    } finally {
      setSubmitting(false);
    }
  };

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
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-dark)",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 16px",
      }}
    >
      <div className="grid-bg" style={{ position: "fixed", inset: 0, opacity: 0.4 }} />

      <div
        style={{
          position: "fixed",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(0,245,255,0.06) 0%, transparent 70%)",
          top: -100,
          left: -100,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "fixed",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%)",
          bottom: -80,
          right: -80,
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 560 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>NS</div>
          <h2
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "1.6rem",
              fontWeight: 900,
              background: "var(--grad-accent)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            NETRASYNC
          </h2>
          <p
            style={{
              color: "var(--text-muted)",
              fontSize: "0.8rem",
              letterSpacing: 2,
              marginTop: 4,
            }}
          >
            PATIENT REGISTRATION PORTAL
          </p>
        </div>

        <div className="glass-card" style={{ padding: "36px 40px" }}>
          <Form form={form} layout="vertical" requiredMark={false}>
            <SectionLabel icon="ID" text="Personal Information" />

            <AntField name="name" label="Full Name" rules={[{ required: true, message: "Name is required" }]}>
              <Input
                placeholder="Enter your full legal name"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "#00f5ff")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(0,245,255,0.2)")}
              />
            </AntField>

            <AntField
              name="email"
              label="Email"
              rules={[
                { required: true, message: "Email is required" },
                { type: "email", message: "Enter a valid email" },
              ]}
            >
              <Input
                placeholder="Enter your email"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "#00f5ff")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(0,245,255,0.2)")}
              />
            </AntField>

            <AntField
              name="password"
              label="Password"
              rules={[
                { required: true, message: "Password is required" },
                { min: 6, message: "Password should be at least 6 characters" },
              ]}
            >
              <Input.Password
                placeholder="Create a password"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "#00f5ff")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(0,245,255,0.2)")}
              />
            </AntField>

            <AntField name="age" label="Age" rules={[{ required: true, message: "Age is required" }]}>
              <Input
                type="number"
                placeholder="Your age"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "#00f5ff")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(0,245,255,0.2)")}
              />
            </AntField>

            <AntField
              name="eye"
              label="Dominated eye"
              rules={[{ required: true, message: "Select dominated eye" }]}
            >
              <Select
                placeholder="Select dominated eye"
                style={{ width: "100%" }}
                dropdownStyle={{ background: "#0d1117", border: "1px solid rgba(0,245,255,0.2)" }}
              >
                <Option value="left">Left Eye</Option>
                <Option value="right">Right Eye</Option>
              </Select>
            </AntField>

            <SectionLabel icon="PH" text="Face Alignment Photo" />

            {!capturedPhoto && photoMode !== "camera" && (
              <div style={{ display: "grid", gap: 12, marginBottom: 20 }}>
                <button
                  type="button"
                  onClick={startCamera}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "14px 16px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,245,255,0.28)",
                    background: "rgba(0,245,255,0.07)",
                    color: "#e8f4ff",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                  }}
                >
                  <span>Click Live Photo</span>
                  <span style={{ color: "#00f5ff", fontFamily: "var(--font-heading)", fontSize: "0.75rem" }}>CAMERA</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "14px 16px",
                    borderRadius: 10,
                    border: "1px solid rgba(168,85,247,0.28)",
                    background: "rgba(168,85,247,0.07)",
                    color: "#e8f4ff",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                  }}
                >
                  <span>Upload Image</span>
                  <span style={{ color: "#a855f7", fontFamily: "var(--font-heading)", fontSize: "0.75rem" }}>BROWSE</span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUpload}
                  style={{ display: "none" }}
                />

                {uploading && (
                  <div style={{ color: "#a855f7", fontFamily: "var(--font-heading)", fontSize: "0.72rem", letterSpacing: 1 }}>
                    Processing uploaded image...
                  </div>
                )}
              </div>
            )}

            {photoMode === "camera" && !capturedPhoto && (
              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "2px solid rgba(0,245,255,0.35)",
                    background: "#000",
                    position: "relative",
                  }}
                >
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{ width: "100%", height: 240, objectFit: "cover", display: "block" }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: 10,
                      bottom: 10,
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: "rgba(0,0,0,0.5)",
                      color: cameraReady ? "#00ff88" : "#f59e0b",
                      fontSize: "0.7rem",
                      fontFamily: "var(--font-heading)",
                    }}
                  >
                    {cameraReady ? "Live Camera" : "Initializing"}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button className="btn-neon" type="button" onClick={capturePhoto} style={{ flex: 1, padding: "11px" }}>
                    <span>Capture</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    style={{
                      flex: 1,
                      padding: "11px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "transparent",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {capturedPhoto && (
              <div style={{ marginBottom: 22 }}>
                <div
                  style={{
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "1px solid rgba(0,245,255,0.35)",
                    marginBottom: 12,
                  }}
                >
                  <img src={capturedPhoto} alt="Captured" style={{ width: "100%", height: 240, objectFit: "cover", display: "block" }} />
                </div>

                <div
                  style={{
                    border: `1px solid ${scoreStatus?.color || "rgba(0,245,255,0.2)"}33`,
                    borderRadius: 10,
                    padding: "14px 16px",
                    background: "rgba(0,245,255,0.05)",
                    marginBottom: 10,
                  }}
                >
                  {/* Header row: label + percentage */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "var(--font-heading)", color: "#00f5ff", fontSize: "0.74rem", letterSpacing: 1.2 }}>
                      AI EYE ALIGNMENT
                    </span>
                    <span
                      style={{
                        color: scoreStatus?.color || "#00f5ff",
                        fontFamily: "var(--font-heading)",
                        fontSize: "0.85rem",
                        letterSpacing: 0.8,
                      }}
                    >
                      {scoring ? "Analyzing..." : `${alignmentScore != null ? alignmentScore.toFixed(1) : "--"}%`}
                    </span>
                  </div>

                  {scoring ? (
                    <div style={{ marginTop: 10, color: "var(--text-secondary)", fontSize: "0.83rem" }}>
                      Please wait — EYONIX AI is analyzing your photo for eye alignment...
                    </div>
                  ) : scoreStatus ? (
                    <div style={{ marginTop: 10 }}>
                      {/* Severity badge */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 10px",
                            borderRadius: 6,
                            fontSize: "0.68rem",
                            fontFamily: "var(--font-heading)",
                            letterSpacing: 1,
                            background: `${scoreStatus.color}22`,
                            color: scoreStatus.color,
                            border: `1px solid ${scoreStatus.color}44`,
                          }}
                        >
                          {scoreStatus.severity || "OK"}
                        </span>
                        <span style={{ color: "var(--text-secondary)", fontSize: "0.82rem" }}>
                          {scoreStatus.label}
                        </span>
                      </div>

                      {/* Direction */}
                      {scoreStatus.direction && scoreStatus.direction !== "Aligned" && (
                        <div style={{ fontSize: "0.78rem", color: "#a0b4c8", marginBottom: 4 }}>
                          <span style={{ color: "#00f5ff", fontFamily: "var(--font-heading)", fontSize: "0.68rem", marginRight: 6 }}>DIRECTION</span>
                          {scoreStatus.direction}
                        </div>
                      )}

                      {/* Strabismus */}
                      {scoreStatus.strabismus && scoreStatus.strabismus !== "None" && (
                        <div style={{ fontSize: "0.78rem", color: "#a0b4c8", marginBottom: 4 }}>
                          <span style={{ color: "#a855f7", fontFamily: "var(--font-heading)", fontSize: "0.68rem", marginRight: 6 }}>TYPE</span>
                          {scoreStatus.strabismus}
                        </div>
                      )}

                      <div style={{ marginTop: 6, color: "var(--text-secondary)", fontSize: "0.78rem", opacity: 0.8 }}>
                        Retake photo for a new scan, or register when satisfied.
                      </div>
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={retakePhoto}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-secondary)",
                    textDecoration: "underline",
                    cursor: "pointer",
                    padding: 0,
                    fontSize: "0.85rem",
                  }}
                >
                  Retake photo
                </button>
              </div>
            )}

            <canvas ref={canvasRef} style={{ display: "none" }} />

            <button
              className="btn-neon"
              type="button"
              onClick={onFinish}
              disabled={submitting}
              style={{ width: "100%", padding: "13px", fontSize: "0.85rem", opacity: submitting ? 0.7 : 1 }}
            >
              <span>{submitting ? "Registering..." : "Register"}</span>
            </button>
          </Form>

          <div
            style={{
              marginTop: 22,
              textAlign: "center",
              color: "var(--text-secondary)",
              fontSize: "0.9rem",
            }}
          >
            Already registered?{" "}
            <button
              type="button"
              onClick={() => navigate("/login", { replace: true })}
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
              Login into system
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ icon, text }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 24,
        paddingBottom: 16,
        borderBottom: "1px solid rgba(0,245,255,0.1)",
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span
        style={{
          fontFamily: "var(--font-heading)",
          color: "#00f5ff",
          fontSize: "0.8rem",
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        {text}
      </span>
    </div>
  );
}

function AntField({ name, label, rules, children }) {
  return (
    <Form.Item
      name={name}
      label={label}
      rules={rules}
      style={{ marginBottom: 20 }}
      labelCol={{ style: { paddingBottom: 6 } }}
    >
      {children}
    </Form.Item>
  );
}
