export type ElementType =
  | "rectangle" | "diamond" | "ellipse"
  | "arrow" | "line" | "freedraw" | "text"
  | "eraser";

export interface Element {
  id: string;
  type: ElementType;
  x: number;              // top-left of bounding box, scene space
  y: number;
  width: number;          // may be negative before normalisation
  height: number;
  angle: number;          // radians, rotation about the bbox centre

  strokeColor: string;    // "#1e1e1e"
  backgroundColor: string;// "transparent" or hex
  fillStyle: "solid" | "hachure" | "cross-hatch";
  strokeWidth: number;    // 1 | 2 | 4
  strokeStyle: "solid" | "dashed" | "dotted";
  roughness: number;      // 0 | 1 | 2
  opacity: number;        // 0..100

  seed: number;           // stable rough.js seed, set once at creation

  // linear elements ("arrow" | "line" | "freedraw") only
  points?: [number, number][]; // relative to (x, y); first point is [0,0]

  // text only
  text?: string;
  fontSize?: number;      // 16 | 20 | 28
  fontFamily?: "hand" | "normal" | "code";
  textAlign?: "left" | "center" | "right";

  // reconciliation
  version: number;        // increments on every local mutation
  versionNonce: number;   // random uint32, re-rolled on every mutation
  updated: number;        // epoch ms, informational only
  isDeleted: boolean;     // soft delete — tombstones are kept and synced
  zIndex: number;         // stacking order
}

export interface AppStateSnapshot {
  viewBackgroundColor: string;
}

export interface Scene {
  elements: Element[];          // includes tombstones
  appState: AppStateSnapshot;
}

export interface Peer {
  userId: string;
  name: string;   // from ?name=, else "Anonymous"
  color: string;  // assigned by the server from a fixed palette, stable per connection
  pointer?: { x: number; y: number };
}
