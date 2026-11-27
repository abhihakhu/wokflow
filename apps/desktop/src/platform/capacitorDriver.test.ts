import { describe, expect, it, vi } from 'vitest';
import { capacitorDriver, type CapacitorDb } from './capacitorDriver';

describe('capacitorDriver', () => {
  it('maps run/query to execute/select without implicit transactions', async () => {
    const db: CapacitorDb = {
      run: vi.fn(async () => ({ changes: { changes: 2 } })),
      query: vi.fn(async () => ({ values: [{ id: 'a' }] })),
    };
    const driver = capacitorDriver(db);
    expect(await driver.execute('DELETE FROM t WHERE id = ?', ['a'])).toEqual({ rowsAffected: 2 });
    expect(db.run).toHaveBeenCalledWith('DELETE FROM t WHERE id = ?', ['a'], false);
    expect(await driver.select('SELECT 1')).toEqual([{ id: 'a' }]);
    expect(db.query).toHaveBeenCalledWith('SELECT 1', []);
  });

  it('treats missing results as empty', async () => {
    const driver = capacitorDriver({ run: async () => ({}), query: async () => ({}) });
    expect(await driver.execute('x')).toEqual({ rowsAffected: 0 });
    expect(await driver.select('y')).toEqual([]);
  });
});
