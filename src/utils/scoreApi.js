/**
 * scoreApi.js — Frontend helpers for the scoring system.
 * All calls require a valid JWT token in localStorage.
 */

const API_BASE = "http://localhost:5000/api";

function authHeaders() {
    const token = localStorage.getItem("token");
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

// ─── Difficulty multipliers (mirrors backend) ───────────────
export const DIFFICULTY_MULTIPLIERS = { beginner: 1, intermediate: 2, advanced: 3 };

/**
 * Submit a game score to the backend.
 * @param {Object} params
 * @param {string} params.gameName       - 'orb-drive' | 'fusion-hoops'
 * @param {string} params.difficulty     - 'beginner' | 'intermediate' | 'advanced'
 * @param {number} params.timeTaken      - seconds to complete
 * @param {number} params.rawScore       - game score (0-100)
 * @param {number} [params.avgAlignment] - average alignment %
 * @param {number} [params.maxSpeed]     - max speed achieved
 * @param {number} [params.focusBonus]   - focus bonus %
 * @returns {Promise<Object>} { success, scoreId, points, difficulty, difficultyMultiplier }
 */
export async function submitScore({
    gameName,
    difficulty = "beginner",
    timeTaken = 0,
    rawScore = 0,
    avgAlignment = 0,
    maxSpeed = 0,
    focusBonus = 0,
}) {
    try {
        const res = await fetch(`${API_BASE}/scores`, {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ gameName, difficulty, timeTaken, rawScore, avgAlignment, maxSpeed, focusBonus }),
        });
        return await res.json();
    } catch (err) {
        console.error("submitScore error:", err);
        return { success: false, error: err.message };
    }
}

/**
 * Fetch the logged-in user's score summary (total + per-game breakdown).
 * @returns {Promise<Object>} { success, total, perGame }
 */
export async function getScoreSummary() {
    try {
        const res = await fetch(`${API_BASE}/scores/me/summary`, { headers: authHeaders() });
        return await res.json();
    } catch (err) {
        console.error("getScoreSummary error:", err);
        return { success: false, error: err.message };
    }
}

/**
 * Fetch date-wise scores (for worm/line graph).
 * @param {number} [days=30] - number of days to look back
 * @returns {Promise<Object>} { success, perGamePerDay, dailyTotals }
 */
export async function getDatewiseScores(days = 30) {
    try {
        const res = await fetch(`${API_BASE}/scores/me/datewise?days=${days}`, { headers: authHeaders() });
        return await res.json();
    } catch (err) {
        console.error("getDatewiseScores error:", err);
        return { success: false, error: err.message };
    }
}

/**
 * Fetch all scores for the logged-in user.
 * @returns {Promise<Object>} { success, count, data }
 */
export async function getAllScores() {
    try {
        const res = await fetch(`${API_BASE}/scores/me`, { headers: authHeaders() });
        return await res.json();
    } catch (err) {
        console.error("getAllScores error:", err);
        return { success: false, error: err.message };
    }
}

/**
 * Fetch scores for a specific game.
 * @param {string} gameName - 'orb-drive' | 'fusion-hoops'
 * @returns {Promise<Object>} { success, gameName, count, data }
 */
export async function getGameScores(gameName) {
    try {
        const res = await fetch(`${API_BASE}/scores/me/game/${gameName}`, { headers: authHeaders() });
        return await res.json();
    } catch (err) {
        console.error("getGameScores error:", err);
        return { success: false, error: err.message };
    }
}
