-- gleiches Aggregat, aber basierend auf cases_flat
CREATE VIEW IF NOT EXISTS v_method_problem_stats AS
SELECT
  tm.label AS method_label,
  pc.label AS problem_label,
  f.method_code,
  f.primary_problem_code,
  f.status,
  COUNT(*)                           AS cases_n,
  AVG(COALESCE(f.session_count,0))   AS avg_sessions,
  AVG(f.sud_start)                   AS avg_sud_start,
  AVG(f.sud_last)                    AS avg_sud_last,
  AVG(CASE WHEN f.sud_start IS NOT NULL AND f.sud_last IS NOT NULL
           THEN (f.sud_start - f.sud_last) END)  AS avg_sud_delta, -- ØΔSUD
  100.0 * AVG(COALESCE(f.has_prev_therapy,0))    AS pct_prev_therapies,
  AVG(f.avg_prev_duration_months)                AS avg_prev_duration_mon,
  100.0 * SUM(CASE WHEN f.gender='m' THEN 1 ELSE 0 END) / COUNT(*) AS pct_m,
  100.0 * SUM(CASE WHEN f.gender='w' THEN 1 ELSE 0 END) / COUNT(*) AS pct_w,
  100.0 * SUM(CASE WHEN f.gender='d' THEN 1 ELSE 0 END) / COUNT(*) AS pct_d,
  100.0 * SUM(CASE WHEN f.gender='u' THEN 1 ELSE 0 END) / COUNT(*) AS pct_u
FROM cases_flat f
JOIN therapy_methods    tm ON tm.code = f.method_code
JOIN problem_categories pc ON pc.code = f.primary_problem_code
GROUP BY f.method_code, f.primary_problem_code, f.status
ORDER BY tm.label, pc.label, f.status;
