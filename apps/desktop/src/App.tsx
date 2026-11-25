import { useEffect, useMemo, useState } from 'react';
import {
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
  type FocusRating,
  type Session,
  type Task,
} from '@wokflow/core';
import { parsePack, pickLine } from '@wokflow/companion';
import type { Platform } from '@wokflow/data';
import defaultPackJson from '../../../packs/default/pack.json';

const pack = parsePack(defaultPackJson);
const DURATIONS = [25, 45, 60, 90] as const;
const RATINGS: FocusRating[] = [1, 2, 3, 4, 5];

function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function App({ platform }: { platform: Platform }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [prepTask, setPrepTask] = useState<Task | undefined>();
  const [session, setSession] = useState<Session | undefined>();
  const [coins, setCoins] = useState(0);
  const [lastEarned, setLastEarned] = useState<number | undefined>();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    void platform.store.tasks.list().then(setTasks);
  }, [platform]);

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

  // Leave detection.
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
  const activeTask = tasks.find((t) => t.id === session?.taskId);

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
        <div className="purse" aria-label={`${coins} coins`}>
          <span className="coin" aria-hidden="true" /> {coins} coins
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
          {session?.phase === 'simmer' || session?.phase === 'paused' ? (
            <div className="timer" role="timer" aria-live="off">
              <span className="timer-clock">{formatClock(remainingMs(session, now))}</span>
              <span className="timer-task">{activeTask?.title}</span>
              {session.awayCount > 0 && (
                <span className="muted">Stepped away {session.awayCount}×</span>
              )}
            </div>
          ) : null}
        </section>

        <aside className="panel">
          {!session && !prepTask && (
            <Kitchen
              tasks={tasks}
              lastEarned={lastEarned}
              onPrep={(t) => {
                setLastEarned(undefined);
                setPrepTask(t);
              }}
            />
          )}

          {!session && prepTask && (
            <Prep
              task={prepTask}
              onCancel={() => setPrepTask(undefined)}
              onStart={(input) => {
                const t = Date.now();
                const s = startSimmer(
                  createSession({ id: crypto.randomUUID(), taskId: prepTask.id, ...input }, t),
                  t,
                );
                setNow(t);
                setSession(s);
                setPrepTask(undefined);
              }}
            />
          )}

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
              onServe={(input) => {
                const served = serveSession(session, input, Date.now());
                void platform.store.sessions.put(served);
                setCoins((c) => c + (served.coinsEarned ?? 0));
                setLastEarned(served.coinsEarned);
                setSession(undefined);
              }}
            />
          )}
        </aside>
      </main>
    </div>
  );
}

function Kitchen({
  tasks,
  lastEarned,
  onPrep,
}: {
  tasks: Task[];
  lastEarned: number | undefined;
  onPrep: (t: Task) => void;
}) {
  return (
    <div className="stack">
      <h2>Today’s menu</h2>
      {lastEarned !== undefined && <p className="earned">Served! +{lastEarned} coins</p>}
      <ul className="tasks">
        {tasks.map((t) => (
          <li key={t.id}>
            <span>{t.title}</span>
            <button type="button" className="btn" onClick={() => onPrep(t)}>
              Prep
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Prep({
  task,
  onStart,
  onCancel,
}: {
  task: Task;
  onStart: (input: { firstStep: string; intent: string; plannedMin: number }) => void;
  onCancel: () => void;
}) {
  const [firstStep, setFirstStep] = useState('');
  const [intent, setIntent] = useState('');
  const [plannedMin, setPlannedMin] = useState<number>(25);
  const ready = firstStep.trim() !== '' && intent.trim() !== '';

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onStart({ firstStep, intent, plannedMin });
      }}
    >
      <h2>Mise en place</h2>
      <p className="muted">{task.title}</p>
      <label>
        Smallest first step
        <input value={firstStep} onChange={(e) => setFirstStep(e.target.value)} />
      </label>
      <label>
        By the end, I want to understand…
        <textarea rows={3} value={intent} onChange={(e) => setIntent(e.target.value)} />
      </label>
      <fieldset className="pills">
        <legend>Simmer for</legend>
        {DURATIONS.map((d) => (
          <button
            key={d}
            type="button"
            className="pill"
            aria-pressed={plannedMin === d}
            onClick={() => setPlannedMin(d)}
          >
            {d}m
          </button>
        ))}
      </fieldset>
      <div className="row">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Back
        </button>
        <button type="submit" className="btn primary" disabled={!ready}>
          Fire up the wok
        </button>
      </div>
    </form>
  );
}

function Simmer({
  session,
  onPause,
  onResume,
  onFinish,
  onPark,
}: {
  session: Session;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onPark: (text: string) => void;
}) {
  const [thought, setThought] = useState('');
  const [parked, setParked] = useState<string[]>([]);

  return (
    <div className="stack">
      <h2>Simmering</h2>
      <dl className="mise">
        <dt>First step</dt>
        <dd>{session.firstStep}</dd>
        <dt>Understand</dt>
        <dd>{session.intent}</dd>
      </dl>
      <div className="row">
        {session.phase === 'simmer' ? (
          <button type="button" className="btn ghost" onClick={onPause}>
            Pause
          </button>
        ) : (
          <button type="button" className="btn ghost" onClick={onResume}>
            Resume
          </button>
        )}
        <button type="button" className="btn primary" onClick={onFinish}>
          Finish &amp; plate
        </button>
      </div>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          const text = thought.trim();
          if (!text) return;
          onPark(text);
          setParked((p) => [...p, text]);
          setThought('');
        }}
      >
        <label>
          Parking lot: drop a stray thought and keep cooking
          <input value={thought} onChange={(e) => setThought(e.target.value)} />
        </label>
      </form>
      {parked.length > 0 && (
        <ul className="parked">
          {parked.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Plate({
  session,
  onServe,
}: {
  session: Session;
  onServe: (input: { reflection: string; focusRating: FocusRating }) => void;
}) {
  const [reflection, setReflection] = useState('');
  const [rating, setRating] = useState<FocusRating | undefined>();

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (rating) onServe({ reflection, focusRating: rating });
      }}
    >
      <h2>Plate it</h2>
      <p className="muted">
        {Math.floor(session.focusedMs / 60_000)} min focused · stepped away {session.awayCount}×
      </p>
      <label>
        Explain it in 2–3 sentences
        <span className="muted">Goal: {session.intent}</span>
        <textarea rows={5} value={reflection} onChange={(e) => setReflection(e.target.value)} />
      </label>
      <fieldset className="pills">
        <legend>How focused were you?</legend>
        {RATINGS.map((r) => (
          <button
            key={r}
            type="button"
            className="pill"
            aria-pressed={rating === r}
            onClick={() => setRating(r)}
          >
            {r}
          </button>
        ))}
      </fieldset>
      <button type="submit" className="btn primary" disabled={!rating}>
        Serve the dish
      </button>
    </form>
  );
}
