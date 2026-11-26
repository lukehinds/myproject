import { useStore } from './store';
import type { Element } from './types';

export const StylePanel = ({ activeElement }: { activeElement: Element | null }) => {
  const updateElement = useStore((state) => state.updateElement);

  if (!activeElement) return null;

  return (
    <div style={{ position: 'absolute', top: 60, left: 10, background: '#fff', padding: '16px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 10 }}>
      <h4>Style</h4>
      
      <label>
        Stroke Color
        <input type="color" value={activeElement.strokeColor} onChange={(e) => updateElement(activeElement.id, { strokeColor: e.target.value })} />
      </label>
      
      <label>
        Background Color
        <input type="color" value={activeElement.backgroundColor === 'transparent' ? '#ffffff' : activeElement.backgroundColor} onChange={(e) => updateElement(activeElement.id, { backgroundColor: e.target.value })} />
      </label>

      <label>
        Stroke Width
        <input type="range" min="1" max="10" value={activeElement.strokeWidth} onChange={(e) => updateElement(activeElement.id, { strokeWidth: parseInt(e.target.value) })} />
      </label>

      <label>
        Opacity
        <input type="range" min="0" max="100" value={activeElement.opacity} onChange={(e) => updateElement(activeElement.id, { opacity: parseInt(e.target.value) })} />
      </label>
      
      <label>
        Roughness
        <select value={activeElement.roughness} onChange={(e) => updateElement(activeElement.id, { roughness: parseFloat(e.target.value) })}>
          <option value="0">0 (Clean)</option>
          <option value="1">1 (Normal)</option>
          <option value="2">2 (Rough)</option>
        </select>
      </label>

      <label>
        Fill Style
        <select value={activeElement.fillStyle} onChange={(e) => updateElement(activeElement.id, { fillStyle: e.target.value as any })}>
          <option value="solid">Solid</option>
          <option value="hachure">Hachure</option>
          <option value="cross-hatch">Cross-hatch</option>
        </select>
      </label>

      <label>
        Stroke Style
        <select value={activeElement.strokeStyle} onChange={(e) => updateElement(activeElement.id, { strokeStyle: e.target.value as any })}>
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
        </select>
      </label>
    </div>
  );
};
