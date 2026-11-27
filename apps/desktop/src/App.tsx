import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
  WALLET,
  companionStateFor,
  createSession,
  finishSimmer,
  markAway,
  markBack,
  pauseSimmer,
  planReminders,
  potReminder,
  remainingMs,
  resumeSimmer,
  serveSession,
  startSimmer,
  type Recipe,
  type Session,
  type Task,
} from '@wokflow/core';
import { pickLine } from '@wokflow/companion';
import type { Platform } from '@wokflow/data';
import { selectPack } from './packs';
import { useSettings } from './state/useSettings';
import { SettingsView } from './views/SettingsView';
import { Shop } from './views/Shop';
import { useKitchen } from './state/useKitchen';
import { Menu } from './views/Menu';
import { RecipeEditor } from './views/RecipeEditor';
import { Plate, Prep, Simmer } from './views/Session';
import { TaskEditor } from './views/TaskEditor';
import { Timer } from './views/Timer';

// PixiJS is large; load the scene after the menu so the app is usable immediately.
const KitchenScene = lazy(() =>
  import('./scene/KitchenScene').then((m) => ({ default: m.KitchenScene })),
);

type Panel =
  | { view: 'menu' }
  | { view: 'prep'; task: Task }
  | { view: 'editTask'; task: Task | undefined }
  | { view: 'editRecipe'; recipe: Recipe | undefined }
  | { view: 'settings' }
  | { view: 'shop' };

