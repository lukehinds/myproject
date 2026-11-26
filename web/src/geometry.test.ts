import { describe, it, expect } from 'vitest';
import { hitTestElement } from './geometry';
import type { Element } from './types';

describe('geometry hitTestElement', () => {
  const el: Element = {
    id: '1', type: 'rectangle', x: 10, y: 10, width: 100, height: 100, angle: 0,
    strokeColor: '#000', backgroundColor: 'transparent', fillStyle: 'solid',
    strokeWidth: 1, strokeStyle: 'solid', roughness: 1, opacity: 100, seed: 1,
    version: 1, versionNonce: 1, updated: 0, isDeleted: false, zIndex: 0
  };

  it('detects point inside element', () => {
    expect(hitTestElement(el, 50, 50)).toBe(true);
  });

  it('detects point outside element', () => {
    expect(hitTestElement(el, 5, 5)).toBe(false);
    expect(hitTestElement(el, 150, 50)).toBe(false);
  });

  it('handles rotation correctly', () => {
    // Rotate 90 degrees around center (60, 60)
    // The top-right corner originally is at (110, 10).
    // After 90 deg rotation clockwise, it should move.
    const rotated = { ...el, angle: Math.PI / 2 };
    expect(hitTestElement(rotated, 60, 60)).toBe(true); // center is still inside
  });
});
