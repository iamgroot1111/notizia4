-- Vor-Therapien je Fall
CREATE VIEW IF NOT EXISTS v_prev_therapies_per_case AS
SELECT
  cp.case_id,
  1 AS has_prev_therapy,
  AVG(cp.duration_months) AS avg_prev_duration_months
FROM case_previous_therapies cp
GROUP BY cp.case_id;
