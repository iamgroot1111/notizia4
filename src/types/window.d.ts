// src/types/window.d.ts
export {};

declare global {
  type Gender = "m" | "w" | "d" | "u";
  type CatalogItem = { code: string; label: string };

  // -------- Clients
  type Client = {
    id: number;
    full_name: string;
    gender: Gender | null;
    dob: string | null;
    contact: string | null;
  };

  // -------- Cases (Fall / Anamnese)
  type CaseRow = {
    id: number;
    client_id: number;
    method_code: string;
    primary_problem_code: string;
    start_date: string;               // yyyy-mm-dd
    target_description?: string | null;
    age_years_at_start: number | null;
    // optional je nach SELECT:
    sud_start?: number | null;
    problem_duration_months?: number | null;
  };

  type PrevTherapy = {
    therapy_type_code: string;
    since_month: string | null;       // yyyy-mm (oder null)
    duration_months: number | null;
    is_completed: boolean;
    note: string | null;
  };

  type Medication = {
    med_code: string;
    since_month: string | null;       // yyyy-mm (oder null)
    dosage_note: string | null;
  };

  type CaseFull = CaseRow & {
    sud_current: number | null;
    problem_since_month: string | null;
    previous_therapies: PrevTherapy[];
    medications: Medication[];
  };

  // -------- Sessions (Sitzungen)
  type SessionRow = {
    id: number;
    case_id: number;
    date: string;                     // ISO
    topic: string | null;
    sud_session: number | null;
    duration_min: number | null;
    method_code_session?: string | null;
    change_note?: string | null;
    new_problem_code?: string | null;
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
            primary_problem_code?: string | null;
            method_code?: string | null;
            target_description?: string | null;
            sud_start?: number | null;
            problem_duration_months?: number | null;
          } | null;
        }): Promise<{ id: number; case_id?: number | undefined }>;
        update(patch: Partial<{
          id: number; full_name: string; gender: Gender | null; dob: string | null; contact: string | null;
        }>): Promise<{ ok: true }>;
        delete(id: number): Promise<{ ok: true }>;
      };

      cases: {
        listByClient(clientId: number): Promise<CaseRow[]>;
        readFull(caseId: number): Promise<CaseFull | null>;
        create(p: {
          client_id: number;
          method_code?: string;
          primary_problem_code?: string;
          start_date?: string; // yyyy-mm-dd
          target_description?: string | null;
          sud_start?: number | null;
          problem_duration_months?: number | null;
          age_years_at_start?: number | null;
        }): Promise<{ id: number }>;
        update(patch: Partial<{
          id: number;
          method_code: string;
          primary_problem_code: string;
          start_date: string;
          target_description: string | null;
          sud_start: number | null;
          problem_duration_months: number | null;
          age_years_at_start: number | null;
        }>): Promise<{ ok: true }>;
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
        delete(id: number): Promise<{ ok: true }>;
      };

      sessions: {
        listByCase(caseId: number): Promise<SessionRow[]>;
        create(p: {
          case_id: number;
          date?: string;
          topic?: string | null;
          sud_session?: number | null;
          duration_min?: number | null;
          method_code_session?: string | null;
          change_note?: string | null;
          new_problem_code?: string | null;
          note?: string | null;
        }): Promise<{ id: number }>;
        update(patch: Partial<{
          id: number;
          date: string;
          topic: string | null;
          sud_session: number | null;
          duration_min: number | null;
          method_code_session: string | null;
          change_note: string | null;
          new_problem_code: string | null;
          note: string | null;
        }>): Promise<{ ok: true }>;
        delete(id: number): Promise<{ ok: true }>;
      };

      catalog: {
        therapyMethods(): Promise<CatalogItem[]>;
        problemCategories(): Promise<CatalogItem[]>;
        previousTherapyTypes(): Promise<CatalogItem[]>;
        medicationCatalog(): Promise<CatalogItem[]>;
      };
    };
  }
}
