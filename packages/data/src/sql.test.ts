import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS, TABLES, createSqlStore, migrate, type SqlDriver } from './sql.js';
import { describeStoreContract } from './store.contract.js';

/** node:sqlite wrapped as a SqlDriver — the same shape the Tauri plugin is wrapped into. */
function nodeDriver(db = new DatabaseSync(':memory:')): SqlDriver & { db: DatabaseSync } {
  return {
    db,
    async execute(sql, params = []) {
      const result = db.prepare(sql).run(...params);
      return { rowsAffected: Number(result.changes) };
    },
    async select(sql, params = []) {
      return db.prepare(sql).all(...params) as never;
    },
  };
}

describeStoreContract('sqlite', () => createSqlStore(nodeDriver()));

describe('migrations', () => {
  it('creates every table and records the version', async () => {
    const driver = nodeDriver();
    expect(await migrate(driver)).toBe(MIGRATIONS.at(-1)!.version);
    const tables = (
      await driver.select<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
    ).map((r) => r.name);
    expect(tables).toEqual(expect.arrayContaining([...Object.values(TABLES), 'schema_migrations']));
  });

  it('is idempotent and keeps data across re-opens', async () => {
    const driver = nodeDriver();
    const first = await createSqlStore(driver);
    await first.inventory.put({ id: 'coins', qty: 59, updatedAt: '2026-11-24T00:00:00.000Z' });
    const reopened = await createSqlStore(driver);
    expect((await reopened.inventory.get('coins'))?.qty).toBe(59);
    const versions = await driver.select<{ version: number }>(
      'SELECT version FROM schema_migrations',
    );
    expect(versions).toHaveLength(MIGRATIONS.length);
  });

  it('applies only newer migrations, in order', async () => {
    const driver = nodeDriver();
    await migrate(driver);
    const extra = [
      ...MIGRATIONS,
      { version: 4, name: 'fourth', statements: ['CREATE TABLE m4 (x)'] },
      {
        version: 3,
        name: 'third',
        statements: ['CREATE TABLE m3 (x)', 'INSERT INTO m3 VALUES (1)'],
      },
    ];
    expect(await migrate(driver, extra)).toBe(4);
    const applied = await driver.select<{ version: number; name: string }>(
      'SELECT version, name FROM schema_migrations ORDER BY version',
    );
    expect(applied.map((r) => r.version)).toEqual([1, 2, 3, 4]);
    // Running again does nothing (m3 would fail to re-create without IF NOT EXISTS).
    expect(await migrate(driver, extra)).toBe(4);
  });

  it('stores updated_at for sync and handles records without one', async () => {
    const driver = nodeDriver();
    const store = await createSqlStore(driver);
    await store.sessions.put({
      id: 's1',
      taskId: 't1',
      phase: 'served',
      plannedMin: 25,
      firstStep: 'a',
      intent: 'b',
      focusedMs: 1,
      awayCount: 0,
      awayMs: 0,
      updatedAt: 1_800_000_000_000,
    });
    const [row] = await driver.select<{ updated_at: string }>('SELECT updated_at FROM sessions');
    expect(row?.updated_at).toBe('1800000000000');
    await store.parkingLot.put({
      id: 'p1',
      text: 'email TA',
      resolved: false,
      createdAt: '2026-11-24',
    });
    const [p] = await driver.select<{ updated_at: string }>('SELECT updated_at FROM parking_lot');
    expect(p?.updated_at).toBe('');
  });
});

describe('upgrading an existing database', () => {
  it('adds the v2 tables to a database created at v1 and keeps its data', async () => {
    const driver = nodeDriver();
    await migrate(driver, MIGRATIONS.slice(0, 1));
    await driver.execute(
      "INSERT INTO tasks (id, data, updated_at) VALUES ('t1', '{\"id\":\"t1\"}', '')",
    );
    const store = await createSqlStore(driver);
    expect((await store.tasks.get('t1'))?.id).toBe('t1');
    await store.settings.put({ id: 'settings', values: { motion: 'reduce' }, updatedAt: 'now' });
    expect((await store.settings.get('settings'))?.values).toEqual({ motion: 'reduce' });
    await store.placements.put({ id: 'bonsai', visible: false, updatedAt: 'now' });
    expect((await store.placements.list()).map((p) => p.visible)).toEqual([false]);
  });
});
