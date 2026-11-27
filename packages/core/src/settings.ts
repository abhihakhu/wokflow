import { isValidNudgeTime } from './reminders.js';
import { DEFAULT_AWAY_GRACE_MS, MAX_PLANNED_MIN, MIN_PLANNED_MIN } from './session.js';
import { ValidationError } from './validation.js';

export type MotionPreference = 'system' | 'reduce' | 'full';

export interface Settings {
  /** Folder name under packs/ of the companion to show. */
  companionPack: string;
  /** Pre-selected session length on the Prep screen, in minutes. */
  defaultSimmerMin: number;
  /** Absences shorter than this don't count as stepping away (ADR 0003). */
  awayGraceSec: number;
  /** Animation: follow the OS setting, or force reduced / full motion. */
  motion: MotionPreference;
  /** Notify the day before tasks and recipes are due. */
  dueReminders: boolean;
  /** "HH:MM" for a daily nudge to start cooking, or "" for none. */
  dailyNudge: string;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  companionPack: 'default',
  defaultSimmerMin: 25,
  awayGraceSec: DEFAULT_AWAY_GRACE_MS / 1000,
  motion: 'system',
  dueReminders: true,
  dailyNudge: '',
});

export const AWAY_GRACE_RANGE = { min: 0, max: 600 } as const;
const MOTIONS: readonly MotionPreference[] = ['system', 'reduce', 'full'];
const PACK_FOLDER = /^[a-z0-9][a-z0-9_-]*$/i;

function check(settings: Settings): Settings {
  if (!PACK_FOLDER.test(settings.companionPack)) {
    throw new ValidationError('Pick a companion from the list.', 'companionPack');
  }
  const min = settings.defaultSimmerMin;
  if (!Number.isInteger(min) || min < MIN_PLANNED_MIN || min > MAX_PLANNED_MIN) {
    throw new ValidationError(
      `Default session must be ${MIN_PLANNED_MIN}–${MAX_PLANNED_MIN} minutes.`,
      'defaultSimmerMin',
    );
  }
  const grace = settings.awayGraceSec;
  if (!Number.isInteger(grace) || grace < AWAY_GRACE_RANGE.min || grace > AWAY_GRACE_RANGE.max) {
    throw new ValidationError(
      `Grace period must be ${AWAY_GRACE_RANGE.min}–${AWAY_GRACE_RANGE.max} seconds.`,
      'awayGraceSec',
    );
  }
  if (!MOTIONS.includes(settings.motion)) {
    throw new ValidationError('Pick a motion setting.', 'motion');
  }
  if (typeof settings.dueReminders !== 'boolean') {
    throw new ValidationError('Due reminders must be on or off.', 'dueReminders');
  }
  if (typeof settings.dailyNudge !== 'string' || !isValidNudgeTime(settings.dailyNudge)) {
    throw new ValidationError('Use a time like 18:30, or leave it empty.', 'dailyNudge');
  }
  return settings;
}

/**
 * Read stored settings leniently: unknown keys are dropped, and any missing or invalid
 * field falls back to its default, so an old or hand-edited record never breaks startup.
 */
export function parseSettings(raw: unknown): Settings {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const result: Settings = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    if (!(key in source)) continue;
    const candidate = { ...DEFAULT_SETTINGS, [key]: source[key] } as Settings;
    try {
      check(candidate);
      (result as unknown as Record<string, unknown>)[key] = candidate[key];
    } catch {
      // keep the default for this field
    }
  }
  return result;
}

/** Apply a change from the settings screen. Throws ValidationError naming the bad field. */
export function updateSettings(current: Settings, patch: Partial<Settings>): Settings {
  return check({ ...current, ...patch });
}

/** Whether the scene should animate, given the user's choice and the OS preference. */
export function shouldReduceMotion(
  motion: MotionPreference,
  systemPrefersReduced: boolean,
): boolean {
  return motion === 'reduce' || (motion === 'system' && systemPrefersReduced);
}
