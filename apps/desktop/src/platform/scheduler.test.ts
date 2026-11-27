import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Reminder } from '@wokflow/core';
import { createTimeoutScheduler } from './scheduler';

const reminder = (id: number, inMs: number, title = `r${id}`): Reminder => ({
  id,
  kind: 'daily',
  at: Date.now() + inMs,
  title,
  body: 'body',
});

describe('timeout scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires reminders at their time, skipping past ones', async () => {
    const notify = vi.fn(async (_title: string, _body: string) => {});
    const schedule = createTimeoutScheduler(notify);
    await schedule([
      reminder(1, 1000, 'soon'),
      reminder(2, -5, 'past'),
      reminder(3, 5000, 'later'),
    ]);
    vi.advanceTimersByTime(999);
    expect(notify).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(notify).toHaveBeenCalledWith('soon', 'body');
    vi.advanceTimersByTime(5000);
    expect(notify.mock.calls.map((c) => c[0])).toEqual(['soon', 'later']);
  });

  it('replaces the previous set on each call', async () => {
    const notify = vi.fn(async (_title: string, _body: string) => {});
    const schedule = createTimeoutScheduler(notify);
    await schedule([reminder(1, 1000, 'old')]);
    await schedule([reminder(2, 2000, 'new')]);
    vi.advanceTimersByTime(3000);
    expect(notify.mock.calls.map((c) => c[0])).toEqual(['new']);
    await schedule([]);
    vi.advanceTimersByTime(10_000);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('survives a failing notification', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const schedule = createTimeoutScheduler(async () => {
      throw new Error('denied');
    });
    await schedule([reminder(1, 10)]);
    vi.advanceTimersByTime(10);
    await vi.runAllTimersAsync();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('ignores delays setTimeout cannot represent', async () => {
    const notify = vi.fn(async (_title: string, _body: string) => {});
    await createTimeoutScheduler(notify)([reminder(1, 2 ** 31)]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
