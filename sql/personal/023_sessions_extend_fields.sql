-- 023_sessions_extend_fields.sql
-- Sitzung um methodenbezogene & Verlaufsfelder erweitern.
ALTER TABLE sessions ADD COLUMN method_code_session TEXT;  -- optional, überschreibt Case-Methode
ALTER TABLE sessions ADD COLUMN change_note TEXT;          -- Veränderungen seit letzter Sitzung
ALTER TABLE sessions ADD COLUMN new_problem_code TEXT;     -- neues/zusätzliches Problem (optional)

CREATE INDEX IF NOT EXISTS idx_sessions_case_date ON sessions(case_id, date);
