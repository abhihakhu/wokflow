import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import type { Reminder } from '@wokflow/core';
import { createSqlStore, type Platform } from '@wokflow/data';
import { capacitorDriver, type CapacitorDb } from './capacitorDriver';

const DB_NAME = 'wokflow';

async function ensureNotificationPermission(): Promise<boolean> {
  let { display } = await LocalNotifications.checkPermissions();
  if (display === 'prompt' || display === 'prompt-with-rationale') {
    ({ display } = await LocalNotifications.requestPermissions());
  }
  return display === 'granted';
}

/** Turn a Capacitor listener (whose handle arrives async) into a synchronous unsubscribe. */
function onAppState(active: boolean, cb: () => void): () => void {
  const handle = App.addListener('appStateChange', (state) => {
    if (state.isActive === active) cb();
  });
  return () => {
    void handle.then((h) => h.remove());
  };
}

/** Android platform: SQLite on the device, OS-scheduled local notifications, app state events. */
export async function createCapacitorPlatform(): Promise<Platform> {
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  const existing = (await sqlite.isConnection(DB_NAME, false)).result;
  const db = existing
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
  await db.open();

  let scheduledIds: number[] = [];

  return {
    store: await createSqlStore(capacitorDriver(db as unknown as CapacitorDb)),
    async notify(title, body) {
      if (!(await ensureNotificationPermission())) return;
      await LocalNotifications.schedule({
        notifications: [{ id: Date.now() % 2_000_000_000, title, body }],
      });
    },
    async scheduleReminders(reminders: readonly Reminder[]) {
      if (scheduledIds.length) {
        await LocalNotifications.cancel({ notifications: scheduledIds.map((id) => ({ id })) });
      }
      const upcoming = reminders.filter((r) => r.at > Date.now());
      scheduledIds = upcoming.map((r) => r.id);
      if (!upcoming.length || !(await ensureNotificationPermission())) return;
      await LocalNotifications.schedule({
        notifications: upcoming.map((r) => ({
          id: r.id,
          title: r.title,
          body: r.body,
          schedule: { at: new Date(r.at), allowWhileIdle: true },
        })),
      });
    },
    onAppHidden: (cb) => onAppState(false, cb),
    onAppVisible: (cb) => onAppState(true, cb),
  };
}
