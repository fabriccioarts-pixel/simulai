-- 1. Create UserPermissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS UserPermissions (
  user_id INTEGER NOT NULL,
  content_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, content_id)
);

-- 2. Create Questions table if it doesn't exist
CREATE TABLE IF NOT EXISTS Questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_id TEXT,
  discipline TEXT,
  question TEXT,
  options TEXT,
  answer TEXT,
  explanation TEXT,
  banca TEXT,
  pegadinha TEXT,
  content_id INTEGER DEFAULT 1
);

-- 3. Create Users table if it doesn't exist
CREATE TABLE IF NOT EXISTS Users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Try adding new columns to Users (they might already exist locally but not remotely)
ALTER TABLE Users ADD COLUMN verification_code TEXT;
ALTER TABLE Users ADD COLUMN is_verified INTEGER DEFAULT 0;
