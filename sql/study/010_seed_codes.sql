INSERT OR IGNORE INTO problem_categories(code,label) VALUES
 ('SELBSTWERT','Selbstwert'),('PANIK','Panik'),('DEPRESSION','Depression'),
 ('UEBERGEWICHT','Übergewicht'),('UNSPEC','Unbestimmt');

INSERT OR IGNORE INTO therapy_methods(code,label) VALUES
 ('AUFLOESENDE_HYPNOSE','Auflösende Hypnose'),('EMDR','EMDR'),
 ('GESPRACH','Gesprächstherapie'),('UNSPEC','Unbestimmt');

INSERT OR IGNORE INTO previous_therapy_types(code,label) VALUES
 ('VERHALTENSTHERAPIE','Verhaltenstherapie'),('GESPRACH','Gesprächstherapie'),
 ('HYPNOSE','Hypnose'),('UNSPEC','Unbestimmt');

INSERT OR IGNORE INTO medication_catalog(code,label) VALUES
 ('SSRI','SSRI'),('BENZO','Benzodiazepine'),('NEUROLEPTIKA','Neuroleptika'),('NONE','Keine/Unbekannt');
