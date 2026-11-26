import type { Element } from './types';

// Canonical serialize removes updated and sorts keys
function canonical(e: Element): string {
  const { updated: _, ...rest } = e;
  const sortedKeys = Object.keys(rest).sort() as (keyof typeof rest)[];
  const res: Record<string, unknown> = {};
  for (const k of sortedKeys) {
    res[k] = rest[k];
  }
  return JSON.stringify(res);
}

export function reconcileElements(
  localElements: Element[],
  incomingElements: Element[]
): Element[] {
  const elementMap = new Map<string, Element>();

  for (const el of localElements) {
    elementMap.set(el.id, el);
  }

  // Collapse incoming changes
  for (const b of incomingElements) {
    const a = elementMap.get(b.id);
    if (!a) {
      elementMap.set(b.id, b);
      continue;
    }

    if (b.version > a.version) {
      elementMap.set(b.id, b);
    } else if (b.version === a.version && b.versionNonce < a.versionNonce) {
      elementMap.set(b.id, b);
    } else if (b.version === a.version && b.versionNonce === a.versionNonce) {
      // Tie-break: lexicographically smaller canonical JSON wins
      if (canonical(b) < canonical(a)) {
        elementMap.set(b.id, b);
      }
    }
  }

  // Preserve the array order (array position doesn't mean zIndex)
  const result: Element[] = [];
  const handled = new Set<string>();

  for (const el of localElements) {
    const finalEl = elementMap.get(el.id)!;
    result.push(finalEl);
    handled.add(finalEl.id);
  }

  for (const el of incomingElements) {
    if (!handled.has(el.id)) {
      result.push(elementMap.get(el.id)!);
      handled.add(el.id);
    }
  }

  // Ensure returned array is sorted by zIndex ascending, then id ascending
  result.sort((a, b) => {
    if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex;
    return a.id.localeCompare(b.id);
  });

  return result;
}
