import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { isTauri } from '@tauri-apps/api/core';
import type { Platform } from '@wokflow/data';
import { App } from './App';
import { createWebPlatform } from './platform/web';
import './styles.css';

async function loadPlatform(): Promise<Platform> {
  // Each native platform is loaded lazily so other builds never pull in its bindings.
  if (isTauri()) {
    const { createTauriPlatform } = await import('./platform/tauri');
    return createTauriPlatform();
  }
  if (Capacitor.isNativePlatform()) {
    const { createCapacitorPlatform } = await import('./platform/capacitor');
    return createCapacitorPlatform();
  }
  return createWebPlatform();
}

const root = createRoot(document.getElementById('root')!);

loadPlatform().then(
  (platform) =>
    root.render(
      <StrictMode>
        <App platform={platform} />
      </StrictMode>,
    ),
  (error: unknown) =>
    root.render(
      <main className="fatal" role="alert">
        <h1>The kitchen didn’t open</h1>
        <p>WokFlow couldn’t load its database.</p>
        <pre>{error instanceof Error ? error.message : String(error)}</pre>
      </main>,
    ),
);
