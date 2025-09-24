-- 021_clients_drop_code_require_gender.sql
-- Ziel: Spalte 'code' entfernen, gender als Pflichtfeld, code komplett raus

PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS __clients_new;

CREATE TABLE __clients_new (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  gender    TEXT NOT NULL CHECK (gender IN ('m','f','d','u')),
  dob       TEXT,
  contact   TEXT
);

INSERT INTO __clients_new (id, full_name, gender, dob, contact)
SELECT
  id,
  full_name,
  CASE
    WHEN gender IN ('m','f','d','u') THEN gender
    WHEN gender IS NULL OR TRIM(gender)='' THEN 'u'
    ELSE 'u'
  END,
  dob, contact
FROM clients;

DROP TABLE IF EXISTS clients;
ALTER TABLE __clients_new RENAME TO clients;

-- Frühere Indizes auf 'code' sicher entfernen
DROP INDEX IF EXISTS ux_clients_code_nonnull;

PRAGMA foreign_keys = ON;
