import { useState } from 'react';
import type { FocusRating, Session, Task } from '@wokflow/core';

const DURATIONS = [25, 45, 60, 90];
const RATINGS: FocusRating[] = [1, 2, 3, 4, 5];

export function Prep({
  task,
  defaultMin = 25,
  onStart,
  onCancel,
}: {
  task: Task;
  defaultMin?: number;
  onStart(input: { firstStep: string; intent: string; plannedMin: number }): void;
  onCancel(): void;
}) {
  const [firstStep, setFirstStep] = useState('');
  const [intent, setIntent] = useState('');
  const [plannedMin, setPlannedMin] = useState<number>(defaultMin);
  const durations = DURATIONS.includes(defaultMin)
    ? DURATIONS
    : [...DURATIONS, defaultMin].sort((a, b) => a - b);
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
      {task.notes && <p className="notes">{task.notes}</p>}
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
        {durations.map((d) => (
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

export function Simmer({
  session,
  onPause,
  onResume,
  onFinish,
  onPark,
}: {
  session: Session;
  onPause(): void;
  onResume(): void;
  onFinish(): void;
  onPark(text: string): void;
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

export function Plate({
  session,
  onServe,
}: {
  session: Session;
  onServe(input: { reflection: string; focusRating: FocusRating; stepDone: boolean }): void;
}) {
  const [reflection, setReflection] = useState('');
  const [rating, setRating] = useState<FocusRating | undefined>();
  const [stepDone, setStepDone] = useState(false);

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (rating) onServe({ reflection, focusRating: rating, stepDone });
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
      <label className="check">
        <input type="checkbox" checked={stepDone} onChange={(e) => setStepDone(e.target.checked)} />
        This task is finished
      </label>
      <button type="submit" className="btn primary" disabled={!rating}>
        Serve the dish
      </button>
    </form>
  );
}
