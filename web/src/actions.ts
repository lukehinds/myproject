import { useStore } from './store';
import type { Element } from './types';
import { nanoid } from 'nanoid';

export function getSelectedElements(): Element[] {
  const state = useStore.getState();
  const set = new Set(state.selectedIds);
  return state.elements.filter(e => set.has(e.id));
}

export function copySelectionToClipboard(selectedElements: Element[]) {
  if (selectedElements.length === 0) return;
  const data = JSON.stringify(selectedElements);
  navigator.clipboard.writeText(data).catch(console.error);
}

export async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    const parsed = JSON.parse(text) as Element[];
    if (!Array.isArray(parsed)) return;

    const allZs = useStore.getState().elements.map(e => e.zIndex);
    const maxZ = allZs.length > 0 ? Math.max(...allZs) : 0;

    // Duplicate and offset elements
    const newElements = parsed.map(el => ({
      ...el,
      id: nanoid(),
      x: el.x + 20, // Offset paste
      y: el.y + 20,
      version: 1,
      versionNonce: Math.floor(Math.random() * 2 ** 32),
      updated: Date.now(),
      isDeleted: false,
      zIndex: maxZ + 1,
    }));

    if (newElements.length > 0) {
      useStore.getState().setElements(prev => [...prev, ...newElements]);
      import('./ws').then(({ wsClient }) => wsClient.sendElements(newElements));
    }
  } catch (e) {
    // Not valid JSON or no clipboard access
  }
}

export function deleteElements(elementsToDelete: Element[]) {
  if (elementsToDelete.length === 0) return;
  const updates = elementsToDelete.map(el => ({
    ...el,
    isDeleted: true,
    version: el.version + 1,
    versionNonce: Math.floor(Math.random() * 2 ** 32),
    updated: Date.now()
  }));

  useStore.getState().setElements(prev => {
    return prev.map(p => updates.find(u => u.id === p.id) || p);
  });
  import('./ws').then(({ wsClient }) => wsClient.sendElements(updates));
}

export function duplicateElements(elementsToDuplicate: Element[]) {
  if (elementsToDuplicate.length === 0) return;
  
  const allZs = useStore.getState().elements.map(e => e.zIndex);
  const maxZ = allZs.length > 0 ? Math.max(...allZs) : 0;

  const newElements = elementsToDuplicate.map(el => ({
    ...el,
    id: nanoid(),
    x: el.x + 20,
    y: el.y + 20,
    version: 1,
    versionNonce: Math.floor(Math.random() * 2 ** 32),
    updated: Date.now(),
    isDeleted: false,
    zIndex: maxZ + 1,
  }));

  useStore.getState().setElements(prev => [...prev, ...newElements]);
  import('./ws').then(({ wsClient }) => wsClient.sendElements(newElements));
}

export function moveZOrder(elementsToMove: Element[], direction: 'front' | 'back') {
  if (elementsToMove.length === 0) return;

  useStore.getState().setElements(prev => {
    const allZs = prev.map(e => e.zIndex);
    const maxZ = allZs.length > 0 ? Math.max(...allZs) : 0;
    const minZ = allZs.length > 0 ? Math.min(...allZs) : 0;

    const movedIds = new Set(elementsToMove.map(e => e.id));
    const next = prev.map(e => {
      if (movedIds.has(e.id)) {
        return {
          ...e,
          zIndex: direction === 'front' ? maxZ + 1 : minZ - 1,
          version: e.version + 1,
          versionNonce: Math.floor(Math.random() * 2 ** 32),
          updated: Date.now()
        };
      }
      return e;
    });

    const moved = next.filter(e => movedIds.has(e.id));
    import('./ws').then(({ wsClient }) => wsClient.sendElements(moved));
    return next;
  });
}
