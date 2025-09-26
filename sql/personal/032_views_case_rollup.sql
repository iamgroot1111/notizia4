-- Rollup je Fall: Status, Sitzungen, Vor-Therapien
CREATE VIEW IF NOT EXISTS v_case_rollup AS
SELECT
  c.id  AS case_id,
  c.client_id,
  c.method_code,
  c.primary_problem_code,
  c.start_date,
  c.closed_at,
  CASE WHEN c.closed_at IS NULL THEN 'current' ELSE 'closed' END AS status,
  spc.session_count,
  spc.sud_start_calc,
  spc.sud_last_calc,
  pt.has_prev_therapy,
  pt.avg_prev_duration_months
FROM cases c
LEFT JOIN v_sessions_per_case        spc ON spc.case_id = c.id
LEFT JOIN v_prev_therapies_per_case  pt  ON pt.case_id  = c.id;
