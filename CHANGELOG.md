# Changelog

## v0.2.0 — Android and reminders (unreleased)

- **Android app** (Capacitor): the same kitchen, companion and loop on your phone, with data stored on the device.
- **Reminders:** the day before tasks and recipes are due, an optional daily nudge to start cooking, and "Order up!" when a session's time is done. On Android they arrive even when WokFlow is closed; on desktop, while it's running.
- **Native notifications** on desktop.
- **Smaller screens:** tighter header, timer and bubble on phones; safe-area padding.

## v0.1.0 — first release

The first complete version of the desktop app.

- **The loop:** Prep (mise en place), Simmer (focus with leave detection and a parking lot), Plate (explain what you learned, rate your focus), Serve (coins and ingredients).
- **Tasks and recipes:** tasks with due dates, tags and estimates; multi-step recipes and signature dishes (exams, projects) with progress and step ordering.
- **The kitchen:** an animated PixiJS kitchen at dusk that reacts to your session, with Ember, the default companion.
- **Market:** six decor items to buy with coins, ingredients and rare decor, shown in the kitchen (and hideable).
- **Settings:** companion picker (personal packs in `packs/`), default session length, away grace period, motion preference.
- **Storage:** everything saved locally in SQLite.
