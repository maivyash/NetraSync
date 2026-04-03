import express from "express";
import db from "../db.js";
import axios from "axios";

const router = express.Router();

// ─── REGISTER USER ──────────────────────────────────────────
// Inserts into all 3 tables: users, eye_details, photos
router.post("/register", async (req, res) => {
    const { name, phone, age, condition, eye, severity, photo } = req.body;

    // Validation
    if (!name || !phone || !age) {
        return res.status(400).json({
            success: false,
            error: "Name, phone, and age are required fields",
        });
    }

    let connection;
    try {
        // Use a transaction to ensure all 3 inserts succeed or none do
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Insert into users table
        const [userResult] = await connection.execute(
            "INSERT INTO users (name, phone, age) VALUES (?, ?, ?)",
            [name, phone, parseInt(age)]
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

// ─── GET ALL USERS ──────────────────────────────────────────
router.get("/users", async (req, res) => {
    try {
        const [users] = await db.execute(`
            SELECT 
                u.id, u.name, u.phone, u.age, u.created_at,
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

// ─── GET SINGLE USER BY ID ─────────────────────────────────
router.get("/users/:id", async (req, res) => {
    try {
        const [users] = await db.execute(
            `SELECT 
                u.id, u.name, u.phone, u.age, u.created_at,
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

export default router;