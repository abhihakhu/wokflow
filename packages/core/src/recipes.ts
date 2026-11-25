import type { Recipe, RecipeKind, Task, Timestamp } from './types.js';
import { ValidationError, optionalDate, requireTitle } from './validation.js';

export interface NewRecipeInput {
  title: string;
  kind: RecipeKind;
  dueAt?: string;
}

function requireKind(kind: string): RecipeKind {
  if (kind !== 'recipe' && kind !== 'signature') {
    throw new ValidationError('Pick recipe or signature dish.', 'kind');
  }
  return kind;
}

export function createRecipe(input: NewRecipeInput, id: string, now: Timestamp): Recipe {
  const kind = requireKind(input.kind);
  const dueAt = optionalDate(input.dueAt);
  return {
    id,
    title: requireTitle(input.title),
    kind,
    ...(dueAt !== undefined ? { dueAt } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

export interface RecipePatch {
  title?: string;
  kind?: RecipeKind;
  dueAt?: string | null;
}

export function updateRecipe(recipe: Recipe, patch: RecipePatch, now: Timestamp): Recipe {
  const next: Recipe = { ...recipe, updatedAt: now };
  if (patch.title !== undefined) next.title = requireTitle(patch.title);
  if (patch.kind !== undefined) next.kind = requireKind(patch.kind);
  if (patch.dueAt !== undefined) {
    const dueAt = patch.dueAt === null ? undefined : optionalDate(patch.dueAt);
    if (dueAt === undefined) delete next.dueAt;
    else next.dueAt = dueAt;
  }
  return next;
}

/** The stepIndex a newly added step should get (appends to the end). */
export function nextStepIndex(tasks: readonly Task[], recipeId: string): number {
  return tasks
    .filter((t) => t.recipeId === recipeId)
    .reduce((max, t) => Math.max(max, (t.stepIndex ?? -1) + 1), 0);
}

/**
 * Reorder a recipe's steps. `orderedIds` must list every step exactly once.
 * Returns only the steps whose position changed (so callers write the minimum).
 */
export function reorderSteps(
  tasks: readonly Task[],
  recipeId: string,
  orderedIds: readonly string[],
  now: Timestamp,
): Task[] {
  const steps = tasks.filter((t) => t.recipeId === recipeId);
  const ids = new Set(steps.map((t) => t.id));
  if (
    orderedIds.length !== ids.size ||
    new Set(orderedIds).size !== ids.size ||
    !orderedIds.every((id) => ids.has(id))
  ) {
    throw new ValidationError('The new order must list every step exactly once.', 'stepIndex');
  }
  const byId = new Map(steps.map((t) => [t.id, t]));
  return orderedIds.flatMap((id, index) => {
    const step = byId.get(id)!;
    return step.stepIndex === index ? [] : [{ ...step, stepIndex: index, updatedAt: now }];
  });
}

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
