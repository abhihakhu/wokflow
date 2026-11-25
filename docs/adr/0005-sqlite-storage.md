# ADR 0005 — SQLite storage behind a driver interface

- **Status:** accepted
- **Date:** 2026-11-24

## Context

M1 kept everything in memory. M2 needs data that survives restarts on desktop now and on Android later, without the UI or core knowing which database is underneath.

## Decision

- **`SqlDriver`** is the only database surface: `execute(sql, params)` → `{ rowsAffected }` and `select(sql, params)` → rows, with `?` placeholders. Tauri's `@tauri-apps/plugin-sql`, Capacitor's SQLite plugin and Node's built-in `node:sqlite` each fit it with a few lines of wrapping.
- **Document-style tables.** Each collection is a table of `(id TEXT PRIMARY KEY, data TEXT, updated_at TEXT)`, with the record stored as JSON. Lists are filtered in memory.
- **Migrations in TypeScript** (`MIGRATIONS` in `@wokflow/data`), recorded in `schema_migrations` and applied on startup. Statements are idempotent and run without an explicit transaction, because Tauri's sqlx pool may run each call on a different connection.
- **One contract test suite** (`describeStoreContract`) runs against both the in-memory and SQLite stores, so every adapter is held to the same behaviour.

## Why documents instead of normalized columns

A single user's kitchen holds hundreds of records, not millions, so in-memory filtering is instant. Storing JSON keeps the schema stable while the domain model is still changing; adding a field to `Task` needs no migration. `updated_at` is a real indexed column because last-write-wins sync (v0.3) will query by it.

## Consequences

- Queries that need SQL-side filtering (e.g. stats over thousands of sessions) will need a migration that adds real columns or a dedicated table. The migration runner already supports this.
- Tests run against real SQLite with no native build step (`node:sqlite` ships with Node 22).
