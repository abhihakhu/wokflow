import { describe, expect, it } from 'vitest';
import { computeCoins, countSentences, rewardForStep } from './rewards.js';

describe('countSentences', () => {
  it('counts sentences with at least three words', () => {
    expect(countSentences('Pointers store addresses. Free each node once!')).toBe(2);
    expect(countSentences('ok. ok. fine.')).toBe(0);
    expect(countSentences('Why does this leak?! Because next was lost first...')).toBe(2);
    expect(countSentences('')).toBe(0);
  });
});

describe('computeCoins', () => {
  const base = { focusedMinutes: 25, reflection: '', focusRating: 3 as const, awayCount: 0 };

  it('pays one coin per whole focused minute plus the rating', () => {
    expect(computeCoins(base)).toBe(25 + 6);
    expect(computeCoins({ ...base, focusedMinutes: 25.9 })).toBe(31);
  });

  it('adds the reflection bonus only for two real sentences', () => {
    const one = 'Malloc gives heap memory.';
    const two = 'Malloc gives heap memory. You must free it once.';
    expect(computeCoins({ ...base, reflection: one })).toBe(31);
    expect(computeCoins({ ...base, reflection: two })).toBe(41);
  });

  it('caps the away penalty at five and never goes negative', () => {
    expect(computeCoins({ ...base, awayCount: 2 })).toBe(29);
    expect(computeCoins({ ...base, awayCount: 50 })).toBe(26);
    expect(computeCoins({ ...base, focusedMinutes: -10, focusRating: 1, awayCount: 5 })).toBe(0);
  });
});

describe('rewardForStep', () => {
  it('gives an ingredient per step and rare decor for finishing a signature dish', () => {
    expect(rewardForStep('recipe', true)).toEqual({ ingredients: 1, rareDecorUnlock: false });
    expect(rewardForStep('signature', false)).toEqual({ ingredients: 1, rareDecorUnlock: false });
    expect(rewardForStep('signature', true)).toEqual({ ingredients: 1, rareDecorUnlock: true });
  });
});
