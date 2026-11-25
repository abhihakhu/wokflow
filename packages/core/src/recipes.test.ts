import { describe, expect, it } from 'vitest';
import { isFinalStep, recipeProgress, recipeSteps } from './recipes.js';
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
