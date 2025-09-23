const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');

let win;
let dbPersonal;
let dbStudy;

function createWindow() {
  win = new BrowserWindow({
    width: 1200, height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function runMigrations(db, dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort(); // numerisch/lexikografisch
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    db.exec(sql);
  }
}

app.whenReady().then(() => {
  // DB-Dateien im Benutzerverzeichnis der App
  const base = app.getPath('userData'); // z.B. C:\Users\<Du>\AppData\Roaming\notizia4
  dbPersonal = new Database(path.join(base, 'personal.sqlite'));
  dbStudy    = new Database(path.join(base, 'study.sqlite'));
  dbPersonal.pragma('journal_mode = WAL');
  dbStudy.pragma('journal_mode = WAL');

  // Migrationen ausführen
  runMigrations(dbPersonal, path.join(__dirname, '../sql/personal'));
  runMigrations(dbStudy,    path.join(__dirname, '../sql/study'));

  // --- IPC: CLIENTS ---
  ipcMain.handle('clients.list', () => {
    return dbPersonal.prepare(`
      SELECT id, code, full_name, gender
      FROM clients
      ORDER BY full_name COLLATE NOCASE
    `).all();
  });

  ipcMain.handle('clients.create', (_e, payload) => {
    const { code, full_name, gender = null } = payload || {};
    if (!code || !full_name) throw new Error('code und full_name sind Pflichtfelder.');
    const stmt = dbPersonal.prepare(`
      INSERT INTO clients(code, full_name, gender) VALUES (@code, @full_name, @gender)
    `);
    const info = stmt.run({ code, full_name, gender });
    return { id: Number(info.lastInsertRowid) };
  });

  // --- IPC: CASES (für Sessions nötig) ---
  ipcMain.handle('cases.listByClient', (_e, clientId) => {
    return dbPersonal.prepare(`
      SELECT id, client_id, method_code, primary_problem_code, start_date
      FROM cases WHERE client_id = ? ORDER BY id DESC
    `).all(clientId);
  });

  ipcMain.handle('cases.create', (_e, payload) => {
    const {
      client_id, method_code = 'AUFLOESENDE_HYPNOSE',
      primary_problem_code = 'UNSPEC',
      start_date = new Date().toISOString().slice(0,10),
      target_description = null, sud_start = null, problem_duration_months = null
    } = payload || {};
    if (!client_id) throw new Error('client_id fehlt.');
    const stmt = dbPersonal.prepare(`
      INSERT INTO cases(
        client_id, primary_problem_code, method_code, start_date,
        target_description, sud_start, problem_duration_months
      ) VALUES (@client_id, @primary_problem_code, @method_code, @start_date,
                @target_description, @sud_start, @problem_duration_months)
    `);
    const info = stmt.run({
      client_id, primary_problem_code, method_code, start_date,
      target_description, sud_start, problem_duration_months
    });
    return { id: Number(info.lastInsertRowid) };
  });

  // --- IPC: SESSIONS ---
  ipcMain.handle('sessions.listByCase', (_e, caseId) => {
    return dbPersonal.prepare(`
      SELECT id, case_id, date, topic, sud_session, duration_min
      FROM sessions WHERE case_id = ?
      ORDER BY date DESC, id DESC
    `).all(caseId);
  });

  ipcMain.handle('sessions.create', (_e, payload) => {
    const {
      case_id, date = new Date().toISOString(),
      topic = null, sud_session = null, duration_min = null,
      note = null
    } = payload || {};
    if (!case_id) throw new Error('case_id fehlt.');
    const tx = dbPersonal.transaction(() => {
      const info = dbPersonal.prepare(`
        INSERT INTO sessions(case_id, date, topic, sud_session, duration_min)
        VALUES (@case_id, @date, @topic, @sud_session, @duration_min)
      `).run({ case_id, date, topic, sud_session, duration_min });

      if (note) {
        dbPersonal.prepare(`
          INSERT OR REPLACE INTO session_notes(session_id, content) VALUES (?, ?)
        `).run(info.lastInsertRowid, note);
      }
      return { id: Number(info.lastInsertRowid) };
    });
    return tx();
  });

  createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
// ... oben wie gehabt (app, BrowserWindow, dbPersonal/dbStudy, runMigrations, etc.)

// Hilfsfunktion: Code aus Namen generieren (eindeutig)
function generateClientCode(db, full_name) {
  const base = (full_name || 'CLNT')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z]/g, '').toUpperCase();
  const root = base.slice(0, 4) || 'CLNT';
  let code = root;
  let i = 0;
  while (db.prepare('SELECT 1 FROM clients WHERE code=?').get(code)) {
    i += 1;
    code = root + String(i).padStart(2, '0');
  }
  return code;
}

app.whenReady().then(() => {
  // ... DB öffnen + PRAGMA + Migrationen laufen lassen ...

  // ---------- Clients ----------
  ipcMain.handle('clients.list', () => {
    return dbPersonal.prepare(`
      SELECT id, code, full_name, gender, age_years
      FROM clients
      ORDER BY full_name COLLATE NOCASE
    `).all();
  });

  ipcMain.handle('clients.create', (_e, payload) => {
    const { full_name, gender = null, age_years = null, code = null } = payload || {};
    if (!full_name) throw new Error('full_name ist Pflichtfeld.');

    const finalCode = (code && String(code).trim()) || generateClientCode(dbPersonal, full_name);
    const stmt = dbPersonal.prepare(`
      INSERT INTO clients(code, full_name, gender, age_years)
      VALUES (@code, @full_name, @gender, @age_years)
    `);
    const info = stmt.run({ code: finalCode, full_name, gender, age_years });
    return { id: Number(info.lastInsertRowid), code: finalCode };
  });

  // ---------- Cases (Anamnese lesen/speichern, Methode ändern) ----------
  ipcMain.handle('cases.readFull', (_e, caseId) => {
    const c = dbPersonal.prepare(`
      SELECT id, client_id, method_code, primary_problem_code, start_date, target_description
      FROM cases WHERE id=?
    `).get(caseId);
    if (!c) return null;
    const prev = dbPersonal.prepare(`
      SELECT therapy_type_code AS therapy_type_code, duration_months, note
      FROM case_previous_therapies WHERE case_id=?
    `).all(caseId);
    const meds = dbPersonal.prepare(`
      SELECT med_code AS med_code, since_month, dosage_note
      FROM case_medications WHERE case_id=?
    `).all(caseId);
    return { ...c, previous_therapies: prev, medications: meds };
  });

  ipcMain.handle('cases.saveAnamnesis', (_e, payload) => {
    const { case_id, primary_problem_code = null, target_description = null,
            previous_therapies = [], medications = [] } = payload || {};
    if (!case_id) throw new Error('case_id fehlt.');
    const tx = dbPersonal.transaction(() => {
      // Meta-Felder im Case
      if (primary_problem_code !== null || target_description !== null) {
        dbPersonal.prepare(`
          UPDATE cases
             SET primary_problem_code = COALESCE(@primary_problem_code, primary_problem_code),
                 target_description   = COALESCE(@target_description,   target_description)
           WHERE id = @case_id
        `).run({ case_id, primary_problem_code, target_description });
      }
      // Vor-Therapien
      dbPersonal.prepare(`DELETE FROM case_previous_therapies WHERE case_id=?`).run(case_id);
      for (const t of previous_therapies) {
        dbPersonal.prepare(`
          INSERT INTO case_previous_therapies(case_id, therapy_type_code, duration_months, note)
          VALUES (@case_id, @therapy_type_code, @duration_months, @note)
        `).run({
          case_id,
          therapy_type_code: t.therapy_type_code,
          duration_months: t.duration_months ?? null,
          note: t.note ?? null
        });
      }
      // Medikamente
      dbPersonal.prepare(`DELETE FROM case_medications WHERE case_id=?`).run(case_id);
      for (const m of medications) {
        dbPersonal.prepare(`
          INSERT INTO case_medications(case_id, med_code, since_month, dosage_note)
          VALUES (@case_id, @med_code, @since_month, @dosage_note)
        `).run({
          case_id,
          med_code: m.med_code,
          since_month: m.since_month ?? null,
          dosage_note: m.dosage_note ?? null
        });
      }
    });
    tx();
    return { ok: true };
  });

  ipcMain.handle('cases.updateMethod', (_e, { case_id, method_code }) => {
    if (!case_id || !method_code) throw new Error('case_id und method_code erforderlich.');
    dbPersonal.prepare(`UPDATE cases SET method_code=? WHERE id=?`).run(method_code, case_id);
    return { ok: true };
  });

  // cases.create hattest du schon – der Handler darf optional primary_problem_code/target_description entgegennehmen.
});
