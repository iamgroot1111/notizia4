# Notizia – Heilerfolge sichtbar machen

Offline‑fähige Desktop‑App (Electron + React + SQLite) zur **einheitlichen Dokumentation** von
Klienten‑ und Therapiesitzungen mit **Grundauswertungen** und vorbereitetem **Export**.
Die App speichert alle Daten lokal und funktioniert ohne Internet. :contentReference[oaicite:2]{index=2}

> UI‑Leitidee & Navigation orientieren sich an den Mockups („Klienten“, „Sitzungen“, Auswertungen). :contentReference[oaicite:3]{index=3}

---

## ✨ Funktionsumfang (aktueller Stand)

- **Klientenverwaltung (CRUD)**: Anlegen, Suchen/Filtern, Bearbeiten, Löschen. Pflichtfelder:
  `full_name`, `gender (m|w|d|u)`.  
  (*w* = weiblich, *m* = männlich, *d* = divers, *u* = unbekannt)
- **Anamnese pro Fall (Case)** – im Detailbereich eines Klienten:
  - Methode, primäres Problem, Ziel (Text)
  - **Alter (Start)** als `age_years_at_start`
  - **SUD**: Start/aktuell
  - **Seit wann** belastend (`problem_since_month`), **Dauer** in Monaten
  - **Bisherige Therapien** (Typ, *seit wann*, *Dauer*, *abgeschlossen*, Notiz)
  - **Medikamente** (Code, *seit wann*, Dosierung/Notiz)
  - Speichern / Bearbeiten / Löschen der Anamnese
- **Sitzungen (CRUD)** pro Fall:
  - Datum, Thema, SUD (Sitzung), Dauer (Min.)
  - **Methoden‑Override für die Sitzung**, **Veränderungen seit letzter Sitzung**,
    **neues Problem** (Code) sowie optionale Notiz
  - Tabellarische Anzeige mit Inline‑Bearbeitung
- **Lokale Speicherung** in SQLite, robust via Migrationen (siehe unten)  
- **Grundlegende Filter/Suche** (Name/Teile des Namens)
- **Vorbereitung Export & interne Auswertungen** (folgt als nächster Schritt). :contentReference[oaicite:4]{index=4}

---

## 🧩 Tech‑Stack

- **Frontend**: React + TypeScript + Vite
- **Desktop**: Electron (Context Isolation + Preload‑Bridge)
- **Datenbank**: SQLite (via `better-sqlite3`, WAL‑Modus)
- **Typsichere IPC‑Bridge**: Deklarationen in `src/types/window.d.ts`
- **Migrations**: SQL‑Dateien unter `sql/personal` (automatisch ausgeführt)

---

## 🚀 Schnellstart (Entwicklung)

### Voraussetzungen
- Node.js ≥ 20 (empfohlen; getestet mit Node 22)
- Windows 10/11 (andere OS prinzipiell möglich)
- Optional: *DB Browser for SQLite* zum Nachsehen (nicht parallel offen lassen)

### Setup & Start
```bash
npm install
npm run dev
