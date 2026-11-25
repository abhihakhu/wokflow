/** The kitchen is authored in a fixed 1600×1000 design space. */
export const DESIGN = { width: 1600, height: 1000 } as const;

/** Where the companion stands in design space: bottom-center on the counter, and its max height. */
export const COMPANION_SPOT = { x: 1320, y: 640, maxHeight: 420 } as const;

export interface Fit {
  scale: number;
  x: number;
  y: number;
}

/**
 * Scale the design to cover the view (like CSS `object-fit: cover`) and position it so the
 * horizontal focus point stays as central as the crop allows. focusX is a 0–1 fraction of the
 * design width; the default keeps both the stove and the companion in view on narrow windows.
 */
export function coverFit(
  viewWidth: number,
  viewHeight: number,
  focusX = 0.65,
  design: { width: number; height: number } = DESIGN,
): Fit {
  if (viewWidth <= 0 || viewHeight <= 0) return { scale: 0, x: 0, y: 0 };
  const scale = Math.max(viewWidth / design.width, viewHeight / design.height);
  const scaledW = design.width * scale;
  const scaledH = design.height * scale;
  const wantX = viewWidth / 2 - focusX * scaledW;
  const x = Math.min(0, Math.max(viewWidth - scaledW, wantX));
  // Anchor vertically toward the bottom so the counter never gets cropped away.
  const y = viewHeight - scaledH;
  return { scale, x, y };
}
