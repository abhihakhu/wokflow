import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, parseSettings, updateSettings, type Settings } from '@wokflow/core';
import type { WokflowStore } from '@wokflow/data';

export interface SettingsState {
  loaded: boolean;
  settings: Settings;
  /** Validate and persist. Throws ValidationError for bad input. */
  save(patch: Partial<Settings>): Promise<Settings>;
}

export function useSettings(store: WokflowStore): SettingsState {
  const [loaded, setLoaded] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let live = true;
    store.settings.get('settings').then((record) => {
      if (!live) return;
      setSettings(parseSettings(record?.values));
      setLoaded(true);
    }, console.error);
    return () => {
      live = false;
    };
  }, [store]);

  const save = useCallback<SettingsState['save']>(
    async (patch) => {
      const next = updateSettings(settings, patch);
      await store.settings.put({
        id: 'settings',
        values: { ...next },
        updatedAt: new Date().toISOString(),
      });
      setSettings(next);
      return next;
    },
    [store, settings],
  );

  return { loaded, settings, save };
}
