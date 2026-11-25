import type { SpriteAnimation } from '@wokflow/companion';
import { COMPANION_SPOT } from './layout.js';

export interface FrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class SpriteSheetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpriteSheetError';
  }
}

/**
 * Slice a horizontal strip into frames. Without explicit frameWidth/frameHeight the strip is
 * divided evenly and frames take the full sheet height.
 */
export function frameRects(
  anim: SpriteAnimation,
  sheetWidth: number,
  sheetHeight: number,
): FrameRect[] {
  const width = anim.frameWidth ?? Math.floor(sheetWidth / anim.frames);
  const height = anim.frameHeight ?? sheetHeight;
  if (width <= 0 || height <= 0)
    throw new SpriteSheetError(`"${anim.sheet}" has an empty frame size.`);
  if (width * anim.frames > sheetWidth || height > sheetHeight) {
    throw new SpriteSheetError(
      `"${anim.sheet}" is ${sheetWidth}×${sheetHeight}px but ${anim.frames} frames of ${width}×${height}px don't fit.`,
    );
  }
  return Array.from({ length: anim.frames }, (_, i) => ({ x: i * width, y: 0, width, height }));
}

/** PixiJS AnimatedSprite speed: frames advanced per 60 fps tick. */
export function animationSpeed(fps: number): number {
  return fps / 60;
}

export interface Placement {
  x: number;
  y: number;
  scale: number;
}

/** Scale a companion so its frame fits the spot's height, standing bottom-center on the counter. */
export function companionPlacement(frameHeight: number, spot = COMPANION_SPOT): Placement {
  return { x: spot.x, y: spot.y, scale: spot.maxHeight / frameHeight };
}
