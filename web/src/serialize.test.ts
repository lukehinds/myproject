import { describe, it, expect } from 'vitest';
import { serializeScene, deserializeScene } from './serialize';
import type { Scene } from './types';

describe('Scene serialisation', () => {
  it('serializes and deserializes a scene correctly', () => {
    const scene: Scene = {
      elements: [
        {
          id: '1', type: 'rectangle', x: 10, y: 10, width: 100, height: 100, angle: 0,
          strokeColor: '#000', backgroundColor: 'transparent', fillStyle: 'solid',
          strokeWidth: 1, strokeStyle: 'solid', roughness: 1, opacity: 100, seed: 1,
          version: 1, versionNonce: 1, updated: 0, isDeleted: false, zIndex: 0
        }
      ],
      appState: { viewBackgroundColor: '#ffffff' }
    };

    const serialized = serializeScene(scene);
    expect(typeof serialized).toBe('string');
    expect(serialized).toContain('rectangle');

    const deserialized = deserializeScene(serialized);
    expect(deserialized.elements).toHaveLength(1);
    expect(deserialized.elements[0].id).toBe('1');
    expect(deserialized.appState.viewBackgroundColor).toBe('#ffffff');
  });
});
