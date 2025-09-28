export type Gender = "m" | "w" | "d" | "u";

export type Client = {
  id: number;
  full_name: string;
  gender: Gender;
  dob?: string | null;
  contact?: string | null;
};

export interface Store {
  clients: {
    list(): Promise<Client[]>;
    create(p: { full_name: string; gender: Gender; dob?: string | null; contact?: string | null }): Promise<{ id: number }>;
    update(p: Partial<Client> & { id: number }): Promise<{ ok: true }>;
    delete(id: number): Promise<{ ok: true }>;
  };
}
