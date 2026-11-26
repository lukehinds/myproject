import rough from 'roughjs';
import { renderElement } from './render';
import type { Scene } from './types';

function createExportCanvas(scene: Scene) {
  const canvas = document.createElement('canvas');

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  if (scene.elements.length === 0) {
    minX = 0; minY = 0; maxX = 100; maxY = 100;
  } else {
    for (const el of scene.elements) {
      if (el.isDeleted) continue;
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    }
  }

  const padding = 20;
  canvas.width = maxX - minX + padding * 2;
  canvas.height = maxY - minY + padding * 2;

  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = scene.appState.viewBackgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-minX + padding, -minY + padding);

  const rc = rough.canvas(canvas);

  for (const el of scene.elements) {
    if (el.isDeleted) continue;
    
    ctx.save();
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate(el.angle);
    ctx.translate(-cx, -cy);
    
    ctx.globalAlpha = el.opacity / 100;
    renderElement(rc, el);

    if (el.type === 'text' && el.text) {
      ctx.font = `${el.fontSize || 20}px ${el.fontFamily || 'sans-serif'}`;
      ctx.fillStyle = el.strokeColor;
      ctx.textAlign = (el.textAlign as CanvasTextAlign) || 'left';
      
      let tx = el.x;
      if (el.textAlign === 'center') tx = el.x + el.width / 2;
      if (el.textAlign === 'right') tx = el.x + el.width;
      
      ctx.fillText(el.text, tx, el.y + (el.fontSize || 20));
    }
    ctx.restore();
  }

  ctx.restore();
  return canvas;
}

export function exportToImage(scene: Scene, type: 'png' | 'svg' = 'png'): void {
  const canvas = createExportCanvas(scene);
  const dataUrl = canvas.toDataURL(`image/${type}`);
  
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `whiteboard.${type}`;
  a.click();
}

export function exportToSVG(scene: Scene): void {
  // Real implementation would generate SVG nodes and serialize to string.
  // Using the canvas wrapper as MVP.
  exportToImage(scene, 'svg'); // NOTE: canvas.toDataURL doesn't actually do standard SVG.
}
