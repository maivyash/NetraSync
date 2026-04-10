import express from "express";
import db from "../db.js";
import axios from "axios";
import multer from "multer";
import nodemailer from "nodemailer";
import { createHash, randomInt } from "crypto";
import { log } from "console";
import { generateToken, verifyToken } from "../middleware/auth.js";

const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();
const otpStore = new Map();
const OTP_TTL_MS = 5 * 60 * 1000;

let transporterPromise;
function getMailerTransporter() {
    if (!transporterPromise) {
        const smtpHost = process.env.SMTP_HOST;
        const smtpPort = Number(process.env.SMTP_PORT || 587);
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;

        if (!smtpHost || !smtpUser || !smtpPass) {
            throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.");
        }

        transporterPromise = Promise.resolve(
            nodemailer.createTransport({
                host: smtpHost,
                port: smtpPort,
                secure: smtpPort === 465,
                auth: { user: smtpUser, pass: smtpPass },
            })
        );
    }

    return transporterPromise;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashPassword(password) {
    return createHash("sha256").update(password).digest("hex");
}

async function getUsersTableColumns() {
    const [rows] = await db.execute(
        `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
    );
    return new Set(rows.map((r) => r.COLUMN_NAME));
}

// ─── REGISTER USER ──────────────────────────────────────────
// Inserts into all 3 tables: users, eye_details, photos
router.post("/register", async (req, res) => {
    const { name, email, password, age, condition, eye, severity, photo } = req.body;

    // Validation
    if (!name || !age || !email) {
        return res.status(400).json({
            success: false,
            error: "Name, age, and email are required fields",
        });
    }

    let connection;
    try {
        // Use a transaction to ensure all 3 inserts succeed or none do
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Insert into users table with available schema columns
        const columns = await getUsersTableColumns();
        const insertCols = ["name", "age"];
        const insertVals = [name, parseInt(age)];

        if (columns.has("email")) {
            insertCols.push("email");
            insertVals.push(email || null);
        }
        if (columns.has("password") && password) {
            insertCols.push("password");
            insertVals.push(hashPassword(password));
        }

        const placeholders = insertCols.map(() => "?").join(", ");
        const [userResult] = await connection.execute(
            `INSERT INTO users (${insertCols.join(", ")}) VALUES (${placeholders})`,
            insertVals
        );
        const userId = userResult.insertId;




        try {
            const b64 = photo.split(',')[1]; // 🔥 FIX

            const response = await axios.post(
                'http://localhost:8766/analyze_image',
                {
                    image_base64: b64,
                    dominant: eye,
                }
            );

            const data = response.data;
            console.log("AI RESULT:", data);

            const alignment = data?.misalignment?.percentage || 412;

            if (condition || eye || severity) {
                await connection.execute(
                    "INSERT INTO eye_details (user_id, condition_type, affected_eye, severity, alignment) VALUES (?, ?, ?, ?, ?)",
                    [userId, condition || null, eye || null, severity || null, alignment]
                );
            }

        } catch (err) {
            console.log("AI ERROR:", err.message);
        }

        // 2. Insert into eye_details table (if eye data provided)




        // 3. Insert into photos table (if photo provided)
        if (photo && photo !== "none") {
            await connection.execute(
                "INSERT INTO photos (user_id, photo_url) VALUES (?, ?)",
                [userId, photo]
            );
        }

        await connection.commit();

        res.status(201).json({
            success: true,
            message: "User registered successfully",
            userId: userId,
        });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Registration error:", err);
        res.status(500).json({
            success: false,
            error: "Registration failed. Please try again.",
            details: err.message,
        });
    } finally {
        if (connection) connection.release();
    }
});

// ─── GET ALL USERS (Protected Route) ──────────────────────────────────────────
router.get("/users", verifyToken, async (req, res) => {
    try {
        const [users] = await db.execute(`
            SELECT 
                u.id, u.name, u.age, u.created_at,
                e.condition_type, e.affected_eye, e.severity,
                p.photo_url
            FROM users u
            LEFT JOIN eye_details e ON u.id = e.user_id
            LEFT JOIN photos p ON u.id = p.user_id
            ORDER BY u.created_at DESC
        `);

        res.json({ success: true, count: users.length, data: users });
    } catch (err) {
        console.error("Fetch users error:", err);
        res.status(500).json({ success: false, error: "Failed to fetch users" });
    }
});

// ─── GET SINGLE USER BY ID (Protected Route) ─────────────────────────────────
router.get("/users/:id", verifyToken, async (req, res) => {
    try {
        const [users] = await db.execute(
            `SELECT 
                u.id, u.name, u.age, u.created_at,
                e.condition_type, e.affected_eye, e.severity,
                p.photo_url
            FROM users u
            LEFT JOIN eye_details e ON u.id = e.user_id
            LEFT JOIN photos p ON u.id = p.user_id
            WHERE u.id = ?`,
            [req.params.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        res.json({ success: true, data: users[0] });
    } catch (err) {
        console.error("Fetch user error:", err);
        res.status(500).json({ success: false, error: "Failed to fetch user" });
    }
});

// ─── DELETE USER ────────────────────────────────────────────
router.delete("/users/:id", async (req, res) => {
    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Delete from child tables first (due to FK constraints)
        await connection.execute("DELETE FROM photos WHERE user_id = ?", [req.params.id]);
        await connection.execute("DELETE FROM eye_details WHERE user_id = ?", [req.params.id]);
        const [result] = await connection.execute("DELETE FROM users WHERE id = ?", [req.params.id]);

        await connection.commit();

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: "User not found" });
        }

        res.json({ success: true, message: "User deleted successfully" });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Delete user error:", err);
        res.status(500).json({ success: false, error: "Failed to delete user" });
    } finally {
        if (connection) connection.release();
    }
});

// ─── HEALTH CHECK ───────────────────────────────────────────
router.get("/health", async (req, res) => {
    try {
        await db.execute("SELECT 1");
        res.json({
            success: true,
            status: "healthy",
            database: "connected",
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        res.status(503).json({
            success: false,
            status: "unhealthy",
            database: "disconnected",
            error: err.message,
        });
    }
});


router.post("/scanImage", upload.single("photo"), async (req, res) => {

    console.log("Scan Image API Hit");

    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: "Image file is required"
            });
        }

        const dominantEye = req.body.dominant || "right";
        console.log("FILE:", req.file.originalname, "| Dominant:", dominantEye);

        // ✅ Convert image buffer → base64
        const base64 = req.file.buffer.toString("base64");
        // Call Python AI server with the user's dominant eye
        const response = await axios.post(
            "http://localhost:8766/analyze_image",
            {
                image_base64: base64,
                dominant: dominantEye
            }
        );

        const aiData = response.data;

        console.log("AI DATA:", aiData);

        // Extract alignment details
        const alignment = aiData?.misalignment?.percentage ?? 0;
        const severity = aiData?.misalignment?.severity || "unknown";
        const direction = aiData?.misalignment?.direction || "Aligned";
        const strabismus = aiData?.misalignment?.strabismus || "None";

        // ✅ Final clean response
        res.json({
            success: true,
            alignment: Math.round(alignment * 100) / 100,
            severity,
            direction,
            strabismus,
            dominantSide: aiData?.dominant_side || dominantEye,
            faceDetected: aiData?.face_detected ?? false,
            misalignment: aiData?.misalignment || null,
            headPose: aiData?.head_pose || null,
            leftEye: aiData?.left_eye || null,
            rightEye: aiData?.right_eye || null,
        });

    } catch (err) {
        console.error("Scan API error:", err.message);

        res.status(500).json({
            success: false,
            error: "AI scan failed"
        });
    }
});

// ─── AUTH: SEND EMAIL OTP ──────────────────────────────────
router.post("/auth/send-otp", async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();

    if (!isValidEmail(email)) {
        return res.status(400).json({ success: false, error: "Valid email is required" });
    }

    try {
        const [rows] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, error: "Email not found in our records." });
        }

        const otp = String(randomInt(100000, 999999));
        const expiresAt = Date.now() + OTP_TTL_MS;

        const transporter = await getMailerTransporter();
        await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: email,
            subject: "NetraSync Password Reset OTP",
            text: `Your NetraSync OTP is ${otp}. It expires in 5 minutes.`,
            html: `<p>Your NetraSync OTP is <b>${otp}</b>.</p><p>This OTP expires in 5 minutes.</p>`,
        });

        otpStore.set(email, { otp, expiresAt, verified: false });

        return res.json({ success: true, message: "OTP sent to email" });
    } catch (err) {
        console.error("Send OTP error:", err.message);
        return res.status(500).json({ success: false, error: err.message || "Failed to send OTP" });
    }
});

// ─── AUTH: VERIFY OTP ──────────────────────────────────────
router.post("/auth/verify-otp", async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const otp = String(req.body?.otp || "").trim();

    if (!isValidEmail(email) || !/^\d{6}$/.test(otp)) {
        return res.status(400).json({ success: false, error: "Valid email and 6-digit OTP are required" });
    }

    const record = otpStore.get(email);
    if (!record) {
        return res.status(400).json({ success: false, error: "OTP not found. Please request a new OTP." });
    }
    if (Date.now() > record.expiresAt) {
        otpStore.delete(email);
        return res.status(400).json({ success: false, error: "OTP expired. Please request a new OTP." });
    }
    if (record.otp !== otp) {
        return res.status(400).json({ success: false, error: "Invalid OTP" });
    }

    otpStore.set(email, { ...record, verified: true });
    return res.json({ success: true, message: "OTP verified" });
});

// ─── AUTH: RESET PASSWORD ──────────────────────────────────
router.post("/auth/reset-password", async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const newPassword = String(req.body?.newPassword || "").trim();

    if (!isValidEmail(email) || newPassword.length < 6) {
        return res.status(400).json({ success: false, error: "Valid email and new password are required" });
    }

    const record = otpStore.get(email);
    if (!record || !record.verified) {
        return res.status(400).json({ success: false, error: "OTP verification required before resetting password" });
    }
    if (Date.now() > record.expiresAt) {
        otpStore.delete(email);
        return res.status(400).json({ success: false, error: "OTP expired. Please request a new OTP." });
    }

    try {
        const columns = await getUsersTableColumns();
        if (!columns.has("email") || !columns.has("password")) {
            return res.status(500).json({
                success: false,
                error: "users table must have email and password columns for password reset",
            });
        }

        const [result] = await db.execute(
            "UPDATE users SET password = ? WHERE email = ?",
            [hashPassword(newPassword), email]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: "No account found with this email" });
        }

        otpStore.delete(email);
        return res.json({ success: true, message: "Password reset successful" });
    } catch (err) {
        console.error("Reset password error:", err.message);
        return res.status(500).json({ success: false, error: "Failed to reset password" });
    }
});

// ─── LOGIN USER ────────────────────────────────────────────
router.post("/login", async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "").trim();

    console.log("LOGIN ATTEMPT:", { email, passwordLength: password.length });

    if (!isValidEmail(email) || !password) {
        return res.status(400).json({
            success: false,
            error: "Email and password are required",
        });
    }

    try {
        const [users] = await db.execute(
            "SELECT id, name, email, password FROM users WHERE email = ?",
            [email]
        );

        console.log("USER QUERY RESULT:", users.length > 0 ? "Found" : "Not found");

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                error: "Invalid email or password",
            });
        }

        const user = users[0];
        const hashedPassword = hashPassword(password);

        console.log("PASSWORD CHECK:", {
            provided: hashedPassword.substring(0, 10) + "...",
            stored: user.password.substring(0, 10) + "...",
            match: user.password === hashedPassword,
        });

        if (user.password !== hashedPassword) {
            return res.status(401).json({
                success: false,
                error: "Invalid email or password",
            });
        }

        // Generate JWT token
        const token = generateToken(user.id, user.email, user.name);

        // Login successful
        console.log("LOGIN SUCCESS:", email);
        res.json({
            success: true,
            message: "Login successful",
            userId: user.id,
            userName: user.name,
            email: user.email,
            token: token,
        });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({
            success: false,
            error: "Login failed. Please try again.",
        });
    }
});

export default router;