import { useCallback, useEffect, useState } from 'react';
import {
  WALLET,
  adjustInventory,
  completeTask,
  createRecipe,
  createTask,
  markInProgress,
  nextStepIndex,
  purchase,
  visibleDecor,
  readWallet,
  recipeSteps,
  reopenTask,
  reorderSteps,
  rewardDeltas,
  updateRecipe,
  updateTask,
  type InventoryItem,
  type Placement,
  type Recipe,
  type RecipeKind,
  type StepReward,
  type Task,
  type Wallet,
  type WalletId,
} from '@wokflow/core';
import type { WokflowStore } from '@wokflow/data';

export interface TaskForm {
  title: string;
  notes: string;
  dueAt: string;
  estSessions: number;
  tags: string;
  recipeId?: string;
}

export interface RecipeForm {
  title: string;
  kind: RecipeKind;
  dueAt: string;
}

const newId = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();
const splitTags = (raw: string) => raw.split(',');

export interface Kitchen {
  loaded: boolean;
  tasks: Task[];
  recipes: Recipe[];
  wallet: Wallet;
  inventory: InventoryItem[];
  placements: Placement[];
  /** Owned, non-hidden decor ids to draw in the kitchen. */
  decor: string[];
  /** Validate and buy a shop item. Throws ValidationError if owned or unaffordable. */
  buyDecor(id: string): Promise<void>;
  setDecorVisible(id: string, visible: boolean): Promise<void>;
  saveTask(form: TaskForm, existing?: Task): Promise<Task>;
  deleteTask(task: Task): Promise<void>;
  /** Complete or reopen. Returns the reward when completing a recipe step. */
  toggleDone(task: Task): Promise<StepReward | undefined>;
  addStep(recipe: Recipe, title: string): Promise<Task>;
  moveStep(recipe: Recipe, task: Task, direction: -1 | 1): Promise<void>;
  saveRecipe(form: RecipeForm, existing?: Recipe): Promise<Recipe>;
  /** Deletes the recipe and all of its steps. */
  deleteRecipe(recipe: Recipe): Promise<void>;
  startedSession(task: Task): Promise<void>;
  earn(id: WalletId, amount: number): Promise<void>;
}

interface Snapshot {
  tasks: Task[];
  recipes: Recipe[];
  inventory: InventoryItem[];
  placements: Placement[];
}

async function loadSnapshot(store: WokflowStore): Promise<Snapshot> {
  const [tasks, recipes, inventory, placements] = await Promise.all([
    store.tasks.list(),
    store.recipes.list(),
    store.inventory.list(),
    store.placements.list(),
  ]);
  return { tasks, recipes, inventory, placements };
}