export function App({ platform }: { platform: Platform }) {
  const kitchen = useKitchen(platform.store);
  const settingsState = useSettings(platform.store);
  const { settings } = settingsState;
  const graceMs = settings.awayGraceSec * 1000;
  const companion = useMemo(() => selectPack(settings.companionPack), [settings.companionPack]);
  const { pack } = companion;
  const [panel, setPanel] = useState<Panel>({ view: 'menu' });
  const [session, setSession] = useState<Session | undefined>();
  const [flash, setFlash] = useState<string>();
  const [now, setNow] = useState(() => Date.now());

  // Persist every session change.
  useEffect(() => {
    if (session) void platform.store.sessions.put(session);
  }, [platform, session]);

  // Tick once a second while simmering.
  const simmering = session?.phase === 'simmer';
  useEffect(() => {
    if (!simmering) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [simmering]);

  // Leave detection (ADR 0003).
  useEffect(() => {
    if (!simmering) return;
    const offHidden = platform.onAppHidden(() => setSession((s) => s && markAway(s, Date.now())));
    const offVisible = platform.onAppVisible(() =>
      setSession((s) => s && markBack(s, Date.now(), graceMs)),
    );
    return () => {
      offHidden();
      offVisible();
    };
  }, [platform, simmering, graceMs]);

  // Reminders: due dates, the daily nudge, and "order up" for a running session.
  // Recomputed when anything they depend on changes; each call replaces the scheduled set.
  const reminderKey = JSON.stringify([
    kitchen.tasks.map((t) => [t.id, t.status, t.dueAt, t.recipeId]),
    kitchen.recipes.map((r) => [r.id, r.dueAt, r.title]),
    settings.dueReminders,
    settings.dailyNudge,
    session?.id,
    session?.phase,
    session?.runningSince,
    session?.awaySince,
    session?.focusedMs,
  ]);
  useEffect(() => {
    if (!kitchen.loaded || !settingsState.loaded) return;
    const at = Date.now();
    const plan = planReminders(kitchen.tasks, kitchen.recipes, settings, at);
    const pot = potReminder(
      session,
      kitchen.tasks.find((t) => t.id === session?.taskId)?.title,
      at,
    );
    platform
      .scheduleReminders(pot ? [pot, ...plan] : plan)
      .catch((err: unknown) => console.warn('[wokflow] could not schedule reminders:', err));
    // reminderKey captures every input; the objects themselves change identity every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform, reminderKey, kitchen.loaded, settingsState.loaded]);

  const companionState = companionStateFor(session);
  const line = useMemo(() => pickLine(pack, companionState), [pack, companionState]);
  const activeTask = kitchen.tasks.find((t) => t.id === session?.taskId);
  const backToMenu = () => setPanel({ view: 'menu' });

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="seal" aria-hidden="true">
            锅
          </span>
          <div>
            <div className="brand-name">WokFlow</div>
            <div className="brand-tag">Fire up · find your flow</div>
          </div>
        </div>
        <div className="row" role="group" aria-label="Wallet">
          <span className="purse">
            <span className="coin" aria-hidden="true" /> {kitchen.wallet.coins} coins
          </span>
          <span className="purse">
            <span className="chili" aria-hidden="true" /> {kitchen.wallet.ingredients} ingredients
          </span>
          {kitchen.wallet.rareDecor > 0 && (
            <span className="purse">✦ {kitchen.wallet.rareDecor} rare decor</span>
          )}
          <button
            type="button"
            className="btn small market-btn"
            disabled={Boolean(session)}
            onClick={() => setPanel({ view: 'shop' })}
          >
            Market
          </button>
          <button
            type="button"
            className="icon-btn on-wood"
            aria-label="Settings"
            disabled={Boolean(session)}
            onClick={() => setPanel({ view: 'settings' })}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </button>
        </div>
      </header>

      <main className="layout">
        <section className="scene" aria-label="Kitchen">
          <Suspense fallback={null}>
            {settingsState.loaded && (
              <KitchenScene
                state={companionState}
                companion={companion}
                motion={settings.motion}
                decor={kitchen.decor}
              />
            )}
          </Suspense>
          <p className="bubble" aria-live="polite">
            <span className="sr-only">{pack.name} says: </span>
            {line}
          </p>
          {session && (session.phase === 'simmer' || session.phase === 'paused') && (
            <div role="timer" aria-live="off" className="timer-wrap">
              <Timer
                remainingMs={remainingMs(session, now)}
                plannedMs={session.plannedMin * 60_000}
                task={activeTask?.title}
                label={session.phase === 'paused' ? 'Paused' : 'Simmering'}
                note={session.awayCount > 0 ? `Stepped away ${session.awayCount}×` : undefined}
              />
            </div>
          )}
        </section>

        <aside className="panel">
          {session && (session.phase === 'simmer' || session.phase === 'paused') && (
            <Simmer
              session={session}
              onPause={() => setSession(pauseSimmer(session, Date.now(), graceMs))}
              onResume={() => setSession(resumeSimmer(session, Date.now()))}
              onFinish={() => setSession(finishSimmer(session, Date.now(), graceMs))}
              onPark={(text) =>
                void platform.store.parkingLot.put({
                  id: crypto.randomUUID(),
                  sessionId: session.id,
                  text,
                  resolved: false,
                  createdAt: new Date().toISOString(),
                })
              }
            />
          )}

          {session?.phase === 'plate' && (
            <Plate
              session={session}
              onServe={({ reflection, focusRating, stepDone }) => {
                void (async () => {
                  const served = serveSession(session, { reflection, focusRating }, Date.now());
                  await platform.store.sessions.put(served);
                  await kitchen.earn(WALLET.coins, served.coinsEarned ?? 0);
                  let message = `Served! +${served.coinsEarned ?? 0} coins`;
                  if (stepDone && activeTask && activeTask.status !== 'done') {
                    const reward = await kitchen.toggleDone(activeTask);
                    if (reward) message += `, +${reward.ingredients} ingredient`;
                    if (reward?.rareDecorUnlock) message += ', rare decor unlocked';
                  }
                  setFlash(message);
                  setSession(undefined);
                  backToMenu();
                })();
              }}
            />
          )}

          {!session && panel.view === 'menu' && (
            <Menu
              kitchen={kitchen}
              flash={flash}
              onReward={setFlash}
              onPrep={(task) => {
                setFlash(undefined);
                setPanel({ view: 'prep', task });
              }}
              onEditTask={(task) => setPanel({ view: 'editTask', task })}
              onEditRecipe={(recipe) => setPanel({ view: 'editRecipe', recipe })}
            />
          )}

          {!session && panel.view === 'prep' && (
            <Prep
              task={panel.task}
              defaultMin={settings.defaultSimmerMin}
              onCancel={backToMenu}
              onStart={(input) => {
                const t = Date.now();
                const s = startSimmer(
                  createSession({ id: crypto.randomUUID(), taskId: panel.task.id, ...input }, t),
                  t,
                );
                void kitchen.startedSession(panel.task);
                setNow(t);
                setSession(s);
              }}
            />
          )}

          {!session && panel.view === 'editTask' && (
            <TaskEditor
              key={panel.task?.id ?? 'new'}
              kitchen={kitchen}
              task={panel.task}
              onDone={backToMenu}
            />
          )}

          {!session && panel.view === 'editRecipe' && (
            <RecipeEditor
              key={panel.recipe?.id ?? 'new'}
              kitchen={kitchen}
              recipe={panel.recipe}
              onDone={backToMenu}
            />
          )}
          {!session && panel.view === 'settings' && settingsState.loaded && (
            <SettingsView state={settingsState} onDone={backToMenu} />
          )}
          {!session && panel.view === 'shop' && <Shop kitchen={kitchen} onDone={backToMenu} />}
        </aside>
      </main>
    </div>
  );
}
