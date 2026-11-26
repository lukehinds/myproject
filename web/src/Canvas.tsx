import { useEffect, useRef, useState, type MouseEvent } from 'react';
import rough from 'roughjs';
import { useStore } from './store';
import { renderElement } from './render';
import { wsClient } from './ws';
import type { Element, ElementType } from './types';
import { nanoid } from 'nanoid';
import { hitTestElement } from './geometry';
import { getHandles, hitTestHandle, type HandlePosition } from './resize';

type Tool = 'selection' | 'hand' | ElementType;

export const Canvas = ({ tool }: { tool: Tool }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const elements = useStore((state) => state.elements);
  const appState = useStore((state) => state.appState);
  const selectedIds = useStore((state) => state.selectedIds);
  const setSelectedIds = useStore((state) => state.setSelectedIds);

  // Viewport state
  const [scrollX, setScrollX] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [zoom] = useState(1);

  // Interaction state
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isResizing, setIsResizing] = useState<HandlePosition | null>(null);
  const [activeElement, setActiveElement] = useState<Element | null>(null);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [selectionBox, setSelectionBox] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

  const [peers, setPeers] = useState(wsClient.peers);

  useEffect(() => {
    wsClient.onPeersChange = setPeers;
    return () => { wsClient.onPeersChange = undefined; };
  }, []);

  // Redraw when elements change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.fillStyle = appState.viewBackgroundColor;
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.save();
    // Apply viewport transform
    ctx.translate(scrollX, scrollY);
    ctx.scale(zoom, zoom);

    const rc = rough.canvas(canvas);

    const allElements = [...elements];
    if (activeElement) {
      allElements.push(activeElement);
    }
    
    // Sort by zIndex ascending, then id ascending for rendering
    allElements.sort((a, b) => {
      if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex;
      return a.id.localeCompare(b.id);
    });

    // Render active elements
    for (const el of allElements) {
      if (el.isDeleted) continue;

      ctx.save();
      // Rotation logic
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate(el.angle);
      ctx.translate(-cx, -cy);

      ctx.globalAlpha = el.opacity / 100;

      renderElement(rc, el);

      ctx.restore();
    }

    // Render selection boxes and handles
    if (tool === 'selection') {
      const selected = allElements.filter(e => selectedIds.includes(e.id) && !e.isDeleted);
      for (const el of selected) {
        ctx.save();
        const cx = el.x + el.width / 2;
        const cy = el.y + el.height / 2;
        ctx.translate(cx, cy);
        ctx.rotate(el.angle);
        ctx.translate(-cx, -cy);
        
        ctx.strokeStyle = '#6965db';
        ctx.lineWidth = 1 / zoom;
        ctx.strokeRect(el.x, el.y, el.width, el.height);

        const handles = getHandles(el);
        for (const h of Object.values(handles)) {
          ctx.fillStyle = '#fff';
          ctx.fillRect(h.x, h.y, h.width, h.height);
          ctx.strokeRect(h.x, h.y, h.width, h.height);
        }
        ctx.restore();
      }
    }

    // Render rubber band selection box
    if (selectionBox) {
      ctx.save();
      ctx.fillStyle = 'rgba(105, 101, 219, 0.1)';
      ctx.strokeStyle = '#6965db';
      ctx.lineWidth = 1 / zoom;
      ctx.fillRect(selectionBox.x, selectionBox.y, selectionBox.w, selectionBox.h);
      ctx.strokeRect(selectionBox.x, selectionBox.y, selectionBox.w, selectionBox.h);
      ctx.restore();
    }

    ctx.restore();

    // Render remote cursors over the UI space
    ctx.save();
    ctx.translate(scrollX, scrollY);
    ctx.scale(zoom, zoom);
    for (const peer of peers) {
      if (peer.pointer) {
        const ptr = peer.pointer;
        ctx.fillStyle = peer.color;
        ctx.beginPath();
        ctx.arc(ptr.x, ptr.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '12px sans-serif';
        ctx.fillText(peer.name, ptr.x + 8, ptr.y + 8);
      }
    }
    ctx.restore();

  }, [elements, activeElement, appState.viewBackgroundColor, scrollX, scrollY, zoom, selectedIds, selectionBox, peers, tool]);

  const getSceneCoords = (e: MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left - scrollX) / zoom;
    const y = (e.clientY - rect.top - scrollY) / zoom;
    return { x, y };
  };

  const handleMouseDown = (e: MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getSceneCoords(e);

    if (tool === 'hand' || e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setStartPan({ x: e.clientX, y: e.clientY });
      return;
    }

    if (tool === 'eraser') {
      const hit = elements.slice().reverse().find(el => !el.isDeleted && hitTestElement(el, x, y));
      if (hit) {
        useStore.getState().updateElement(hit.id, { isDeleted: true });
        const next = useStore.getState().elements.find(e => e.id === hit.id)!;
        wsClient.sendElements([next]);
      }
      return;
    }

    if (tool === 'selection') {
      const selectedElements = elements.filter(el => selectedIds.includes(el.id) && !el.isDeleted);
      
      // Hit test handles first
      for (const el of selectedElements) {
        const handle = hitTestHandle(el, x, y);
        if (handle) {
          setIsResizing(handle);
          setActiveElement(el);
          return;
        }
      }

      // Hit test element bodies
      const hit = elements.slice().reverse().find(el => !el.isDeleted && hitTestElement(el, x, y));
      if (hit) {
        if (!selectedIds.includes(hit.id)) {
          setSelectedIds([hit.id]);
        }
        setIsTranslating(true);
        setActiveElement(hit); // Track for relative movement
      } else {
        setSelectedIds([]);
        setSelectionBox({ x, y, w: 0, h: 0 });
      }
      return;
    }

    const t = tool as string;
    if (t !== 'selection' && t !== 'eraser') {
      const allZs = elements.map(e => e.zIndex);
      const maxZ = allZs.length > 0 ? Math.max(...allZs) : 0;
      
      setIsDrawing(true);
      setActiveElement({
        id: nanoid(),
        type: tool,
        x,
        y,
        width: 0,
        height: 0,
        angle: 0,
        strokeColor: '#1e1e1e',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 2,
        strokeStyle: 'solid',
        roughness: 1,
        opacity: 100,
        seed: Math.floor(Math.random() * 2 ** 32),
        version: 1,
        versionNonce: Math.floor(Math.random() * 2 ** 32),
        updated: Date.now(),
        isDeleted: false,
        zIndex: maxZ + 1,
        points: tool === 'freedraw' ? [[0, 0]] : undefined,
      });
    }
  };

  const lastPointerSend = useRef(0);

  const handleMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getSceneCoords(e);
    
    // Throttle WS pointer send to <= 30/s (every ~33ms)
    const now = Date.now();
    if (now - lastPointerSend.current > 33) {
      wsClient.sendPointer(x, y, selectedIds);
      lastPointerSend.current = now;
    }

    if (isPanning) {
      setScrollX(s => s + (e.clientX - startPan.x));
      setScrollY(s => s + (e.clientY - startPan.y));
      setStartPan({ x: e.clientX, y: e.clientY });
      return;
    }

    if (tool === 'selection') {
      if (selectionBox) {
        setSelectionBox({ ...selectionBox, w: x - selectionBox.x, h: y - selectionBox.y });
        return;
      }
      if (isTranslating && activeElement) {
        // Full translation requires moving all selected elements by dx, dy relative to start
        // Will implement precise tracking later
      }
      if (isResizing && activeElement) {
        // Resize logic goes here
      }
    }

    if (isDrawing && activeElement) {
      if (activeElement.type === 'freedraw' && activeElement.points) {
        const nextPoints = [...activeElement.points, [x - activeElement.x, y - activeElement.y]] as [number, number][];
        setActiveElement({ ...activeElement, points: nextPoints });
      } else {
        setActiveElement({
          ...activeElement,
          width: x - activeElement.x,
          height: y - activeElement.y,
        });
      }
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (tool === 'selection') {
      if (selectionBox) {
        // Find elements in bounding box
        const { x, y, w, h } = selectionBox;
        const x1 = Math.min(x, x + w);
        const y1 = Math.min(y, y + h);
        const x2 = Math.max(x, x + w);
        const y2 = Math.max(y, y + h);

        const inside = elements.filter(el => {
          if (el.isDeleted) return false;
          // Simple bbox overlap test
          const ex1 = Math.min(el.x, el.x + el.width);
          const ey1 = Math.min(el.y, el.y + el.height);
          const ex2 = Math.max(el.x, el.x + el.width);
          const ey2 = Math.max(el.y, el.y + el.height);
          return !(x2 < ex1 || x1 > ex2 || y2 < ey1 || y1 > ey2);
        });
        setSelectedIds(inside.map(el => el.id));
        setSelectionBox(null);
      }
      setIsTranslating(false);
      setIsResizing(null);
      setActiveElement(null);
    }

    if (isDrawing && activeElement) {
      useStore.getState().setElements((prev) => {
        const next = [...prev, activeElement];
        wsClient.sendElements([activeElement]);
        return next;
      });
      setSelectedIds([activeElement.id]);
      setIsDrawing(false);
      setActiveElement(null);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100vw', height: '100vh', touchAction: 'none', cursor: tool === 'hand' || isPanning ? 'grab' : 'crosshair' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
};
