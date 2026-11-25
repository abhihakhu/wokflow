# ADR 0003 — Leave detection and the grace period

- **Status:** accepted
- **Date:** 2026-11-24

## Context

The companion reacts when you leave the app mid-session. But on a laptop, real work often happens in other windows (an editor, a PDF, a terminal), so a naive "window lost focus" check would punish exactly the work we want.

## Decision

- **Signal:** the Page Visibility API on desktop (the window is minimized or fully hidden), not window blur. On Android, `App.addListener('appStateChange')`.
- **Grace period:** absences shorter than 30 s (`DEFAULT_AWAY_GRACE_MS`) are ignored.
- **Counted absences** are excluded from focused time and add to `awayCount`, which costs at most 5 coins per session. Missing time is never punished beyond that.
- The grace period is a parameter of every core transition, so a per-user setting is trivial to add.

## Consequences

- Side-by-side work in another app is not penalized; hiding WokFlow is.
- If this still feels wrong in practice, the next step is a "working elsewhere" toggle on the Simmer screen that suspends leave detection for the session.
