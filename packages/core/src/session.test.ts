import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AWAY_GRACE_MS,
  SessionTransitionError,
  companionStateFor,
  createSession,
  finishSimmer,
  focusedMsAt,
  markAway,
  markBack,
  pauseSimmer,
  remainingMs,
  resumeSimmer,
  serveSession,
  startSimmer,
} from './session.js';
import type { Session } from './types.js';

const MIN = 60_000;
const T0 = 1_800_000_000_000;

function prep(overrides: Partial<Parameters<typeof createSession>[0]> = {}): Session {
  return createSession(
    {
      id: 's1',
      taskId: 't1',
      plannedMin: 45,
      firstStep: 'Trace insert-at-head for a 3-node list',
      intent: 'Why every malloc’d node needs exactly one free',
      ...overrides,
    },
    T0,
  );
}

describe('createSession (prep)', () => {
  it('creates a prep-phase session with trimmed mise en place', () => {
    const s = prep({ firstStep: '  step  ', intent: '  why  ' });
    expect(s).toMatchObject({ phase: 'prep', firstStep: 'step', intent: 'why', focusedMs: 0 });
  });

  it('requires a first step and an intent', () => {
    expect(() => prep({ firstStep: '   ' })).toThrow(SessionTransitionError);
    expect(() => prep({ intent: '' })).toThrow(/understand/);
  });

  it.each([0, 241, 2.5, Number.NaN])('rejects planned minutes %s', (plannedMin) => {
    expect(() => prep({ plannedMin })).toThrow(/Planned minutes/);
  });
});

describe('simmer timing', () => {
  it('accumulates focus across pause and resume', () => {
    let s = startSimmer(prep(), T0);
    expect(focusedMsAt(s, T0 + 10 * MIN)).toBe(10 * MIN);
    s = pauseSimmer(s, T0 + 10 * MIN);
    // Paused time does not count.
    expect(focusedMsAt(s, T0 + 20 * MIN)).toBe(10 * MIN);
    s = resumeSimmer(s, T0 + 20 * MIN);
    s = finishSimmer(s, T0 + 35 * MIN);
    expect(s.phase).toBe('plate');
    expect(s.focusedMs).toBe(25 * MIN);
    expect(s.endedAt).toBe(T0 + 35 * MIN);
  });

  it('reports remaining time on the pot', () => {
    const s = startSimmer(prep({ plannedMin: 25 }), T0);
    expect(remainingMs(s, T0 + 5 * MIN)).toBe(20 * MIN);
    expect(remainingMs(s, T0 + 60 * MIN)).toBe(0);
  });

  it('rejects invalid transitions', () => {
    const s = prep();
    expect(() => pauseSimmer(s, T0)).toThrow(SessionTransitionError);
    expect(() => resumeSimmer(s, T0)).toThrow(SessionTransitionError);
    expect(() => finishSimmer(s, T0)).toThrow(SessionTransitionError);
    expect(() => serveSession(s, { reflection: 'x', focusRating: 3 }, T0)).toThrow(
      SessionTransitionError,
    );
    expect(() => startSimmer(startSimmer(s, T0), T0)).toThrow(SessionTransitionError);
  });

  it('rejects time going backwards', () => {
    const s = startSimmer(prep(), T0 + MIN);
    expect(() => pauseSimmer(s, T0)).toThrow(/backwards/);
  });
});

describe('leave detection', () => {
  it('ignores short glances away (under the grace period)', () => {
    let s = startSimmer(prep(), T0);
    s = markAway(s, T0 + 5 * MIN);
    s = markBack(s, T0 + 5 * MIN + DEFAULT_AWAY_GRACE_MS - 1);
    expect(s.awayCount).toBe(0);
    expect(s.awaySince).toBeUndefined();
    s = finishSimmer(s, T0 + 10 * MIN);
    expect(s.focusedMs).toBe(10 * MIN);
  });

  it('counts long absences and excludes them from focus', () => {
    let s = startSimmer(prep(), T0);
    s = markAway(s, T0 + 5 * MIN);
    expect(companionStateFor(s)).toBe('away');
    // While away, focus is frozen at the moment they left.
    expect(focusedMsAt(s, T0 + 7 * MIN)).toBe(5 * MIN);
    s = markBack(s, T0 + 7 * MIN);
    expect(s.awayCount).toBe(1);
    expect(s.awayMs).toBe(2 * MIN);
    expect(companionStateFor(s)).toBe('focus');
    s = finishSimmer(s, T0 + 12 * MIN);
    expect(s.focusedMs).toBe(10 * MIN);
  });

  it('is idempotent and only applies during simmer', () => {
    const p = prep();
    expect(markAway(p, T0)).toBe(p);
    expect(markBack(p, T0)).toBe(p);
    let s = startSimmer(p, T0);
    s = markAway(s, T0 + MIN);
    expect(markAway(s, T0 + 2 * MIN)).toBe(s);
  });

  it('closes an open absence when pausing or finishing', () => {
    let s = startSimmer(prep(), T0);
    s = markAway(s, T0 + 4 * MIN);
    s = pauseSimmer(s, T0 + 6 * MIN);
    expect(s).toMatchObject({ awayCount: 1, focusedMs: 4 * MIN, phase: 'paused' });
    expect(s.awaySince).toBeUndefined();

    let f = startSimmer(prep(), T0);
    f = markAway(f, T0 + 3 * MIN);
    f = finishSimmer(f, T0 + 9 * MIN);
    expect(f).toMatchObject({ awayCount: 1, awayMs: 6 * MIN, focusedMs: 3 * MIN });
  });
});

describe('serveSession (plate)', () => {
  it('awards coins matching the mockup example (42 + 10 + 8 − 1 = 59)', () => {
    let s = startSimmer(prep(), T0);
    s = markAway(s, T0 + 20 * MIN);
    s = markBack(s, T0 + 21 * MIN);
    s = finishSimmer(s, T0 + 43 * MIN);
    expect(s.focusedMs).toBe(42 * MIN);
    const served = serveSession(
      s,
      {
        reflection:
          'Each node is its own heap block, so freeing the head does not free the rest. Save next before freeing the current node.',
        focusRating: 4,
      },
      T0 + 44 * MIN,
    );
    expect(served).toMatchObject({ phase: 'served', focusRating: 4, coinsEarned: 59 });
    expect(companionStateFor(served)).toBe('complete');
  });

  it('rejects an out-of-range rating', () => {
    const s = finishSimmer(startSimmer(prep(), T0), T0 + MIN);
    // @ts-expect-error — runtime guard for untyped callers
    expect(() => serveSession(s, { reflection: '', focusRating: 7 }, T0 + MIN)).toThrow(/1–5/);
  });
});

describe('companionStateFor', () => {
  it('maps phases to companion states', () => {
    expect(companionStateFor(undefined)).toBe('idle');
    const p = prep();
    expect(companionStateFor(p)).toBe('idle');
    const s = startSimmer(p, T0);
    expect(companionStateFor(s)).toBe('focus');
    expect(companionStateFor(pauseSimmer(s, T0 + MIN))).toBe('idle');
    expect(companionStateFor(finishSimmer(s, T0 + MIN))).toBe('complete');
  });
});
