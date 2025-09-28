import type { Store, Client } from "./storeTypes";

export const electronStore: Store = {
  clients: {
    list:   (): Promise<Client[]> => window.api.clients.list(),
    create: (p: { full_name: string; gender: Client["gender"]; dob?: string|null; contact?: string|null }) =>
              window.api.clients.create(p),
    update: (p: Partial<Client> & { id: number }) => window.api.clients.update(p),
    delete: (id: number) => window.api.clients.delete(id),
  },
};
