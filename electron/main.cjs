/* electron/main.cjs */
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const Database = require("better-sqlite3");

let win;
let dbPersonal;
let dbStudy;

/* ========== Helpers ========== */
function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (!app.isPackaged) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

function runMigrations(db, dir) {
  if (!fs.existsSync(dir)) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT UNIQUE NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const seen = db.prepare("SELECT 1 FROM _migrations WHERE filename=?");
  const mark = db.prepare("INSERT INTO _migrations(filename) VALUES (?)");

  for (const file of files) {
    if (seen.get(file)) {
      console.log("[migration] skip", file);
      continue;
    }
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    db.exec("BEGIN");
    try {
      console.log("[migration] apply", file);
      db.exec(sql);
      mark.run(file);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      console.error("[migration] FAILED in", file, e);
      throw e;
    }
  }
}

/** idempotent: Spalte hinzufügen */
function addColumnIfMissing(db, table, columnDef) {
  const col = String(columnDef).trim().split(/\s+/, 1)[0];
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
    console.log(`[ddl] add ${table}.${col}`);
  }
}

/** Utils */
function monthsBetweenYM(sinceYYYYMM, refISO) {
  if (!sinceYYYYMM) return null;
  const [sy, sm] = String(sinceYYYYMM)
    .split("-")
    .map((n) => parseInt(n, 10));
  if (!sy || !sm) return null;
  const ref = refISO ? new Date(refISO) : new Date();
  const diff = (ref.getFullYear() - sy) * 12 + (ref.getMonth() + 1 - sm);
  return Math.max(0, diff);
}
function toMonth(iso) {
  return iso ? String(iso).slice(0, 7) : null;
}
function uidForCase(caseId) {
  return crypto
    .createHash("sha1")
    .update("notizia|case|" + caseId)
    .digest("hex");
}

/* ========== Reporting-SQL (ohne Views) ========== */
/** Aggregation pro Fall + Aufsummierung Methode×Problem×Status */
const METHOD_PROBLEM_SQL = `
WITH case_base AS (
  SELECT c.id AS case_id, c.client_id,
         c.method_code,
         c.primary_problem_code AS problem_code,
         CASE WHEN c.closed_at IS NULL THEN 'current' ELSE 'closed' END AS status
  FROM cases c
),
sr AS (
  SELECT s.case_id,
         COUNT(*) AS sessions_count,
         (SELECT sud_session FROM sessions s1
            WHERE s1.case_id = s.case_id
            ORDER BY s1.date ASC, s1.id ASC LIMIT 1) AS sud_start,
         (SELECT sud_session FROM sessions s2
            WHERE s2.case_id = s.case_id
            ORDER BY s2.date DESC, s2.id DESC LIMIT 1) AS sud_last
  FROM sessions s
  GROUP BY s.case_id
),
prev AS (
  SELECT cp.case_id,
         1 AS has_prev,
         SUM(COALESCE(cp.duration_months,0)) AS prev_months
  FROM case_previous_therapies cp
  GROUP BY cp.case_id
),
gen AS (
  SELECT c.id AS case_id, cl.gender
  FROM cases c JOIN clients cl ON cl.id = c.client_id
),
per_case AS (
  SELECT
    cb.method_code, cb.problem_code, cb.status,
    g.gender,
    COALESCE(sr.sessions_count,0) AS sessions_count,
    sr.sud_start, sr.sud_last,
    CASE WHEN sr.sud_start IS NOT NULL AND sr.sud_last IS NOT NULL
         THEN sr.sud_last - sr.sud_start END AS sud_delta,
    CASE WHEN p.has_prev IS NULL THEN 0 ELSE 1 END AS has_prev,
    COALESCE(p.prev_months,0) AS prev_months
  FROM case_base cb
  LEFT JOIN sr   ON sr.case_id = cb.case_id
  LEFT JOIN prev p ON p.case_id = cb.case_id
  LEFT JOIN gen  g ON g.case_id = cb.case_id
),
agg AS (
  SELECT
    method_code, problem_code, status,
    COUNT(*) AS cases_count,
    SUM(sessions_count) AS sessions_count,
    AVG(NULLIF(sessions_count,0)) AS avg_sessions,
    AVG(sud_start) AS avg_sud_start,
    AVG(sud_last)  AS avg_sud_last,
    AVG(sud_delta) AS avg_sud_delta,
    AVG(has_prev) * 100.0 AS prev_therapies_share,
    AVG(prev_months * 1.0) AS prev_therapies_avg_months,
    SUM(CASE WHEN gender='m' THEN 1 ELSE 0 END) AS genders_m,
    SUM(CASE WHEN gender='w' THEN 1 ELSE 0 END) AS genders_w,
    SUM(CASE WHEN gender='d' THEN 1 ELSE 0 END) AS genders_d,
    SUM(CASE WHEN gender='u' THEN 1 ELSE 0 END) AS genders_u
  FROM per_case
  GROUP BY method_code, problem_code, status
)
SELECT
  a.method_code,
  (SELECT label FROM therapy_methods       WHERE code=a.method_code)  AS method_label,
  a.problem_code,
  (SELECT label FROM problem_categories    WHERE code=a.problem_code) AS problem_label,
  a.status,
  a.cases_count, a.sessions_count, a.avg_sessions,
  ROUND(a.avg_sud_start,2) AS avg_sud_start,
  ROUND(a.avg_sud_last,2)  AS avg_sud_last,
  ROUND(a.avg_sud_delta,2) AS avg_sud_delta,
  ROUND(a.prev_therapies_share,1)      AS prev_therapies_share,
  ROUND(a.prev_therapies_avg_months,1) AS prev_therapies_avg_months,
  a.genders_m, a.genders_w, a.genders_d, a.genders_u
FROM agg a
ORDER BY method_label, problem_label, status;
`;

