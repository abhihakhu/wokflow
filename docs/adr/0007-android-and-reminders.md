# ADR 0007 — Android and reminders

- **Status:** accepted
- **Date:** 2026-11-27

## Context

WokFlow needs to reach my phone: reminders that arrive when the app is closed, and the same kitchen and loop on a small screen. ADR 0001 chose Capacitor for Android.

## Decision

- **One web build, two shells.** `apps/mobile` is a Capacitor project whose `webDir` is the desktop app's `dist/`. The UI, scene and companion are shared; only the `Platform` differs. `main.tsx` picks Tauri, Capacitor or plain web at startup and lazy-loads only that platform's bindings.
- **Storage:** `@capacitor-community/sqlite`, wrapped as a `SqlDriver` (`capacitorDriver`, unit-tested), so the same migrations and contract-tested store run on the phone.
- **Reminders are planned in core, delivered by the platform.** `planReminders` (due dates: 9:00 the day before; daily nudge) and `potReminder` ("order up" when a session's time is done) are pure and tested across time zones. `Platform.scheduleReminders` replaces the whole scheduled set each time its inputs change, using stable 31-bit ids derived from what each reminder is about.
  - **Android:** `@capacitor/local-notifications` hands them to the OS, so they fire with the app closed.
  - **Desktop/browser:** an in-process timer scheduler (tested with fake timers) fires them through native notifications while the app is running.
- **The pot reminder survives leaving the app.** While you're away the timer is frozen at the moment you left, so the reminder is anchored there and still fires on time if you were working elsewhere.
- **Distribution:** CI builds a debug-signed APK on every push; the release workflow attaches it to each GitHub release for sideloading.

## Consequences

- Desktop reminders need WokFlow open (tray/background mode would be the next step).
- The APK is debug-signed. Publishing to the Play Store would need a release keystore stored as a CI secret.
- On Android 12+ exact alarms need a separate permission; without it, notifications may arrive a few minutes late, which is fine for nudges.
