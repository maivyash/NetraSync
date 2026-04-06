import mysql from "mysql2/promise";

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

// Test connection on startup
(async () => {
    try {
        const conn = await pool.getConnection();
        console.log("MySQL Connected (connection pool ready)");
        conn.release();
    } catch (err) {
        console.error(" DB Connection Failed:", err.message);
    }
})();

export default pool;