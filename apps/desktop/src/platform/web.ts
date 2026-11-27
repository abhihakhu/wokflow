import type { Recipe, Task } from '@wokflow/core';
import { createMemoryStore, type Platform } from '@wokflow/data';
import { createTimeoutScheduler } from './scheduler';
import { visibility, webNotify } from './visibility';

const now = new Date().toISOString();

const demoRecipe: Recipe = {
  id: 'demo-exam',
  title: 'ECE 264 exam review',
  kind: 'signature',
  createdAt: now,
  updatedAt: now,
};

const step = (id: string, title: string, stepIndex: number, done = false): Task => ({
  id,
  title,
  estSessions: 1,
  tags: ['ece264'],
  recipeId: demoRecipe.id,
  stepIndex,
  status: done ? 'done' : 'todo',
  createdAt: now,
  updatedAt: now,
});

/** Demo data for the browser build. The desktop app (Tauri) starts empty and persists to SQLite. */
const demoTasks: Task[] = [
  step('demo-1', 'Pointers & addresses', 0, true),
  step('demo-2', 'Structs & malloc', 1, true),
  step('demo-3', 'Linked lists: insert & free', 2),
  step('demo-4', 'Recursion on lists', 3),
  step('demo-5', 'Practice exam (boss round)', 4),
  {
    id: 'demo-6',
    title: 'Lab 9 write-up',
    estSessions: 2,
    tags: ['lab'],
    status: 'todo',
    createdAt: now,
    updatedAt: now,
  },
];

/** Browser platform: in-memory demo data (resets on reload). */
export function createWebPlatform(): Platform {
  return {
    store: createMemoryStore({ tasks: demoTasks, recipes: [demoRecipe] }),
    notify: webNotify,
    scheduleReminders: createTimeoutScheduler(webNotify),
    ...visibility,
  };
}
