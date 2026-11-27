/** The stove mouth in design space: flames grow up from this baseline. */
export const FIRE = { x: 760, baseY: 620, halfWidth: 44, maxHeight: 64 } as const;

export interface FlameShape {
  color: number;
  /** Flat [x0, y0, x1, y1, …] polygon in design space. */
  points: number[];
}

const LAYERS = [
  { color: 0xff6a2a, width: 1, height: 1, speed: 1 },
  { color: 0xff9a3d, width: 0.72, height: 0.75, speed: 1.4 },
  { color: 0xffd27a, width: 0.42, height: 0.45, speed: 1.9 },
] as const;

/** Smooth pseudo-noise from summed sines: stable, cheap, no state. */
function flicker(t: number, seed: number): number {
  return (
    0.5 +
    0.25 * Math.sin(t * 7.1 + seed) +
    0.15 * Math.sin(t * 13.3 + seed * 2.1) +
    0.1 * Math.sin(t * 23.7 + seed * 3.7)
  );
}

/**
 * Three nested flame layers, each a row of tongues whose heights flicker over time.
 * `intensity` (0–1) scales the height; 0 leaves only embers.
 */
export function flameShapes(t: number, intensity: number, tongues = 5): FlameShape[] {
  const k = Math.min(1, Math.max(0, intensity));
  return LAYERS.map((layer, li) => {
    const half = FIRE.halfWidth * layer.width;
    const left = FIRE.x - half;
    const step = (half * 2) / tongues;
    const points: number[] = [left, FIRE.baseY];
    for (let i = 0; i < tongues; i++) {
      const h =
        FIRE.maxHeight * layer.height * k * (0.55 + 0.45 * flicker(t * layer.speed, i * 1.7 + li));
      const tipX = left + step * (i + 0.5) + Math.sin(t * 3 + i) * step * 0.15;
      points.push(tipX, FIRE.baseY - Math.max(4, h), left + step * (i + 1), FIRE.baseY - 4);
    }
    points.push(FIRE.x + half, FIRE.baseY);
    return { color: layer.color, points };
  });
}
