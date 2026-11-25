import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { isTauri } from '@tauri-apps/api/core';
import type { Platform } from '@wokflow/data';
import { App } from './App';
import { createWebPlatform } from './platform/web';
import './styles.css';

async function loadPlatform(): Promise<Platform> {
  if (!isTauri()) return createWebPlatform();
  // Loaded lazily so the browser build never pulls in the Tauri SQL bindings.
  const { createTauriPlatform } = await import('./platform/tauri');
  return createTauriPlatform();
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
