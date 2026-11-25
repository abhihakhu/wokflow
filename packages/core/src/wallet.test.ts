import { describe, expect, it } from 'vitest';
import { WALLET, adjustInventory, readWallet, rewardDeltas } from './wallet.js';

const T = '2026-11-24T20:00:00.000Z';

describe('wallet', () => {
  it('adds to missing and existing items and never goes negative', () => {
    const a = adjustInventory(undefined, WALLET.coins, 59, T);
    expect(a).toEqual({ id: 'coins', qty: 59, updatedAt: T });
    expect(adjustInventory(a, WALLET.coins, 10, T).qty).toBe(69);
    expect(adjustInventory(a, WALLET.coins, -100, T).qty).toBe(0);
    expect(() => adjustInventory(a, WALLET.coins, 0.5, T)).toThrow(RangeError);
  });

  it('reads the wallet with zero defaults', () => {
    expect(readWallet([])).toEqual({ coins: 0, ingredients: 0, rareDecor: 0 });
    expect(
      readWallet([
        { id: 'coins', qty: 12, updatedAt: T },
        { id: 'other', qty: 3, updatedAt: T },
      ]),
    ).toEqual({
      coins: 12,
      ingredients: 0,
      rareDecor: 0,
    });
  });

  it('turns step rewards into deltas', () => {
    expect(rewardDeltas({ ingredients: 1, rareDecorUnlock: false })).toEqual([['ingredients', 1]]);
    expect(rewardDeltas({ ingredients: 1, rareDecorUnlock: true })).toEqual([
      ['ingredients', 1],
      ['rare-decor', 1],
    ]);
  });
});
