import { useState } from "react";

export type PrevTherapy = { therapy_type_code: string; duration_months?: number | null; note?: string | null };
export type Medication = { med_code: string; since_month?: number | null; dosage_note?: string | null };

export type Anamnesis = {
  primary_problem_code?: string;
  target_description?: string;
  previous_therapies: PrevTherapy[];
  medications: Medication[];
};

const PROBLEMS: { code: string; label: string }[] = [
  { code: "UEBERGEWICHT", label: "Übergewicht" },
  { code: "SOCIAL_ANXIETY", label: "Soziale Angst" },
  { code: "PANIK", label: "Panik" },
  { code: "DEPRESSION", label: "Depression" },
  { code: "SLEEP", label: "Schlafproblem" },
  { code: "PAIN", label: "Schmerzen" },
  { code: "SELBSTWERT", label: "Selbstwert" },
  { code: "RELATIONSHIP", label: "Beziehungen" },
  { code: "UNSPEC", label: "Sonstige" }
];

const PREV_THERAPY_TYPES = [
  { code: "VERHALTENSTHERAPIE", label: "Verhaltenstherapie" },
  { code: "GESPRACH",            label: "Gesprächstherapie" },
  { code: "HYPNOSE",             label: "Hypnose" },
  { code: "UNSPEC",              label: "Unbestimmt" }
];

const MEDS = [
  { code: "SSRI",         label: "SSRI" },
  { code: "BENZO",        label: "Benzodiazepine" },
  { code: "NEUROLEPTIKA", label: "Neuroleptika" },
  { code: "NONE",         label: "Keine/Unbekannt" }
];

export default function AnamnesisEditor(props: {
  value: Anamnesis;
  onChange: (a: Anamnesis) => void;
}) {
  const { value, onChange } = props;
  const [open, setOpen] = useState(true);

  const set = (patch: Partial<Anamnesis>) => onChange({ ...value, ...patch });

  return (
    <fieldset className="n4-card" style={{ marginTop: 12 }}>
      <legend style={{ fontWeight: 700, cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
        Anamnese {open ? "▾" : "▸"} <span style={{ opacity: .6, fontWeight: 400 }}>(optional)</span>
      </legend>
      {open && (
        <div className="n4-panel">
          <div className="n4-row">
            <label>
              Problem
              <select
                value={value.primary_problem_code ?? ""}
                onChange={e => set({ primary_problem_code: e.target.value || undefined })}
              >
                <option value="">– auswählen –</option>
                {PROBLEMS.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
              </select>
            </label>
            <label style={{ flex: 1 }}>
              Ziel (Wunsch des Klienten)
              <input
                value={value.target_description ?? ""}
                onChange={e => set({ target_description: e.target.value })}
                placeholder="z. B. angstfrei im Alltag, besser schlafen …"
              />
            </label>
          </div>

          <h4 style={{ marginBottom: 6 }}>Bisherige Therapien</h4>
          {value.previous_therapies.map((t, i) => (
            <div className="n4-row" key={i}>
              <label>
                Therapie
                <select
                  value={t.therapy_type_code}
                  onChange={e => {
                    const arr = [...value.previous_therapies];
                    arr[i] = { ...arr[i], therapy_type_code: e.target.value };
                    set({ previous_therapies: arr });
                  }}
                >
                  {PREV_THERAPY_TYPES.map(pt => <option key={pt.code} value={pt.code}>{pt.label}</option>)}
                </select>
              </label>
              <label>
                Dauer (Monate)
                <input type="number" min={0} value={t.duration_months ?? ""} onChange={e => {
                  const arr = [...value.previous_therapies];
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  arr[i] = { ...arr[i], duration_months: v };
                  set({ previous_therapies: arr });
                }} />
              </label>
              <label style={{ flex: 1 }}>
                Notiz
                <input value={t.note ?? ""} onChange={e => {
                  const arr = [...value.previous_therapies];
                  arr[i] = { ...arr[i], note: e.target.value };
                  set({ previous_therapies: arr });
                }} />
              </label>
              <button type="button" onClick={() => {
                const arr = [...value.previous_therapies];
                arr.splice(i, 1);
                set({ previous_therapies: arr });
              }}>Entfernen</button>
            </div>
          ))}
          <button type="button" onClick={() => set({ previous_therapies: [...value.previous_therapies, { therapy_type_code: "UNSPEC" }] })}>
            + Therapie hinzufügen
          </button>

          <h4 style={{ marginBottom: 6, marginTop: 12 }}>Medikation</h4>
          {value.medications.map((m, i) => (
            <div className="n4-row" key={i}>
              <label>
                Medikament
                <select
                  value={m.med_code}
                  onChange={e => {
                    const arr = [...value.medications];
                    arr[i] = { ...arr[i], med_code: e.target.value };
                    set({ medications: arr });
                  }}
                >
                  {MEDS.map(md => <option key={md.code} value={md.code}>{md.label}</option>)}
                </select>
              </label>
              <label>
                Seit (Monat)
                <input type="number" min={0} value={m.since_month ?? ""} onChange={e => {
                  const arr = [...value.medications];
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  arr[i] = { ...arr[i], since_month: v };
                  set({ medications: arr });
                }} />
              </label>
              <label style={{ flex: 1 }}>
                Notiz/Dosierung
                <input value={m.dosage_note ?? ""} onChange={e => {
                  const arr = [...value.medications];
                  arr[i] = { ...arr[i], dosage_note: e.target.value };
                  set({ medications: arr });
                }} />
              </label>
              <button type="button" onClick={() => {
                const arr = [...value.medications];
                arr.splice(i, 1);
                set({ medications: arr });
              }}>Entfernen</button>
            </div>
          ))}
          <button type="button" onClick={() => set({ medications: [...value.medications, { med_code: "NONE" }] })}>
            + Medikament hinzufügen
          </button>
        </div>
      )}
    </fieldset>
  );
}
