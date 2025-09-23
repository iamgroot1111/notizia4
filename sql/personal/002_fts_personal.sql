-- Contentless FTS5-Index (keine Duplikation in separater Tabelle)
CREATE VIRTUAL TABLE IF NOT EXISTS session_notes_fts
USING fts5(content, content='', tokenize='unicode61');

-- Trigger halten den FTS-Index in Sync
CREATE TRIGGER IF NOT EXISTS session_notes_ai
AFTER INSERT ON session_notes BEGIN
  INSERT INTO session_notes_fts(rowid, content) VALUES (new.session_id, new.content);
END;

CREATE TRIGGER IF NOT EXISTS session_notes_au
AFTER UPDATE ON session_notes BEGIN
  INSERT INTO session_notes_fts(session_notes_fts, rowid, content) VALUES ('delete', new.session_id, old.content);
  INSERT INTO session_notes_fts(rowid, content) VALUES (new.session_id, new.content);
END;

CREATE TRIGGER IF NOT EXISTS session_notes_ad
AFTER DELETE ON session_notes BEGIN
  INSERT INTO session_notes_fts(session_notes_fts, rowid, content) VALUES ('delete', old.session_id, old.content);
END;
