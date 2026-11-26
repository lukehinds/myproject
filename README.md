# Whiteboard

A web-based collaborative whiteboard and diagramming application inspired by
Excalidraw: an infinite canvas with hand-drawn-style shapes, real-time
multi-user rooms, and PNG/SVG/JSON export.

- `web/` — React + TypeScript + Vite client, canvas renderer
- `server/` — FastAPI WebSocket + REST server, JSON file persistence
- `docs/ARCHITECTURE.md` — data model, wire protocol and reconciliation rules

## Develop

```sh
just dev      # server on :8000, client on :5173
just test
just lint
```

Open http://127.0.0.1:5173/ and share the room URL to collaborate.
