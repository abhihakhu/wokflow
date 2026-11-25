# ADR 0002 — Swappable character packs

- **Status:** accepted
- **Date:** 2026-11-24

## Context

The companion character is central to the app's motivation loop, and I want to use a character I personally like. The assets I have for that character are licensed for personal, non-commercial use and forbid redistribution, so they cannot live in a public repository.

## Decision

- Companions are **packs**: a folder with a `pack.json` and its art, loaded at runtime.
- Every pack must provide animations for four states — `idle`, `focus`, `away`, `complete` — and may provide lines for each. `@wokflow/companion` validates packs with a zod schema and reports every problem at once.
- Two renderers: **sprite sheets** (primary; works with frames rendered from a 3D model) and **Rive** (optional, for hand-built vector characters).
- Only `packs/default/` is committed. `.gitignore` excludes every other folder under `packs/`.

## Consequences

- The public repo ships an original default character, "Ember".
- Personal packs work locally with no code changes and never reach GitHub.
- Demo GIFs and screenshots in the README must use the default pack.
