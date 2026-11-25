import { ValidationError } from '@wokflow/core';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse a due date as a local calendar day (plain dates must not shift across time zones). */
function toLocalDay(due: string): Date {
  const m = DATE_ONLY.exec(due);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(due);
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface DueLabel {
  text: string;
  overdue: boolean;
}

export function dueLabel(due: string | undefined): DueLabel | undefined {
  if (!due) return undefined;
  const day = toLocalDay(due);
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const days = Math.round((dayStart.getTime() - startOfToday().getTime()) / 86_400_000);
  const date = day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (days < 0) return { text: `Overdue · ${date}`, overdue: true };
  if (days === 0) return { text: 'Due today', overdue: false };
  if (days === 1) return { text: 'Due tomorrow', overdue: false };
  if (days < 7) return { text: `Due in ${days} days`, overdue: false };
  return { text: `Due ${date}`, overdue: false };
}

/** The value for an <input type="date"> from a stored due date. */
export function dateInputValue(due: string | undefined): string {
  if (!due) return '';
  if (DATE_ONLY.test(due)) return due;
  const d = new Date(due);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface FormError {
  field?: string;
  message: string;
}

export function toFormError(err: unknown): FormError {
  if (err instanceof ValidationError) return { field: err.field, message: err.message };
  return { message: err instanceof Error ? err.message : 'Something went wrong.' };
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
