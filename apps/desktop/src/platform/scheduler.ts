import type { Reminder } from '@wokflow/core';

/** Longest delay setTimeout accepts (~24.8 days); reminders are planned a week ahead at most. */
const MAX_DELAY = 2 ** 31 - 1;

export interface Clock {
  now(): number;
  setTimeout(cb: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const realClock: Clock = {
  now: () => Date.now(),
  setTimeout: (cb, ms) => globalThis.setTimeout(cb, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
};

/**
 * In-process reminder scheduling for platforms without OS-level scheduling (desktop, browser).
 * Each call replaces the previous set; reminders only fire while the app is running.
 */
export function createTimeoutScheduler(
  notify: (title: string, body: string) => Promise<void>,
  clock: Clock = realClock,
) {
  let handles: unknown[] = [];
  return async function scheduleReminders(reminders: readonly Reminder[]): Promise<void> {
    for (const handle of handles) clock.clearTimeout(handle);
    handles = [];
    const now = clock.now();
    for (const reminder of reminders) {
      const delay = reminder.at - now;
      if (delay <= 0 || delay > MAX_DELAY) continue;
      handles.push(
        clock.setTimeout(() => {
          notify(reminder.title, reminder.body).catch((err: unknown) =>
            console.warn('[wokflow] notification failed:', err),
          );
        }, delay),
      );
    }
  };
}
