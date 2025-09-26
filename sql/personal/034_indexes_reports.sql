-- sinnvolle Indizes für Performance
CREATE INDEX IF NOT EXISTS ix_sessions_case_date
  ON sessions(case_id, date);
CREATE INDEX IF NOT EXISTS ix_cases_method_problem
  ON cases(method_code, primary_problem_code);
