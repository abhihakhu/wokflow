import { computeCoins } from './rewards.js';
import type { CompanionState, EpochMs, FocusRating, Session } from './types.js';

/** Away episodes shorter than this are ignored (glancing at a notification, alt-tabbing to a PDF). */
export const DEFAULT_AWAY_GRACE_MS = 30_000;
export const MIN_PLANNED_MIN = 1;
export const MAX_PLANNED_MIN = 240;

export class SessionTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionTransitionError';
  }
}

export interface NewSessionInput {
  id: string;
  taskId: string;
  plannedMin: number;
  firstStep: string;
  intent: string;
}

/** Prep: create a session. Mise en place is required — that's the point. */
export function createSession(input: NewSessionInput, now: EpochMs): Session {
  const firstStep = input.firstStep.trim();
  const intent = input.intent.trim();
  if (!firstStep) throw new SessionTransitionError('A first step is required before you start.');
  if (!intent)
    throw new SessionTransitionError('Say what you want to understand before you start.');
  if (
    !Number.isInteger(input.plannedMin) ||
    input.plannedMin < MIN_PLANNED_MIN ||
    input.plannedMin > MAX_PLANNED_MIN
  ) {
    throw new SessionTransitionError(
      `Planned minutes must be a whole number from ${MIN_PLANNED_MIN} to ${MAX_PLANNED_MIN}.`,
    );
  }
  return {
    id: input.id,
    taskId: input.taskId,
    phase: 'prep',
    plannedMin: input.plannedMin,
    firstStep,
    intent,
    focusedMs: 0,
    awayCount: 0,
    awayMs: 0,
    updatedAt: now,
  };
}

function expectPhase(s: Session, ...phases: Session['phase'][]): void {
  if (!phases.includes(s.phase)) {
    throw new SessionTransitionError(
      `Cannot do that while the session is "${s.phase}" (expected ${phases.join(' or ')}).`,
    );
  }
}

function assertTimeForward(s: Session, now: EpochMs): void {
  if (now < s.updatedAt) throw new SessionTransitionError('Time went backwards.');
}

/** Close the running stretch at `at`, adding it to focused time. */
function closeStretch(s: Session, at: EpochMs): Session {
  if (s.runningSince === undefined) return s;
  const { runningSince, ...rest } = s;
  return { ...rest, focusedMs: s.focusedMs + Math.max(0, at - runningSince) };
}

export function startSimmer(s: Session, now: EpochMs): Session {
  expectPhase(s, 'prep');
  assertTimeForward(s, now);
  return { ...s, phase: 'simmer', startedAt: now, runningSince: now, updatedAt: now };
}

export function pauseSimmer(s: Session, now: EpochMs, graceMs = DEFAULT_AWAY_GRACE_MS): Session {
  expectPhase(s, 'simmer');
  assertTimeForward(s, now);
  const back = s.awaySince !== undefined ? markBack(s, now, graceMs) : s;
  return { ...closeStretch(back, now), phase: 'paused', updatedAt: now };
}

export function resumeSimmer(s: Session, now: EpochMs): Session {
  expectPhase(s, 'paused');
  assertTimeForward(s, now);
  return { ...s, phase: 'simmer', runningSince: now, updatedAt: now };
}

/** The user left the app (window hidden / app backgrounded). Idempotent. */
export function markAway(s: Session, now: EpochMs): Session {
  if (s.phase !== 'simmer' || s.awaySince !== undefined) return s;
  assertTimeForward(s, now);
  return { ...s, awaySince: now, updatedAt: now };
}

/**
 * The user came back. If they were gone at least `graceMs`, the episode counts:
 * it is excluded from focused time and increments the away counter.
 */
export function markBack(s: Session, now: EpochMs, graceMs = DEFAULT_AWAY_GRACE_MS): Session {
  if (s.awaySince === undefined) return s;
  assertTimeForward(s, now);
  const { awaySince, ...rest } = s;
  const duration = now - awaySince;
  if (duration < graceMs) return { ...rest, updatedAt: now };
  // Focus counted up to the moment they left; restart the stretch now.
  const closed = closeStretch(rest, awaySince);
  return {
    ...closed,
    runningSince: now,
    awayCount: s.awayCount + 1,
    awayMs: s.awayMs + duration,
    updatedAt: now,
  };
}

/** Finish simmering and move to Plate (reflection). Allowed from simmer or paused. */
export function finishSimmer(s: Session, now: EpochMs, graceMs = DEFAULT_AWAY_GRACE_MS): Session {
  expectPhase(s, 'simmer', 'paused');
  assertTimeForward(s, now);
  const back = s.awaySince !== undefined ? markBack(s, now, graceMs) : s;
  return { ...closeStretch(back, now), phase: 'plate', endedAt: now, updatedAt: now };
}

export interface PlateInput {
  reflection: string;
  focusRating: FocusRating;
}

/** Plate → Served: record the reflection and award coins. */
export function serveSession(s: Session, input: PlateInput, now: EpochMs): Session {
  expectPhase(s, 'plate');
  assertTimeForward(s, now);
  if (![1, 2, 3, 4, 5].includes(input.focusRating)) {
    throw new SessionTransitionError('Focus rating must be 1–5.');
  }
  const reflection = input.reflection.trim();
  const coinsEarned = computeCoins({
    focusedMinutes: s.focusedMs / 60_000,
    reflection,
    focusRating: input.focusRating,
    awayCount: s.awayCount,
  });
  return {
    ...s,
    phase: 'served',
    reflection,
    focusRating: input.focusRating,
    coinsEarned,
    updatedAt: now,
  };
}

/** Focused time so far, including the running stretch. */
export function focusedMsAt(s: Session, now: EpochMs): number {
  if (s.runningSince === undefined) return s.focusedMs;
  const until = s.awaySince ?? now;
  return s.focusedMs + Math.max(0, until - s.runningSince);
}

/** Time left on the pot, based on focused time. */
export function remainingMs(s: Session, now: EpochMs): number {
  return Math.max(0, s.plannedMin * 60_000 - focusedMsAt(s, now));
}

export function companionStateFor(s: Session | undefined): CompanionState {
  if (!s) return 'idle';
  switch (s.phase) {
    case 'prep':
    case 'paused':
      return 'idle';
    case 'simmer':
      return s.awaySince !== undefined ? 'away' : 'focus';
    case 'plate':
    case 'served':
      return 'complete';
  }
}
