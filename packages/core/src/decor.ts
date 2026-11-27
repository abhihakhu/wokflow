import type { InventoryItem, Placement } from './types.js';
import { ValidationError } from './validation.js';
import { WALLET, type Wallet, type WalletId } from './wallet.js';

export interface DecorCost {
  coins: number;
  ingredients: number;
  rareDecor: number;
}

export interface DecorItem {
  id: string;
  name: string;
  description: string;
  cost: DecorCost;
}

const cost = (coins: number, ingredients = 0, rareDecor = 0): DecorCost => ({
  coins,
  ingredients,
  rareDecor,
});

/**
 * Everything the shop sells, cheapest first. Prices assume roughly 40–60 coins per
 * focused session; ingredients come from recipe steps and rare decor from signature dishes.
 */
export const DECOR_CATALOG: readonly DecorItem[] = Object.freeze([
  {
    id: 'paper-fan',
    name: 'Paper fan',
    description: 'A red folding fan for the wall by the window.',
    cost: cost(40),
  },
  {
    id: 'tea-set',
    name: 'Clay tea set',
    description: 'A teapot and two cups for breaks between sessions.',
    cost: cost(60),
  },
  {
    id: 'bonsai',
    name: 'Bonsai pine',
    description: 'A patient little tree in a porcelain pot.',
    cost: cost(90, 2),
  },
  {
    id: 'goldfish-bowl',
    name: 'Goldfish bowl',
    description: 'A goldfish who swims laps while you work.',
    cost: cost(120, 3),
  },
  {
    id: 'koi-scroll',
    name: 'Koi scroll',
    description: 'A hanging scroll of koi swimming upstream.',
    cost: cost(150, 2),
  },
  {
    id: 'golden-wok',
    name: 'Golden wok',
    description: 'A trophy for finishing a signature dish.',
    cost: cost(200, 0, 1),
  },
]);

export const decorInventoryId = (decorId: string) => `decor:${decorId}`;

export function findDecor(id: string): DecorItem | undefined {
  return DECOR_CATALOG.find((d) => d.id === id);
}

export function ownsDecor(inventory: readonly InventoryItem[], decorId: string): boolean {
  return (inventory.find((i) => i.id === decorInventoryId(decorId))?.qty ?? 0) > 0;
}

export type Shortfall = Partial<DecorCost>;

/** What's missing to afford `cost`; an empty object means affordable. */
export function shortfall(wallet: Wallet, price: DecorCost): Shortfall {
  const missing: Shortfall = {};
  if (wallet.coins < price.coins) missing.coins = price.coins - wallet.coins;
  if (wallet.ingredients < price.ingredients)
    missing.ingredients = price.ingredients - wallet.ingredients;
  if (wallet.rareDecor < price.rareDecor) missing.rareDecor = price.rareDecor - wallet.rareDecor;
  return missing;
}

export function describeShortfall(missing: Shortfall): string | undefined {
  const parts = [
    missing.coins && `${missing.coins} more coin${missing.coins === 1 ? '' : 's'}`,
    missing.ingredients &&
      `${missing.ingredients} more ingredient${missing.ingredients === 1 ? '' : 's'}`,
    missing.rareDecor && 'a rare decor token (finish a signature dish)',
  ].filter(Boolean);
  return parts.length ? `Needs ${parts.join(' and ')}.` : undefined;
}

/**
 * Validate a purchase and return the inventory changes to apply: the price as negative
 * deltas plus the item itself. Throws ValidationError if unknown, owned, or unaffordable.
 */
export function purchase(
  inventory: readonly InventoryItem[],
  wallet: Wallet,
  decorId: string,
): Array<[string, number]> {
  const item = findDecor(decorId);
  if (!item) throw new ValidationError('That item isn’t in the shop.', 'decor');
  if (ownsDecor(inventory, decorId))
    throw new ValidationError(`You already own the ${item.name}.`, 'decor');
  const missing = describeShortfall(shortfall(wallet, item.cost));
  if (missing) throw new ValidationError(missing, 'decor');
  const deltas: Array<[WalletId | string, number]> = [];
  if (item.cost.coins) deltas.push([WALLET.coins, -item.cost.coins]);
  if (item.cost.ingredients) deltas.push([WALLET.ingredients, -item.cost.ingredients]);
  if (item.cost.rareDecor) deltas.push([WALLET.rareDecor, -item.cost.rareDecor]);
  deltas.push([decorInventoryId(decorId), 1]);
  return deltas;
}

/** Owned decor that should appear in the kitchen: owned and not hidden, in catalog order. */
export function visibleDecor(
  inventory: readonly InventoryItem[],
  placements: readonly Placement[],
): string[] {
  const hidden = new Set(placements.filter((p) => !p.visible).map((p) => p.id));
  return DECOR_CATALOG.filter((d) => ownsDecor(inventory, d.id) && !hidden.has(d.id)).map(
    (d) => d.id,
  );
}
