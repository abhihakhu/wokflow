import { isFinalStep } from './recipes.js';
import { rewardForStep, type StepReward } from './rewards.js';
import type { Recipe, Task, TaskStatus, Timestamp } from './types.js';
import {
  ValidationError,
  normalizeTags,
  optionalDate,
  optionalNotes,
  requireTitle,
  sessionsEstimate,
} from './validation.js';

export interface NewTaskInput {
  title: string;
  notes?: string;
  /** ISO timestamp or YYYY-MM-DD. */
  dueAt?: string;
  estSessions?: number;
  tags?: string[];
  recipeId?: string;
  stepIndex?: number;
}

/** Build a task from raw form input. Throws ValidationError with the offending field. */
export function createTask(input: NewTaskInput, id: string, now: Timestamp): Task {
  if (
    input.stepIndex !== undefined &&
    (!Number.isInteger(input.stepIndex) || input.stepIndex < 0)
  ) {
    throw new ValidationError('Step order must be a whole number ≥ 0.', 'stepIndex');
  }
  if (input.stepIndex !== undefined && input.recipeId === undefined) {
    throw new ValidationError('Only recipe steps have a step order.', 'stepIndex');
  }
  const notes = optionalNotes(input.notes);
  const dueAt = optionalDate(input.dueAt);
  return {
    id,
    title: requireTitle(input.title),
    ...(notes !== undefined ? { notes } : {}),
    ...(dueAt !== undefined ? { dueAt } : {}),
    estSessions: sessionsEstimate(input.estSessions),
    tags: normalizeTags(input.tags),
    ...(input.recipeId !== undefined ? { recipeId: input.recipeId } : {}),
    ...(input.stepIndex !== undefined ? { stepIndex: input.stepIndex } : {}),
    status: 'todo',
    createdAt: now,
    updatedAt: now,
  };
}

/** Fields the edit form can change. `null` clears an optional field. */
export interface TaskPatch {
  title?: string;
  notes?: string | null;
  dueAt?: string | null;
  estSessions?: number;
  tags?: string[];
}

export function updateTask(task: Task, patch: TaskPatch, now: Timestamp): Task {
  const next: Task = { ...task, updatedAt: now };
  if (patch.title !== undefined) next.title = requireTitle(patch.title);
  if (patch.estSessions !== undefined) next.estSessions = sessionsEstimate(patch.estSessions);
  if (patch.tags !== undefined) next.tags = normalizeTags(patch.tags);
  if (patch.notes !== undefined) {
    const notes = patch.notes === null ? undefined : optionalNotes(patch.notes);
    if (notes === undefined) delete next.notes;
    else next.notes = notes;
  }
  if (patch.dueAt !== undefined) {
    const dueAt = patch.dueAt === null ? undefined : optionalDate(patch.dueAt);
    if (dueAt === undefined) delete next.dueAt;
    else next.dueAt = dueAt;
  }
  return next;
}

/** Starting a session on a todo marks it in progress; anything else is unchanged. */
export function markInProgress(task: Task, now: Timestamp): Task {
  return task.status === 'todo' ? { ...task, status: 'in_progress', updatedAt: now } : task;
}

export interface Completion {
  task: Task;
  /** Present for recipe steps; plain tasks earn their coins through sessions. */
  reward?: StepReward;
}

/**
 * Mark a task done. `allTasks` is needed to tell whether this finishes its recipe,
 * and `recipe` (when the task is a step) decides whether that unlocks rare decor.
 */
export function completeTask(
  task: Task,
  allTasks: readonly Task[],
  recipe: Recipe | undefined,
  now: Timestamp,
): Completion {
  if (task.status === 'done') throw new ValidationError('Already done.', 'status');
  if (task.recipeId !== undefined && recipe?.id !== task.recipeId) {
    throw new ValidationError('Pass the recipe this step belongs to.', 'recipeId');
  }
  const done: Task = { ...task, status: 'done', updatedAt: now };
  if (!recipe) return { task: done };
  return { task: done, reward: rewardForStep(recipe.kind, isFinalStep(allTasks, task)) };
}

/** Undo a completion. Rewards already granted are kept (no take-backs). */
export function reopenTask(task: Task, now: Timestamp): Task {
  if (task.status !== 'done') return task;
  const status: TaskStatus = 'todo';
  return { ...task, status, updatedAt: now };
}

/** Sort for the menu: unfinished first, then by due date (soonest first, undated last), then title. */
export function sortForMenu(tasks: readonly Task[]): Task[] {
  const rank = (t: Task) => (t.status === 'done' ? 1 : 0);
  return [...tasks].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.dueAt ?? '￿').localeCompare(b.dueAt ?? '￿') ||
      a.title.localeCompare(b.title),
  );
}
