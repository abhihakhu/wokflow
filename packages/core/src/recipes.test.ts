import { describe, expect, it } from 'vitest';
import {
  createRecipe,
  isFinalStep,
  nextStepIndex,
  recipeProgress,
  recipeSteps,
  reorderSteps,
  updateRecipe,
} from './recipes.js';
import type { Task } from './types.js';

let n = 0;
function task(overrides: Partial<Task>): Task {
  n += 1;
  return {
    id: `t${n}`,
    title: `Task ${n}`,
    estSessions: 1,
    tags: [],
    status: 'todo',
    createdAt: `2026-11-0${(n % 9) + 1}T00:00:00.000Z`,
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

const exam = [
  task({ id: 'a', recipeId: 'r1', stepIndex: 0, status: 'done', title: 'Pointers' }),
  task({ id: 'c', recipeId: 'r1', stepIndex: 2, title: 'Recursion' }),
  task({ id: 'b', recipeId: 'r1', stepIndex: 1, title: 'Linked lists' }),
  task({ id: 'x', title: 'Unrelated' }),
];

describe('recipes', () => {
  it('orders steps by stepIndex', () => {
    expect(recipeSteps(exam, 'r1').map((t) => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('falls back to creation time when stepIndex is missing', () => {
    const loose = [
      task({ id: 'late', recipeId: 'r2', createdAt: '2026-11-09T00:00:00.000Z' }),
      task({ id: 'early', recipeId: 'r2', createdAt: '2026-11-01T00:00:00.000Z' }),
    ];
    expect(recipeSteps(loose, 'r2').map((t) => t.id)).toEqual(['early', 'late']);
  });

  it('reports progress and the next step', () => {
    const p = recipeProgress(exam, 'r1');
    expect(p).toMatchObject({ done: 1, total: 3, complete: false });
    expect(p.ratio).toBeCloseTo(1 / 3);
    expect(p.next?.id).toBe('b');
  });

  it('handles empty and complete recipes', () => {
    expect(recipeProgress(exam, 'missing')).toEqual({
      done: 0,
      total: 0,
      ratio: 0,
      complete: false,
    });
    const finished = exam.map((t) => (t.recipeId === 'r1' ? { ...t, status: 'done' as const } : t));
    const p = recipeProgress(finished, 'r1');
    expect(p.complete).toBe(true);
    expect(p.next).toBeUndefined();
  });

  it('detects the final step', () => {
    const [a, c, b, x] = exam as [Task, Task, Task, Task];
    expect(isFinalStep(exam, b)).toBe(false);
    const almost = exam.map((t) => (t.id === 'b' ? { ...t, status: 'done' as const } : t));
    expect(isFinalStep(almost, c)).toBe(true);
    expect(isFinalStep(exam, x)).toBe(false);
    expect(a.status).toBe('done');
  });
});

describe('recipe editing', () => {
  const T0 = '2026-11-24T20:00:00.000Z';
  const T1 = '2026-11-25T08:00:00.000Z';

  it('creates and updates recipes with validation', () => {
    const r = createRecipe(
      { title: ' ECE 264 exam ', kind: 'signature', dueAt: '2026-12-10' },
      'r9',
      T0,
    );
    expect(r).toEqual({
      id: 'r9',
      title: 'ECE 264 exam',
      kind: 'signature',
      dueAt: '2026-12-10',
      createdAt: T0,
      updatedAt: T0,
    });
    const u = updateRecipe(r, { title: 'Final review', kind: 'recipe', dueAt: null }, T1);
    expect(u).toMatchObject({ title: 'Final review', kind: 'recipe', updatedAt: T1 });
    expect(u).not.toHaveProperty('dueAt');
    expect(updateRecipe(r, { dueAt: '2026-12-12' }, T1).dueAt).toBe('2026-12-12');
    expect(() => createRecipe({ title: 'x', kind: 'boss' as never }, 'r', T0)).toThrow(/signature/);
    expect(() => updateRecipe(r, { title: '' }, T1)).toThrow(/name/);
  });

  it('appends new steps at the end', () => {
    expect(nextStepIndex(exam, 'r1')).toBe(3);
    expect(nextStepIndex(exam, 'empty')).toBe(0);
  });

  it('reorders steps and returns only the moved ones', () => {
    const moved = reorderSteps(exam, 'r1', ['a', 'c', 'b'], T1);
    expect(moved.map((t) => [t.id, t.stepIndex])).toEqual([
      ['c', 1],
      ['b', 2],
    ]);
    expect(moved.every((t) => t.updatedAt === T1)).toBe(true);
  });

  it('rejects incomplete or duplicate orders', () => {
    expect(() => reorderSteps(exam, 'r1', ['a', 'b'], T1)).toThrow(/every step/);
    expect(() => reorderSteps(exam, 'r1', ['a', 'a', 'b'], T1)).toThrow(/every step/);
    expect(() => reorderSteps(exam, 'r1', ['a', 'b', 'x'], T1)).toThrow(/every step/);
  });
});
