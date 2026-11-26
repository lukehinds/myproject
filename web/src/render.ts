import rough from 'roughjs';
import type { Element } from './types';

export function renderElement(rc: ReturnType<typeof rough.canvas>, el: Element) {
  const options = {
    stroke: el.strokeColor,
    fill: el.backgroundColor !== 'transparent' ? el.backgroundColor : undefined,
    fillStyle: el.fillStyle,
    strokeWidth: el.strokeWidth,
    roughness: el.roughness,
    seed: el.seed,
    strokeLineDash: el.strokeStyle === 'dashed' ? [8, 8] : el.strokeStyle === 'dotted' ? [2, 4] : undefined,
  };

  switch (el.type) {
    case 'rectangle':
      rc.rectangle(el.x, el.y, el.width, el.height, options);
      break;
    case 'diamond': {
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      rc.polygon([
        [cx, el.y],
        [el.x + el.width, cy],
        [cx, el.y + el.height],
        [el.x, cy],
      ], options);
      break;
    }
    case 'ellipse':
      rc.ellipse(el.x + el.width / 2, el.y + el.height / 2, el.width, el.height, options);
      break;
    case 'line':
    case 'arrow':
      if (el.points && el.points.length >= 2) {
        const [x1, y1] = el.points[0];
        const [x2, y2] = el.points[1];
        rc.line(el.x + x1, el.y + y1, el.x + x2, el.y + y2, options);
        // Arrow head logic omitted for brevity in MVP
      }
      break;
    case 'freedraw':
      if (el.points && el.points.length > 1) {
        rc.linearPath(el.points.map(p => [el.x + p[0], el.y + p[1]]), options);
      }
      break;
    case 'text':
      // Text is usually rendered via native canvas 2D context instead of rough.js
      // We will handle it outside roughjs or pass it through
      break;
  }
}
