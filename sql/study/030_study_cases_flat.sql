CREATE TABLE IF NOT EXISTS cases_flat (
  case_uid TEXT PRIMARY KEY,   -- Pseudonym
  method_code TEXT NOT NULL,
  primary_problem_code TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('current','completed')),
  start_month TEXT,            -- YYYY-MM
  end_month   TEXT,            -- YYYY-MM (nur completed)
  age_years_at_start INTEGER,
  gender TEXT CHECK (gender IN ('m','w','d','u')),
  session_count INTEGER,
  sud_start REAL,
  sud_last  REAL,
  has_prev_therapy INTEGER,
  avg_prev_duration_months REAL
);
