import { formatClock } from '../format';

const R = 40;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** The jade-ring timer from the mockup: gold progress shows how much of the pot is left. */
export function Timer({
  remainingMs,
  plannedMs,
  task,
  label,
  note,
}: {
  remainingMs: number;
  plannedMs: number;
  task: string | undefined;
  label: string;
  note: string | undefined;
}) {
  const left = plannedMs > 0 ? Math.min(1, Math.max(0, remainingMs / plannedMs)) : 0;
  const clock = formatClock(remainingMs);
  return (
    <div className="timer">
      <svg width="100" height="100" viewBox="0 0 100 100" role="img" aria-label={`${clock} left`}>
        <circle cx="50" cy="50" r={R} fill="none" stroke="#5e9c83" strokeWidth="16" />
        <circle cx="50" cy="50" r={R} fill="none" stroke="#7fb9a0" strokeWidth="2" opacity="0.6" />
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke="#e3c27a"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - left)}
          transform="rotate(-90 50 50)"
        />
        <circle cx="50" cy="50" r="30" fill="#2a160f" />
        <text x="50" y="56" textAnchor="middle" className="timer-text">
          {clock}
        </text>
      </svg>
      <div className="timer-info">
        <span className="timer-label">{label}</span>
        <span className="timer-task">{task}</span>
        {note && <span className="timer-note">{note}</span>}
      </div>
    </div>
  );
}
