/* src/types/window.d.ts */

declare global {
  type Gender = "m" | "w" | "d" | "u";

  interface CatalogItem {
    code: string;
    label: string;
  }

  interface Client {
    id: number;
    full_name: string;
    gender: Gender;
    dob: string | null;
  }

  interface CaseRow {
    id: number;
    client_id: number;
    method_code: string;
    primary_problem_code: string;
    start_date: string; // ISO yyyy-mm-dd
    age_years_at_start: number | null;
  }

  interface PrevTherapy {
    therapy_type_code: string;
    since_month: string | null; // YYYY-MM
    duration_months: number | null;
    is_completed: boolean;
    note: string | null;
  }

  interface Medication {
    med_code: string;
    since_month: string | null; // YYYY-MM
    dosage_note: string | null;
  }

  interface CaseFull extends CaseRow {
    target_description: string | null;
    sud_start: number | null;
    problem_since_month: string | null; // YYYY-MM
    problem_duration_months: number | null;
    previous_therapies: PrevTherapy[];
    medications: Medication[];
    /** berechnet aus letzter Sitzung */
    sud_current: number | null;
  }

  interface SessionRow {
    id: number;
    case_id: number;
    date: string; // ISO
    topic: string | null;
    sud_session: number | null;
    duration_min: number | null;
  }

  type ReportSource = "personal" | "study";
  type ReportStatus = "current" | "closed";

  type ReportMethodProblemRow = {
    method_code: string;
    method_label: string;
    problem_code: string;
    problem_label: string;
    status: "current" | "closed";
    cases_n: number;
    avg_sessions: number | null;
    avg_sud_start: number | null;
    avg_sud_last: number | null;
    avg_sud_delta: number | null;
    pct_prev_therapies: number | null;
    avg_prev_duration_mon: number | null;
    pct_m: number | null;
    pct_w: number | null;
    pct_d: number | null;
    pct_u: number | null;
  };

  interface Window {
    api: {
      clients: {
        list(): Promise<Client[]>;
        create(p: {
          full_name: string;
          gender: Gender;
          dob?: string | null;
          contact?: string | null;
          intake?: {
            age_years_at_start?: number | null;
            method_code?: string | null;
            primary_problem_code?: string | null;
            target_description?: string | null;
            sud_start?: number | null;
            problem_since_month?: string | null;
            problem_duration_months?: number | null;
            previous_therapies?: PrevTherapy[];
            medications?: Medication[];
          } | null;
        }): Promise<{ id: number }>;
        update(patch: {
          id: number;
          full_name?: string;
          gender?: Gender;
          dob?: string | null;
          contact?: string | null;
        }): Promise<{ ok: true }>;
        delete(id: number): Promise<{ ok: true }>;
      };

      cases: {
        listByClient(id: number): Promise<CaseRow[]>;
        readFull(id: number): Promise<CaseFull | null>;
        create(p: {
          client_id: number;
          method_code?: string;
          primary_problem_code?: string;
          start_date?: string; // ISO
          age_years_at_start?: number | null;
        }): Promise<{ id: number }>;
        saveAnamnesis(p: {
          case_id: number;
          method_code?: string | null;
          primary_problem_code?: string | null;
          target_description?: string | null;
          sud_start?: number | null;
          sud_current?: number | null;
          problem_since_month?: string | null;
          problem_duration_months?: number | null;
          age_years_at_start?: number | null;
          previous_therapies?: PrevTherapy[];
          medications?: Medication[];
        }): Promise<{ ok: true }>;
        updateMethod(p: {
          case_id: number;
          method_code: string;
        }): Promise<{ ok: true }>;
        delete(id: number): Promise<{ ok: true }>;
      };

      sessions: {
        listByCase(id: number): Promise<SessionRow[]>;
        create(p: {
          case_id: number;
          date?: string;
          topic?: string | null;
          sud_session?: number | null;
          duration_min?: number | null;
          note?: string | null;
        }): Promise<{ id: number }>;
        update(p: {
          id: number;
          topic?: string | null;
          sud_session?: number | null;
          duration_min?: number | null;
        }): Promise<{ ok: true }>;
        delete(id: number): Promise<{ ok: true }>;
      };

      catalog: {
        therapyMethods(): Promise<CatalogItem[]>;
        problemCategories(): Promise<CatalogItem[]>;
        previousTherapyTypes(): Promise<CatalogItem[]>;
        medicationCatalog(): Promise<CatalogItem[]>;
      };

      reports: {
        methodProblem(p: {
          source: "personal" | "study";
        }): Promise<ReportMethodProblemRow[]>;
      };

      export: {
        study: {
          toCsv(): Promise<{ path: string }>;
        };
      };
      maintenance: {
        recalcProblemDurations(): Promise<{ updated: number }>;
      };
    };
  }
}

export type ReportMethodProblemRow = {
  method_code: string;
  method_label: string;
  problem_code: string;
  problem_label: string;
  status: 'current' | 'closed';
  cases_n: number;
  avg_sessions: number | null;
  avg_sud_start: number | null;
  avg_sud_last: number | null;
  avg_sud_delta: number | null;
  pct_prev_therapies: number | null;
  avg_prev_duration_mon: number | null;
  pct_m: number | null;
  pct_w: number | null;
  pct_d: number | null;
  pct_u: number | null;
};
