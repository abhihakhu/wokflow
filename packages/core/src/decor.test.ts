import { describe, expect, it } from 'vitest';
import {
  DECOR_CATALOG,
  decorInventoryId,
  describeShortfall,
  findDecor,
  ownsDecor,
  purchase,
  shortfall,
  visibleDecor,
} from './decor.js';
import { ValidationError } from './validation.js';

const T = '2026-11-27T00:00:00.000Z';
const rich = { coins: 1000, ingredients: 10, rareDecor: 1 };

describe('decor catalog', () => {
  it('has unique ids, names and sane prices, cheapest first', () => {
    const ids = DECOR_CATALOG.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of DECOR_CATALOG) {
      expect(d.id).toMatch(/^[a-z][a-z-]*$/);
      expect(d.cost.coins).toBeGreaterThan(0);
      expect(d.name.length).toBeGreaterThan(0);
    }
    const coins = DECOR_CATALOG.map((d) => d.cost.coins);
    expect(coins).toEqual([...coins].sort((a, b) => a - b));
    expect(Object.isFrozen(DECOR_CATALOG)).toBe(true);
    expect(findDecor('golden-wok')?.cost.rareDecor).toBe(1);
    expect(findDecor('nope')).toBeUndefined();
  });
});

describe('shortfall', () => {
  it('reports exactly what is missing', () => {
    const price = { coins: 90, ingredients: 2, rareDecor: 0 };
    expect(shortfall(rich, price)).toEqual({});
    expect(shortfall({ coins: 50, ingredients: 1, rareDecor: 0 }, price)).toEqual({
      coins: 40,
      ingredients: 1,
    });
  });

  it('describes it in words', () => {
    expect(describeShortfall({})).toBeUndefined();
    expect(describeShortfall({ coins: 1 })).toBe('Needs 1 more coin.');
    expect(describeShortfall({ coins: 40, ingredients: 2 })).toBe(
      'Needs 40 more coins and 2 more ingredients.',
    );
    expect(describeShortfall({ rareDecor: 1 })).toMatch(/signature dish/);
  });
});

describe('purchase', () => {
  it('charges the price and grants the item', () => {
    expect(purchase([], rich, 'bonsai')).toEqual([
      ['coins', -90],
      ['ingredients', -2],
      ['decor:bonsai', 1],
    ]);
    expect(purchase([], rich, 'golden-wok')).toEqual([
      ['coins', -200],
      ['rare-decor', -1],
      ['decor:golden-wok', 1],
    ]);
  });

  it('refuses unknown, owned and unaffordable items', () => {
    const owned = [{ id: decorInventoryId('tea-set'), qty: 1, updatedAt: T }];
    const cases: Array<() => unknown> = [
      () => purchase([], rich, 'spaceship'),
      () => purchase(owned, rich, 'tea-set'),
      () => purchase([], { coins: 10, ingredients: 0, rareDecor: 0 }, 'tea-set'),
    ];
    for (const attempt of cases) expect(attempt).toThrow(ValidationError);
    expect(() => purchase(owned, rich, 'tea-set')).toThrow(/already own/);
    expect(() => purchase([], { coins: 10, ingredients: 0, rareDecor: 0 }, 'tea-set')).toThrow(
      'Needs 50 more coins.',
    );
  });
});

describe('visibleDecor', () => {
  it('shows owned items unless hidden, in catalog order', () => {
    const inventory = ['koi-scroll', 'paper-fan', 'bonsai'].map((id) => ({
      id: decorInventoryId(id),
      qty: 1,
      updatedAt: T,
    }));
    expect(ownsDecor(inventory, 'bonsai')).toBe(true);
    expect(ownsDecor(inventory, 'tea-set')).toBe(false);
    expect(visibleDecor(inventory, [])).toEqual(['paper-fan', 'bonsai', 'koi-scroll']);
    expect(
      visibleDecor(inventory, [
        { id: 'bonsai', visible: false, updatedAt: T },
        { id: 'paper-fan', visible: true, updatedAt: T },
      ]),
    ).toEqual(['paper-fan', 'koi-scroll']);
    expect(visibleDecor([{ id: decorInventoryId('bonsai'), qty: 0, updatedAt: T }], [])).toEqual(
      [],
    );
  });
});