/* ========== App init ========== */
app.whenReady().then(() => {
  const base = app.getPath("userData"); // z. B. %APPDATA%/notizia4

  dbPersonal = new Database(path.join(base, "personal.sqlite"));
  dbStudy = new Database(path.join(base, "study.sqlite"));
  dbPersonal.pragma("journal_mode = WAL");
  dbStudy.pragma("journal_mode = WAL");

  // optionale (idempotente) Schutzspalten
  addColumnIfMissing(dbPersonal, "cases", "target_description TEXT");
  addColumnIfMissing(dbPersonal, "cases", "sud_start REAL");
  addColumnIfMissing(dbPersonal, "cases", "problem_since_month TEXT");
  addColumnIfMissing(dbPersonal, "cases", "problem_duration_months INTEGER");
  addColumnIfMissing(dbPersonal, "cases", "age_years_at_start INTEGER");
  addColumnIfMissing(dbPersonal, "cases", "closed_at TEXT");

  // Migrationen (legt auch Views wie v_method_problem_stats an)
  runMigrations(dbPersonal, path.join(__dirname, "../sql/personal"));
  runMigrations(dbStudy, path.join(__dirname, "../sql/study"));

  /* ---------- Helper zum Befüllen der Study-DB ---------- */
  function refreshStudyAgg() {
    const rows = dbPersonal.prepare(METHOD_PROBLEM_SQL).all();
    dbStudy.exec(`
      BEGIN;
      CREATE TABLE IF NOT EXISTS study_agg_method_problem (
        method_code TEXT, method_label TEXT,
        problem_code TEXT, problem_label TEXT,
        status TEXT CHECK (status IN ('current','closed')),
        cases_count INTEGER, sessions_count INTEGER, avg_sessions REAL,
        avg_sud_start REAL, avg_sud_last REAL, avg_sud_delta REAL,
        prev_therapies_share REAL, prev_therapies_avg_months REAL,
        genders_m INTEGER, genders_w INTEGER, genders_d INTEGER, genders_u INTEGER
      );
      DELETE FROM study_agg_method_problem;
      COMMIT;
    `);
    const ins = dbStudy.prepare(`
      INSERT INTO study_agg_method_problem
      (method_code, method_label, problem_code, problem_label, status,
       cases_count, sessions_count, avg_sessions,
       avg_sud_start, avg_sud_last, avg_sud_delta,
       prev_therapies_share, prev_therapies_avg_months,
       genders_m, genders_w, genders_d, genders_u)
      VALUES (@method_code, @method_label, @problem_code, @problem_label, @status,
              @cases_count, @sessions_count, @avg_sessions,
              @avg_sud_start, @avg_sud_last, @avg_sud_delta,
              @prev_therapies_share, @prev_therapies_avg_months,
              @genders_m, @genders_w, @genders_d, @genders_u)
    `);
    const tx = dbStudy.transaction((items) => {
      for (const r of items) ins.run(r);
    });
    tx(rows);
    return { inserted: rows.length };
  }

  /* ========== IPC: CLIENTS ========== */
  ipcMain.handle("clients.list", () => {
    return dbPersonal
      .prepare(
        `
      SELECT id, full_name, gender, dob
      FROM clients
      ORDER BY full_name COLLATE NOCASE
    `
      )
      .all();
  });

  ipcMain.handle("clients.create", (_e, payload = {}) => {
    const {
      full_name,
      gender,
      dob = null,
      contact = null,
      intake = null,
    } = payload;
    if (!full_name || !String(full_name).trim())
      throw new Error("full_name ist Pflichtfeld.");
    if (!gender || !["m", "w", "d", "u"].includes(String(gender)))
      throw new Error("gender (m|w|d|u) ist Pflicht.");

    const info = dbPersonal
      .prepare(
        `
      INSERT INTO clients(full_name, gender, dob, contact) VALUES (?, ?, ?, ?)
    `
      )
      .run(String(full_name).trim(), gender, dob, contact);
    const clientId = Number(info.lastInsertRowid);

    // optional: ersten Fall direkt anlegen
    if (
      intake &&
      (intake.age_years_at_start != null ||
        intake.method_code ||
        intake.primary_problem_code)
    ) {
      const method_code = intake.method_code || "AUFLOESENDE_HYPNOSE";
      const primary_problem_code = intake.primary_problem_code || "UNSPEC";
      const start_date = new Date().toISOString().slice(0, 10);
      dbPersonal
        .prepare(
          `
        INSERT INTO cases(client_id, method_code, primary_problem_code, start_date, age_years_at_start)
        VALUES (?, ?, ?, ?, ?)
      `
        )
        .run(
          clientId,
          method_code,
          primary_problem_code,
          start_date,
          intake.age_years_at_start ?? null
        );
    }
    return { id: clientId };
  });

  ipcMain.handle("clients.update", (_e, p = {}) => {
    const {
      id,
      full_name = null,
      gender = null,
      dob = undefined,
      contact = undefined,
    } = p;
    if (!id) throw new Error("id fehlt.");
    dbPersonal
      .prepare(
        `
      UPDATE clients
         SET full_name = COALESCE(@full_name, full_name),
             gender    = COALESCE(@gender, gender),
             dob       = CASE WHEN @dob     IS NULL THEN dob     ELSE @dob     END,
             contact   = CASE WHEN @contact IS NULL THEN contact ELSE @contact END
       WHERE id=@id
    `
      )
      .run({ id, full_name, gender, dob, contact });
    return { ok: true };
  });

  ipcMain.handle("clients.delete", (_e, id) => {
    dbPersonal
      .prepare(
        `DELETE FROM session_notes WHERE session_id IN (SELECT id FROM sessions WHERE case_id IN (SELECT id FROM cases WHERE client_id=?))`
      )
      .run(id);
    dbPersonal
      .prepare(
        `DELETE FROM sessions WHERE case_id IN (SELECT id FROM cases WHERE client_id=?)`
      )
      .run(id);
    dbPersonal
      .prepare(
        `DELETE FROM case_previous_therapies WHERE case_id IN (SELECT id FROM cases WHERE client_id=?)`
      )
      .run(id);
    dbPersonal
      .prepare(
        `DELETE FROM case_medications     WHERE case_id IN (SELECT id FROM cases WHERE client_id=?)`
      )
      .run(id);
    dbPersonal.prepare(`DELETE FROM cases WHERE client_id=?`).run(id);
    dbPersonal.prepare(`DELETE FROM clients WHERE id=?`).run(id);
    return { ok: true };
  });

  /* ========== IPC: CASES ========== */
  ipcMain.handle("cases.listByClient", (_e, clientId) => {
    return dbPersonal
      .prepare(
        `
      SELECT id, client_id, method_code, primary_problem_code, start_date, age_years_at_start
      FROM cases
      WHERE client_id=?
      ORDER BY id DESC
    `
      )
      .all(clientId);
  });

  ipcMain.handle("cases.readFull", (_e, caseId) => {
    const c = dbPersonal
      .prepare(
        `
      SELECT id, client_id, method_code, primary_problem_code, start_date,
             target_description, sud_start, problem_since_month, problem_duration_months,
             age_years_at_start
      FROM cases WHERE id=?
    `
      )
      .get(caseId);
    if (!c) return null;

    const prev = dbPersonal
      .prepare(
        `
      SELECT therapy_type_code, since_month, duration_months, is_completed, note
      FROM case_previous_therapies WHERE case_id=?
      ORDER BY rowid
    `
      )
      .all(caseId);

    const meds = dbPersonal
      .prepare(
        `
      SELECT med_code, since_month, dosage_note
      FROM case_medications WHERE case_id=?
      ORDER BY rowid
    `
      )
      .all(caseId);

    const lastSud =
      dbPersonal
        .prepare(
          `
      SELECT sud_session FROM sessions WHERE case_id=?
      ORDER BY date DESC, id DESC LIMIT 1
    `
        )
        .get(caseId)?.sud_session ?? null;

    return {
      ...c,
      previous_therapies: prev,
      medications: meds,
      sud_current: lastSud,
    };
  });

  ipcMain.handle("cases.create", (_e, payload = {}) => {
    const {
      client_id,
      method_code = "AUFLOESENDE_HYPNOSE",
      primary_problem_code = "UNSPEC",
      start_date = new Date().toISOString().slice(0, 10),
      age_years_at_start = null,
    } = payload;
    if (!client_id) throw new Error("client_id fehlt.");
    const info = dbPersonal
      .prepare(
        `
      INSERT INTO cases(client_id, method_code, primary_problem_code, start_date, age_years_at_start)
      VALUES (?, ?, ?, ?, ?)
    `
      )
      .run(
        client_id,
        method_code,
        primary_problem_code,
        start_date,
        age_years_at_start
      );
    return { id: Number(info.lastInsertRowid) };
  });

  ipcMain.handle("cases.saveAnamnesis", (_e, payload = {}) => {
    const {
      case_id,
      method_code = null,
      primary_problem_code = null,
      target_description = null,
      sud_start = null,
      sud_current = null,
      problem_since_month = null,
      problem_duration_months = null,
      age_years_at_start = null,
      previous_therapies = [],
      medications = [],
    } = payload;
    if (!case_id) throw new Error("case_id fehlt.");

    dbPersonal.exec("BEGIN");
    try {
      const ref =
        dbPersonal
          .prepare(`SELECT start_date FROM cases WHERE id=?`)
          .get(case_id)?.start_date ?? null;
      const calcMonths = problem_since_month
        ? monthsBetweenYM(problem_since_month, ref)
        : null;

      dbPersonal
        .prepare(
          `
        UPDATE cases SET
          method_code            = COALESCE(@method_code,           method_code),
          primary_problem_code   = COALESCE(@primary_problem_code,  primary_problem_code),
          target_description     = COALESCE(@target_description,    target_description),
          sud_start              = COALESCE(@sud_start,             sud_start),
          problem_since_month    = COALESCE(@problem_since_month,   problem_since_month),
          problem_duration_months= COALESCE(@problem_duration_months, problem_duration_months),
          age_years_at_start     = COALESCE(@age_years_at_start,    age_years_at_start)
        WHERE id=@case_id
      `
        )
        .run({
          case_id,
          method_code,
          primary_problem_code,
          target_description,
          sud_start,
          problem_since_month,
          problem_duration_months: problem_duration_months ?? calcMonths,
          age_years_at_start,
        });

      dbPersonal
        .prepare(`DELETE FROM case_previous_therapies WHERE case_id=?`)
        .run(case_id);
      const insPT = dbPersonal.prepare(`
        INSERT INTO case_previous_therapies(case_id, therapy_type_code, since_month, duration_months, is_completed, note)
        VALUES (@case_id, @therapy_type_code, @since_month, @duration_months, @is_completed, @note)
      `);
      for (const t of previous_therapies) {
        insPT.run({
          case_id,
          therapy_type_code: t.therapy_type_code,
          since_month: t.since_month ?? null,
          duration_months: t.duration_months ?? null,
          is_completed: t.is_completed ? 1 : 0,
          note: t.note ?? null,
        });
      }

      dbPersonal
        .prepare(`DELETE FROM case_medications WHERE case_id=?`)
        .run(case_id);
      const insMed = dbPersonal.prepare(`
        INSERT INTO case_medications(case_id, med_code, since_month, dosage_note)
        VALUES (@case_id, @med_code, @since_month, @dosage_note)
      `);
      for (const m of medications) {
        insMed.run({
          case_id,
          med_code: m.med_code,
          since_month: m.since_month ?? null,
          dosage_note: m.dosage_note ?? null,
        });
      }

      dbPersonal.exec("COMMIT");
      return { ok: true };
    } catch (e) {
      dbPersonal.exec("ROLLBACK");
      throw e;
    }
  });

  ipcMain.handle("cases.updateMethod", (_e, { case_id, method_code }) => {
    if (!case_id || !method_code)
      throw new Error("case_id und method_code erforderlich.");
    dbPersonal
      .prepare(`UPDATE cases SET method_code=? WHERE id=?`)
      .run(method_code, case_id);
    return { ok: true };
  });

  ipcMain.handle("cases.delete", (_e, caseId) => {
    dbPersonal.exec("BEGIN");
    try {
      dbPersonal
        .prepare(
          `DELETE FROM session_notes WHERE session_id IN (SELECT id FROM sessions WHERE case_id=?)`
        )
        .run(caseId);
      dbPersonal.prepare(`DELETE FROM sessions WHERE case_id=?`).run(caseId);
      dbPersonal
        .prepare(`DELETE FROM case_previous_therapies WHERE case_id=?`)
        .run(caseId);
      dbPersonal
        .prepare(`DELETE FROM case_medications WHERE case_id=?`)
        .run(caseId);
      dbPersonal.prepare(`DELETE FROM cases WHERE id=?`).run(caseId);
      dbPersonal.exec("COMMIT");
      return { ok: true };
    } catch (e) {
      dbPersonal.exec("ROLLBACK");
      throw e;
    }
  });

  /* ========== IPC: SESSIONS ========== */
  ipcMain.handle("sessions.listByCase", (_e, caseId) => {
    return dbPersonal
      .prepare(
        `
      SELECT id, case_id, date, topic, sud_session, duration_min
      FROM sessions WHERE case_id=? ORDER BY date DESC, id DESC
    `
      )
      .all(caseId);
  });

  ipcMain.handle("sessions.create", (_e, payload = {}) => {
    const {
      case_id,
      date = new Date().toISOString(),
      topic = null,
      sud_session = null,
      duration_min = null,
      note = null,
    } = payload;
    if (!case_id) throw new Error("case_id fehlt.");
    const info = dbPersonal
      .prepare(
        `
      INSERT INTO sessions(case_id, date, topic, sud_session, duration_min)
      VALUES (?, ?, ?, ?, ?)
    `
      )
      .run(case_id, date, topic, sud_session, duration_min);
    if (note) {
      dbPersonal
        .prepare(
          `INSERT OR REPLACE INTO session_notes(session_id, content) VALUES (?, ?)`
        )
        .run(info.lastInsertRowid, note);
    }
    return { id: Number(info.lastInsertRowid) };
  });

  ipcMain.handle("sessions.update", (_e, p = {}) => {
    const { id, topic = null, sud_session = null, duration_min = null } = p;
    if (!id) throw new Error("id fehlt.");
    dbPersonal
      .prepare(
        `
      UPDATE sessions SET topic=@topic, sud_session=@sud_session, duration_min=@duration_min WHERE id=@id
    `
      )
      .run({ id, topic, sud_session, duration_min });
    return { ok: true };
  });

  ipcMain.handle("sessions.delete", (_e, id) => {
    dbPersonal.prepare(`DELETE FROM session_notes WHERE session_id=?`).run(id);
    dbPersonal.prepare(`DELETE FROM sessions WHERE id=?`).run(id);
    return { ok: true };
  });

  /* ========== IPC: KATALOGE ========== */
  ipcMain.handle("catalog.therapyMethods", () =>
    dbPersonal
      .prepare(`SELECT code, label FROM therapy_methods ORDER BY label`)
      .all()
  );
  ipcMain.handle("catalog.problemCategories", () =>
    dbPersonal
      .prepare(`SELECT code, label FROM problem_categories ORDER BY label`)
      .all()
  );
  ipcMain.handle("catalog.previousTherapyTypes", () =>
    dbPersonal
      .prepare(`SELECT code, label FROM previous_therapy_types ORDER BY label`)
      .all()
  );
  ipcMain.handle("catalog.medicationCatalog", () =>
    dbPersonal
      .prepare(`SELECT code, label FROM medication_catalog ORDER BY label`)
      .all()
  );

  /* ========== IPC: REPORTS ========== */
  // Eine einheitliche View in BEIDEN Datenbanken: v_method_problem_stats
  ipcMain.handle(
    "reports.methodProblem",
    (_e, { source = "personal" } = {}) => {
      const db = source === "study" ? dbStudy : dbPersonal;
      return db
        .prepare(
          `
      SELECT method_code, method_label,
             problem_code, problem_label,
             status, cases_n, avg_sessions,
             avg_sud_start, avg_sud_last, avg_sud_delta,
             pct_prev_therapies, avg_prev_duration_mon,
             pct_m, pct_w, pct_d, pct_u
      FROM v_method_problem_stats
      ORDER BY method_label, problem_label, status
    `
        )
        .all();
    }
  );

  /* ========== IPC: STUDY-Export & Sync ========== */
  ipcMain.handle("export.study.refresh", () => refreshStudyAgg());

  // CSV-Export (ruft vorher refresh auf) und gibt IMMER { path } zurück
  ipcMain.handle("export.study.toCsv", () => {
    refreshStudyAgg();

    const stats = dbStudy
      .prepare(
        `
      SELECT method_label, problem_label, status,
             cases_n, avg_sessions, avg_sud_start, avg_sud_last, avg_sud_delta,
             pct_prev_therapies, avg_prev_duration_mon,
             pct_m, pct_w, pct_d, pct_u
      FROM v_method_problem_stats
      ORDER BY method_label, problem_label, status
    `
      )
      .all();

    const fmtNum = (v) =>
      v === null || v === undefined || Number.isNaN(v)
        ? "" // leer lassen
        : String(v).replace(/\./g, ","); // Dezimalpunkt -> Komma
    const row = (arr) => arr.join(";");

    const header = [
      "Methode",
      "Problem",
      "Status",
      "Faelle",
      "Ø_Sitzungen",
      "Ø_SUD_Start",
      "Ø_SUD_Letz",
      "Ø_Δ_SUD",
      "%_mit_VorTherapie",
      "Ø_Dauer_VorTherapie_Mon",
      "%_m",
      "%_w",
      "%_d",
      "%_u",
    ];
    const lines = [header.join(";")];
    lines.push("sep=;"); // Excel-Separator-Hinweis
    lines.push(row(header));
    for (const s of stats) {
      lines.push(
        [
          s.method_label,
          s.problem_label,
          s.status,
          fmtNum(s.cases_n),
          fmtNum(s.avg_sessions ?? ""),
          fmtNum(s.avg_sud_start ?? ""),
          fmtNum(s.avg_sud_last ?? ""),
          fmtNum(s.avg_sud_delta ?? ""),
          fmtNum(s.pct_prev_therapies ?? ""),
          fmtNum(s.avg_prev_duration_mon ?? ""),
          fmtNum(s.pct_m ?? ""),
          fmtNum(s.pct_w ?? ""),
          fmtNum(s.pct_d ?? ""),
          fmtNum(s.pct_u ?? ""),
        ].join(";")
      );
    }

    const outPath = path.join(
      app.getPath("documents"),
      `notizia_study_export_${Date.now()}.csv`
    );

    const csv = "\uFEFF" + lines.join("\r\n"); // BOM + CRLF
    fs.writeFileSync(outPath, csv, "utf8");
    return { path: outPath };
  });

  /* ========== IPC: Wartung ========== */
  ipcMain.handle("maintenance.recalcProblemDurations", () => {
    const rows = dbPersonal
      .prepare(
        `
      SELECT id, start_date, problem_since_month, problem_duration_months
      FROM cases
      WHERE problem_since_month IS NOT NULL
    `
      )
      .all();

    const upd = dbPersonal.prepare(`
      UPDATE cases
         SET problem_duration_months = @new_m
       WHERE id = @id
         AND (problem_duration_months IS NULL OR problem_duration_months <> @new_m)
    `);

    let changed = 0;
    dbPersonal.exec("BEGIN");
    try {
      for (const r of rows) {
        const new_m = monthsBetweenYM(r.problem_since_month, r.start_date);
        const res = upd.run({ id: r.id, new_m });
        changed += res.changes | 0;
      }
      dbPersonal.exec("COMMIT");
    } catch (e) {
      dbPersonal.exec("ROLLBACK");
      throw e;
    }
    console.log(`[maintenance] scanned=${rows.length}, changed=${changed}`);
    return { scanned: rows.length, changed };
  });

  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
