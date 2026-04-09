import mysql from "mysql2/promise";

const conn = await mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "admin",
  database: "netrasync",
});

try {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS game_scores (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      user_id       INT NOT NULL,
      game_name     VARCHAR(50) NOT NULL,
      difficulty    ENUM('beginner','intermediate','advanced') NOT NULL DEFAULT 'beginner',
      time_taken    FLOAT NOT NULL DEFAULT 0,
      raw_score     INT NOT NULL DEFAULT 0,
      points        INT NOT NULL DEFAULT 0,
      avg_alignment FLOAT DEFAULT 0,
      max_speed     INT DEFAULT 0,
      focus_bonus   INT DEFAULT 0,
      played_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_date (user_id, played_at),
      INDEX idx_user_game (user_id, game_name)
    )
  `);
  console.log("✅ game_scores table created successfully!");

  // Verify
  const [rows] = await conn.execute("DESCRIBE game_scores");
  console.log("Columns:", rows.map(r => r.Field).join(", "));
} catch (err) {
  console.log("Info:", err.message);
} finally {
  await conn.end();
  process.exit(0);
}
