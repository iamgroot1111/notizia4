// electron/main.cjs
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');

let win;
let dbPersonal;
let dbStudy;

// ---------- Fenster ----------
function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// ---------- Migration-Runner ----------
function runMigrations(db, dir) {
  if (!fs.existsSync(dir)) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT UNIQUE NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  const seen = db.prepare('SELECT 1 FROM _migrations WHERE filename=?');
  const mark = db.prepare('INSERT INTO _migrations(filename) VALUES (?)');

  for (const file of files) {
    if (seen.get(file)) {
      console.log(`[migration] skip  ${file}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log(`[migration] apply ${file}`);
    db.exec('BEGIN');
    try {
      db.exec(sql);
      mark.run(file);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      console.error(`[migration] FAILED in ${file}`);
      throw err;
    }
  }
}

// ---------- Helper: Spalte hinzufügen falls fehlend ----------
function addColumnIfMissing(db, table, columnDef) {
  const colName = columnDef.trim().split(/\s+/, 1)[0]; // z. B. 'sud_current'
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some(c => c.name === colName)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
    console.log(`[migration] added ${table}.${colName}`);
  } else {
    console.log(`[migration] exists ${table}.${colName}, skipping`);
  }
}

// ---------- App Ready ----------
app.whenReady().then(() => {
  // DB-Dateien im Benutzerverzeichnis der App
  const base = app.getPath('userData'); // z. B. C:\Users\<Du>\AppData\Roaming\notizia4
  dbPersonal = new Database(path.join(base, 'personal.sqlite'));
  dbStudy    = new Database(path.join(base, 'study.sqlite'));
  dbPersonal.pragma('journal_mode = WAL');
  dbStudy.pragma('journal_mode = WAL');

  // Migrationen ausführen
  runMigrations(dbPersonal, path.join(__dirname, '../sql/personal'));
  runMigrations(dbStudy,    path.join(__dirname, '../sql/study'));

  // ---- Schema-Drifts sicher abfangen (NACH den Migrationen) ----
  addColumnIfMissing(dbPersonal, 'cases', 'sud_current INTEGER');
  addColumnIfMissing(dbPersonal, 'cases', 'problem_since_month TEXT');
  addColumnIfMissing(dbPersonal, 'case_previous_therapies', 'since_month TEXT');
  addColumnIfMissing(dbPersonal, 'case_previous_therapies', 'is_completed INTEGER DEFAULT 0');
  addColumnIfMissing(dbPersonal, 'sessions', 'method_code_session TEXT');
  addColumnIfMissing(dbPersonal, 'sessions', 'change_note TEXT');
  addColumnIfMissing(dbPersonal, 'sessions', 'new_problem_code TEXT');

  // ---------- IPC: CLIENTS ----------
  ipcMain.handle('clients.list', () => {
    return dbPersonal.prepare(`
      SELECT id, full_name, gender, dob, contact
      FROM clients ORDER BY full_name COLLATE NOCASE
    `).all();
  });

  ipcMain.handle('clients.create', (_e, payload) => {
    const { full_name, gender, dob = null, contact = null, intake = null } = payload || {};
    if (!full_name || !String(full_name).trim()) throw new Error('full_name ist Pflichtfeld.');
    if (!gender || !['m','w','d','u'].includes(String(gender))) throw new Error('gender (m|w|d|u) ist Pflicht.');

    const info = dbPersonal.prepare(`
      INSERT INTO clients(full_name, gender, dob, contact)
      VALUES (@full_name, @gender, @dob, @contact)
    `).run({
      full_name: String(full_name).trim(),
      gender, dob, contact
    });

    const clientId = Number(info.lastInsertRowid);
    let caseId;

    // beim Anlegen optional ersten Fall erzeugen (Alter/Start etc.)
    if (intake) {
      const {
        age_years_at_start = null,
        primary_problem_code = 'UNSPEC',
        method_code = 'AUFLOESENDE_HYPNOSE',
        start_date = new Date().toISOString().slice(0,10),
        target_description = null,
        sud_start = null,
        problem_duration_months = null
      } = intake;

      const caseInfo = dbPersonal.prepare(`
        INSERT INTO cases(
          client_id, method_code, primary_problem_code, start_date,
          target_description, sud_start, problem_duration_months, age_years_at_start
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        clientId, method_code, primary_problem_code, start_date,
        target_description, sud_start, problem_duration_months, age_years_at_start
      );
      caseId = Number(caseInfo.lastInsertRowid);
    }

    return { id: clientId, case_id: caseId };
  });

  ipcMain.handle('clients.update', (_e, patch) => {
    if (!patch?.id) throw new Error('id fehlt.');
    dbPersonal.prepare(`
      UPDATE clients SET
        full_name = COALESCE(@full_name, full_name),
        gender    = COALESCE(@gender,    gender),
        dob       = COALESCE(@dob,       dob),
        contact   = COALESCE(@contact,   contact)
      WHERE id = @id
    `).run(patch);
    return { ok: true };
  });

  ipcMain.handle('clients.delete', (_e, id) => {
    dbPersonal.prepare(`DELETE FROM clients WHERE id=?`).run(id);
    return { ok: true };
  });

  // ---------- IPC: CASES ----------
  ipcMain.handle('cases.listByClient', (_e, clientId) => {
    return dbPersonal.prepare(`
      SELECT id, client_id, method_code, primary_problem_code, start_date,
             target_description, age_years_at_start
      FROM cases
      WHERE client_id = ?
      ORDER BY id DESC
    `).all(clientId);
  });

  ipcMain.handle('cases.readFull', (_e, caseId) => {
    const c = dbPersonal.prepare(`
      SELECT id, client_id, method_code, primary_problem_code, start_date,
             target_description, age_years_at_start, sud_start, sud_current,
             problem_since_month, problem_duration_months
      FROM cases WHERE id=?
    `).get(caseId);
    if (!c) return null;

    const prev = dbPersonal.prepare(`
      SELECT therapy_type_code, since_month, duration_months, is_completed, note
      FROM case_previous_therapies WHERE case_id=?
    `).all(caseId);

    const meds = dbPersonal.prepare(`
      SELECT med_code, since_month, dosage_note
      FROM case_medications WHERE case_id=?
    `).all(caseId);

    return { ...c, previous_therapies: prev, medications: meds };
  });

  ipcMain.handle('cases.create', (_e, p) => {
    const {
      client_id,
      method_code = 'AUFLOESENDE_HYPNOSE',
      primary_problem_code = 'UNSPEC',
      start_date = new Date().toISOString().slice(0,10),
      target_description = null,
      sud_start = null,
      problem_duration_months = null,
      age_years_at_start = null
    } = p || {};
    if (!client_id) throw new Error('client_id fehlt.');

    const info = dbPersonal.prepare(`
      INSERT INTO cases(
        client_id, method_code, primary_problem_code, start_date,
        target_description, sud_start, problem_duration_months, age_years_at_start
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      client_id, method_code, primary_problem_code, start_date,
      target_description, sud_start, problem_duration_months, age_years_at_start
    );
    return { id: Number(info.lastInsertRowid) };
  });

  ipcMain.handle('cases.update', (_e, patch) => {
    if (!patch?.id) throw new Error('id fehlt.');
    dbPersonal.prepare(`
      UPDATE cases SET
        method_code               = COALESCE(@method_code,               method_code),
        primary_problem_code      = COALESCE(@primary_problem_code,      primary_problem_code),
        start_date                = COALESCE(@start_date,                start_date),
        target_description        = COALESCE(@target_description,        target_description),
        sud_start                 = COALESCE(@sud_start,                 sud_start),
        problem_duration_months   = COALESCE(@problem_duration_months,   problem_duration_months),
        age_years_at_start        = COALESCE(@age_years_at_start,        age_years_at_start)
      WHERE id=@id
    `).run(patch);
    return { ok: true };
  });

  ipcMain.handle('cases.saveAnamnesis', (_e, p) => {
    const { case_id } = p || {};
    if (!case_id) throw new Error('case_id fehlt.');

    const tx = dbPersonal.transaction(() => {
      // Stammdaten
      dbPersonal.prepare(`
        UPDATE cases SET
          method_code             = COALESCE(@method_code,             method_code),
          primary_problem_code    = COALESCE(@primary_problem_code,    primary_problem_code),
          target_description      = COALESCE(@target_description,      target_description),
          sud_start               = COALESCE(@sud_start,               sud_start),
          sud_current             = COALESCE(@sud_current,             sud_current),
          problem_since_month     = COALESCE(@problem_since_month,     problem_since_month),
          problem_duration_months = COALESCE(@problem_duration_months, problem_duration_months),
          age_years_at_start      = COALESCE(@age_years_at_start,      age_years_at_start)
        WHERE id = @case_id
      `).run(p);

      // Vor-Therapien
      if (Array.isArray(p.previous_therapies)) {
        dbPersonal.prepare(`DELETE FROM case_previous_therapies WHERE case_id=?`).run(case_id);
        const ins = dbPersonal.prepare(`
          INSERT INTO case_previous_therapies
            (case_id, therapy_type_code, since_month, duration_months, is_completed, note)
          VALUES (@case_id, @therapy_type_code, @since_month, @duration_months, @is_completed, @note)
        `);
        for (const t of p.previous_therapies) {
          ins.run({
            case_id,
            therapy_type_code: t.therapy_type_code,
            since_month: t.since_month ?? null,
            duration_months: t.duration_months ?? null,
            is_completed: t.is_completed ? 1 : 0,
            note: t.note ?? null
          });
        }
      }

      // Medikamente
      if (Array.isArray(p.medications)) {
        dbPersonal.prepare(`DELETE FROM case_medications WHERE case_id=?`).run(case_id);
        const ins = dbPersonal.prepare(`
          INSERT INTO case_medications(case_id, med_code, since_month, dosage_note)
          VALUES (@case_id, @med_code, @since_month, @dosage_note)
        `);
        for (const m of p.medications) {
          ins.run({
            case_id,
            med_code: m.med_code,
            since_month: m.since_month ?? null,
            dosage_note: m.dosage_note ?? null
          });
        }
      }
    });
    tx();
    return { ok: true };
  });

  ipcMain.handle('cases.delete', (_e, id) => {
    dbPersonal.prepare(`DELETE FROM cases WHERE id=?`).run(id);
    return { ok: true };
  });

  // ---------- IPC: SESSIONS ----------
  ipcMain.handle('sessions.listByCase', (_e, caseId) => {
    return dbPersonal.prepare(`
      SELECT id, case_id, date, topic, sud_session, duration_min,
             method_code_session, change_note, new_problem_code
      FROM sessions
      WHERE case_id = ?
      ORDER BY date DESC, id DESC
    `).all(caseId);
  });

  ipcMain.handle('sessions.create', (_e, payload) => {
    const {
      case_id, date = new Date().toISOString(),
      topic = null, sud_session = null, duration_min = null,
      method_code_session = null, change_note = null, new_problem_code = null,
      note = null
    } = payload || {};
    if (!case_id) throw new Error('case_id fehlt.');

    const tx = dbPersonal.transaction(() => {
      const info = dbPersonal.prepare(`
        INSERT INTO sessions
          (case_id, date, topic, sud_session, duration_min,
           method_code_session, change_note, new_problem_code)
        VALUES (@case_id, @date, @topic, @sud_session, @duration_min,
                @method_code_session, @change_note, @new_problem_code)
      `).run({
        case_id, date, topic, sud_session, duration_min,
        method_code_session, change_note, new_problem_code
      });

      if (note) {
        dbPersonal.prepare(`
          INSERT OR REPLACE INTO session_notes(session_id, content)
          VALUES (?, ?)
        `).run(info.lastInsertRowid, note);
      }
      return { id: Number(info.lastInsertRowid) };
    });
    return tx();
  });

  ipcMain.handle('sessions.update', (_e, patch) => {
    if (!patch?.id) throw new Error('id fehlt.');
    dbPersonal.prepare(`
      UPDATE sessions SET
        date = COALESCE(@date, date),
        topic = COALESCE(@topic, topic),
        sud_session = COALESCE(@sud_session, sud_session),
        duration_min = COALESCE(@duration_min, duration_min),
        method_code_session = COALESCE(@method_code_session, method_code_session),
        change_note = COALESCE(@change_note, change_note),
        new_problem_code = COALESCE(@new_problem_code, new_problem_code)
      WHERE id = @id
    `).run(patch);

    if ('note' in patch) {
      dbPersonal.prepare(`
        INSERT OR REPLACE INTO session_notes(session_id, content)
        VALUES (@id, COALESCE(@note, (SELECT content FROM session_notes WHERE session_id=@id)))
      `).run(patch);
    }
    return { ok: true };
  });

  ipcMain.handle('sessions.delete', (_e, id) => {
    dbPersonal.prepare(`DELETE FROM session_notes WHERE session_id=?`).run(id);
    dbPersonal.prepare(`DELETE FROM sessions WHERE id=?`).run(id);
    return { ok: true };
  });

  // ---------- IPC: Kataloge ----------
  ipcMain.handle('catalog.therapyMethods', () => {
    return dbPersonal.prepare(`SELECT code, label FROM therapy_methods ORDER BY label`).all();
  });
  ipcMain.handle('catalog.problemCategories', () => {
    return dbPersonal.prepare(`SELECT code, label FROM problem_categories ORDER BY label`).all();
  });
  ipcMain.handle('catalog.previousTherapyTypes', () => {
    return dbPersonal.prepare(`SELECT code, label FROM previous_therapy_types ORDER BY label`).all();
  });
  ipcMain.handle('catalog.medicationCatalog', () => {
    return dbPersonal.prepare(`SELECT code, label FROM medication_catalog ORDER BY label`).all();
  });

  createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
