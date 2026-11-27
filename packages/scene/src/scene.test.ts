import { describe, expect, it } from 'vitest';
import { DECOR_CATALOG } from '@wokflow/core';
import { DECOR_ART, companionBounds, decorBounds, insideDesign, overlaps } from './decor.js';
import { FIRE, flameShapes } from './flame.js';
import { COMPANION_SPOT, DESIGN, coverFit } from './layout.js';
import { SCENE_PARAMS, approach } from './params.js';
import {
  emitCount,
  particleAlpha,
  particleRadius,
  seededRng,
  spawn,
  stepParticles,
  type Particle,
} from './particles.js';
import { SpriteSheetError, animationSpeed, companionPlacement, frameRects } from './sprites.js';

describe('coverFit', () => {
  it('fills a matching aspect ratio exactly', () => {
    expect(coverFit(800, 500)).toEqual({ scale: 0.5, x: 0, y: 0 });
  });

  it('covers a tall view and keeps the focus point centered', () => {
    const fit = coverFit(500, 1000, 0.65);
    expect(fit.scale).toBe(1);
    expect(DESIGN.height * fit.scale).toBeGreaterThanOrEqual(1000);
    // Focus at 65% of the design width lands mid-view.
    expect(fit.x + 0.65 * DESIGN.width * fit.scale).toBeCloseTo(250);
  });

  it('never exposes empty space at the edges', () => {
    for (const focusX of [0, 0.5, 1]) {
      const fit = coverFit(600, 1000, focusX);
      expect(fit.x).toBeLessThanOrEqual(0);
      expect(fit.x + DESIGN.width * fit.scale).toBeGreaterThanOrEqual(600);
    }
  });

  it('anchors a wide view to the bottom so the counter stays visible', () => {
    const fit = coverFit(2000, 500);
    expect(fit.scale).toBe(1.25);
    expect(fit.y + DESIGN.height * fit.scale).toBe(500);
  });

  it('handles an empty view', () => {
    expect(coverFit(0, 400)).toEqual({ scale: 0, x: 0, y: 0 });
  });
});

describe('scene params', () => {
  it('is busiest while focusing and dimmest when away', () => {
    expect(SCENE_PARAMS.focus.fire).toBeGreaterThan(SCENE_PARAMS.idle.fire);
    expect(SCENE_PARAMS.away.fire).toBeLessThan(SCENE_PARAMS.idle.fire);
    expect(SCENE_PARAMS.away.lanternGlow).toBeLessThan(SCENE_PARAMS.focus.lanternGlow);
  });

  it('eases toward the target without overshooting', () => {
    const from = SCENE_PARAMS.idle;
    const to = SCENE_PARAMS.focus;
    const mid = approach(from, to, 0.25);
    expect(mid.fire).toBeGreaterThan(from.fire);
    expect(mid.fire).toBeLessThan(to.fire);
    expect(approach(from, to, 0)).toEqual(from);
    expect(approach(from, to, 100).fire).toBeCloseTo(to.fire);
    expect(approach(from, to, -1)).toEqual(from);
  });
});

describe('particles', () => {
  const emitter = { x: 100, y: 200, spread: 10 };

  it('spawns within the emitter and moving up', () => {
    const rng = seededRng(42);
    for (let i = 0; i < 50; i++) {
      const p = spawn(emitter, rng);
      expect(Math.abs(p.x - 100)).toBeLessThanOrEqual(10);
      expect(p.y).toBe(200);
      expect(p.vy).toBeLessThan(0);
      expect(p.r1).toBeGreaterThan(p.r0);
    }
  });

  it('is deterministic for a seed', () => {
    expect(spawn(emitter, seededRng(7))).toEqual(spawn(emitter, seededRng(7)));
    expect(spawn(emitter, seededRng(7))).not.toEqual(spawn(emitter, seededRng(8)));
  });

  it('carries fractional emission so low rates still emit', () => {
    let carry = 0;
    let total = 0;
    for (let i = 0; i < 60; i++) {
      const r = emitCount(2, 1 / 60, carry);
      carry = r.carry;
      total += r.count;
    }
    expect(total).toBe(2);
    expect(emitCount(-5, 1, 0)).toEqual({ count: 0, carry: 0 });
  });

  it('rises, ages and dies', () => {
    const p: Particle = { ...spawn(emitter, seededRng(1)), life: 1 };
    const [next] = stepParticles([p], 0.5);
    expect(next!.y).toBeLessThan(p.y);
    expect(next!.age).toBe(0.5);
    expect(stepParticles([p], 1)).toEqual([]);
  });

  it('fades in, then out, and grows', () => {
    const p: Particle = { ...spawn(emitter, seededRng(1)), life: 2 };
    expect(particleAlpha({ ...p, age: 0 })).toBe(0);
    expect(particleAlpha({ ...p, age: 0.4 })).toBeGreaterThan(particleAlpha({ ...p, age: 1.8 }));
    expect(particleAlpha({ ...p, age: 0.3 }, 1)).toBeLessThanOrEqual(1);
    expect(particleRadius({ ...p, age: 0 })).toBe(p.r0);
    expect(particleRadius({ ...p, age: 2 })).toBeCloseTo(p.r1);
  });
});

