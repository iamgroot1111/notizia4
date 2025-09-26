-- study: konsistente Aggregat-View (nur lesen)
-- Erwartet: Tabelle cases_flat (anonymisierte Fakten)
DROP VIEW IF EXISTS v_method_problem_stats;

CREATE VIEW v_method_problem_stats AS
SELECT
  f.method_code,
  (SELECT label FROM therapy_methods WHERE code = f.method_code)          AS method_label,
  f.primary_problem_code                                                  AS problem_code,
  (SELECT label FROM problem_categories WHERE code = f.primary_problem_code) AS problem_label,
  f.status,
  COUNT(*)                                   AS cases_n,
  AVG(COALESCE(f.session_count, 0.0))        AS avg_sessions,
  AVG(f.sud_start)                           AS avg_sud_start,
  AVG(f.sud_last)                            AS avg_sud_last,
  AVG(f.sud_last - f.sud_start)              AS avg_sud_delta,
  100.0 * AVG(COALESCE(f.has_prev_therapy,0)) AS pct_prev_therapies,
  AVG(f.avg_prev_duration_months)            AS avg_prev_duration_mon,
  100.0 * SUM(CASE WHEN f.gender='m' THEN 1 ELSE 0 END) / COUNT(*) AS pct_m,
  100.0 * SUM(CASE WHEN f.gender='w' THEN 1 ELSE 0 END) / COUNT(*) AS pct_w,
  100.0 * SUM(CASE WHEN f.gender='d' THEN 1 ELSE 0 END) / COUNT(*) AS pct_d,
  100.0 * SUM(CASE WHEN f.gender='u' OR f.gender IS NULL THEN 1 ELSE 0 END) / COUNT(*) AS pct_u
FROM cases_flat f
GROUP BY
  f.method_code, method_label, f.primary_problem_code, problem_label, f.status;
