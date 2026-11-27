import { COMPANION_SPOT, DESIGN } from './layout.js';

export interface DecorArt {
  /** File in packages/scene/assets/decor/. */
  file: string;
  /** Intrinsic SVG size in px. */
  width: number;
  height: number;
  /** Anchor point position in design space. */
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
  scale: number;
  /** Wall items sit behind the lanterns; counter items stand on the counter. */
  layer: 'wall' | 'counter';
}

const COUNTER_TOP = 624;

/** Where each shop item appears in the 1600×1000 kitchen. */
export const DECOR_ART: Readonly<Record<string, DecorArt>> = Object.freeze({
  'paper-fan': {
    file: 'paper-fan.svg',
    width: 180,
    height: 110,
    x: 195,
    y: 400,
    anchorX: 0.5,
    anchorY: 0.5,
    scale: 0.85,
    layer: 'wall',
  },
  'tea-set': {
    file: 'tea-set.svg',
    width: 170,
    height: 90,
    x: 1130,
    y: COUNTER_TOP,
    anchorX: 0.5,
    anchorY: 1,
    scale: 0.7,
    layer: 'counter',
  },
  bonsai: {
    file: 'bonsai.svg',
    width: 160,
    height: 170,
    x: 205,
    y: COUNTER_TOP,
    anchorX: 0.5,
    anchorY: 1,
    scale: 0.85,
    layer: 'counter',
  },
  'goldfish-bowl': {
    file: 'goldfish-bowl.svg',
    width: 100,
    height: 96,
    x: 575,
    y: COUNTER_TOP,
    anchorX: 0.5,
    anchorY: 1,
    scale: 0.85,
    layer: 'counter',
  },
  'koi-scroll': {
    file: 'koi-scroll.svg',
    width: 140,
    height: 250,
    x: 1360,
    y: 116,
    anchorX: 0.5,
    anchorY: 0,
    scale: 0.8,
    layer: 'wall',
  },
  'golden-wok': {
    file: 'golden-wok.svg',
    width: 180,
    height: 140,
    x: 872,
    y: 250,
    anchorX: 0.5,
    anchorY: 0.5,
    scale: 0.75,
    layer: 'wall',
  },
});

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The item's footprint in design space. */
export function decorBounds(art: DecorArt): Box {
  const w = art.width * art.scale;
  const h = art.height * art.scale;
  const left = art.x - art.anchorX * w;
  const top = art.y - art.anchorY * h;
  return { left, top, right: left + w, bottom: top + h };
}

/** Approximate footprint of a companion standing at the companion spot. */
export function companionBounds(halfWidth = 130, height = 200): Box {
  return {
    left: COMPANION_SPOT.x - halfWidth,
    right: COMPANION_SPOT.x + halfWidth,
    top: COMPANION_SPOT.y - height,
    bottom: COMPANION_SPOT.y,
  };
}

export function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

export function insideDesign(box: Box): boolean {
  return box.left >= 0 && box.top >= 0 && box.right <= DESIGN.width && box.bottom <= DESIGN.height;
}
