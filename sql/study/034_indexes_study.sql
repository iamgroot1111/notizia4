CREATE INDEX IF NOT EXISTS ix_cases_flat_meth_prob
  ON cases_flat(method_code, primary_problem_code, status);
