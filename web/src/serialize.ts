import type { Scene } from './types';

export function serializeScene(scene: Scene): string {
  return JSON.stringify(scene);
}

export function deserializeScene(data: string): Scene {
  const parsed = JSON.parse(data);
  // Optional: add validation logic here to ensure `parsed` is a valid Scene
  return parsed as Scene;
}
