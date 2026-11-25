# ADR 0001 — Monorepo and stack

- **Status:** accepted
- **Date:** 2026-11-24

## Context

WokFlow runs on desktop (Windows/macOS/Linux) and Android. It needs rich 2D scenes, local notifications, offline storage, and later sync. It is also a portfolio project, so the architecture should be easy to explain and test.

## Decision

- **One TypeScript codebase, two thin shells.** A pnpm workspace with `packages/*` for shared code and `apps/*` for platform shells.
- **`@wokflow/core` is pure.** Domain logic (sessions, rewards, recipes) has no I/O, no platform imports, and takes `now` as an argument. This makes it fully unit-testable and deterministic.
- **Storage behind an interface.** `@wokflow/data` defines `Collection<T>`, `WokflowStore` and `Platform`. Adapters (in-memory today; Tauri SQL and Capacitor SQLite next) implement it. The UI never imports Tauri or Capacitor directly.
- **UI:** React + Vite. **Scenes:** PixiJS. **Desktop shell:** Tauri 2 (small binaries, Rust backend). **Android shell:** Capacitor (mature local-notification and SQLite plugins).
- **TypeScript 6.0** is pinned because typescript-eslint does not yet support TypeScript 7.

## Consequences

- Adding a platform means writing one `Platform` implementation, not touching core or UI.
- Packages are consumed as TypeScript source (no build step between packages), which keeps the dev loop fast; the app bundler compiles everything.
- Two native toolchains (Rust for Tauri, Android SDK for Capacitor) are needed for release builds.
