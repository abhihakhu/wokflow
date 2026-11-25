import type { InventoryItem, ParkingLotItem, Recipe, Session, Task } from '@wokflow/core';

/**
 * A minimal async collection. Every platform adapter (memory, Tauri SQL,
 * Capacitor SQLite, later Supabase sync) implements this same shape, so the
 * UI and core never know which one they are talking to.
 */
export interface Collection<T extends { id: string }> {
  get(id: string): Promise<T | undefined>;
  list(where?: (item: T) => boolean): Promise<T[]>;
  /** Insert or replace by id. */
  put(item: T): Promise<T>;
  remove(id: string): Promise<boolean>;
}

export interface WokflowStore {
  tasks: Collection<Task>;
  recipes: Collection<Recipe>;
  sessions: Collection<Session>;
  parkingLot: Collection<ParkingLotItem>;
  inventory: Collection<InventoryItem>;
}

/**
 * Everything a shell (desktop / Android) injects into the app.
 * Core and UI depend on this interface, never on Tauri or Capacitor directly.
 */
export interface Platform {
  store: WokflowStore;
  notify(title: string, body: string): Promise<void>;
  /** Subscribe to the app being hidden/backgrounded. Returns an unsubscribe function. */
  onAppHidden(cb: () => void): () => void;
  onAppVisible(cb: () => void): () => void;
}