/** All persistent kitchen state, loaded from and written through the platform store. */
export function useKitchen(store: WokflowStore): Kitchen {
  const [loaded, setLoaded] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);

  const apply = useCallback((snapshot: Snapshot) => {
    setTasks(snapshot.tasks);
    setRecipes(snapshot.recipes);
    setInventory(snapshot.inventory);
    setPlacements(snapshot.placements);
    setLoaded(true);
  }, []);

  const reload = useCallback(async () => apply(await loadSnapshot(store)), [store, apply]);

  // Initial load; ignore the result if the store changed before it arrived.
  useEffect(() => {
    let live = true;
    loadSnapshot(store).then((snapshot) => {
      if (live) apply(snapshot);
    }, console.error);
    return () => {
      live = false;
    };
  }, [store, apply]);

  /** Adjust any inventory item: a currency (WalletId) or an owned decor item. */
  const earn = useCallback(
    async (id: string, amount: number) => {
      await store.inventory.put(
        adjustInventory(await store.inventory.get(id), id, amount, nowIso()),
      );
    },
    [store],
  );

  const saveTask = useCallback<Kitchen['saveTask']>(
    async (form, existing) => {
      const now = nowIso();
      const fields = {
        title: form.title,
        notes: form.notes,
        dueAt: form.dueAt,
        estSessions: form.estSessions,
        tags: splitTags(form.tags),
      };
      let task: Task;
      if (existing) {
        task = updateTask(existing, fields, now);
      } else {
        const all = await store.tasks.list();
        task = createTask(
          {
            ...fields,
            ...(form.recipeId !== undefined
              ? { recipeId: form.recipeId, stepIndex: nextStepIndex(all, form.recipeId) }
              : {}),
          },
          newId(),
          now,
        );
      }
      await store.tasks.put(task);
      await reload();
      return task;
    },
    [store, reload],
  );

  const deleteTask = useCallback<Kitchen['deleteTask']>(
    async (task) => {
      await store.tasks.remove(task.id);
      // Close the gap in the recipe's step order.
      if (task.recipeId) {
        const all = await store.tasks.list();
        const ids = recipeSteps(all, task.recipeId).map((t) => t.id);
        for (const moved of reorderSteps(all, task.recipeId, ids, nowIso()))
          await store.tasks.put(moved);
      }
      await reload();
    },
    [store, reload],
  );

  const toggleDone = useCallback<Kitchen['toggleDone']>(
    async (task) => {
      const now = nowIso();
      if (task.status === 'done') {
        await store.tasks.put(reopenTask(task, now));
        await reload();
        return undefined;
      }
      const all = await store.tasks.list();
      const recipe = task.recipeId ? await store.recipes.get(task.recipeId) : undefined;
      const { task: done, reward } = completeTask(task, all, recipe, now);
      await store.tasks.put(done);
      if (reward) for (const [id, delta] of rewardDeltas(reward)) await earn(id, delta);
      await reload();
      return reward;
    },
    [store, reload, earn],
  );

  const addStep = useCallback<Kitchen['addStep']>(
    (recipe, title) =>
      saveTask({ title, notes: '', dueAt: '', estSessions: 1, tags: '', recipeId: recipe.id }),
    [saveTask],
  );

  const moveStep = useCallback<Kitchen['moveStep']>(
    async (recipe, task, direction) => {
      const all = await store.tasks.list();
      const ids = recipeSteps(all, recipe.id).map((t) => t.id);
      const from = ids.indexOf(task.id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= ids.length) return;
      [ids[from], ids[to]] = [ids[to]!, ids[from]!];
      for (const moved of reorderSteps(all, recipe.id, ids, nowIso())) await store.tasks.put(moved);
      await reload();
    },
    [store, reload],
  );

  const saveRecipe = useCallback<Kitchen['saveRecipe']>(
    async (form, existing) => {
      const now = nowIso();
      const recipe = existing
        ? updateRecipe(
            existing,
            { title: form.title, kind: form.kind, dueAt: form.dueAt || null },
            now,
          )
        : createRecipe(form, newId(), now);
      await store.recipes.put(recipe);
      await reload();
      return recipe;
    },
    [store, reload],
  );

  const deleteRecipe = useCallback<Kitchen['deleteRecipe']>(
    async (recipe) => {
      for (const step of await store.tasks.list((t) => t.recipeId === recipe.id)) {
        await store.tasks.remove(step.id);
      }
      await store.recipes.remove(recipe.id);
      await reload();
    },
    [store, reload],
  );

  const startedSession = useCallback<Kitchen['startedSession']>(
    async (task) => {
      const next = markInProgress(task, nowIso());
      if (next !== task) {
        await store.tasks.put(next);
        await reload();
      }
    },
    [store, reload],
  );

  const buyDecor = useCallback<Kitchen['buyDecor']>(
    async (id) => {
      const items = await store.inventory.list();
      const deltas = purchase(items, readWallet(items), id);
      for (const [itemId, delta] of deltas) await earn(itemId, delta);
      await reload();
    },
    [store, earn, reload],
  );

  const setDecorVisible = useCallback<Kitchen['setDecorVisible']>(
    async (id, visible) => {
      await store.placements.put({ id, visible, updatedAt: nowIso() });
      await reload();
    },
    [store, reload],
  );

  const earnAndReload = useCallback<Kitchen['earn']>(
    async (id, amount) => {
      await earn(id, amount);
      await reload();
    },
    [earn, reload],
  );

  return {
    loaded,
    tasks,
    recipes,
    wallet: readWallet(inventory),
    inventory,
    placements,
    decor: visibleDecor(inventory, placements),
    buyDecor,
    setDecorVisible,
    saveTask,
    deleteTask,
    toggleDone,
    addStep,
    moveStep,
    saveRecipe,
    deleteRecipe,
    startedSession,
    earn: earnAndReload,
  };
}

export { WALLET };
