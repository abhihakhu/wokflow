import type { Platform } from '@wokflow/data';

/** Page Visibility API leave detection, shared by the web and Tauri platforms (see ADR 0003). */
export const visibility: Pick<Platform, 'onAppHidden' | 'onAppVisible'> = {
  onAppHidden(cb) {
    const handler = () => {
      if (document.visibilityState === 'hidden') cb();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  },
  onAppVisible(cb) {
    const handler = () => {
      if (document.visibilityState === 'visible') cb();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  },
};

export async function webNotify(title: string, body: string): Promise<void> {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') await Notification.requestPermission();
  if (Notification.permission === 'granted') new Notification(title, { body });
}
