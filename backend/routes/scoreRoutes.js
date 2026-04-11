import express from "express";
import db from "../db.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// ─── DIFFICULTY MULTIPLIERS ─────────────────────────────────
const DIFFICULTY_MULT = { beginner: 1, intermediate: 2, advanced: 3 };

// Reference "par" times (seconds) per difficulty — used for time bonus calc
const REFERENCE_TIMES = { beginner: 60, intermediate: 90, advanced: 150 };

/**
 * Calculate final points from raw game data.
 * Formula: base_score × difficulty_multiplier × time_bonus
 *   - time_bonus = clamp(0.5, referenceTime / timeTaken, 3.0)
 *   - Faster completion → higher time_bonus → more points
 *   - Higher difficulty → higher multiplier → more points
 */
function calculatePoints({ rawScore, difficulty, timeTaken, gameName }) {
    const diffMult = DIFFICULTY_MULT[difficulty] || 1;
    const refTime = REFERENCE_TIMES[difficulty] || 60;
    const safeTaken = Math.max(1, timeTaken || 1);

    // time_bonus: faster = higher, capped between 0.5 and 3.0
    const timeBonus = Math.max(0.5, Math.min(3.0, refTime / safeTaken));

    return Math.round(rawScore * diffMult * timeBonus);
}

// ─── AUTO-CREATE TABLE ON STARTUP ───────────────────────────
(async () => {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS game_scores (
                id            INT AUTO_INCREMENT PRIMARY KEY,
                user_id       INT NOT NULL,
                game_name     VARCHAR(50)  NOT NULL,
                difficulty    ENUM('beginner','intermediate','advanced') NOT NULL DEFAULT 'beginner',
                time_taken    FLOAT        NOT NULL DEFAULT 0,
                raw_score     INT          NOT NULL DEFAULT 0,
                points        INT          NOT NULL DEFAULT 0,
                avg_alignment FLOAT                 DEFAULT 0,
                max_speed     INT                   DEFAULT 0,
                focus_bonus   INT                   DEFAULT 0,
                played_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_date (user_id, played_at),
                INDEX idx_user_game (user_id, game_name)
            )
        `);
        console.log("✅ game_scores table ready");

        await db.execute(`
            CREATE TABLE IF NOT EXISTS alignment_scores (
                id            INT AUTO_INCREMENT PRIMARY KEY,
                user_id       INT NOT NULL,
                alignment     FLOAT NOT NULL,
                severity      VARCHAR(50),
                direction     VARCHAR(50),
                strabismus    VARCHAR(50),
                captured_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_alignment_user_date (user_id, captured_at)
            )
        `);
        console.log("✅ alignment_scores table ready");
    } catch (err) {
        // Table may already exist or DB not ready yet — that's fine
        if (!err.message.includes("already exists")) {
            console.error("table creation warning:", err.message);
        }
    }
})();

// ─── POST /api/scores — Submit a game score ─────────────────
router.post("/scores", verifyToken, async (req, res) => {
    const userId = req.user.id;
    const {
        gameName,
        difficulty = "beginner",
        timeTaken = 0,
        rawScore = 0,
        avgAlignment = 0,
        maxSpeed = 0,
        focusBonus = 0,
    } = req.body;

    // Validation
    if (!gameName) {
        return res.status(400).json({ success: false, error: "gameName is required" });
    }

    const validGames = ["orb-drive", "fusion-hoops"];
    if (!validGames.includes(gameName)) {
        return res.status(400).json({ success: false, error: `Invalid gameName. Must be: ${validGames.join(", ")}` });
    }

    const validDiffs = ["beginner", "intermediate", "advanced"];
    if (!validDiffs.includes(difficulty)) {
        return res.status(400).json({ success: false, error: `Invalid difficulty. Must be: ${validDiffs.join(", ")}` });
    }

    if (typeof rawScore !== "number" || rawScore < 0) {
        return res.status(400).json({ success: false, error: "rawScore must be a non-negative number" });
    }

    try {
        const points = calculatePoints({ rawScore, difficulty, timeTaken, gameName });

        const [result] = await db.execute(
            `INSERT INTO game_scores 
             (user_id, game_name, difficulty, time_taken, raw_score, points, avg_alignment, max_speed, focus_bonus)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                gameName,
                difficulty,
                Math.round(timeTaken * 100) / 100,
                Math.round(rawScore),
                points,
                Math.round(avgAlignment * 100) / 100,
                Math.round(maxSpeed),
                Math.round(focusBonus),
            ]
        );

        res.status(201).json({
            success: true,
            message: "Score saved",
            scoreId: result.insertId,
            points,
            difficulty,
            difficultyMultiplier: DIFFICULTY_MULT[difficulty],
        });
    } catch (err) {
        console.error("Save score error:", err);
        res.status(500).json({ success: false, error: "Failed to save score" });
    }
});

