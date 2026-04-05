import mysql from "mysql2/promise";

const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "Ruchika",
    database: "netrasync",
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