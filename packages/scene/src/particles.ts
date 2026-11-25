/** A steam puff. Positions are in design space; times in seconds. */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  /** Radius at birth and at death. */
  r0: number;
  r1: number;
  /** Per-particle phase for the sideways wobble. */
  phase: number;
}

export interface Emitter {
  x: number;
  y: number;
  /** Half-width of the spawn line. */
  spread: number;
}

export type Rng = () => number;

/** Deterministic PRNG (mulberry32) for tests and reproducible scenes. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function spawn(emitter: Emitter, rng: Rng): Particle {
  return {
    x: emitter.x + (rng() * 2 - 1) * emitter.spread,
    y: emitter.y,
    vx: (rng() * 2 - 1) * 8,
    vy: -(40 + rng() * 30),
    age: 0,
    life: 2.2 + rng() * 1.3,
    r0: 6 + rng() * 6,
    r1: 26 + rng() * 18,
    phase: rng() * Math.PI * 2,
  };
}

/**
 * How many particles to emit this frame at `rate` per second, carrying the fractional
 * remainder so low rates still emit steadily.
 */
export function emitCount(
  rate: number,
  dtSec: number,
  carry: number,
): { count: number; carry: number } {
  const total = carry + Math.max(0, rate) * Math.max(0, dtSec);
  // The epsilon absorbs float drift (60 × 2/60 sums to 1.9999…), which would otherwise drop a particle.
  const count = Math.floor(total + 1e-9);
  return { count, carry: Math.max(0, total - count) };
}

/** Advance particles, drop dead ones. Steam slows as it rises and wobbles sideways. */
export function stepParticles(particles: readonly Particle[], dtSec: number): Particle[] {
  const out: Particle[] = [];
  for (const p of particles) {
    const age = p.age + dtSec;
    if (age >= p.life) continue;
    const drag = Math.exp(-0.35 * dtSec);
    out.push({
      ...p,
      age,
      x: p.x + (p.vx + Math.sin(p.phase + age * 2.2) * 10) * dtSec,
      y: p.y + p.vy * dtSec,
      vy: p.vy * drag,
    });
  }
  return out;
}

/** 0 → 1 → 0 over a particle's life: quick fade in, long fade out. */
export function particleAlpha(p: Particle, max = 0.35): number {
  const t = p.age / p.life;
  const fadeIn = Math.min(1, t / 0.15);
  return max * fadeIn * (1 - t);
}

export function particleRadius(p: Particle): number {
  const t = p.age / p.life;
  return p.r0 + (p.r1 - p.r0) * Math.sqrt(t);
}
