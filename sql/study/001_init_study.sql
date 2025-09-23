PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS therapy_methods (
  code TEXT PRIMARY KEY, label TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS problem_categories (
  code TEXT PRIMARY KEY, label TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS previous_therapy_types (
  code TEXT PRIMARY KEY, label TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS medication_catalog (
  code TEXT PRIMARY KEY, label TEXT NOT NULL
);

-- Eine Zeile pro abgeschlossener Therapie – ohne PII!
CREATE TABLE IF NOT EXISTS study_cases (
  study_case_uuid TEXT PRIMARY KEY,
  method_code TEXT NOT NULL REFERENCES therapy_methods(code),
  primary_problem_code TEXT NOT NULL REFERENCES problem_categories(code),
  problem_duration_months INTEGER,
  sud_start INTEGER CHECK (sud_start BETWEEN 0 AND 10),
  sud_end INTEGER CHECK (sud_end BETWEEN 0 AND 10),
  sessions_count INTEGER,
  therapy_duration_days INTEGER,
  prev_therapies_codes TEXT,
  med_codes TEXT,
  achieved_desired_change INTEGER NOT NULL CHECK (achieved_desired_change IN (0,1))
);
