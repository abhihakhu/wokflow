import Database from '@tauri-apps/plugin-sql';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { createSqlStore, type Platform, type SqlDriver } from '@wokflow/data';
import { createTimeoutScheduler } from './scheduler';
import { visibility } from './visibility';

/** The database file, created in the app's config directory on first launch. */
export const DB_URL = 'sqlite:wokflow.db';

/** Native OS notifications; asks for permission the first time. */
async function nativeNotify(title: string, body: string): Promise<void> {
  let granted = await isPermissionGranted();
  if (!granted) granted = (await requestPermission()) === 'granted';
  if (granted) sendNotification({ title, body });
}

/** Tauri platform: SQLite via tauri-plugin-sql, native notifications, migrated on startup. */
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
    notify: nativeNotify,
    // Desktop has no OS-level scheduling here: reminders fire while WokFlow is running.
    scheduleReminders: createTimeoutScheduler(nativeNotify),
    ...visibility,
  };
}
