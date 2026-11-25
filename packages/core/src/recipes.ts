import type { Task } from './types.js';

export interface RecipeProgress {
  done: number;
  total: number;
  /** 0–1; 0 for an empty recipe. */
  ratio: number;
  /** The first unfinished step in order, if any. */
  next?: Task;
  complete: boolean;
}

/** Steps of a recipe, ordered by stepIndex (then creation time as a tiebreak). */
export function recipeSteps(tasks: readonly Task[], recipeId: string): Task[] {
  return tasks
    .filter((t) => t.recipeId === recipeId)
    .sort(
      (a, b) =>
        (a.stepIndex ?? Number.MAX_SAFE_INTEGER) - (b.stepIndex ?? Number.MAX_SAFE_INTEGER) ||
        a.createdAt.localeCompare(b.createdAt),
    );
}

export function recipeProgress(tasks: readonly Task[], recipeId: string): RecipeProgress {
  const steps = recipeSteps(tasks, recipeId);
  const done = steps.filter((t) => t.status === 'done').length;
  const total = steps.length;
  const next = steps.find((t) => t.status !== 'done');
  return {
    done,
    total,
    ratio: total === 0 ? 0 : done / total,
    ...(next ? { next } : {}),
    complete: total > 0 && done === total,
  };
}

/** True when completing `task` would finish its recipe. */
export function isFinalStep(tasks: readonly Task[], task: Task): boolean {
  if (!task.recipeId) return false;
  const remaining = recipeSteps(tasks, task.recipeId).filter(
    (t) => t.status !== 'done' && t.id !== task.id,
  );
  return remaining.length === 0;
}
