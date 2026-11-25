import Database from '@tauri-apps/plugin-sql';
import { createSqlStore, type Platform, type SqlDriver } from '@wokflow/data';
import { visibility, webNotify } from './visibility';

/** The database file, created in the app's config directory on first launch. */
export const DB_URL = 'sqlite:wokflow.db';

/** Tauri platform: SQLite via tauri-plugin-sql, migrated on startup. */
export async function createTauriPlatform(): Promise<Platform> {
  const db = await Database.load(DB_URL);
  const driver: SqlDriver = {
    async execute(sql, params = []) {
      const result = await db.execute(sql, params);
      return { rowsAffected: result.rowsAffected };
    },
    async select(sql, params = []) {
      return db.select(sql, params);
    },
  };
  return {
    store: await createSqlStore(driver),
    // Native notifications (tauri-plugin-notification) arrive with reminders in M6.
    notify: webNotify,
    ...visibility,
  };
}
