import type { Element } from './types';

// Points and lines geometry
export function distance(x1: number, y1: number, x2: number, y2: number) {
  return Math.hypot(x2 - x1, y2 - y1);
}

// Check if point is inside a rectangle (not rotated)
export function pointInRect(px: number, py: number, rx: number, ry: number, rw: number, rh: number) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

export function rotatePoint(px: number, py: number, cx: number, cy: number, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const nx = cos * (px - cx) - sin * (py - cy) + cx;
  const ny = sin * (px - cx) + cos * (py - cy) + cy;
  return { x: nx, y: ny };
}

// Bounding box hit testing
export function hitTestElement(el: Element, px: number, py: number): boolean {
  // Translate point to element's local space for rotation
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const { x: lx, y: ly } = rotatePoint(px, py, cx, cy, -el.angle);

  // Normalise rect bounds
  const x1 = Math.min(el.x, el.x + el.width);
  const x2 = Math.max(el.x, el.x + el.width);
  const y1 = Math.min(el.y, el.y + el.height);
  const y2 = Math.max(el.y, el.y + el.height);

  return pointInRect(lx, ly, x1, y1, x2 - x1, y2 - y1);
}
