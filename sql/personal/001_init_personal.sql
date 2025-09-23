PRAGMA foreign_keys = ON;

-- Kataloge (in beiden DBs identisch halten)
CREATE TABLE IF NOT EXISTS therapy_methods (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS problem_categories (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS previous_therapy_types (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS medication_catalog (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL
);

-- Mandant: Praxisdaten mit PII
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  dob TEXT,              -- optional
  gender TEXT,           -- optional
  contact TEXT           -- optional
);

-- Behandlungsfall (Episode)
CREATE TABLE IF NOT EXISTS cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  primary_problem_code TEXT NOT NULL REFERENCES problem_categories(code),
  method_code TEXT NOT NULL REFERENCES therapy_methods(code),
  start_date TEXT NOT NULL,
  target_description TEXT,
  sud_start INTEGER CHECK (sud_start BETWEEN 0 AND 10),
  problem_duration_months INTEGER CHECK (problem_duration_months >= 0),
  has_previous_therapies INTEGER DEFAULT 0,
  has_medications INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS case_previous_therapies (
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  therapy_type_code TEXT NOT NULL REFERENCES previous_therapy_types(code),
  duration_months INTEGER,
  note TEXT,
  PRIMARY KEY (case_id, therapy_type_code)
);

CREATE TABLE IF NOT EXISTS case_medications (
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  med_code TEXT NOT NULL REFERENCES medication_catalog(code),
  since_month INTEGER,
  dosage_note TEXT,
  PRIMARY KEY (case_id, med_code)
);

-- Sitzungen & Notizen
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  topic TEXT,
  sud_session INTEGER CHECK (sud_session BETWEEN 0 AND 10),
  duration_min INTEGER
);

CREATE TABLE IF NOT EXISTS session_notes (
  session_id INTEGER PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  content TEXT NOT NULL
);

-- Abschluss eines Falls (für Export)
CREATE TABLE IF NOT EXISTS case_outcomes (
  case_id INTEGER PRIMARY KEY REFERENCES cases(id) ON DELETE CASCADE,
  end_date TEXT NOT NULL,
  sud_end INTEGER CHECK (sud_end BETWEEN 0 AND 10),
  sessions_count INTEGER CHECK (sessions_count >= 0),
  achieved_desired_change INTEGER NOT NULL CHECK (achieved_desired_change IN (0,1))
);
