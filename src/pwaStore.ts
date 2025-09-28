import Dexie from "dexie";
import type { Table } from "dexie";                 // type-only (wegen verbatimModuleSyntax)
import type { Store, Client } from "./storeTypes";

type ClientRow = Omit<Client, "id"> & { id?: number };

class DB extends Dexie {
  clients!: Table<ClientRow, number>;
  constructor() {
    super("notiziaPwa");
    this.version(1).stores({ clients: "++id, full_name, gender" });
  }
}
const db = new DB();

export const pwaStore: Store = {
  clients: {
    async list(): Promise<Client[]> {
      const rows = await db.clients.orderBy("full_name").toArray();
      return rows.map(r => ({
        id: r.id!, full_name: r.full_name, gender: r.gender,
        dob: r.dob ?? null, contact: r.contact ?? null
      }));
    },
    async create(
      p: { full_name: string; gender: Client["gender"]; dob?: string | null; contact?: string | null }
    ): Promise<{ id: number }> {
      const id = await db.clients.add({
        full_name: p.full_name, gender: p.gender, dob: p.dob ?? null, contact: p.contact ?? null
      });
      return { id };
    },
    async update(p: Partial<Client> & { id: number }): Promise<{ ok: true }> {
      await db.clients.update(p.id, p);
      return { ok: true };
    },
    async delete(id: number): Promise<{ ok: true }> {
      await db.clients.delete(id);
      return { ok: true };
    },
  },
};
