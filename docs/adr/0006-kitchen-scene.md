# ADR 0006 — The kitchen scene

- **Status:** accepted
- **Date:** 2026-11-24

## Context

The kitchen is the reason to open the app. It has to look like the mockup, react to the session, and run smoothly in Tauri's webview without making the rest of the app hard to test.

## Decision

- **PixiJS 8** renders the scene into a canvas behind the UI. Text that matters (the companion's line, the timer) stays in HTML on top, so it's crisp and readable by screen readers; the canvas is `aria-hidden`.
- **Layered SVG art** in a fixed 1600×1000 design space: `kitchen-back.svg` (wall, moon-gate window, roof), lanterns, `kitchen-front.svg` (counter, stove, wok, steamers), then the animated layers (fire glow, flames, steam) and the companion. The SVGs are the mockup's art, split so animation can sit between them.
- **Pure logic, thin glue.** Cover-fit layout, per-state scene parameters and easing, steam particles, flame shapes and sprite-sheet slicing are pure functions with unit tests. `kitchen.ts` only creates Pixi objects and draws what those functions return.
- **The scene follows the session.** Each companion state maps to fire strength, steam rates, lantern glow and sway (busiest while focusing, dimmer when you step away), eased over about a second.
- **Accessibility and performance.** `prefers-reduced-motion` freezes the scene on a calm frame. The scene module is lazy-loaded so the menu is usable before PixiJS arrives, and a pack that fails to load hides the companion instead of breaking the kitchen.
- **Packs are discovered at build time** with `import.meta.glob('packs/*/pack.json')`. `VITE_COMPANION_PACK=<folder>` picks one; a missing or invalid pack falls back to the default.

## Consequences

- Rive packs validate but don't render in the scene yet (sprite sheets only).
- The scene can't be exercised in jsdom; UI integration tests mock it, and visual changes are reviewed by rendering the layers (see `scripts/`) or running `pnpm tauri dev`.
