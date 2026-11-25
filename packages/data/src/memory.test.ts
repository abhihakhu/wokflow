import { describe, expect, it } from 'vitest';
import type { Task } from '@wokflow/core';
import { createMemoryCollection, createMemoryStore } from './memory.js';

const task: Task = {
  id: 't1',
  title: 'Linked lists: insert & free',
  estSessions: 2,
  tags: ['ece264'],
  status: 'todo',
  createdAt: '2026-11-24T00:00:00.000Z',
  updatedAt: '2026-11-24T00:00:00.000Z',
};

describe('memory collection', () => {
  it('puts, gets, lists, filters and removes', async () => {
    const c = createMemoryCollection<Task>();
    await c.put(task);
    await c.put({ ...task, id: 't2', status: 'done' });
    expect((await c.get('t1'))?.title).toBe(task.title);
    expect(await c.list()).toHaveLength(2);
    expect((await c.list((t) => t.status === 'done')).map((t) => t.id)).toEqual(['t2']);
    expect(await c.remove('t1')).toBe(true);
    expect(await c.remove('t1')).toBe(false);
    expect(await c.get('t1')).toBeUndefined();
  });

  it('isolates stored data from caller mutation', async () => {
    const c = createMemoryCollection<Task>([task]);
    const got = await c.get('t1');
    got!.tags.push('mutated');
    expect((await c.get('t1'))?.tags).toEqual(['ece264']);
    expect(task.tags).toEqual(['ece264']);
  });

  it('replaces by id', async () => {
    const c = createMemoryCollection<Task>([task]);
    await c.put({ ...task, title: 'Renamed' });
    expect(await c.list()).toHaveLength(1);
    expect((await c.get('t1'))?.title).toBe('Renamed');
  });
});

describe('memory store', () => {
  it('creates every collection, optionally seeded', async () => {
    const store = createMemoryStore({ tasks: [task] });
    expect(await store.tasks.list()).toHaveLength(1);
    expect(await store.recipes.list()).toEqual([]);
    expect(await store.sessions.list()).toEqual([]);
    expect(await store.parkingLot.list()).toEqual([]);
    expect(await store.inventory.list()).toEqual([]);
  });
});
