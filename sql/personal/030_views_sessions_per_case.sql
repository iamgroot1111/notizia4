-- Sessions je Fall (frühester & letzter SUD)
CREATE VIEW IF NOT EXISTS v_sessions_per_case AS
SELECT
  s.case_id,
  COUNT(*) AS session_count,
  (SELECT sud_session FROM sessions s1
     WHERE s1.case_id = s.case_id
     ORDER BY s1.date ASC, s1.id ASC LIMIT 1) AS sud_start_calc,
  (SELECT sud_session FROM sessions s2
     WHERE s2.case_id = s.case_id
     ORDER BY s2.date DESC, s2.id DESC LIMIT 1) AS sud_last_calc
FROM sessions s
GROUP BY s.case_id;
