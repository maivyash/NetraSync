-- ============================================
-- CREATE DATABASE
-- ============================================
CREATE DATABASE IF NOT EXISTS netrasync;
USE netrasync;

-- ============================================
-- CREATE TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  age INT,
  email VARCHAR(255),
  password VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_email (email)
);

CREATE TABLE IF NOT EXISTS eye_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  condition_type VARCHAR(100),
  affected_eye ENUM('LEFT', 'RIGHT', 'BOTH') DEFAULT 'BOTH',
  severity ENUM('Mild', 'Moderate', 'Severe') DEFAULT 'Mild',
  alignment INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS photos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  photo_url LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- GAME SCORES TABLE  (scoring system)
-- ============================================
-- Stores every completed game session.
-- Points formula:  base_score × difficulty_multiplier × time_bonus
--   difficulty_multiplier: beginner=1, intermediate=2, advanced=3
--   time_bonus:            faster completion → higher multiplier (capped 0.5–3.0)
CREATE TABLE IF NOT EXISTS game_scores (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT NOT NULL,
  game_name     VARCHAR(50)  NOT NULL,                                   -- 'orb-drive' | 'fusion-hoops'
  difficulty    ENUM('beginner','intermediate','advanced') NOT NULL DEFAULT 'beginner',
  time_taken    FLOAT        NOT NULL DEFAULT 0,                         -- seconds to complete
  raw_score     INT          NOT NULL DEFAULT 0,                         -- game-internal score (0-100)
  points        INT          NOT NULL DEFAULT 0,                         -- calculated final points
  avg_alignment FLOAT                 DEFAULT 0,
  max_speed     INT                   DEFAULT 0,
  focus_bonus   INT                   DEFAULT 0,
  played_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_date (user_id, played_at),
  INDEX idx_user_game (user_id, game_name)
);


