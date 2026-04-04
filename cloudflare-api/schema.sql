-- ============================================================
-- SIMULAI SaaS v2.0 — Schema Completo
-- ============================================================

-- 1. Users (gerenciado via Supabase)
CREATE TABLE IF NOT EXISTS Users (
  id TEXT PRIMARY KEY,           -- UUID do Supabase
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'user',
  is_admin INTEGER DEFAULT 0,
  stripe_customer_id TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

-- 2. Subscriptions (modelo SaaS recorrente)
CREATE TABLE IF NOT EXISTS Subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES Users(id),
  status TEXT NOT NULL DEFAULT 'inactive', -- active | canceled | past_due | incomplete
  plan TEXT DEFAULT 'monthly',             -- monthly | annual
  stripe_subscription_id TEXT UNIQUE,
  current_period_end INTEGER,              -- timestamp unix
  created_at INTEGER DEFAULT (unixepoch())
);

-- 3. Quizzes (catálogo dinâmico — feed)
CREATE TABLE IF NOT EXISTS Quizzes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT,                            -- ex: "Direito Constitucional", "ATA-MF"
  is_premium INTEGER DEFAULT 0,            -- boolean
  difficulty TEXT DEFAULT 'medium',        -- easy | medium | hard
  is_active INTEGER DEFAULT 1,             -- boolean — inativo some do feed
  created_at INTEGER DEFAULT (unixepoch())
);

-- 4. Questions (vinculadas a quizzes)
CREATE TABLE IF NOT EXISTS Questions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT REFERENCES Quizzes(id),
  discipline TEXT,
  question TEXT NOT NULL,
  options TEXT NOT NULL,                   -- JSON: [{letra, texto, correta}]
  answer TEXT,                             -- letra da resposta correta
  explanation TEXT,
  banca TEXT DEFAULT 'ESAF',
  pegadinha TEXT,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

-- 5. UserProgress (sessões de quiz — suporta retomada)
CREATE TABLE IF NOT EXISTS UserProgress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES Users(id),
  quiz_id TEXT NOT NULL REFERENCES Quizzes(id),
  current_question_index INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  answers TEXT DEFAULT '[]',               -- JSON: [{questionId, selectedLetter, correctLetter, isCorrect}]
  completed INTEGER DEFAULT 0,
  started_at INTEGER DEFAULT (unixepoch()),
  completed_at INTEGER,
  UNIQUE(user_id, quiz_id)                 -- apenas 1 sessão ativa por quiz por user
);

-- 6. UserDailyUsage (controle freemium: 10 questões/dia)
CREATE TABLE IF NOT EXISTS UserDailyUsage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES Users(id),
  date TEXT NOT NULL,                      -- YYYY-MM-DD (UTC-3)
  free_questions_used INTEGER DEFAULT 0,
  UNIQUE(user_id, date)
);

-- 7. UserPermissions (legado — mantido para compatibilidade)
CREATE TABLE IF NOT EXISTS UserPermissions (
  user_id TEXT NOT NULL,
  content_id TEXT NOT NULL,
  PRIMARY KEY (user_id, content_id)
);
