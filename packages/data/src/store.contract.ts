import { describe, expect, it } from 'vitest';
import type { Recipe, Task } from '@wokflow/core';
import type { WokflowStore } from './repository.js';

/**
 * Behaviour every WokflowStore adapter must share. Each adapter's test file calls
 * this with a factory, so memory, SQLite (and later Capacitor) are held to one spec.
 */
export function describeStoreContract(name: string, makeStore: () => Promise<WokflowStore>): void {
  const task: Task = {
    id: 't1',
    title: 'Linked lists: insert & free',
    notes: 'Draw the boxes first',
    dueAt: '2026-12-08',
    estSessions: 2,
    tags: ['ece264'],
    recipeId: 'r1',
    stepIndex: 0,
    status: 'todo',
    createdAt: '2026-11-24T00:00:00.000Z',
    updatedAt: '2026-11-24T00:00:00.000Z',
  };
  const recipe: Recipe = {
    id: 'r1',
    title: 'ECE 264 exam review',
    kind: 'signature',
    createdAt: '2026-11-24T00:00:00.000Z',
    updatedAt: '2026-11-24T00:00:00.000Z',
  };

  describe(`${name} store contract`, () => {
    it('round-trips records exactly, including unicode', async () => {
      const store = await makeStore();
      const fancy = { ...task, id: 't-uni', title: 'Mise en place 锅 — “quotes” & emoji-free' };
      await store.tasks.put(task);
      await store.tasks.put(fancy);
      await store.recipes.put(recipe);
      expect(await store.tasks.get('t1')).toEqual(task);
      expect(await store.tasks.get('t-uni')).toEqual(fancy);
      expect(await store.recipes.get('r1')).toEqual(recipe);
      expect(await store.tasks.get('missing')).toBeUndefined();
    });

    it('lists in insertion order and filters', async () => {
      const store = await makeStore();
      await store.tasks.put(task);
      await store.tasks.put({ ...task, id: 't2', status: 'done' });
      await store.tasks.put({ ...task, id: 't3' });
      expect((await store.tasks.list()).map((t) => t.id)).toEqual(['t1', 't2', 't3']);
      expect((await store.tasks.list((t) => t.status === 'done')).map((t) => t.id)).toEqual(['t2']);
    });

    it('upserts by id without duplicating or reordering', async () => {
      const store = await makeStore();
      await store.tasks.put(task);
      await store.tasks.put({ ...task, id: 't2' });
      await store.tasks.put({ ...task, title: 'Renamed', updatedAt: '2026-11-25T00:00:00.000Z' });
      const all = await store.tasks.list();
      expect(all.map((t) => t.id)).toEqual(['t1', 't2']);
      expect(all[0]?.title).toBe('Renamed');
    });

    it('drops optional fields that were removed on update', async () => {
      const store = await makeStore();
      await store.tasks.put(task);
      const { notes: _notes, dueAt: _dueAt, ...bare } = task;
      await store.tasks.put(bare);
      const got = await store.tasks.get('t1');
      expect(got).not.toHaveProperty('notes');
      expect(got).not.toHaveProperty('dueAt');
    });

    it('removes and reports whether anything was removed', async () => {
      const store = await makeStore();
      await store.tasks.put(task);
      expect(await store.tasks.remove('t1')).toBe(true);
      expect(await store.tasks.remove('t1')).toBe(false);
      expect(await store.tasks.list()).toEqual([]);
    });

    it('returns copies, not live references', async () => {
      const store = await makeStore();
      const saved = await store.tasks.put(task);
      saved.tags.push('mutated');
      const got = await store.tasks.get('t1');
      got!.tags.push('mutated-again');
      expect((await store.tasks.get('t1'))?.tags).toEqual(['ece264']);
    });

    it('keeps collections separate', async () => {
      const store = await makeStore();
      await store.tasks.put(task);
      await store.inventory.put({ id: 't1', qty: 5, updatedAt: '2026-11-24T00:00:00.000Z' });
      expect((await store.tasks.get('t1'))?.title).toBe(task.title);
      expect((await store.inventory.get('t1'))?.qty).toBe(5);
      expect(await store.sessions.list()).toEqual([]);
      expect(await store.parkingLot.list()).toEqual([]);
    });
  });
}
