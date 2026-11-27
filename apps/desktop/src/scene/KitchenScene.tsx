import { useEffect, useRef, useState } from 'react';
import { shouldReduceMotion, type CompanionState, type MotionPreference } from '@wokflow/core';
import { mountKitchen, type KitchenScene as Scene } from '@wokflow/scene';
import back from '@wokflow/scene/assets/kitchen-back.svg?url';
import front from '@wokflow/scene/assets/kitchen-front.svg?url';
import glow from '@wokflow/scene/assets/glow.svg?url';
import lantern from '@wokflow/scene/assets/lantern.svg?url';
import { decorFileUrl } from '../decorArt';
import type { LoadedPack } from '../packs';

const ASSETS = { back, front, glow, lantern };

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/** The animated PixiJS kitchen, filling its parent. Purely decorative: hidden from screen readers. */
export function KitchenScene({
  state,
  companion,
  motion = 'system',
  decor = [],
}: {
  state: CompanionState;
  companion: LoadedPack;
  motion?: MotionPreference;
  /** Decor item ids to show. */
  decor?: readonly string[];
}) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<Scene | undefined>(undefined);
  const latest = useRef(state);
  const reduced = shouldReduceMotion(motion, usePrefersReducedMotion());
  const reducedRef = useRef(reduced);
  const [failed, setFailed] = useState(false);
  const decorKey = decor.join(',');
  const latestDecor = useRef(decor);

  useEffect(() => {
    latestDecor.current = decorKey ? decorKey.split(',') : [];
    scene.current?.setDecor(latestDecor.current);
  }, [decorKey]);

  useEffect(() => {
    latest.current = state;
    scene.current?.setState(state);
  }, [state]);

  useEffect(() => {
    reducedRef.current = reduced;
    scene.current?.setReducedMotion(reduced);
  }, [reduced]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    mountKitchen(el, {
      assets: ASSETS,
      pack: companion.pack,
      resolvePackFile: companion.resolveFile,
      resolveDecorFile: decorFileUrl,
      decor: [...latestDecor.current],
      initialState: latest.current,
      reducedMotion: reducedRef.current,
    }).then(
      (mounted) => {
        // StrictMode / fast unmounts: tear down a scene that finished loading too late.
        if (cancelled) mounted.destroy();
        else scene.current = mounted;
      },
      (err: unknown) => {
        console.error('[wokflow] kitchen scene failed to start:', err);
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
      scene.current?.destroy();
      scene.current = undefined;
    };
  }, [companion]);

  return (
    <div ref={host} className={`kitchen-canvas${failed ? ' fallback' : ''}`} aria-hidden="true" />
  );
}
