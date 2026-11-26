import { create } from 'zustand';
import type { Element, AppStateSnapshot } from './types';
import { reconcileElements } from './reconciliation';

interface HistoryState {
  past: Element[][];
  future: Element[][];
}

interface AppState {
  elements: Element[];
  appState: AppStateSnapshot;
  history: HistoryState;
  selectedIds: string[];
  setElements: (elements: Element[] | ((prev: Element[]) => Element[]), addToHistory?: boolean) => void;
  updateElement: (id: string, updates: Partial<Element>) => void;
  reconcile: (incomingElements: Element[]) => void;
  setAppState: (updates: Partial<AppStateSnapshot>) => void;
  setSelectedIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  undo: () => void;
  redo: () => void;
}

export const useStore = create<AppState>((set) => ({
  elements: [],
  appState: { viewBackgroundColor: '#ffffff' },
  history: { past: [], future: [] },
  selectedIds: [],

  setElements: (elementsOrFn, addToHistory = true) =>
    set((state) => {
      const nextElements = typeof elementsOrFn === 'function' ? elementsOrFn(state.elements) : elementsOrFn;
      if (!addToHistory) return { elements: nextElements };

      return {
        elements: nextElements,
        history: {
          past: [...state.history.past, state.elements],
          future: [],
        },
      };
    }),

  updateElement: (id, updates) =>
    set((state) => {
      const el = state.elements.find((e) => e.id === id);
      if (!el) return state;

      const newEl = {
        ...el,
        ...updates,
        version: el.version + 1,
        versionNonce: Math.floor(Math.random() * 2 ** 32),
        updated: Date.now(),
      };

      const nextElements = state.elements.map((e) => (e.id === id ? newEl : e));

      return {
        elements: nextElements,
        history: {
          past: [...state.history.past, state.elements],
          future: [],
        },
      };
    }),

  reconcile: (incomingElements) =>
    set((state) => ({
      elements: reconcileElements(state.elements, incomingElements),
    })),

  setAppState: (updates) =>
    set((state) => ({
      appState: { ...state.appState, ...updates },
    })),

  setSelectedIds: (ids) =>
    set((state) => ({
      selectedIds: typeof ids === 'function' ? ids(state.selectedIds) : ids,
    })),

  undo: () =>
    set((state) => {
      if (state.history.past.length === 0) return state;
      const prev = state.history.past[state.history.past.length - 1];
      const newPast = state.history.past.slice(0, -1);
      
      // Bump versions for all elements changed so peers get the undo
      // In MVP, we might just rollback state locally and then broadcast it
      // A more robust way is to bump versions of changed elements.
      const newElements = prev.map(p => {
        const curr = state.elements.find(e => e.id === p.id);
        if (curr && JSON.stringify(curr) !== JSON.stringify(p)) {
          return { ...p, version: curr.version + 1, versionNonce: Math.floor(Math.random() * 2 ** 32) };
        }
        return p;
      });

      return {
        elements: newElements,
        history: {
          past: newPast,
          future: [state.elements, ...state.history.future],
        },
      };
    }),

  redo: () =>
    set((state) => {
      if (state.history.future.length === 0) return state;
      const next = state.history.future[0];
      const newFuture = state.history.future.slice(1);

      const newElements = next.map(n => {
        const curr = state.elements.find(e => e.id === n.id);
        if (curr && JSON.stringify(curr) !== JSON.stringify(n)) {
          return { ...n, version: curr.version + 1, versionNonce: Math.floor(Math.random() * 2 ** 32) };
        }
        return n;
      });

      return {
        elements: newElements,
        history: {
          past: [...state.history.past, state.elements],
          future: newFuture,
        },
      };
    }),
}));
