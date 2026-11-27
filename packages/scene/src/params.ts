import type { CompanionState } from '@wokflow/core';

export interface SceneParams {
  /** Stove fire strength, 0–1. */
  fire: number;
  /** Steam particles per second from the wok. */
  wokSteam: number;
  /** Steam particles per second from the bamboo steamers. */
  steamerSteam: number;
  /** Lantern glow strength, 0–1. */
  lanternGlow: number;
  /** Lantern sway amplitude in degrees. */
  sway: number;
}

/**
 * The kitchen reacts to the session: it's busiest while you focus, calm when idle,
 * and dims a little when you step away (the pot's still on…).
 */
export const SCENE_PARAMS: Record<CompanionState, SceneParams> = {
  idle: { fire: 0.45, wokSteam: 4, steamerSteam: 3, lanternGlow: 0.8, sway: 1.5 },
  focus: { fire: 1, wokSteam: 12, steamerSteam: 6, lanternGlow: 1, sway: 1 },
  away: { fire: 0.25, wokSteam: 2, steamerSteam: 1, lanternGlow: 0.5, sway: 0.5 },
  complete: { fire: 0.7, wokSteam: 8, steamerSteam: 8, lanternGlow: 1, sway: 2.5 },
};

/** Ease current params toward a target so state changes fade instead of snapping. */
export function approach(
  current: SceneParams,
  target: SceneParams,
  dtSec: number,
  rate = 2,
): SceneParams {
  const k = 1 - Math.exp(-rate * Math.max(0, dtSec));
  const mix = (a: number, b: number) => a + (b - a) * k;
  return {
    fire: mix(current.fire, target.fire),
    wokSteam: mix(current.wokSteam, target.wokSteam),
    steamerSteam: mix(current.steamerSteam, target.steamerSteam),
    lanternGlow: mix(current.lanternGlow, target.lanternGlow),
    sway: mix(current.sway, target.sway),
  };
}
