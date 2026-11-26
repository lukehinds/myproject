import { describe, it, expect } from 'vitest';
import { hitTestHandle } from './resize';
import type { Element } from './types';

describe('resize handles hit-testing', () => {
  const el: Element = {
    id: '1', type: 'rectangle', x: 10, y: 10, width: 100, height: 100, angle: 0,
    strokeColor: '#000', backgroundColor: 'transparent', fillStyle: 'solid',
    strokeWidth: 1, strokeStyle: 'solid', roughness: 1, opacity: 100, seed: 1,
    version: 1, versionNonce: 1, updated: 0, isDeleted: false, zIndex: 0
  };

  it('detects hit on top-left handle', () => {
    // top left is at (10, 10). Handle center is (10, 10), size 8.
    // bounding box: x from 6 to 14, y from 6 to 14
    expect(hitTestHandle(el, 10, 10, 8)).toBe('nw');
    expect(hitTestHandle(el, 7, 7, 8)).toBe('nw');
    expect(hitTestHandle(el, 15, 15, 8)).toBe(null);
  });

  it('detects hit on bottom-right handle with rotation', () => {
    // bottom right unrotated is (110, 110).
    // center is (60, 60)
    // Rotate 180 degrees (Math.PI), bottom-right moves to top-left (10, 10)
    const rotated = { ...el, angle: Math.PI };
    expect(hitTestHandle(rotated, 10, 10, 8)).toBe('se');
  });
});
