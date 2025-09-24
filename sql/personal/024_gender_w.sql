-- 024_gender_w.sql
-- Ziel: 'w' für weiblich erlauben und bestehendes 'f' zu 'w' migrieren.

PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS __clients_new;

CREATE TABLE __clients_new (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  gender    TEXT NOT NULL CHECK (gender IN ('m','w','d','u')),
  dob       TEXT,
  contact   TEXT
);

INSERT INTO __clients_new (id, full_name, gender, dob, contact)
SELECT
  id,
  full_name,
  CASE
    WHEN gender = 'f' THEN 'w'
    WHEN gender IN ('m','w','d','u') THEN gender
    ELSE 'u'
  END,
  dob, contact
FROM clients;

DROP TABLE clients;
ALTER TABLE __clients_new RENAME TO clients;

PRAGMA foreign_keys = ON;