describe('flames', () => {
  it('draws three closed layers from the stove baseline', () => {
    const shapes = flameShapes(1.3, 1);
    expect(shapes).toHaveLength(3);
    for (const s of shapes) {
      expect(s.points.length % 2).toBe(0);
      expect(s.points[1]).toBe(FIRE.baseY);
      expect(s.points.at(-1)).toBe(FIRE.baseY);
      const ys = s.points.filter((_, i) => i % 2 === 1);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(FIRE.baseY - FIRE.maxHeight);
    }
  });

  it('gets taller with intensity and leaves embers at zero', () => {
    const height = (k: number) => {
      const ys = flameShapes(2, k)[0]!.points.filter((_, i) => i % 2 === 1);
      return FIRE.baseY - Math.min(...ys);
    };
    expect(height(1)).toBeGreaterThan(height(0.3));
    expect(height(0)).toBe(4);
    expect(height(5)).toBe(height(1));
  });

  it('flickers over time', () => {
    expect(flameShapes(0, 1)[0]!.points).not.toEqual(flameShapes(0.5, 1)[0]!.points);
  });
});

describe('sprite sheets', () => {
  const anim = { sheet: 'idle.png', frames: 4, fps: 8 };

  it('slices an even strip', () => {
    expect(frameRects(anim, 1024, 320)).toEqual([
      { x: 0, y: 0, width: 256, height: 320 },
      { x: 256, y: 0, width: 256, height: 320 },
      { x: 512, y: 0, width: 256, height: 320 },
      { x: 768, y: 0, width: 256, height: 320 },
    ]);
  });

  it('uses explicit frame sizes and rejects ones that overflow', () => {
    expect(frameRects({ ...anim, frameWidth: 200, frameHeight: 300 }, 1024, 320)[1]).toEqual({
      x: 200,
      y: 0,
      width: 200,
      height: 300,
    });
    expect(() => frameRects({ ...anim, frameWidth: 300 }, 1024, 320)).toThrow(SpriteSheetError);
    expect(() => frameRects({ ...anim, frameHeight: 400 }, 1024, 320)).toThrow(/don't fit/);
    expect(() => frameRects(anim, 2, 320)).toThrow(/empty/);
  });

  it('converts fps and places companions on the counter', () => {
    expect(animationSpeed(12)).toBe(0.2);
    expect(companionPlacement(320)).toEqual({
      x: COMPANION_SPOT.x,
      y: COMPANION_SPOT.y,
      scale: COMPANION_SPOT.maxHeight / 320,
    });
  });
});

describe('decor placement', () => {
  const entries = Object.entries(DECOR_ART);

  it('has art for every item in the shop', () => {
    for (const item of DECOR_CATALOG) expect(DECOR_ART[item.id], item.id).toBeDefined();
  });

  it('keeps every item inside the kitchen, clear of each other and the companion', () => {
    const companion = companionBounds();
    for (const [id, art] of entries) {
      const box = decorBounds(art);
      expect(insideDesign(box), `${id} inside`).toBe(true);
      expect(overlaps(box, companion), `${id} vs companion`).toBe(false);
    }
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [a, artA] = entries[i]!;
        const [b, artB] = entries[j]!;
        expect(overlaps(decorBounds(artA), decorBounds(artB)), `${a} vs ${b}`).toBe(false);
      }
    }
  });

  it('stands counter items on the counter', () => {
    for (const [id, art] of entries) {
      if (art.layer === 'counter') expect(decorBounds(art).bottom, id).toBe(624);
    }
  });

  it('computes bounds from the anchor', () => {
    expect(
      decorBounds({
        file: 'x',
        width: 100,
        height: 50,
        x: 200,
        y: 100,
        anchorX: 0.5,
        anchorY: 1,
        scale: 2,
        layer: 'counter',
      }),
    ).toEqual({ left: 100, top: 0, right: 300, bottom: 100 });
    expect(
      overlaps(
        { left: 0, top: 0, right: 10, bottom: 10 },
        { left: 10, top: 0, right: 20, bottom: 10 },
      ),
    ).toBe(false);
  });
});
