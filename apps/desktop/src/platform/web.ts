import type { Task } from '@wokflow/core';
import { createMemoryStore, type Platform } from '@wokflow/data';

const now = new Date().toISOString();

/** Demo data so the dev build has something to cook. Replaced by SQLite in milestone 2. */
const seedTasks: Task[] = [
  {
    id: 'demo-1',
    title: 'Linked lists: insert & free',
    estSessions: 2,
    tags: ['ece264'],
    recipeId: 'exam-review',
    stepIndex: 2,
    status: 'todo',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'demo-2',
    title: 'Recursion on lists',
    estSessions: 1,
    tags: ['ece264'],
    recipeId: 'exam-review',
    stepIndex: 3,
    status: 'todo',
    createdAt: now,
    updatedAt: now,
  },
];

/**
 * Browser/Tauri-webview platform: in-memory store, Web Notifications,
 * and the Page Visibility API for leave detection.
 */
export function createWebPlatform(): Platform {
  return {
    store: createMemoryStore({ tasks: seedTasks }),
    async notify(title, body) {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'default') await Notification.requestPermission();
      if (Notification.permission === 'granted') new Notification(title, { body });
    },
    onAppHidden(cb) {
      const handler = () => {
        if (document.visibilityState === 'hidden') cb();
      };
      document.addEventListener('visibilitychange', handler);
      return () => document.removeEventListener('visibilitychange', handler);
    },
    onAppVisible(cb) {
      const handler = () => {
        if (document.visibilityState === 'visible') cb();
      };
      document.addEventListener('visibilitychange', handler);
      return () => document.removeEventListener('visibilitychange', handler);
    },
  };
}
