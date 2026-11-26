import type { Element, Peer } from './types';
import { useStore } from './store';

class WhiteboardClient {
  private ws: WebSocket | null = null;
  private roomId: string | null = null;
  private isConnecting = false;
  private lastSyncedVersion: Record<string, number> = {};

  public peers: Peer[] = [];
  public onPeersChange?: (peers: Peer[]) => void;

  connect(roomId: string, name: string) {
    if (this.isConnecting || (this.ws && this.roomId === roomId)) return;
    this.isConnecting = true;
    this.roomId = roomId;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.ws = new WebSocket(`${protocol}//${host}/ws/rooms/${roomId}?name=${encodeURIComponent(name)}`);

    this.ws.onopen = () => {
      this.isConnecting = false;
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (e) {
        console.error('Invalid WS message', e);
      }
    };

    this.ws.onclose = () => {
      this.isConnecting = false;
      this.ws = null;
      // Reconnect logic could be added here
    };
  }

  private handleMessage(data: any) {
    switch (data.type) {
      case 'init': {
        this.peers = data.users || [];
        this.onPeersChange?.(this.peers);
        if (data.scene?.elements) {
          useStore.getState().reconcile(data.scene.elements);
        }
        break;
      }
      case 'elements': {
        if (data.elements) {
          useStore.getState().reconcile(data.elements);
        }
        break;
      }
      case 'presence': {
        this.peers = data.users || [];
        this.onPeersChange?.(this.peers);
        break;
      }
      case 'pointer': {
        // Handle remote pointer (not persistent in store, use ephemeral state)
        break;
      }
      case 'error': {
        console.error('Server error:', data.message);
        break;
      }
    }
  }

  sendElements(elements: Element[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const toSend = elements.filter(el => {
      const lastV = this.lastSyncedVersion[el.id];
      if (lastV === undefined || el.version > lastV) {
        return true;
      }
      return false;
    });

    if (toSend.length > 0) {
      this.ws.send(JSON.stringify({ type: 'elements', elements: toSend }));
      for (const el of toSend) {
        this.lastSyncedVersion[el.id] = el.version;
      }
    }
  }

  sendPointer(x: number, y: number, selectedIds: string[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'pointer', x, y, selectedIds }));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const wsClient = new WhiteboardClient();
