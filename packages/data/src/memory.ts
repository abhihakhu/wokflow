import type { Collection, WokflowStore } from './repository.js';

/** In-memory collection. Used by tests, the browser dev build, and as a reference adapter. */
export function createMemoryCollection<T extends { id: string }>(seed: T[] = []): Collection<T> {
  const items = new Map<string, T>(seed.map((item) => [item.id, structuredClone(item)]));
  return {
    async get(id) {
      const item = items.get(id);
      return item ? structuredClone(item) : undefined;
    },
    async list(where) {
      const all = [...items.values()].map((item) => structuredClone(item));
      return where ? all.filter(where) : all;
    },
    async put(item) {
      items.set(item.id, structuredClone(item));
      return structuredClone(item);
    },
    async remove(id) {
      return items.delete(id);
    },
  };
}

export type StoreSeed = Partial<{
  [K in keyof WokflowStore]: WokflowStore[K] extends Collection<infer T> ? T[] : never;
}>;

export function createMemoryStore(seed: StoreSeed = {}): WokflowStore {
  return {
    tasks: createMemoryCollection(seed.tasks),
    recipes: createMemoryCollection(seed.recipes),
    sessions: createMemoryCollection(seed.sessions),
    parkingLot: createMemoryCollection(seed.parkingLot),
    inventory: createMemoryCollection(seed.inventory),
  };
}
