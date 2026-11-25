import type { StepReward } from './rewards.js';
import type { InventoryItem, Timestamp } from './types.js';

/** Inventory ids for the player's currencies. */
export const WALLET = {
  coins: 'coins',
  ingredients: 'ingredients',
  rareDecor: 'rare-decor',
} as const;

export type WalletId = (typeof WALLET)[keyof typeof WALLET];

export interface Wallet {
  coins: number;
  ingredients: number;
  rareDecor: number;
}

/** Add (or with a negative delta, spend) an amount. Quantities never go below zero. */
export function adjustInventory(
  item: InventoryItem | undefined,
  id: string,
  delta: number,
  now: Timestamp,
): InventoryItem {
  if (!Number.isInteger(delta)) throw new RangeError('Inventory changes must be whole numbers.');
  return { id, qty: Math.max(0, (item?.qty ?? 0) + delta), updatedAt: now };
}

export function readWallet(items: readonly InventoryItem[]): Wallet {
  const qty = (id: WalletId) => items.find((i) => i.id === id)?.qty ?? 0;
  return {
    coins: qty(WALLET.coins),
    ingredients: qty(WALLET.ingredients),
    rareDecor: qty(WALLET.rareDecor),
  };
}

/** The inventory deltas a step reward grants. */
export function rewardDeltas(reward: StepReward): Array<[WalletId, number]> {
  const deltas: Array<[WalletId, number]> = [[WALLET.ingredients, reward.ingredients]];
  if (reward.rareDecorUnlock) deltas.push([WALLET.rareDecor, 1]);
  return deltas;
}
