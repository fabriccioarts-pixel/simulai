DROP TABLE IF EXISTS Questions;
CREATE TABLE Questions (
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

CREATE TABLE Users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
