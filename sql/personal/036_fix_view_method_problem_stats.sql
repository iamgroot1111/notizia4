-- personal: konsistente Aggregat-View (nur lesen)
DROP VIEW IF EXISTS v_method_problem_stats;

CREATE VIEW v_method_problem_stats AS
SELECT
  r.method_code,
  tm.label                              AS method_label,
  r.primary_problem_code                AS problem_code,
  pc.label                              AS problem_label,
  r.status,
  COUNT(*)                              AS cases_n,
  AVG(COALESCE(r.session_count, 0.0))   AS avg_sessions,
  AVG(r.sud_start_calc)                 AS avg_sud_start,
  AVG(r.sud_last_calc)                  AS avg_sud_last,
  AVG(r.sud_last_calc - r.sud_start_calc) AS avg_sud_delta,
  100.0 * AVG(COALESCE(r.has_prev_therapy, 0)) AS pct_prev_therapies,
  AVG(r.avg_prev_duration_months)       AS avg_prev_duration_mon,
  100.0 * SUM(CASE WHEN c.gender='m' THEN 1 ELSE 0 END) / COUNT(*) AS pct_m,
  100.0 * SUM(CASE WHEN c.gender='w' THEN 1 ELSE 0 END) / COUNT(*) AS pct_w,
  100.0 * SUM(CASE WHEN c.gender='d' THEN 1 ELSE 0 END) / COUNT(*) AS pct_d,
  100.0 * SUM(CASE WHEN c.gender='u' OR c.gender IS NULL THEN 1 ELSE 0 END) / COUNT(*) AS pct_u
FROM v_case_rollup r
JOIN clients            c  ON c.id   = r.client_id
JOIN therapy_methods    tm ON tm.code = r.method_code
JOIN problem_categories pc ON pc.code = r.primary_problem_code
GROUP BY
  r.method_code, tm.label, r.primary_problem_code, pc.label, r.status;
