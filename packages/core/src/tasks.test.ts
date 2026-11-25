import { describe, expect, it } from 'vitest';
import { createRecipe } from './recipes.js';
import {
  completeTask,
  createTask,
  markInProgress,
  reopenTask,
  sortForMenu,
  updateTask,
} from './tasks.js';
import { ValidationError } from './validation.js';

const T0 = '2026-11-24T20:00:00.000Z';
const T1 = '2026-11-25T08:00:00.000Z';

describe('createTask', () => {
  it('normalizes input', () => {
    const t = createTask(
      {
        title: '  Linked   lists  ',
        notes: '  bring the notebook ',
        dueAt: '2026-12-08',
        estSessions: 3,
        tags: [' ECE264 ', 'ece264', '', 'Exam'],
      },
      't1',
      T0,
    );
    expect(t).toEqual({
      id: 't1',
      title: 'Linked lists',
      notes: 'bring the notebook',
      dueAt: '2026-12-08',
      estSessions: 3,
      tags: ['ece264', 'exam'],
      status: 'todo',
      createdAt: T0,
      updatedAt: T0,
    });
  });

  it('defaults to one session, no tags, and omits empty optionals', () => {
    const t = createTask({ title: 'Read ch. 5', notes: '   ', dueAt: '' }, 't2', T0);
    expect(t.estSessions).toBe(1);
    expect(t.tags).toEqual([]);
    expect(t).not.toHaveProperty('notes');
    expect(t).not.toHaveProperty('dueAt');
  });

  it('normalizes full timestamps to UTC', () => {
    expect(createTask({ title: 'x', dueAt: '2026-12-08T09:00:00-08:00' }, 't', T0).dueAt).toBe(
      '2026-12-08T17:00:00.000Z',
    );
  });

  it.each([
    [{ title: '   ' }, 'title'],
    [{ title: 'x'.repeat(121) }, 'title'],
    [{ title: 'x', dueAt: 'next tuesday' }, 'dueAt'],
    [{ title: 'x', dueAt: '2026-02-30' }, 'dueAt'],
    [{ title: 'x', dueAt: '2026-13-40' }, 'dueAt'],
    [{ title: 'x', estSessions: 0 }, 'estSessions'],
    [{ title: 'x', estSessions: 1.5 }, 'estSessions'],
    [{ title: 'x', tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }, 'tags'],
    [{ title: 'x', notes: 'n'.repeat(4001) }, 'notes'],
    [{ title: 'x', stepIndex: 0 }, 'stepIndex'],
    [{ title: 'x', recipeId: 'r', stepIndex: -1 }, 'stepIndex'],
  ])('rejects %o on field %s', (input, field) => {
    try {
      createTask(input, 't', T0);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).field).toBe(field);
    }
  });
});

describe('updateTask', () => {
  const base = createTask(
    { title: 'Old', notes: 'keep?', dueAt: '2026-12-01', tags: ['a'] },
    't1',
    T0,
  );

  it('applies changes and bumps updatedAt', () => {
    const t = updateTask(base, { title: 'New', estSessions: 2, tags: ['B'] }, T1);
    expect(t).toMatchObject({ title: 'New', estSessions: 2, tags: ['b'], updatedAt: T1 });
    expect(t.notes).toBe('keep?');
    expect(base.title).toBe('Old');
  });

  it('clears optionals with null or blank', () => {
    const t = updateTask(base, { notes: null, dueAt: null }, T1);
    expect(t).not.toHaveProperty('notes');
    expect(t).not.toHaveProperty('dueAt');
    const blank = updateTask(base, { notes: '  ', dueAt: '' }, T1);
    expect(blank).not.toHaveProperty('notes');
    expect(blank).not.toHaveProperty('dueAt');
  });

  it('sets optionals', () => {
    const t = updateTask(base, { notes: 'new note', dueAt: '2026-12-10' }, T1);
    expect(t).toMatchObject({ notes: 'new note', dueAt: '2026-12-10' });
  });

  it('validates', () => {
    expect(() => updateTask(base, { title: '' }, T1)).toThrow(ValidationError);
  });
});

describe('status changes', () => {
  const recipe = createRecipe({ title: 'ECE 264 exam review', kind: 'signature' }, 'r1', T0);
  const s1 = createTask({ title: 'Pointers', recipeId: 'r1', stepIndex: 0 }, 's1', T0);
  const s2 = createTask({ title: 'Lists', recipeId: 'r1', stepIndex: 1 }, 's2', T0);
  const loose = createTask({ title: 'Laundry' }, 'l1', T0);

  it('marks todo as in progress only once', () => {
    const t = markInProgress(loose, T1);
    expect(t.status).toBe('in_progress');
    expect(markInProgress(t, T1)).toBe(t);
  });

  it('completes plain tasks without a step reward', () => {
    const done = completeTask(loose, [loose], undefined, T1);
    expect(done.task.status).toBe('done');
    expect(done.reward).toBeUndefined();
  });

  it('rewards recipe steps, with rare decor for finishing a signature dish', () => {
    const first = completeTask(s1, [s1, s2], recipe, T1);
    expect(first.reward).toEqual({ ingredients: 1, rareDecorUnlock: false });
    const last = completeTask(s2, [first.task, s2], recipe, T1);
    expect(last.reward).toEqual({ ingredients: 1, rareDecorUnlock: true });
  });

  it('refuses double completion and mismatched recipes', () => {
    const done = completeTask(loose, [loose], undefined, T1).task;
    expect(() => completeTask(done, [done], undefined, T1)).toThrow(/Already done/);
    expect(() => completeTask(s1, [s1], undefined, T1)).toThrow(/recipe/);
  });

  it('reopens done tasks', () => {
    const done = completeTask(loose, [loose], undefined, T1).task;
    expect(reopenTask(done, T1).status).toBe('todo');
    expect(reopenTask(loose, T1)).toBe(loose);
  });
});

describe('sortForMenu', () => {
  it('puts unfinished first, soonest due first, undated last, then by title', () => {
    const a = createTask({ title: 'B undated' }, 'a', T0);
    const b = createTask({ title: 'Soon', dueAt: '2026-11-30' }, 'b', T0);
    const c = createTask({ title: 'Later', dueAt: '2026-12-15' }, 'c', T0);
    const d = {
      ...createTask({ title: 'A done', dueAt: '2026-11-01' }, 'd', T0),
      status: 'done' as const,
    };
    const e = createTask({ title: 'A undated' }, 'e', T0);
    expect(sortForMenu([a, b, c, d, e]).map((t) => t.id)).toEqual(['b', 'c', 'e', 'a', 'd']);
  });
});
