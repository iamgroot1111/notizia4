-- Aggregat: Methode × Problem × Status
CREATE VIEW IF NOT EXISTS v_method_problem_stats AS
SELECT
  r.method_code,
  tm.label AS method_label,
  r.primary_problem_code,
  pc.label AS problem_label,
  r.status,
  COUNT(*)                             AS cases_n,
  AVG(COALESCE(session_count, 0)) AS avg_sessions,
  AVG(r.sud_start_calc)                AS avg_sud_start,
  AVG(r.sud_last_calc)                 AS avg_sud_last,
  AVG(r.sud_last_calc - r.sud_start_calc) AS avg_sud_delta,
  100.0 * AVG(COALESCE(r.has_prev_therapy,0)) AS pct_prev_therapies,
  AVG(r.avg_prev_duration_months)      AS avg_prev_duration_mon,
  100.0 * SUM(CASE WHEN cl.gender='m' THEN 1 ELSE 0 END) / COUNT(*) AS pct_m,
  100.0 * SUM(CASE WHEN cl.gender='w' THEN 1 ELSE 0 END) / COUNT(*) AS pct_w,
  100.0 * SUM(CASE WHEN cl.gender='d' THEN 1 ELSE 0 END) / COUNT(*) AS pct_d,
  100.0 * SUM(CASE WHEN cl.gender='u' THEN 1 ELSE 0 END) / COUNT(*) AS pct_u
FROM v_case_rollup r
JOIN clients cl         ON cl.id = r.client_id
LEFT JOIN therapy_methods     tm ON tm.code = r.method_code
LEFT JOIN problem_categories  pc ON pc.code = r.primary_problem_code
GROUP BY r.method_code, r.primary_problem_code, r.status;
