import type { Collection, WokflowStore } from './repository.js';

export type SqlValue = string | number | null;

/**
 * The only thing the SQL store needs from a database. Placeholders are `?`.
 * - Tauri: `@tauri-apps/plugin-sql` Database (execute/select) fits with a thin wrapper.
 * - Android: `@capacitor-community/sqlite` (run/query) fits the same way.
 * - Tests: Node's built-in `node:sqlite`.
 */
export interface SqlDriver {
  execute(sql: string, params?: SqlValue[]): Promise<{ rowsAffected: number }>;
  select<Row extends Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<Row[]>;
}

/** Collection name → table name. A fixed allowlist, so table names are never user input. */
export const TABLES = {
  tasks: 'tasks',
  recipes: 'recipes',
  sessions: 'sessions',
  parkingLot: 'parking_lot',
  inventory: 'inventory',
  placements: 'placements',
  settings: 'settings',
} as const satisfies Record<keyof WokflowStore, string>;

const documentTable = (table: string) => [
  `CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY NOT NULL, data TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS ${table}_updated_at ON ${table} (updated_at)`,
];

export interface Migration {
  version: number;
  name: string;
  statements: string[];
}

/**
 * Document-style tables: the record is stored as JSON in `data`, with `id` and
 * `updated_at` as real columns. Records stay small and are filtered in memory,
 * which keeps the schema stable while the domain model is still changing.
 * See docs/adr/0005-sqlite-storage.md.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'document tables',
    statements: [
      TABLES.tasks,
      TABLES.recipes,
      TABLES.sessions,
      TABLES.parkingLot,
      TABLES.inventory,
    ].flatMap(documentTable),
  },
  {
    version: 2,
    name: 'settings and decor placements',
    statements: [TABLES.placements, TABLES.settings].flatMap(documentTable),
  },
];

/**
 * Apply pending migrations in order. Statements are idempotent (IF NOT EXISTS), so a
 * crash between a statement and its version record is safe to re-run. No explicit
 * transaction: pooled drivers (Tauri's sqlx pool) may run each call on a different
 * connection, which would split BEGIN from COMMIT.
 */
export async function migrate(
  driver: SqlDriver,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<number> {
  await driver.execute(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY NOT NULL, name TEXT NOT NULL, applied_at TEXT NOT NULL)',
  );
  const [row] = await driver.select<{ version: number | null }>(
    'SELECT MAX(version) AS version FROM schema_migrations',
  );
  let current = Number(row?.version ?? 0);
  const pending = [...migrations]
    .sort((a, b) => a.version - b.version)
    .filter((m) => m.version > current);
  for (const migration of pending) {
    for (const statement of migration.statements) await driver.execute(statement);
    await driver.execute(
      'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
      [migration.version, migration.name, new Date().toISOString()],
    );
    current = migration.version;
  }
  return current;
}

function sqlCollection<T extends { id: string }>(driver: SqlDriver, table: string): Collection<T> {
  const parse = (rows: Array<{ data: string }>) => rows.map((r) => JSON.parse(r.data) as T);
  return {
    async get(id) {
      return parse(await driver.select(`SELECT data FROM ${table} WHERE id = ?`, [id]))[0];
    },
    async list(where) {
      const all = parse(await driver.select(`SELECT data FROM ${table} ORDER BY rowid`));
      return where ? all.filter(where) : all;
    },
    async put(item) {
      const updatedAt = (item as { updatedAt?: unknown }).updatedAt;
      await driver.execute(
        `INSERT INTO ${table} (id, data, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
        [item.id, JSON.stringify(item), updatedAt === undefined ? '' : String(updatedAt)],
      );
      return JSON.parse(JSON.stringify(item)) as T;
    },
    async remove(id) {
      const { rowsAffected } = await driver.execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
      return rowsAffected > 0;
    },
  };
}

/** Migrate the database, then return a store backed by it. */
export async function createSqlStore(driver: SqlDriver): Promise<WokflowStore> {
  await migrate(driver);
  return {
    tasks: sqlCollection(driver, TABLES.tasks),
    recipes: sqlCollection(driver, TABLES.recipes),
    sessions: sqlCollection(driver, TABLES.sessions),
    parkingLot: sqlCollection(driver, TABLES.parkingLot),
    inventory: sqlCollection(driver, TABLES.inventory),
    placements: sqlCollection(driver, TABLES.placements),
    settings: sqlCollection(driver, TABLES.settings),
  };
}
