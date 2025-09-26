-- sql/study/033_view_method_problem.sql  (Study-DB)
DROP VIEW IF EXISTS v_method_problem_stats;

CREATE VIEW v_method_problem_stats AS
SELECT
  cf.method_code,
  (SELECT label FROM therapy_methods WHERE code = cf.method_code) AS method_label,
  -- WICHTIG: einheitlicher Spaltenname für Frontend & Handler
  cf.primary_problem_code AS problem_code,
  (SELECT label FROM problem_categories WHERE code = cf.primary_problem_code) AS problem_label,
  cf.status,

  COUNT(*)                           AS cases_n,
  AVG(COALESCE(cf.session_count,0))  AS avg_sessions,
  AVG(cf.sud_start)                  AS avg_sud_start,
  AVG(cf.sud_last)                   AS avg_sud_last,
  AVG(cf.sud_last - cf.sud_start)    AS avg_sud_delta,

  AVG(cf.has_prev_therapy) * 100.0   AS pct_prev_therapies,
  AVG(cf.avg_prev_duration_months)   AS avg_prev_duration_mon,

  -- einfache Prozentverteilung Geschlecht
  SUM(CASE WHEN cf.gender='m' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS pct_m,
  SUM(CASE WHEN cf.gender='w' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS pct_w,
  SUM(CASE WHEN cf.gender='d' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS pct_d,
  SUM(CASE WHEN cf.gender='u' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS pct_u

FROM cases_flat cf
GROUP BY cf.method_code, cf.primary_problem_code, cf.status;
