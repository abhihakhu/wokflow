import type { SqlDriver, SqlValue } from '@wokflow/data';

/** The subset of @capacitor-community/sqlite's SQLiteDBConnection the store uses. */
export interface CapacitorDb {
  run(
    statement: string,
    values?: SqlValue[],
    transaction?: boolean,
  ): Promise<{ changes?: { changes?: number } }>;
  query(statement: string, values?: SqlValue[]): Promise<{ values?: unknown[] }>;
}

/**
 * Adapt a Capacitor SQLite connection to the store's SqlDriver.
 * `transaction: false` stops the plugin from wrapping every statement in its own transaction.
 */
export function capacitorDriver(db: CapacitorDb): SqlDriver {
  return {
    async execute(sql, params = []) {
      const result = await db.run(sql, params, false);
      return { rowsAffected: result.changes?.changes ?? 0 };
    },
    async select<Row extends Record<string, unknown>>(sql: string, params: SqlValue[] = []) {
      const result = await db.query(sql, params);
      return (result.values ?? []) as Row[];
    },
  };
}
