-- 022_cases_add_age_years_at_start.sql
-- Alter zum Therapiebeginn in der Anamnese (Case) speichern.
ALTER TABLE cases ADD COLUMN age_years_at_start INTEGER;
