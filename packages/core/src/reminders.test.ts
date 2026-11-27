import { describe, expect, it } from 'vitest';
import {
  dueReminderTime,
  isValidNudgeTime,
  planReminders,
  potReminder,
  reminderId,
} from './reminders.js';
import { createRecipe } from './recipes.js';
import { createSession, markAway, pauseSimmer, startSimmer } from './session.js';
import { createTask } from './tasks.js';

// Local-time dates so the tests pass in any time zone.
const local = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();
const NOW = local(2026, 12, 1, 12);
const ISO = new Date(NOW).toISOString();
const on = { dueReminders: true, dailyNudge: '' };

describe('reminderId', () => {
  it('is a stable positive 31-bit int', () => {
    const id = reminderId('due:task:abc');
    expect(id).toBe(reminderId('due:task:abc'));
    expect(id).not.toBe(reminderId('due:task:abd'));
    expect(Number.isInteger(id)).toBe(true);
    expect(id).toBeGreaterThan(0);
    expect(id).toBeLessThan(2 ** 31);
    expect(reminderId('')).toBeGreaterThan(0);
  });
});

describe('dueReminderTime', () => {
  it('reminds at 9:00 the day before a plain date, 24h before a timestamp', () => {
    expect(dueReminderTime('2026-12-08')).toBe(local(2026, 12, 7, 9));
    expect(dueReminderTime('2026-12-01')).toBe(local(2026, 11, 30, 9));
    expect(dueReminderTime('2026-12-08T17:00:00.000Z')).toBe(
      Date.parse('2026-12-07T17:00:00.000Z'),
    );
    expect(dueReminderTime('whenever')).toBeUndefined();
  });
});

describe('isValidNudgeTime', () => {
  it('accepts HH:MM or empty', () => {
    for (const ok of ['', '00:00', '07:30', '23:59']) expect(isValidNudgeTime(ok)).toBe(true);
    for (const bad of ['7:30', '24:00', '12:60', 'noon']) expect(isValidNudgeTime(bad)).toBe(false);
  });
});

describe('planReminders', () => {
  const soon = createTask({ title: 'Lab 9 write-up', dueAt: '2026-12-03' }, 't1', ISO);
  const done = {
    ...createTask({ title: 'Done thing', dueAt: '2026-12-03' }, 't2', ISO),
    status: 'done' as const,
  };
  const tooFar = createTask({ title: 'Final project', dueAt: '2026-12-20' }, 't3', ISO);
  const past = createTask({ title: 'Yesterday', dueAt: '2026-11-30' }, 't4', ISO);
  const exam = createRecipe(
    { title: 'ECE 264 exam', kind: 'signature', dueAt: '2026-12-05' },
    'r1',
    ISO,
  );
  const step = createTask(
    { title: 'Pointers', recipeId: 'r1', stepIndex: 0, dueAt: '2026-12-04' },
    's1',
    ISO,
  );

  it('reminds the day before unfinished tasks and recipes within a week', () => {
    const plan = planReminders([soon, done, tooFar, past, step], [exam], on, NOW);
    expect(plan.map((r) => [r.kind, r.title, r.at])).toEqual([
      ['due', 'Due tomorrow: Lab 9 write-up', local(2026, 12, 2, 9)],
      ['due', 'Due tomorrow: ECE 264 exam', local(2026, 12, 4, 9)],
    ]);
    expect(plan[1]?.body).toMatch(/signature dish/);
  });

  it('skips a recipe whose steps are all done, and respects the toggle', () => {
    const finished = { ...step, status: 'done' as const };
    expect(planReminders([finished], [exam], on, NOW)).toEqual([]);
    expect(planReminders([soon], [exam], { dueReminders: false, dailyNudge: '' }, NOW)).toEqual([]);
  });

  it('adds a daily nudge for each upcoming day', () => {
    const plan = planReminders([], [], { dueReminders: false, dailyNudge: '18:30' }, NOW, 3);
    expect(plan.map((r) => r.at)).toEqual([
      local(2026, 12, 1, 18, 30),
      local(2026, 12, 2, 18, 30),
      local(2026, 12, 3, 18, 30),
    ]);
    expect(new Set(plan.map((r) => r.id)).size).toBe(3);
    // A nudge earlier in the day than now starts tomorrow.
    const morning = planReminders([], [], { dueReminders: false, dailyNudge: '08:00' }, NOW, 2);
    expect(morning[0]?.at).toBe(local(2026, 12, 2, 8));
    expect(planReminders([], [], { dueReminders: false, dailyNudge: 'bad' }, NOW)).toEqual([]);
  });

  it('sorts everything by time', () => {
    const plan = planReminders([soon], [], { dueReminders: true, dailyNudge: '07:00' }, NOW, 2);
    expect(plan.map((r) => r.kind)).toEqual(['daily', 'due', 'daily']);
    expect(plan.map((r) => r.at)).toEqual([...plan.map((r) => r.at)].sort((a, b) => a - b));
  });
});

describe('potReminder', () => {
  const T0 = 1_800_000_000_000;
  const MIN = 60_000;
  const prep = createSession(
    { id: 's1', taskId: 't1', plannedMin: 25, firstStep: 'a', intent: 'b' },
    T0,
  );

  it('fires when the pot is done', () => {
    const s = startSimmer(prep, T0);
    const r = potReminder(s, 'Read ch. 5', T0 + 5 * MIN);
    expect(r).toMatchObject({ kind: 'pot', at: T0 + 25 * MIN, title: 'Order up!' });
    expect(r?.body).toContain('Read ch. 5');
    expect(potReminder(s, undefined, T0)?.body).toMatch(/session is done/);
  });

  it('stays anchored to when you left while away', () => {
    const away = markAway(startSimmer(prep, T0), T0 + 10 * MIN);
    expect(potReminder(away, 'x', T0 + 12 * MIN)?.at).toBe(T0 + 25 * MIN);
    expect(potReminder(away, 'x', T0 + 20 * MIN)?.at).toBe(T0 + 25 * MIN);
  });

  it('is absent when not simmering or already done', () => {
    expect(potReminder(undefined, 'x', T0)).toBeUndefined();
    expect(potReminder(prep, 'x', T0)).toBeUndefined();
    expect(
      potReminder(pauseSimmer(startSimmer(prep, T0), T0 + MIN), 'x', T0 + MIN),
    ).toBeUndefined();
    expect(potReminder(startSimmer(prep, T0), 'x', T0 + 30 * MIN)).toBeUndefined();
  });
});
