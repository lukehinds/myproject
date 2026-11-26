import type { Element } from './types';
import { rotatePoint } from './geometry';

export type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

// Get the position of all 8 handles for an element
export function getHandles(el: Element, handleSize = 8) {
  const { x, y, width: w, height: h, angle } = el;
  const cx = x + w / 2;
  const cy = y + h / 2;

  // Handles in local coordinates (unrotated)
  const baseHandles = {
    nw: { x, y },
    n: { x: x + w / 2, y },
    ne: { x: x + w, y },
    e: { x: x + w, y: y + h / 2 },
    se: { x: x + w, y: y + h },
    s: { x: x + w / 2, y: y + h },
    sw: { x, y: y + h },
    w: { x, y: y + h / 2 },
  };

  const handles = {} as Record<HandlePosition, { x: number; y: number; width: number; height: number }>;

  for (const [pos, point] of Object.entries(baseHandles)) {
    // Rotate handle center around element center
    const rotated = rotatePoint(point.x, point.y, cx, cy, angle);
    handles[pos as HandlePosition] = {
      x: rotated.x - handleSize / 2,
      y: rotated.y - handleSize / 2,
      width: handleSize,
      height: handleSize,
    };
  }

  return handles;
}

export function hitTestHandle(el: Element, px: number, py: number, handleSize = 8): HandlePosition | null {
  const handles = getHandles(el, handleSize);
  
  for (const [pos, rect] of Object.entries(handles)) {
    if (px >= rect.x && px <= rect.x + rect.width && py >= rect.y && py <= rect.y + rect.height) {
      return pos as HandlePosition;
    }
  }
  
  return null;
}
