import { Canvas } from './Canvas';
import { StylePanel } from './StylePanel';
import { Menu } from './Menu';
import { wsClient } from './ws';
import { useStore } from './store';
import { nanoid } from 'nanoid';
import { useEffect, useState } from 'react';
import type { ElementType } from './types';

type Tool = 'selection' | 'hand' | ElementType;

function App() {
  const [roomId] = useState<string>(() => {
    const hash = window.location.hash.slice(1);
    return hash || nanoid();
  });
  
  const [tool, setTool] = useState<Tool>('selection');
  const elements = useStore((state) => state.elements);
  const selectedElement = elements.find((e) => !e.isDeleted) || null;

  useEffect(() => {
    if (!window.location.hash.slice(1)) {
      window.location.hash = roomId;
    }
    wsClient.connect(roomId, 'Anonymous');

    return () => {
      wsClient.disconnect();
    };
  }, [roomId]);

  const tools: Tool[] = ['selection', 'hand', 'rectangle', 'diamond', 'ellipse', 'arrow', 'line', 'freedraw', 'text'];

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', gap: '8px', background: '#fff', padding: '8px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        {tools.map((t) => (
          <button
            key={t}
            onClick={() => setTool(t)}
            style={{
              padding: '8px 12px',
              background: tool === t ? '#e0eaff' : 'transparent',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: tool === t ? 'bold' : 'normal',
              textTransform: 'capitalize',
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, display: 'flex', gap: '8px' }}>
        <span style={{ background: '#fff', padding: '8px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          Room: {roomId}
        </span>
      </div>
      <Menu />
      <StylePanel activeElement={selectedElement} />
      <Canvas tool={tool} />
    </div>
  );
}

export default App;