// ─── GET /api/scores/me — All scores for logged-in user ─────
router.get("/scores/me", verifyToken, async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT id, game_name, difficulty, time_taken, raw_score, points, 
                    avg_alignment, max_speed, focus_bonus, played_at
             FROM game_scores 
             WHERE user_id = ? 
             ORDER BY played_at DESC 
             LIMIT 200`,
            [req.user.id]
        );

        res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
        console.error("Fetch scores error:", err);
        res.status(500).json({ success: false, error: "Failed to fetch scores" });
    }
});

// ─── GET /api/scores/me/summary — Total + per-game summary ──
router.get("/scores/me/summary", verifyToken, async (req, res) => {
    try {
        // Total stats
        const [[totalRow]] = await db.execute(
            `SELECT 
                COALESCE(SUM(points), 0)   AS total_points,
                COUNT(*)                    AS total_games,
                COALESCE(AVG(points), 0)    AS avg_points,
                COALESCE(MAX(points), 0)    AS best_points,
                COALESCE(AVG(time_taken),0) AS avg_time
             FROM game_scores WHERE user_id = ?`,
            [req.user.id]
        );

        // Per-game breakdown
        const [gameRows] = await db.execute(
            `SELECT 
                game_name,
                difficulty,
                COUNT(*)                    AS games_played,
                COALESCE(SUM(points), 0)    AS total_points,
                COALESCE(AVG(points), 0)    AS avg_points,
                COALESCE(MAX(points), 0)    AS best_points,
                COALESCE(MIN(time_taken),0) AS best_time,
                COALESCE(AVG(time_taken),0) AS avg_time
             FROM game_scores 
             WHERE user_id = ?
             GROUP BY game_name, difficulty
             ORDER BY game_name, FIELD(difficulty, 'beginner', 'intermediate', 'advanced')`,
            [req.user.id]
        );

        res.json({
            success: true,
            total: {
                totalPoints: Math.round(totalRow.total_points),
                totalGames: totalRow.total_games,
                avgPoints: Math.round(totalRow.avg_points),
                bestPoints: Math.round(totalRow.best_points),
                avgTime: Math.round(totalRow.avg_time * 100) / 100,
            },
            perGame: gameRows.map((r) => ({
                gameName: r.game_name,
                difficulty: r.difficulty,
                gamesPlayed: r.games_played,
                totalPoints: Math.round(r.total_points),
                avgPoints: Math.round(r.avg_points),
                bestPoints: Math.round(r.best_points),
                bestTime: Math.round(r.best_time * 100) / 100,
                avgTime: Math.round(r.avg_time * 100) / 100,
            })),
        });
    } catch (err) {
        console.error("Fetch summary error:", err);
        res.status(500).json({ success: false, error: "Failed to fetch summary" });
    }
});

// ─── GET /api/scores/me/datewise — Date-wise scores for worm graph ──
router.get("/scores/me/datewise", verifyToken, async (req, res) => {
    const days = parseInt(req.query.days) || 30; // default last 30 days
    const safeDays = Math.max(7, Math.min(365, days));

    try {
        const [rows] = await db.execute(
            `SELECT 
                DATE(played_at) AS play_date,
                game_name,
                COUNT(*)                     AS sessions,
                COALESCE(SUM(points), 0)     AS total_points,
                COALESCE(AVG(points), 0)     AS avg_points,
                COALESCE(MAX(points), 0)     AS best_points,
                COALESCE(AVG(time_taken), 0) AS avg_time
             FROM game_scores
             WHERE user_id = ? AND played_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
             GROUP BY DATE(played_at), game_name
             ORDER BY play_date ASC, game_name`,
            [req.user.id, safeDays]
        );

        // Also get daily totals (aggregated across all games)
        const [dailyTotals] = await db.execute(
            `SELECT 
                DATE(played_at) AS play_date,
                COUNT(*)                     AS sessions,
                COALESCE(SUM(points), 0)     AS total_points,
                COALESCE(AVG(points), 0)     AS avg_points,
                COALESCE(MAX(points), 0)     AS best_points
             FROM game_scores
             WHERE user_id = ? AND played_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
             GROUP BY DATE(played_at)
             ORDER BY play_date ASC`,
            [req.user.id, safeDays]
        );

        res.json({
            success: true,
            days: safeDays,
            perGamePerDay: rows.map((r) => ({
                date: r.play_date,
                gameName: r.game_name,
                sessions: r.sessions,
                totalPoints: Math.round(r.total_points),
                avgPoints: Math.round(r.avg_points),
                bestPoints: Math.round(r.best_points),
                avgTime: Math.round(r.avg_time * 100) / 100,
            })),
            dailyTotals: dailyTotals.map((r) => ({
                date: r.play_date,
                sessions: r.sessions,
                totalPoints: Math.round(r.total_points),
                avgPoints: Math.round(r.avg_points),
                bestPoints: Math.round(r.best_points),
            })),
        });
    } catch (err) {
        console.error("Fetch datewise error:", err);
        res.status(500).json({ success: false, error: "Failed to fetch datewise scores" });
    }
});

// ─── GET /api/scores/me/game/:gameName — Per-game history ───
router.get("/scores/me/game/:gameName", verifyToken, async (req, res) => {
    const { gameName } = req.params;
    const validGames = ["orb-drive", "fusion-hoops"];

    if (!validGames.includes(gameName)) {
        return res.status(400).json({ success: false, error: `Invalid gameName. Must be: ${validGames.join(", ")}` });
    }

    try {
        const [rows] = await db.execute(
            `SELECT id, difficulty, time_taken, raw_score, points,
                    avg_alignment, max_speed, focus_bonus, played_at
             FROM game_scores
             WHERE user_id = ? AND game_name = ?
             ORDER BY played_at DESC
             LIMIT 100`,
            [req.user.id, gameName]
        );

        res.json({ success: true, gameName, count: rows.length, data: rows });
    } catch (err) {
        console.error("Fetch game scores error:", err);
        res.status(500).json({ success: false, error: "Failed to fetch game scores" });
    }
});

// ─── GET /api/scores/me/today — Today's best score + total points ─────────────
router.get("/scores/me/today", verifyToken, async (req, res) => {
    try {
        const [[todayRow]] = await db.execute(
            `SELECT
                COALESCE(MAX(points), 0)   AS best_score,
                COALESCE(SUM(points), 0)   AS total_points,
                COUNT(*)                    AS sessions_today
             FROM game_scores
             WHERE user_id = ? AND DATE(played_at) = CURDATE()`,
            [req.user.id]
        );

        res.json({
            success: true,
            todayBestScore:   Math.round(todayRow.best_score),
            todayTotalPoints: Math.round(todayRow.total_points),
            sessionsTodady:   todayRow.sessions_today,
        });
    } catch (err) {
        console.error("Fetch today scores error:", err);
        res.status(500).json({ success: false, error: "Failed to fetch today's scores" });
    }
});

export default router;


// ─── POST /api/scores/alignment — Submit an alignment score ─────────────────
router.post("/scores/alignment", verifyToken, async (req, res) => {
    const userId = req.user.id;
    const {
        alignment,
        severity,
        direction,
        strabismus
    } = req.body;

    if (alignment === undefined || alignment === null) {
        return res.status(400).json({ success: false, error: "alignment score is required" });
    }

    try {
        const [result] = await db.execute(
            `INSERT INTO alignment_scores 
             (user_id, alignment, severity, direction, strabismus)
             VALUES (?, ?, ?, ?, ?)`,
            [
                userId,
                Math.round(alignment * 100) / 100,
                severity || null,
                direction || null,
                strabismus || null
            ]
        );

        res.status(201).json({
            success: true,
            message: "Alignment score saved",
            scoreId: result.insertId,
            alignment,
        });
    } catch (err) {
        console.error("Save alignment score error:", err);
        res.status(500).json({ success: false, error: "Failed to save alignment score" });
    }
});

// ─── GET /api/scores/alignment/me — All alignment scores for logged-in user ─────
router.get("/scores/alignment/me", verifyToken, async (req, res) => {
    try {
        const [rows] = await db.execute(
            `SELECT id, alignment, severity, direction, strabismus, captured_at
             FROM alignment_scores 
             WHERE user_id = ? 
             ORDER BY captured_at DESC 
             LIMIT 100`,
            [req.user.id]
        );

        res.json({ success: true, count: rows.length, data: rows });
    } catch (err) {
        console.error("Fetch alignment scores error:", err);
        res.status(500).json({ success: false, error: "Failed to fetch alignment scores" });
    }
});
