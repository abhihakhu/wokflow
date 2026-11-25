export class ValidationError extends Error {
  constructor(
    message: string,
    readonly field: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const MAX_TITLE_LENGTH = 120;
export const MAX_NOTES_LENGTH = 4000;
export const MAX_TAGS = 10;

export function requireTitle(raw: string, field = 'title'): string {
  const title = raw.trim().replace(/\s+/g, ' ');
  if (!title) throw new ValidationError('Give it a name.', field);
  if (title.length > MAX_TITLE_LENGTH) {
    throw new ValidationError(`Keep it under ${MAX_TITLE_LENGTH} characters.`, field);
  }
  return title;
}

export function optionalNotes(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const notes = raw.trim();
  if (!notes) return undefined;
  if (notes.length > MAX_NOTES_LENGTH) {
    throw new ValidationError(`Notes must be under ${MAX_NOTES_LENGTH} characters.`, 'notes');
  }
  return notes;
}

/**
 * Accepts a plain YYYY-MM-DD date (kept as-is, so a due date never shifts a day across
 * time zones) or a full ISO-8601 timestamp (normalized to UTC).
 */
export function optionalDate(raw: string | undefined, field = 'dueAt'): string | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;
  const value = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) {
    throw new ValidationError('Use a date like 2026-12-08.', field);
  }
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new ValidationError('That date does not exist.', field);
  // Reject rollovers like 2026-02-30, which Date.parse silently normalizes.
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  const check = new Date(Date.UTC(y!, m! - 1, d!));
  if (check.getUTCMonth() !== m! - 1 || check.getUTCDate() !== d) {
    throw new ValidationError('That date does not exist.', field);
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Date(ms).toISOString();
}

export function sessionsEstimate(raw: number | undefined): number {
  const value = raw ?? 1;
  if (!Number.isInteger(value) || value < 1 || value > 20) {
    throw new ValidationError('Estimate between 1 and 20 sessions.', 'estSessions');
  }
  return value;
}

/** Trim, lowercase, de-duplicate, drop empties; at most MAX_TAGS. */
export function normalizeTags(raw: readonly string[] | undefined): string[] {
  const tags = [...new Set((raw ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean))];
  if (tags.length > MAX_TAGS) throw new ValidationError(`At most ${MAX_TAGS} tags.`, 'tags');
  return tags;
}
