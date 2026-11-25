/** ISO-8601 timestamp string, e.g. "2026-11-24T23:00:00.000Z". */
export type Timestamp = string;

/** Milliseconds since the Unix epoch. Core functions take `now` explicitly so they stay pure. */
export type EpochMs = number;

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: string;
  title: string;
  notes?: string;
  dueAt?: Timestamp;
  /** How many focus sessions the user expects this to take. */
  estSessions: number;
  tags: string[];
  /** Set when the task is a step of a recipe. */
  recipeId?: string;
  /** Order of the step within its recipe (0-based). */
  stepIndex?: number;
  status: TaskStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** A recipe is a multi-step task. A signature dish is a "boss" recipe (exam, project). */
export type RecipeKind = 'recipe' | 'signature';

export interface Recipe {
  id: string;
  title: string;
  kind: RecipeKind;
  dueAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Session lifecycle:
 *   prep ──start──▶ simmer ◀──resume── paused
 *                     │ └────pause─────▶ ▲
 *                     └──finish──▶ plate ──serve──▶ served
 */
export type SessionPhase = 'prep' | 'simmer' | 'paused' | 'plate' | 'served';

export interface Session {
  id: string;
  taskId: string;
  phase: SessionPhase;
  plannedMin: number;
  /** Mise en place: the smallest concrete first step. */
  firstStep: string;
  /** Mise en place: what the user wants to understand by the end. */
  intent: string;
  startedAt?: EpochMs;
  endedAt?: EpochMs;
  /** Focused time accumulated in closed simmer stretches (excludes pauses and counted away time). */
  focusedMs: number;
  /** Start of the current running simmer stretch. */
  runningSince?: EpochMs;
  /** Set while the user has left the app during a simmer. */
  awaySince?: EpochMs;
  /** Away episodes that lasted at least the grace period. */
  awayCount: number;
  awayMs: number;
  reflection?: string;
  focusRating?: FocusRating;
  coinsEarned?: number;
  updatedAt: EpochMs;
}

export type FocusRating = 1 | 2 | 3 | 4 | 5;

/** The four states every character pack must animate. */
export type CompanionState = 'idle' | 'focus' | 'away' | 'complete';

export interface ParkingLotItem {
  id: string;
  sessionId?: string;
  text: string;
  resolved: boolean;
  createdAt: Timestamp;
}

export interface InventoryItem {
  id: string;
  qty: number;
  updatedAt: Timestamp;
}
