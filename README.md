# WokFlow 锅

[![CI](https://github.com/abhihakhu/wokflow/actions/workflows/ci.yml/badge.svg)](https://github.com/abhihakhu/wokflow/actions/workflows/ci.yml)

WokFlow turns a study or work session into cooking a dish in a traditional harbor kitchen, with a companion character who cooks alongside you. It is built for two problems: **getting started**, and **staying focused long enough to actually understand** what you're working on.

<!-- Add a GIF of the Prep → Simmer → Plate loop here once milestone 3 lands (use the default pack). -->

## The loop

| Phase                    | What you do                                                                                                                                                     | Why                                                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Prep** (mise en place) | Pick a task, write the smallest first step, and say what you want to understand by the end.                                                                     | A concrete first step beats a vague task.                   |
| **Simmer**               | Focus while the companion cooks beside you. Drop stray thoughts into the **parking lot** instead of acting on them. If you hide the app, the companion notices. | Body doubling, plus a place to put distractions.            |
| **Plate**                | Explain what you learned in 2–3 sentences and rate your focus.                                                                                                  | Rewards understanding, not minutes logged.                  |
| **Serve**                | Earn coins and ingredients that unlock decor and new areas of the harbor.                                                                                       | No streaks to lose. A missed day is just a quieter kitchen. |

```
coins = focused minutes + 10 (reflection with ≥ 2 real sentences) + focus rating × 2 − min(away episodes, 5)
```

## Architecture

```
wokflow/
├─ apps/
│  └─ desktop/          # React + Vite UI, Tauri 2 shell (src-tauri/)
├─ packages/
│  ├─ core/             # pure domain logic: sessions, rewards, recipes (no I/O)
│  ├─ data/             # Collection / Store / Platform interfaces + in-memory adapter
│  └─ companion/        # character pack schema, validation, state → animation mapping
├─ packs/
│  └─ default/          # "Ember", the original default companion
└─ docs/adr/            # architecture decision records
```

- **Core is pure.** Every session transition takes `now` explicitly, so the whole focus timer, including pauses and leave detection, is deterministic and unit-tested.
- **Platforms are injected.** The UI depends on a `Platform` interface (`store`, `notify`, `onAppHidden`, `onAppVisible`). Desktop and Android each provide one, so core and UI never import Tauri or Capacitor.
- **Companions are packs.** Drop a folder in `packs/` with a `pack.json` and sprite sheets. Only the default pack is committed; see [packs/README.md](packs/README.md).

Decisions: [stack](docs/adr/0001-monorepo-and-stack.md) · [character packs](docs/adr/0002-character-packs.md) · [leave detection](docs/adr/0003-leave-detection.md) · [visual direction](docs/adr/0004-visual-direction.md)

## Getting started

Requires Node 22+ and pnpm 10 (`corepack enable`).

```bash
pnpm install
pnpm dev          # web build at http://localhost:5173
pnpm test         # unit tests
pnpm coverage     # with coverage thresholds (80%)
pnpm lint && pnpm typecheck
```

### Desktop app (Tauri)

Install Rust (`rustup`) and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS, then:

```bash
cd apps/desktop
pnpm tauri dev    # native window with hot reload
pnpm tauri build  # installer in src-tauri/target/release/bundle
```

## Roadmap

- [x] **M1** Monorepo, CI, core domain + tests, data interfaces, pack schema, working Prep → Simmer → Plate loop
- [ ] **M2** SQLite storage (Tauri), task editing, recipes and signature dishes
- [ ] **M3** PixiJS kitchen scene + default companion art → README GIF
- [ ] **M4** Pack loader from disk (personal packs)
- [ ] **M5** Rewards UI, decor → **v0.1 release**
- [ ] **M6** Android (Capacitor) + local notifications → v0.2
- [ ] Later: sync, Harbor Map, iCal deadline import, LLM-generated recipes and quizzes

## License

MIT for the code and the default pack. Personal packs you add are not covered and stay under their own terms.
