import { remainingMs } from './session.js';
import type { Recipe, Session, Task } from './types.js';

export type ReminderKind = 'due' | 'daily' | 'pot';

export interface Reminder {
  /** Positive 31-bit integer, stable for the same reminder (Android notification ids are ints). */
  id: number;
  kind: ReminderKind;
  /** When to fire, ms since epoch. */
  at: number;
  title: string;
  body: string;
}

export interface ReminderSettings {
  /** Remind the day before things are due. */
  dueReminders: boolean;
  /** "HH:MM" local time for a daily "time to cook" nudge, or "" for none. */
  dailyNudge: string;
}

/** The hour (local) of a due-date reminder on the day before. */
export const DUE_REMINDER_HOUR = 9;
export const PLAN_HORIZON_DAYS = 7;

/** FNV-1a hash folded to a positive 31-bit int, so ids survive restarts. */
export function reminderId(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 1 || 1;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidNudgeTime(value: string): boolean {
  return value === '' || TIME.test(value);
}

/**
 * When to remind about something due at `due`:
 * - plain dates: 9:00 local time the day before;
 * - full timestamps: 24 hours before.
 */
export function dueReminderTime(due: string): number | undefined {
  const date = DATE_ONLY.exec(due);
  if (date) {
    return new Date(
      Number(date[1]),
      Number(date[2]) - 1,
      Number(date[3]) - 1,
      DUE_REMINDER_HOUR,
    ).getTime();
  }
  const ms = Date.parse(due);
  return Number.isNaN(ms) ? undefined : ms - 24 * 3_600_000;
}

/**
 * Every reminder from now until the horizon: due-date reminders for unfinished tasks
 * (recipe steps are covered by their recipe) and recipes, plus the daily nudge.
 */
export function planReminders(
  tasks: readonly Task[],
  recipes: readonly Recipe[],
  settings: ReminderSettings,
  now: number,
  horizonDays = PLAN_HORIZON_DAYS,
): Reminder[] {
  const until = now + horizonDays * 86_400_000;
  const out: Reminder[] = [];

  if (settings.dueReminders) {
    const due: Array<{ key: string; title: string; dueAt: string; what: string }> = [
      ...tasks
        .filter((t) => t.status !== 'done' && t.dueAt && !t.recipeId)
        .map((t) => ({ key: `task:${t.id}`, title: t.title, dueAt: t.dueAt!, what: 'task' })),
      ...recipes
        .filter((r) => r.dueAt)
        .filter((r) => {
          const steps = tasks.filter((t) => t.recipeId === r.id);
          return steps.length === 0 || steps.some((t) => t.status !== 'done');
        })
        .map((r) => ({
          key: `recipe:${r.id}`,
          title: r.title,
          dueAt: r.dueAt!,
          what: r.kind === 'signature' ? 'signature dish' : 'recipe',
        })),
    ];
    for (const item of due) {
      const at = dueReminderTime(item.dueAt);
      if (at === undefined || at <= now || at > until) continue;
      out.push({
        id: reminderId(`due:${item.key}`),
        kind: 'due',
        at,
        title: `Due tomorrow: ${item.title}`,
        body: `Your ${item.what} is due tomorrow. Fire up the wok?`,
      });
    }
  }

  const time = TIME.exec(settings.dailyNudge);
  if (time) {
    const start = new Date(now);
    for (let day = 0; day <= horizonDays; day++) {
      const at = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + day,
        Number(time[1]),
        Number(time[2]),
      ).getTime();
      if (at <= now || at > until) continue;
      const d = new Date(at);
      const dayKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      out.push({
        id: reminderId(`daily:${dayKey}`),
        kind: 'daily',
        at,
        title: 'What are we cooking today?',
        body: 'Pick one thing and do the mise en place. Just the first step.',
      });
    }
  }

  return out.sort((a, b) => a.at - b.at);
}

/**
 * "Order up" when a running session's pot is done; none while paused or not simmering.
 * While you're away the timer is frozen at the moment you left, so the reminder is anchored
 * there: if you were working in another app all along, it still fires on time.
 */
export function potReminder(
  session: Session | undefined,
  taskTitle: string | undefined,
  now: number,
): Reminder | undefined {
  if (!session || session.phase !== 'simmer') return undefined;
  const from = session.awaySince ?? now;
  const left = remainingMs(session, from);
  if (left <= 0) return undefined;
  return {
    id: reminderId(`pot:${session.id}`),
    kind: 'pot',
    at: from + left,
    title: 'Order up!',
    body: taskTitle
      ? `Time’s up on “${taskTitle}”. Come plate it.`
      : 'Your session is done. Come plate it.',
  };
}
