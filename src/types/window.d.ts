export {};

type ClientRow = { id: number; code: string; full_name: string; gender?: string | null; age_years?: number | null };
type CaseRow = { id: number; client_id: number; method_code: string; primary_problem_code: string; start_date: string; target_description?: string | null };
type PrevTherapy = { therapy_type_code: string; duration_months?: number | null; note?: string | null };
type Medication = { med_code: string; since_month?: number | null; dosage_note?: string | null };

declare global {
  interface Window {
    api: {
      clients: {
        list: () => Promise<ClientRow[]>;
        create: (data: { full_name: string; gender?: string | null; age_years?: number | null; code?: string | null }) => Promise<{ id: number; code: string }>;
      };
      cases: {
        listByClient: (clientId: number) => Promise<CaseRow[]>;
        create: (data: Partial<CaseRow> & { client_id: number }) => Promise<{ id: number }>;
        readFull: (caseId: number) => Promise<(CaseRow & { previous_therapies: PrevTherapy[]; medications: Medication[] }) | null>;
        saveAnamnesis: (data: {
          case_id: number;
          primary_problem_code?: string | null;
          target_description?: string | null;
          previous_therapies?: PrevTherapy[];
          medications?: Medication[];
        }) => Promise<{ ok: true }>;
        updateMethod: (data: { case_id: number; method_code: string }) => Promise<{ ok: true }>;
      };
      sessions: {
        listByCase: (caseId: number) => Promise<Array<{ id: number; case_id: number; date: string; topic?: string | null; sud_session?: number | null; duration_min?: number | null }>>;
        create: (data: { case_id: number; date?: string; topic?: string | null; sud_session?: number | null; duration_min?: number | null; note?: string | null; }) => Promise<{ id: number }>;
      };
      ping: () => string;
    };
  }
}
