import type { FocusRating, RecipeKind } from './types.js';

export const REFLECTION_BONUS = 10;
export const MIN_REFLECTION_SENTENCES = 2;
export const MIN_WORDS_PER_SENTENCE = 3;
export const FOCUS_RATING_MULTIPLIER = 2;
export const MAX_AWAY_PENALTY = 5;

/**
 * Counts sentences that carry at least a few words, so "ok. ok." doesn't earn the bonus.
 * Splits on . ! ? (including runs like "?!" or "...").
 */
export function countSentences(text: string): number {
  return text
    .split(/[.!?]+(?:\s+|$)/)
    .map((part) => part.trim())
    .filter((part) => part.split(/\s+/).filter(Boolean).length >= MIN_WORDS_PER_SENTENCE).length;
}

export interface CoinInput {
  focusedMinutes: number;
  reflection: string;
  focusRating: FocusRating;
  awayCount: number;
}

/**
 * coins = floor(focused minutes)
 *       + 10 if the reflection has ≥ 2 real sentences
 *       + focus rating × 2
 *       − min(away episodes, 5)
 * Never negative.
 */
export function computeCoins(input: CoinInput): number {
  const minutes = Math.floor(Math.max(0, input.focusedMinutes));
  const bonus = countSentences(input.reflection) >= MIN_REFLECTION_SENTENCES ? REFLECTION_BONUS : 0;
  const rating = input.focusRating * FOCUS_RATING_MULTIPLIER;
  const penalty = Math.min(Math.max(0, input.awayCount), MAX_AWAY_PENALTY);
  return Math.max(0, minutes + bonus + rating - penalty);
}

export interface StepReward {
  ingredients: number;
  /** Finishing the last step of a signature dish unlocks a rare decor item. */
  rareDecorUnlock: boolean;
}

export function rewardForStep(kind: RecipeKind, isFinalStep: boolean): StepReward {
  return { ingredients: 1, rareDecorUnlock: kind === 'signature' && isFinalStep };
}
