import { describe, it, expect } from 'vitest';
import { reconcileElements } from './reconciliation';
import type { Element } from './types';

function createDummyElement(id: string, version: number, versionNonce: number, isDeleted = false, override: Partial<Element> = {}): Element {
  return {
    id,
    version,
    versionNonce,
    isDeleted,
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    angle: 0,
    strokeColor: '#000',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    seed: 1,
    updated: 0,
    zIndex: 0,
    ...override
  };
}

describe('reconcileElements', () => {
  it('adds a new element', () => {
    const local: Element[] = [];
    const incoming = [createDummyElement('1', 1, 1)];
    const result = reconcileElements(local, incoming);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('updates an existing element with a higher version', () => {
    const local = [createDummyElement('1', 1, 1)];
    const incoming = [createDummyElement('1', 2, 1)];
    const result = reconcileElements(local, incoming);
    expect(result[0].version).toBe(2);
  });

  it('keeps local element if incoming has lower version', () => {
    const local = [createDummyElement('1', 2, 1)];
    const incoming = [createDummyElement('1', 1, 1)];
    const result = reconcileElements(local, incoming);
    expect(result[0].version).toBe(2);
  });

  it('updates if versions are equal and incoming nonce is lower', () => {
    const local = [createDummyElement('1', 1, 2)];
    const incoming = [createDummyElement('1', 1, 1)];
    const result = reconcileElements(local, incoming);
    expect(result[0].versionNonce).toBe(1);
  });

  it('keeps local if versions are equal and local nonce is lower', () => {
    const local = [createDummyElement('1', 1, 1)];
    const incoming = [createDummyElement('1', 1, 2)];
    const result = reconcileElements(local, incoming);
    expect(result[0].versionNonce).toBe(1);
  });

  it('handles canonical tie-break when versions and nonces are equal', () => {
    const a = createDummyElement('1', 1, 1, false, { strokeColor: '#fff', updated: 100 });
    const b = createDummyElement('1', 1, 1, false, { strokeColor: '#000', updated: 200 });
    // b's canonical is smaller than a's ("#000" < "#fff")
    let result = reconcileElements([a], [b]);
    expect(result[0].strokeColor).toBe('#000');
    
    // Order shouldn't matter
    result = reconcileElements([b], [a]);
    expect(result[0].strokeColor).toBe('#000');
  });

  it('handles tombstone resurrection prevention correctly', () => {
    const local = [createDummyElement('1', 2, 1, true)]; // deleted
    const incoming = [createDummyElement('1', 1, 1, false)]; // stale attempt to resurrect
    const result = reconcileElements(local, incoming);
    expect(result[0].isDeleted).toBe(true);
    expect(result[0].version).toBe(2);
  });

  it('sorts by zIndex ascending, then id ascending', () => {
    const a = createDummyElement('a', 1, 1, false, { zIndex: 10 });
    const b = createDummyElement('b', 1, 1, false, { zIndex: 5 });
    const c = createDummyElement('c', 1, 1, false, { zIndex: 10 });
    // Expected order: b (5), a (10, id 'a'), c (10, id 'c')
    const result = reconcileElements([a, b, c], []);
    expect(result.map(e => e.id)).toEqual(['b', 'a', 'c']);
  });

  it('handles permutations', () => {
    const v1 = createDummyElement('1', 1, 1, false, { width: 10 });
    const v2 = createDummyElement('1', 2, 1, false, { width: 20 });
    const v3 = createDummyElement('1', 3, 1, false, { width: 30 });
    
    // regardless of order, v3 wins
    expect(reconcileElements([v1], [v2, v3])[0].width).toBe(30);
    expect(reconcileElements([v1], [v3, v2])[0].width).toBe(30);
    expect(reconcileElements([v3], [v1, v2])[0].width).toBe(30);
    
    // batch collapse case: v2 and v3 in the same batch
    expect(reconcileElements([], [v2, v3])[0].width).toBe(30);
    expect(reconcileElements([], [v3, v2])[0].width).toBe(30);
  });
});
