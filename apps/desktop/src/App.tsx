import { useEffect, useMemo, useState } from 'react';
import {
  WALLET,
  companionStateFor,
  createSession,
  finishSimmer,
  markAway,
  markBack,
  pauseSimmer,
  remainingMs,
  resumeSimmer,
  serveSession,
  startSimmer,
  type Recipe,
  type Session,
  type Task,
} from '@wokflow/core';
import { parsePack, pickLine } from '@wokflow/companion';
import type { Platform } from '@wokflow/data';
import defaultPackJson from '../../../packs/default/pack.json';
import { formatClock } from './format';
import { useKitchen } from './state/useKitchen';
import { Menu } from './views/Menu';
import { RecipeEditor } from './views/RecipeEditor';
import { Plate, Prep, Simmer } from './views/Session';
import { TaskEditor } from './views/TaskEditor';

const pack = parsePack(defaultPackJson);

type Panel =
  | { view: 'menu' }
  | { view: 'prep'; task: Task }
  | { view: 'editTask'; task: Task | undefined }
  | { view: 'editRecipe'; recipe: Recipe | undefined };

export function App({ platform }: { platform: Platform }) {
  const kitchen = useKitchen(platform.store);
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
    const offVisible = platform.onAppVisible(() => setSession((s) => s && markBack(s, Date.now())));
    return () => {
      offHidden();
      offVisible();
    };
  }, [platform, simmering]);

  const companionState = companionStateFor(session);
  const line = useMemo(() => pickLine(pack, companionState), [companionState]);
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
        </div>
      </header>

      <main className="layout">
        <section className="scene" aria-label="Kitchen">
          <div className="companion-slot">
            <p className="bubble">{line}</p>
            <div className="slot-box">
              {pack.name} · {companionState}
            </div>
          </div>
          {session && (session.phase === 'simmer' || session.phase === 'paused') && (
            <div className="timer" role="timer" aria-live="off">
              <span className="timer-clock">{formatClock(remainingMs(session, now))}</span>
              <span className="timer-task">{activeTask?.title}</span>
              {session.awayCount > 0 && (
                <span className="muted">Stepped away {session.awayCount}×</span>
              )}
            </div>
          )}
        </section>

        <aside className="panel">
          {session && (session.phase === 'simmer' || session.phase === 'paused') && (
            <Simmer
              session={session}
              onPause={() => setSession(pauseSimmer(session, Date.now()))}
              onResume={() => setSession(resumeSimmer(session, Date.now()))}
              onFinish={() => setSession(finishSimmer(session, Date.now()))}
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
        </aside>
      </main>
    </div>
  );
}
