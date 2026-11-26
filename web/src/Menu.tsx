import { useStore } from './store';
import { serializeScene, deserializeScene } from './serialize';
import { exportToImage } from './exportUtils';
import { getSelectedElements, copySelectionToClipboard, pasteFromClipboard, deleteElements, duplicateElements, moveZOrder } from './actions';

export const Menu = () => {
  const elements = useStore((state) => state.elements);
  const appState = useStore((state) => state.appState);
  const setElements = useStore((state) => state.setElements);
  const setAppState = useStore((state) => state.setAppState);
  const undo = useStore((state) => state.undo);
  const redo = useStore((state) => state.redo);
  const selectedElements = getSelectedElements();

  const handleCopy = () => copySelectionToClipboard(selectedElements);
  const handlePaste = () => pasteFromClipboard();
  const handleDelete = () => deleteElements(selectedElements);
  const handleDuplicate = () => duplicateElements(selectedElements);
  const handleMoveFront = () => moveZOrder(selectedElements, 'front');
  const handleMoveBack = () => moveZOrder(selectedElements, 'back');

  const handleExportJSON = () => {
    const data = serializeScene({ elements, appState });
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scene.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPNG = () => {
    exportToImage({ elements, appState }, 'png');
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const scene = deserializeScene(ev.target?.result as string);
        setElements(scene.elements);
        setAppState(scene.appState);
      } catch (err) {
        console.error('Invalid JSON scene');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ position: 'absolute', top: 10, right: 10, background: '#fff', padding: '8px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', display: 'flex', gap: '8px', zIndex: 10, alignItems: 'center' }}>
      <button onClick={undo}>Undo</button>
      <button onClick={redo}>Redo</button>
      <div style={{ borderLeft: '1px solid #ccc', height: '24px' }} />
      <button onClick={handleCopy} disabled={selectedElements.length === 0}>Copy</button>
      <button onClick={handlePaste}>Paste</button>
      <button onClick={handleDuplicate} disabled={selectedElements.length === 0}>Duplicate</button>
      <button onClick={handleDelete} disabled={selectedElements.length === 0}>Delete</button>
      <div style={{ borderLeft: '1px solid #ccc', height: '24px' }} />
      <button onClick={handleMoveFront} disabled={selectedElements.length === 0}>Front</button>
      <button onClick={handleMoveBack} disabled={selectedElements.length === 0}>Back</button>
      <div style={{ borderLeft: '1px solid #ccc', height: '24px' }} />
      <button onClick={handleExportPNG}>Save .png</button>
      <button onClick={handleExportJSON}>Save .json</button>
      <label style={{ cursor: 'pointer', background: '#e0eaff', padding: '2px 8px', borderRadius: '4px', border: '1px solid #c0d0f0' }}>
        Load .json
        <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportJSON} />
      </label>
    </div>
  );
};
